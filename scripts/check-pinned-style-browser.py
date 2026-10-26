"""Verify the persistent style/Pattern Card sidebar without publishing working data.

Build tech-pack.html first. Uses isolated Chromium contexts and a loopback server.
Only pristine blank previews and non-identifying evidence are saved; downloads,
synthetic values, image uploads and filled PDFs remain temporary or in memory.
"""
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from threading import Thread
import argparse
import base64
import hashlib
import json
import subprocess
import traceback

from PIL import Image
from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = json.loads((ROOT / 'data/templates/tech-pack-workbook.v1.json').read_text())
VIEWPORTS = [('desktop', 1500, 1000), ('laptop', 1280, 720), ('mobile', 390, 844),
             ('narrow-phone', 320, 568), ('short-phone', 320, 480), ('landscape', 844, 390)]
DATABASE = 'serpentis-regina.workroom.v2'
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=Path('/workspace/work/pinned-sidebar/validation'))
parser.add_argument('--layout-only', action='store_true')
parser.add_argument('--workflow-only', action='store_true')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {'checkedAtUtc': datetime.now(timezone.utc).isoformat(),
          'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
          'buildSha256': hashlib.sha256((ROOT / 'tech-pack.html').read_bytes()).hexdigest(),
          'layouts': [], 'checks': {}, 'issues': [],
          'limits': ['Automated Chromium viewports are not a physical iPhone/native keyboard test.'],
          'privacy': 'Only pristine blank-template screenshots are saved. Synthetic projects, images, JSON and filled PDFs remain temporary.'}
BASE_URL = ''


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/':
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write((ROOT / 'tech-pack.html').read_bytes())

    def log_message(self, *_args):
        pass


def require(value, message):
    if not value:
        raise AssertionError(message)


def wait_ready(page):
    page.wait_for_function("() => document.body.dataset.workroomReady === 'true'", timeout=15000)
    page.evaluate('document.fonts.ready')


def open_page(browser, width=1500, height=1000):
    context = browser.new_context(viewport={'width': width, 'height': height}, accept_downloads=True)
    context.add_init_script('''const read=FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL=function(file){if(window.__pinnedSlowRead)setTimeout(()=>read.call(this,file),800);else read.call(this,file);};''')
    page = context.new_page()
    errors, external = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: external.append(request.url)
            if request.url.startswith(('http:', 'https:')) and request.url != BASE_URL else None)
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE_URL)
    wait_ready(page)
    require(not errors and not external, 'Boot produced a runtime error or external request.')
    return context, page, errors, external


def open_context(page):
    if page.locator('#context-panel').evaluate('(el)=>el.hidden'):
        page.locator('#toggle-style-panel').click()
    if not page.locator('#context-panel').evaluate('(el)=>el.open'):
        page.locator('#context-panel > summary .context-panel-heading').click()


def compact_context(page):
    if page.viewport_size['width'] <= 740 and page.locator('#context-panel').evaluate('(el)=>el.open'):
        page.locator('#context-panel > summary .context-panel-heading').click()


def select_sheet(page, sheet_id):
    compact_context(page)
    page.locator('#tab-' + sheet_id).click()
    require(page.locator('#tab-' + sheet_id).get_attribute('aria-selected') == 'true', 'Wrong active sheet: ' + sheet_id)


def open_for(page, selector):
    target = page.locator(selector)
    if target.evaluate('(el)=>!!el.closest("#context-panel")'):
        open_context(page)
    target.evaluate("el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true}")
    return target


def field(page, key, sidebar=True):
    return page.locator(('#pinned-pattern-content' if sidebar else '#sheet-content') + f' [data-field="{key}"]')


def cell(page, table, row, column, sidebar=True):
    return page.locator(('#pinned-pattern-content' if sidebar else '#sheet-content') + f' [data-table="{table}"][data-row="{row}"][data-col="{column}"]')


def export_pack(page):
    page.locator('#export-menu-toggle').click()
    with page.expect_download() as pending:
        page.locator('#export-json').click()
    download = pending.value
    pack = json.loads(Path(download.path()).read_text())
    download.delete()
    page.keyboard.press('Escape')
    return pack


def db_records(page, stores=('drafts', 'revisions')):
    return page.evaluate('''async ({database,stores})=>{
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(database);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      try{return Object.fromEntries(await Promise.all(stores.map(name=>new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve([name,r.result]);r.onerror=()=>reject(r.error);}))))}finally{db.close();}
    }''', {'database': DATABASE, 'stores': list(stores)})


def wait_saved(page, pack_id, path, expected):
    for _ in range(150):
        row = next((r for r in db_records(page, ('drafts',))['drafts'] if r['id'] == pack_id), None)
        value = row.get('snapshot') if row else None
        for key in path:
            value = value.get(key) if isinstance(value, dict) else None
        if value == expected:
            return
        page.wait_for_timeout(100)
    raise AssertionError('Expected sidebar value did not autosave: ' + '.'.join(path))


def pristine(page):
    require(page.locator('#pack-title').input_value() == 'Untitled tech pack', 'Refusing filled title capture.')
    require(page.locator('#saved-packs option').count() == 1, 'Refusing saved-name capture.')
    require(page.locator('[data-style-key]').evaluate_all('els=>els.every(e=>!e.value)'), 'Refusing filled shared style capture.')
    require(page.locator('#sheet-content input,#sheet-content textarea,#pinned-pattern-content input,#pinned-pattern-content textarea').evaluate_all('els=>els.every(e=>!e.value)'), 'Refusing filled worksheet/sidebar capture.')
    require(page.locator('#sheet-content .attachment-card img,#pinned-pattern-content .attachment-card img').count() == 0, 'Refusing uploaded style image capture.')
    require(page.locator('#style-reference-caption').inner_text() == 'Example reference · SR-FORM-001', 'Refusing private reference capture.')
    require(page.locator('#revision-name,#revision-author,#revision-reason').evaluate_all('els=>els.every(e=>!e.value)'), 'Refusing unfinished named-revision capture.')


def capture(page, name):
    pristine(page)
    page.screenshot(path=str(args.output / name))
    return name


def photo_hashes(page):
    return page.locator('#style-reference-images img').evaluate_all('els=>els.map(e=>({src:e.src,loaded:e.complete&&e.naturalWidth>0}))')


def check_layouts(browser):
    for name, width, height in VIEWPORTS:
        context, page, errors, external = open_page(browser, width, height)
        try:
            photo_source = photo_hashes(page)
            require(len(photo_source) == 2 and all(p['loaded'] for p in photo_source), 'Original example photos failed to load.')
            for image, view in zip(photo_source, ['front', 'back']):
                original = (ROOT / f'assets/house-sheet/mannequin-{view}.jpg').read_bytes()
                require(base64.b64decode(image['src'].split(',', 1)[1]) == original, 'Pinned original photograph bytes changed.')
            page.evaluate("window.__pinnedRoot=document.querySelector('#pinned-pattern-content .sheet-editor');window.__pinnedStyle=document.querySelector('[data-style-key=number]');")
            for sheet in TEMPLATE['sheets']:
                select_sheet(page, sheet['id'])
                geometry = page.evaluate('''()=>{const r=selector=>{const e=document.querySelector(selector),b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,content:r('#sheet-content'),sidebar:r('#context-panel'),photos:r('#style-reference-images'),controls:[...document.querySelectorAll('.footer-actions>button')].map(e=>({id:e.id,...e.getBoundingClientRect().toJSON()})),sameEditor:window.__pinnedRoot===document.querySelector('#pinned-pattern-content .sheet-editor'),sameSharedField:window.__pinnedStyle===document.querySelector('[data-style-key=number]')};}''')
                require(geometry['documentWidth'] <= width + 1 and geometry['documentHeight'] <= height + 1, f'{name}/{sheet["id"]}: root overflow.')
                require(geometry['content']['height'] >= 44, f'{name}/{sheet["id"]}: worksheet has less than one usable control.')
                require(geometry['photos']['height'] >= 40 and geometry['sidebar']['height'] >= 40, 'Pinned reference disappears on tab change.')
                require(geometry['sameEditor'] and geometry['sameSharedField'], 'Tab change remounted the pinned editor or shared record.')
                require(photo_hashes(page) == photo_source, 'Tab change replaced the pinned original photos.')
                require(len(geometry['controls']) == 5, 'A primary action is missing.')
                for control in geometry['controls']:
                    require(control['x'] >= -1 and control['right'] <= width + 1 and control['bottom'] <= height + 1, name + ': primary action is offscreen: ' + control['id'])
                    require(control['height'] >= 43.5, 'A primary control is below44px: ' + control['id'])
                report['layouts'].append({'viewport': name, 'sheet': sheet['id'], **geometry})
            select_sheet(page, 'master')
            before = page.locator('#sheet-content').bounding_box()
            page.locator('#toggle-style-panel').click()
            require(page.locator('#context-panel').is_hidden(), 'Hide style did not hide the entire reference panel.')
            require(page.locator('#toggle-style-panel').get_attribute('aria-expanded') == 'false', 'Hidden state is not exposed to assistive technology.')
            after = page.locator('#sheet-content').bounding_box()
            if width > 740:
                require(after['width'] > before['width'] + 200, 'Hiding style did not return sidebar space to the worksheet.')
            else:
                require(after['height'] > before['height'] + 40, 'Hiding compact style did not return space to the phone worksheet.')
            if name in ['desktop', 'mobile']:
                capture(page, f'pinned-style-{name}-hidden.png')
            page.locator('#toggle-style-panel').click()
            require(not page.locator('#context-panel').is_hidden(), 'Show style did not restore the panel.')
            if name in ['desktop', 'mobile', 'narrow-phone', 'landscape']:
                capture(page, f'pinned-style-{name}.png')
            open_context(page)
            require(page.locator('.context-body').evaluate('(e)=>e.clientHeight') >= 44, name + ': expanded style editor has no scroll space.')
            if name == 'mobile':
                capture(page, 'pinned-style-mobile-expanded.png')
            compact_context(page)
            require(not errors and not external, 'Pinned layout produced runtime errors or external fetches.')
            print(name + ': six pinned layouts passed', flush=True)
        finally:
            context.close()
    report['checks']['originalImageBytesAndMountedEditorsAcrossTabs'] = True
    report['checks']['hideShowReclaimsWorksheetSpaceAndPrimaryControlsRemainVisible'] = True


def raster(width=2, height=2):
    image = BytesIO()
    Image.new('RGB', (width, height), (16, 24, 32)).save(image, format='PNG')
    return image.getvalue()


def paste(page, target, text):
    target.evaluate('''(el,text)=>{const data=new DataTransfer();data.setData('text/plain',text);el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));}''', text)
    page.locator('#paste-dialog').wait_for(state='visible')


def check_workflow(browser):
    context, page, errors, external = open_page(browser)
    try:
        open_context(page)
        page.locator('[data-style-key=number]').fill('SYNTHETIC PINNED STYLE')
        page.locator('[data-style-key=description]').fill('Temporary isolated sidebar workflow')
        page.locator('#style-unit').select_option('cm')
        open_for(page, '#revision-name').fill('Unfinished local note')
        open_for(page, '#pinned-pattern-content [data-field=marker]').fill('Temporary marker release')
        body_before = page.locator('.context-body').evaluate('(e)=>{e.scrollTop=80;return e.scrollTop}')
        page.evaluate("window.__pinnedNode=document.getElementById('pinned-pattern-content').firstElementChild")
        for sheet in TEMPLATE['sheets']:
            select_sheet(page, sheet['id'])
            require(page.locator('#revision-name').input_value() == 'Unfinished local note', 'Tab change discarded unfinished named revision details.')
            require(field(page, 'marker').input_value() == 'Temporary marker release', 'Tab change lost pinned Pattern Card metadata.')
            require(page.evaluate("window.__pinnedNode===document.getElementById('pinned-pattern-content').firstElementChild"), 'Tab change rebuilt lower pinned content.')
            require(abs(page.locator('.context-body').evaluate('(e)=>e.scrollTop') - body_before) <= 1, 'Tab change reset the independent sidebar scroll.')
        page.locator('#revision-name').fill('')
        report['checks']['tabChangesPreserveLowerDomScrollFieldsAndUnfinishedRevision'] = True

        select_sheet(page, 'wash')
        open_for(page, '#pinned-pattern-content [data-field=style]').fill('PATTERN-OVERRIDE')
        open_for(page, '#pinned-pattern-content [data-table=pieces][data-row="1"][data-col=qty]').fill('2')
        cell(page, 'pieces', '1', 'piece').fill('Synthetic front panel')
        snapshot = export_pack(page)
        pack_id = snapshot['id']
        require(snapshot['fields']['pattern']['style'] == 'PATTERN-OVERRIDE' and snapshot['fields']['wash']['style'] == '', 'Pinned metadata was written to the active wash sheet.')
        require(snapshot['tables']['pattern']['pieces']['1']['qty'] == 2, 'Pinned quantity was not stored as a number.')
        select_sheet(page, 'fit')
        require(page.locator('#sheet-content [data-derived-field=style]').inner_text() == 'PATTERN-OVERRIDE', 'Fit style did not follow the pinned Pattern Card.')
        open_for(page, '#pinned-pattern-content [data-field=style]').fill('PATTERN-LINK-LIVE')
        require(page.locator('#sheet-content [data-derived-field=style]').inner_text() == 'PATTERN-LINK-LIVE', 'Editing pinned style did not immediately update the active Fit output.')
        page.locator('#pinned-pattern-content [data-use-shared=style]').click()
        require(page.locator('#sheet-content [data-derived-field=style]').inner_text() == 'SYNTHETIC PINNED STYLE', 'Use shared did not immediately refresh the linked Fit style.')
        field(page, 'style').fill('PATTERN-OVERRIDE')
        report['checks']['pinnedPatternStyleImmediatelyRefreshesActiveFitLink'] = True
        select_sheet(page, 'pattern')
        require(field(page, 'style', False).input_value() == 'PATTERN-OVERRIDE', 'Sidebar metadata failed to mirror into the main Pattern Card.')
        require(cell(page, 'pieces', '1', 'piece', False).input_value() == 'Synthetic front panel', 'Sidebar table text failed to mirror.')
        open_for(page, '#sheet-content [data-field=style]').fill('PATTERN-MAIN-EDIT')
        cell(page, 'pieces', '1', 'qty', False).fill('3')
        require(field(page, 'style').input_value() == 'PATTERN-MAIN-EDIT' and cell(page, 'pieces', '1', 'qty').input_value() == '3', 'Main edits failed to mirror back into the pinned Pattern Card.')
        wait_saved(page, pack_id, ['tables', 'pattern', 'pieces', '1', 'qty'], 3)
        report['checks']['samePackMetadataAndTablesMirrorBothDirectionsAcrossActiveSheets'] = True

        # A hidden invalid sidebar value must still prevent save and update.
        select_sheet(page, 'body')
        invalid = open_for(page, '#pinned-pattern-content [data-table=pieces][data-row="1"][data-col=qty]')
        invalid.fill('-1')
        require(not invalid.evaluate('(e)=>e.checkValidity()'), 'Negative quantity must be rejected.')
        page.locator('#toggle-style-panel').click()
        require(page.locator('#context-panel').is_hidden(), 'Panel did not hide during an invalid in-progress edit.')
        page.locator('#save-pack').click()
        page.wait_for_function('()=>!document.getElementById("context-panel").hidden')
        require(invalid.input_value() == '-1', 'Save erased the hidden invalid sidebar input.')
        page.locator('#toggle-style-panel').click()
        bridge = page.evaluate('async()=>await window.WORKROOM_UPDATES.prepare()')
        require(not bridge['ready'], 'Hidden invalid sidebar input was admitted by the update bridge.')
        require(not page.locator('#context-panel').is_hidden() and invalid.is_visible(), 'Validation did not reveal every hidden sidebar ancestor.')
        require(invalid.input_value() == '-1', 'Validation erased the invalid in-progress value.')
        require(invalid.evaluate('(e)=>document.activeElement===e'), 'Validation did not focus the invalid sidebar input.')
        invalid.fill('3')
        open_for(page, '#pinned-pattern-content [data-field=date]').fill('2026-10-26')
        select_sheet(page, 'pattern')
        open_for(page, '#pinned-pattern-content [data-table=pieces][data-row="1"][data-col=qty]').fill('-1')
        open_for(page, '#sheet-content [data-table=pieces][data-row="1"][data-col=qty]').fill('-2')
        require(page.locator('[aria-invalid=true]').count() >= 2 and page.locator('[aria-invalid=true]').evaluate_all('els=>new Set(els.map(e=>e.id)).size===els.length'), 'Mirrored editors generated duplicate invalid IDs.')
        cell(page, 'pieces', '1', 'qty', False).fill('3')
        report['checks']['hiddenInvalidSidebarBlocksUpdateRevealsAncestorsAndRetainsInput'] = True

        select_sheet(page, 'body')
        before_body = export_pack(page)['tables']['body']
        target = open_for(page, '#pinned-pattern-content [data-table=pieces][data-row="1"][data-col=qty]')
        paste(page, target, '4\tSynthetic pocket\n6\tSynthetic back panel')
        require(page.locator('#apply-paste').is_enabled(), 'Sidebar paste was rejected while another sheet was active.')
        page.locator('#apply-paste').click()
        pasted = export_pack(page)
        require(pasted['tables']['pattern']['pieces']['1']['qty'] == 4 and pasted['tables']['pattern']['pieces']['2']['qty'] == 6, 'Sidebar paste targeted another sheet or column.')
        require(pasted['tables']['body'] == before_body, 'Sidebar paste modified approved-reference note values.')
        page.locator('#undo-edit').click()
        require(cell(page, 'pieces', '1', 'qty').input_value() == '3', 'Undo did not restore the pre-paste Pattern Card.')
        page.locator('#redo-edit').click()
        require(cell(page, 'pieces', '1', 'qty').input_value() == '4', 'Redo did not restore the sidebar paste.')
        report['checks']['sidebarPasteUsesItsOwnSheetAndUndoRedoPreserveOtherSheets'] = True

        wait_saved(page, pack_id, ['tables', 'pattern', 'pieces', '1', 'qty'], 4)
        stable = export_pack(page)
        page.locator('#toggle-style-panel').click()
        require(export_pack(page) == stable, 'Hiding the sidebar changed pack values, timestamps or identity.')
        page.reload()
        wait_ready(page)
        require(page.locator('#context-panel').is_hidden(), 'Hidden view preference was not retained after reopening.')
        page.locator('#toggle-style-panel').click()
        require(field(page, 'style').input_value() == 'PATTERN-MAIN-EDIT', 'Reload did not recover pinned Pattern Card metadata.')
        require(cell(page, 'pieces', '1', 'qty').input_value() == '4', 'Reload did not recover sidebar paste.')
        report['checks']['hidePreferenceIsViewOnlyAndAutosavedPackReopens'] = True

        # Original raster files stay local; pending sidebar file work blocks updates.
        select_sheet(page, 'wash')
        upload = open_for(page, '#pinned-pattern-content [data-attachment=reference]')
        page.evaluate('window.__pinnedSlowRead=true')
        upload.set_input_files({'name': 'synthetic-sidebar.png', 'mimeType': 'image/png', 'buffer': raster()})
        bridge = page.evaluate('async()=>await window.WORKROOM_UPDATES.prepare()')
        require(not bridge['ready'] and 'operation' in bridge['message'], 'Pending sidebar file read did not block an app update.')
        page.wait_for_function('()=>document.querySelector("#style-reference-images img")?.naturalWidth===2')
        page.evaluate('window.__pinnedSlowRead=false')
        require(page.locator('#style-reference-images img').count() == 1 and 'pattern reference' in page.locator('#style-reference-caption').inner_text(), 'Current pattern image did not replace the example reference.')
        require(export_pack(page)['attachments']['pattern']['reference']['name'] == 'synthetic-sidebar.png', 'Sidebar uploaded image was written to the active sheet.')
        before_open = page.locator('#context-panel').evaluate('(e)=>e.open')
        page.locator('[data-sidebar-image=reference]').click()
        require(page.locator('#image-dialog').is_visible() and page.locator('#large-image').evaluate('(e)=>e.naturalWidth') == 2, 'Pinned reference did not enlarge.')
        page.keyboard.press('Escape')
        require(page.locator('#context-panel').evaluate('(e)=>e.open') == before_open, 'Photo enlargement toggled native sidebar details.')
        report['checks']['sidebarImageUploadsStayLocalAndPendingFileBlocksUpdate'] = True
        report['checks']['enlargingPinnedReferenceKeepsPanelState'] = True

        select_sheet(page, 'master')
        base = page.locator('#sheet-content [data-table=specs][data-row="1"][data-col=base]')
        base.fill('invalid master entry')
        page.evaluate("""window.__masterInvalidNode=document.querySelector('#sheet-content [data-table=specs][data-row="1"][data-col=base]')""")
        open_for(page, '#pinned-pattern-content [data-attachment=reference]').set_input_files({'name':'synthetic-sidebar-replacement.png','mimeType':'image/png','buffer':raster(2,4)})
        page.wait_for_function('()=>document.querySelector("#style-reference-images img")?.naturalHeight===4')
        require(base.input_value() == 'invalid master entry' and not base.evaluate('(e)=>e.checkValidity()'), 'Sidebar upload erased a different worksheet’s invalid in-progress entry.')
        require(page.evaluate("""window.__masterInvalidNode===document.querySelector('#sheet-content [data-table=specs][data-row="1"][data-col=base]')"""), 'Sidebar upload remounted the active invalid measurement.')
        bridge = page.evaluate('async()=>await window.WORKROOM_UPDATES.prepare()')
        require(not bridge['ready'], 'Image refresh allowed an update despite an invalid main worksheet input.')
        base.fill('20')
        quantity = open_for(page, '#pinned-pattern-content [data-table=pieces][data-row="1"][data-col=qty]')
        quantity.fill('-3')
        page.evaluate("""window.__sidebarInvalidNode=document.querySelector('#pinned-pattern-content [data-table=pieces][data-row="1"][data-col=qty]')""")
        open_for(page, '#sheet-content [data-attachment=front]').set_input_files({'name':'synthetic-front.png','mimeType':'image/png','buffer':raster(2,3)})
        page.wait_for_function('()=>document.querySelector("#style-reference-images img")?.naturalHeight===3')
        require(quantity.input_value() == '-3' and not quantity.evaluate('(e)=>e.checkValidity()'), 'Master image upload erased invalid sidebar quantity.')
        require(page.evaluate("""window.__sidebarInvalidNode===document.querySelector('#pinned-pattern-content [data-table=pieces][data-row="1"][data-col=qty]')"""), 'Master image upload remounted invalid sidebar table.')
        page.locator('#sheet-content [data-remove=front]').click()
        require(quantity.input_value() == '-3' and not quantity.evaluate('(e)=>e.checkValidity()'), 'Removing a style image erased invalid sidebar quantity.')
        bridge = page.evaluate('async()=>await window.WORKROOM_UPDATES.prepare()')
        require(not bridge['ready'], 'Image removal allowed an update despite invalid sidebar quantity.')
        quantity.fill('4')
        report['checks']['imageUploadAndRemovalPreserveUnrelatedInvalidEditorsAndUpdateGuards'] = True
        open_for(page, '#sheet-content [data-attachment=front]').set_input_files({'name':'synthetic-front.png','mimeType':'image/png','buffer':raster(2,3)})
        page.wait_for_function('()=>document.querySelector("#style-reference-images img")?.naturalHeight===3')
        open_for(page, '#sheet-content [data-attachment=back]').set_input_files({'name':'synthetic-back.png','mimeType':'image/png','buffer':raster(3,2)})
        page.wait_for_function('()=>document.querySelectorAll("#style-reference-images img").length===2')
        require('front/back' in page.locator('#style-reference-caption').inner_text(), 'Current front/back references did not take precedence.')
        select_sheet(page, 'wash')
        require(page.locator('#style-reference-images img').evaluate_all('els=>els.length===2&&els[0].naturalHeight===3&&els[1].naturalWidth===3'), 'Current style photos changed on a worksheet switch.')
        report['checks']['currentFrontBackReferencesStayPinnedAcrossTabs'] = True

        open_context(page)
        open_for(page, '#revision-name').fill('Synthetic sidebar snapshot')
        page.locator('#revision-author').fill('Synthetic reviewer')
        page.locator('#create-revision').click()
        page.wait_for_function('()=>document.querySelectorAll("#revision-list option").length>1')
        revision_id = page.locator('#revision-list').input_value()
        open_for(page, '#pinned-pattern-content [data-table=pieces][data-row="1"][data-col=qty]').fill('8')
        wait_saved(page, pack_id, ['tables', 'pattern', 'pieces', '1', 'qty'], 8)
        page.locator('#revision-list').select_option(revision_id)
        page.locator('#restore-revision').click()
        page.locator('#confirm-restore').click()
        page.wait_for_function('()=>document.querySelector("#pinned-pattern-content [data-table=pieces][data-row=\\"1\\"][data-col=qty]")?.value==="4"')
        require(cell(page, 'pieces', '1', 'qty').input_value() == '4', 'Restoring a named revision did not update the sidebar.')
        require(len(db_records(page)['revisions']) >= 2, 'Restore did not preserve a backup revision.')
        report['checks']['namedRevisionRestoreRefreshesPinnedViewsAndPreservesBackup'] = True

        current = export_pack(page)
        current['id'] = 'synthetic-pinned-import-copy'
        current['fields']['pattern']['marker'] = 'Imported synthetic marker'
        page.locator('#export-menu-toggle').click()
        page.locator('#json-file').set_input_files({'name':'synthetic-pinned.json','mimeType':'application/json','buffer':json.dumps(current).encode()})
        page.wait_for_function('()=>document.querySelector("#pinned-pattern-content [data-field=marker]")?.value==="Imported synthetic marker"')
        require(photo_hashes(page)[0]['loaded'], 'Import did not refresh loaded pinned images.')
        require(export_pack(page)['fields']['pattern']['marker'] == 'Imported synthetic marker', 'Import changed the sidebar field meaning.')
        report['checks']['compatibleJsonTransferRestoresPinnedValuesAndImages'] = True

        select_sheet(page, 'master')
        before = export_pack(page)
        sidebar_state = page.locator('#context-panel').evaluate('(e)=>({hidden:e.hidden,open:e.open})')
        page.evaluate('window.print=()=>{}')
        page.locator('#export-menu-toggle').click()
        page.locator('#print-scope').select_option('all')
        page.locator('#print-pack').click()
        require(page.locator('#print-view tbody tr').count() == 190, 'Pinned tables duplicated or disappeared in complete printing.')
        require(page.locator('#print-view #pinned-pattern-content,#print-view #context-panel').count() == 0, 'Pinned screen-only panel leaked into print.')
        pdf = page.pdf(print_background=True, prefer_css_page_size=True)
        require(len(PdfReader(BytesIO(pdf)).pages) >= 6, 'Complete six-tab PDF failed.')
        require(export_pack(page) == before and page.locator('#context-panel').evaluate('(e)=>({hidden:e.hidden,open:e.open})') == sidebar_state, 'Printing modified pack or sidebar state.')
        report['checks']['completePrintHas190SourceRowsWithoutSidebarDuplication'] = True
        require(not errors and not external, 'Sidebar workflow caused runtime errors or external requests.')
        report['checks']['noRuntimeErrorsOrExternalRequests'] = True
    finally:
        context.close()


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
BASE_URL = f'http://127.0.0.1:{server.server_port}/'
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            if not args.workflow_only:
                check_layouts(browser)
            if not args.layout_only:
                check_workflow(browser)
        except Exception as error:
            report['issues'].append(type(error).__name__ + ': ' + str(error))
            traceback.print_exc()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
report['passed'] = not report['issues']
report['screenshots'] = [{'filename': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(args.output.glob('pinned-style-*.png'))]
(args.output / 'pinned-style-browser.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'layouts':len(report['layouts']),'checks':len(report['checks']),'issues':report['issues']}, indent=2))
raise SystemExit(0 if report['passed'] else 1)
