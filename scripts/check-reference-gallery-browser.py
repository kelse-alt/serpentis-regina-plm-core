"""Exercise the reference gallery in isolated browser contexts.

Build tech-pack.html first. Only generated, non-identifying rasters and temporary
downloads are used. The report contains check results, never working pack data,
uploaded image bytes, filled screenshots, or revision names.
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

ROOT = Path(__file__).resolve().parents[1]
DATABASE = 'serpentis-regina.workroom.v2'
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'reports/reference-gallery-checks')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {
    'checkedAtUtc': datetime.now(timezone.utc).isoformat(),
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'buildSha256': hashlib.sha256((ROOT / 'tech-pack.html').read_bytes()).hexdigest(),
    'checks': {}, 'issues': [],
    'privacy': 'Generated rasters, working packs, downloads and revisions remain in isolated temporary browser contexts. No filled screenshots or image data are saved.',
    'limits': ['Chromium phone viewports do not establish physical iPhone or native picker behavior.'],
}
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


def raster(width, height, color):
    output = BytesIO()
    Image.new('RGB', (width, height), color).save(output, format='PNG')
    return output.getvalue()


def image_file(name, width=30, height=60, color=(16, 24, 32)):
    return {'name': name, 'mimeType': 'image/png', 'buffer': raster(width, height, color)}


FIRST = image_file('synthetic-reference-a.png')
SECOND = image_file('synthetic-reference-b.png', 60, 30, (146, 152, 157))
THIRD = image_file('synthetic-reference-c.png', 40, 50, (41, 50, 57))


def wait_ready(page):
    page.wait_for_function("() => document.body.dataset.workroomReady === 'true'", timeout=15000)
    page.evaluate('document.fonts.ready')


def open_page(browser, width=1500, height=1000):
    context = browser.new_context(viewport={'width': width, 'height': height}, accept_downloads=True)
    context.add_init_script('''const read=FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL=function(file){if(window.__gallerySlowRead)setTimeout(()=>read.call(this,file),900);else read.call(this,file);};''')
    page = context.new_page()
    errors, external = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: external.append(request.url)
            if request.url.startswith(('http:', 'https:')) and request.url != BASE_URL else None)
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE_URL)
    wait_ready(page)
    require(not errors and not external, 'Boot produced runtime errors or external requests.')
    return context, page, errors, external


def open_for(page, selector):
    target = page.locator(selector)
    if target.evaluate('(el)=>!!el.closest("#context-panel")'):
        if page.locator('#context-panel').evaluate('(el)=>el.hidden'):
            page.locator('#toggle-style-panel').click()
        if not page.locator('#context-panel').evaluate('(el)=>el.open'):
            page.locator('#context-panel > summary .context-panel-heading').click()
    target.evaluate("el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true}")
    return target


def select_sheet(page, sheet):
    if page.viewport_size['width'] <= 740 and page.locator('#context-panel').evaluate('(el)=>el.open'):
        page.locator('#context-panel > summary .context-panel-heading').click()
    page.locator('#tab-' + sheet).click()
    require(page.locator('#tab-' + sheet).get_attribute('aria-selected') == 'true', 'Wrong active worksheet.')


def upload(page, files, sidebar=True):
    root = '#pinned-pattern-content' if sidebar else '#sheet-content'
    target = open_for(page, root + ' [data-attachment=reference]')
    require(target.evaluate('(el)=>el.multiple'), 'Pattern reference picker does not allow multiple files.')
    target.set_input_files(files)
    page.wait_for_function("selector=>!document.querySelector(selector)?.value", arg=root + ' [data-attachment=reference]')


def export_pack(page):
    page.locator('#export-menu-toggle').click()
    with page.expect_download() as pending:
        page.locator('#export-json').click()
    download = pending.value
    snapshot = json.loads(Path(download.path()).read_text())
    download.delete()
    page.keyboard.press('Escape')
    return snapshot


def import_pack(page, snapshot):
    page.locator('#export-menu-toggle').click()
    page.locator('#json-file').set_input_files({'name': 'synthetic-gallery.json',
        'mimeType': 'application/json', 'buffer': json.dumps(snapshot).encode()})
    page.wait_for_function('id=>document.querySelector("#saved-packs")?.value===id', arg=snapshot['id'])
    page.wait_for_function('()=>!document.querySelector("#export-dialog").open')


def reference(snapshot):
    value = snapshot['attachments']['pattern']['reference']
    if value is None:
        return [], None
    if 'images' in value:
        return value['images'], value['images'][value['selectedIndex']]
    return [value], value


def assert_gallery(snapshot, names, selected_name):
    images, selected = reference(snapshot)
    require([image['name'] for image in images] == names, 'Gallery changed the image order or lost an original.')
    require((selected['name'] if selected else None) == selected_name, 'Wrong image is selected in exported pack.')
    for image in images:
        source = {file['name']: file for file in [FIRST, SECOND, THIRD]}.get(image['name'])
        if source:
            require(base64.b64decode(image['dataUrl'].split(',', 1)[1]) == source['buffer'], 'Original image bytes changed.')


def assert_display(page, image):
    selected = page.locator('#style-reference-images img')
    require(selected.count() == 1, 'Gallery renders more than one pinned image at a time.')
    require(selected.get_attribute('src') == image['dataUrl'], 'Pinned preview does not show the selected gallery image.')
    for root in ['#pinned-pattern-content', '#sheet-content [data-editor-sheet=pattern]']:
        card = page.locator(root + ' .attachment-card')
        if card.count():
            require(card.locator('img').count() == 1, 'Pattern gallery renders hidden/full-size extra images.')
            require(card.locator('img').get_attribute('src') == image['dataUrl'], 'Mirrored attachment preview is stale.')


def change_selection(page, direction='next', sidebar=True):
    root = '#pinned-pattern-content' if sidebar else '#sheet-content'
    open_for(page, root + f' [data-gallery-{direction}=reference]').click()


def save(page):
    page.locator('#save-pack').click()
    page.wait_for_function("()=>document.querySelector('#save-state').textContent.startsWith('Saved locally')")


def check_desktop(browser):
    context, page, errors, external = open_page(browser)
    try:
        select_sheet(page, 'wash')
        upload(page, [FIRST, SECOND])
        snapshot = export_pack(page)
        names = [FIRST['name'], SECOND['name']]
        assert_gallery(snapshot, names, FIRST['name'])
        require(snapshot['attachments']['wash'] == {}, 'Sidebar upload changed the active worksheet.')
        assert_display(page, reference(snapshot)[1])
        require(page.locator('#pinned-pattern-content [data-gallery-count=reference]').inner_text() == '1 of 2', 'Gallery counter is missing or incorrect.')
        report['checks']['multiUploadRetainsOriginalBytesAndDisplaysOneImage'] = True

        change_selection(page)
        snapshot = export_pack(page)
        assert_gallery(snapshot, names, SECOND['name'])
        assert_display(page, reference(snapshot)[1])
        page.locator('#undo-edit').click()
        assert_gallery(export_pack(page), names, FIRST['name'])
        page.locator('#redo-edit').click()
        assert_gallery(export_pack(page), names, SECOND['name'])
        select_sheet(page, 'pattern')
        require(page.locator('#sheet-content [data-gallery-select=reference]').input_value() == '1', 'Main Pattern Card selection is not mirrored.')
        open_for(page, '#sheet-content [data-gallery-select=reference]').select_option('0')
        require(page.locator('#pinned-pattern-content [data-gallery-select=reference]').input_value() == '0', 'Main selection did not update sidebar.')
        assert_display(page, reference(export_pack(page))[1])
        change_selection(page, sidebar=False)
        save(page)
        saved_id = export_pack(page)['id']
        page.reload()
        wait_ready(page)
        reopened = export_pack(page)
        require(reopened['id'] == saved_id, 'Reload opened a different draft.')
        assert_gallery(reopened, names, SECOND['name'])
        assert_display(page, reference(reopened)[1])
        report['checks']['selectionMirrorsUndoRedoAndSurvivesSaveReload'] = True

        # Reject every file in an invalid batch before altering the gallery.
        before = export_pack(page)
        upload(page, [THIRD, {'name': 'synthetic-invalid.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.0'}])
        require(export_pack(page) == before, 'Unsupported batch partially changed gallery or timestamp.')
        upload(page, [THIRD, {'name': 'synthetic-corrupt.png', 'mimeType': 'image/png', 'buffer': b'not a PNG'}])
        require(export_pack(page) == before, 'Corrupt batch partially changed gallery or timestamp.')
        upload(page, [image_file(f'synthetic-limit-{i}.png', 2, 2, (i, i, i)) for i in range(11)])
        require(export_pack(page) == before, 'Over-limit batch partially changed gallery or timestamp.')
        oversized = b'\x89PNG\r\n\x1a\n' + bytes(5 * 1024 * 1024)
        upload(page, [{'name': 'synthetic-oversize.png', 'mimeType': 'image/png', 'buffer': oversized}])
        require(export_pack(page) == before, 'Oversize image changed gallery or timestamp.')
        report['checks']['unsupportedCorruptOversizeAndOverLimitBatchesAreAtomic'] = True

        # Gallery operations must preserve unrelated invalid in-progress text.
        open_for(page, '#style-unit').select_option('cm')
        select_sheet(page, 'master')
        invalid = page.locator('#sheet-content [data-table=specs][data-row="1"][data-col=base]')
        invalid.fill('unfinished invalid measurement')
        page.evaluate("window.__galleryInvalidNode=document.querySelector('#sheet-content [data-table=specs][data-row=\"1\"][data-col=base]')")
        change_selection(page, 'prev')
        upload(page, [THIRD])
        require(invalid.input_value() == 'unfinished invalid measurement' and not invalid.evaluate('(el)=>el.checkValidity()'), 'Gallery operation erased invalid measurement text.')
        require(page.evaluate("window.__galleryInvalidNode===document.querySelector('#sheet-content [data-table=specs][data-row=\"1\"][data-col=base]')"), 'Gallery operation remounted the worksheet.')
        bridge = page.evaluate('async()=>await window.WORKROOM_UPDATES.prepare()')
        require(not bridge['ready'], 'Gallery operation allowed update despite invalid measurement.')
        invalid.fill('20')
        snapshot = export_pack(page)
        assert_gallery(snapshot, names + [THIRD['name']], FIRST['name'])
        report['checks']['appendPreservesCurrentSelectionAndUnrelatedInvalidText'] = True

        # A pending file read must not be discarded by a PWA update.
        page.evaluate('window.__gallerySlowRead=true')
        target = open_for(page, '#pinned-pattern-content [data-attachment=reference]')
        target.set_input_files([image_file('synthetic-pending.png', 10, 10, (80, 80, 80))])
        bridge = page.evaluate('async()=>await window.WORKROOM_UPDATES.prepare()')
        require(not bridge['ready'] and 'operation' in bridge['message'], 'Pending gallery upload did not block update.')
        page.wait_for_function("()=>document.querySelector('#pinned-pattern-content [data-gallery-count=reference]')?.textContent==='1 of 4'")
        page.evaluate('window.__gallerySlowRead=false')
        page.locator('#undo-edit').click()
        assert_gallery(export_pack(page), names + [THIRD['name']], FIRST['name'])
        report['checks']['pendingUploadBlocksUpdateAndBatchIsOneUndoStep'] = True

        # Preserve all gallery images and selected index in named snapshots.
        change_selection(page)
        open_for(page, '#revision-name').fill('Synthetic gallery snapshot')
        page.locator('#revision-author').fill('Synthetic reviewer')
        page.locator('#create-revision').click()
        page.wait_for_function('()=>document.querySelectorAll("#revision-list option").length>1')
        revision_id = page.locator('#revision-list').input_value()
        open_for(page, '#pinned-pattern-content [data-remove=reference]').click()
        remaining = export_pack(page)
        require(len(reference(remaining)[0]) == 2 and SECOND['name'] not in [i['name'] for i in reference(remaining)[0]], 'Remove current deleted wrong image or whole gallery.')
        page.locator('#revision-list').select_option(revision_id)
        page.locator('#restore-revision').click()
        require('undefined' not in page.locator('#revision-diff').inner_text(), 'Gallery revision comparison contains undefined values.')
        revision_sources = page.locator('#revision-diff img').evaluate_all('els=>els.map(el=>el.getAttribute("src"))')
        require(all(source and source.startswith('data:image/') for source in revision_sources), 'Gallery revision comparison contains broken image references.')
        page.locator('#confirm-restore').click()
        page.wait_for_function("()=>document.querySelector('#pinned-pattern-content [data-gallery-count=reference]')?.textContent==='2 of 3'")
        restored = export_pack(page)
        assert_gallery(restored, names + [THIRD['name']], SECOND['name'])
        assert_display(page, reference(restored)[1])
        report['checks']['removeOnlyCurrentAndRevisionRestoreRecoversImagesAndSelection'] = True

        transferred = json.loads(json.dumps(restored))
        transferred['id'] = 'synthetic-gallery-transfer-copy'
        import_pack(page, transferred)
        assert_gallery(export_pack(page), names + [THIRD['name']], SECOND['name'])
        assert_display(page, reference(export_pack(page))[1])
        report['checks']['jsonTransferPreservesEveryOriginalAndSelectedImage'] = True

        # Complete print contains exactly the selected gallery reference once.
        select_sheet(page, 'pattern')
        snapshot = export_pack(page)
        page.evaluate('window.print=()=>{}')
        page.locator('#export-menu-toggle').click()
        page.locator('#print-scope').select_option('all')
        page.locator('#print-pack').click()
        printed = page.locator('#print-view img').evaluate_all('els=>els.map(el=>el.src)')
        selected = reference(snapshot)[1]
        require(printed.count(selected['dataUrl']) == 1, 'Print duplicated or omitted selected gallery image.')
        for image in reference(snapshot)[0]:
            if image['name'] != selected['name']:
                require(image['dataUrl'] not in printed, 'Print included nonselected gallery images.')
        require(page.locator('#print-view tbody tr').count() == 190, 'Gallery changed complete worksheet row count.')
        require(page.locator('#print-view [data-gallery-select],#print-view [data-gallery-next],#print-view [data-gallery-prev]').count() == 0, 'Interactive gallery controls leaked into print.')
        require(export_pack(page) == snapshot, 'Printing changed gallery state.')
        report['checks']['completePrintContainsOneSelectedReferenceAnd190Rows'] = True

        # Removing the final photo returns to the explicit mannequin example.
        for _ in range(3):
            open_for(page, '#pinned-pattern-content [data-remove=reference]').click()
        require(export_pack(page)['attachments']['pattern']['reference'] is None, 'Final removal did not clear reference slot.')
        require(page.locator('#style-reference-images img').count() == 2, 'Empty gallery did not return mannequin pair.')
        require(page.locator('#style-reference-caption').inner_text() == 'Example reference · SR-FORM-001', 'Mannequin fallback lost identity label.')
        report['checks']['lastRemovalRestoresExplicitExamplePair'] = True
        require(not errors and not external, 'Desktop gallery generated runtime errors or external requests.')
        report['checks']['desktopNoRuntimeErrorsOrExternalRequests'] = True
    finally:
        context.close()


def check_legacy(browser):
    context, page, errors, external = open_page(browser)
    try:
        legacy = export_pack(page)
        legacy['id'] = 'synthetic-legacy-single-reference'
        legacy['attachments']['pattern']['reference'] = {'name': FIRST['name'], 'type': 'image/png',
            'dataUrl': 'data:image/png;base64,' + base64.b64encode(FIRST['buffer']).decode()}
        import_pack(page, legacy)
        assert_gallery(export_pack(page), [FIRST['name']], FIRST['name'])
        upload(page, [SECOND])
        migrated = export_pack(page)
        assert_gallery(migrated, [FIRST['name'], SECOND['name']], FIRST['name'])
        save(page)
        page.reload()
        wait_ready(page)
        assert_gallery(export_pack(page), [FIRST['name'], SECOND['name']], FIRST['name'])
        require(not errors and not external, 'Legacy migration generated runtime errors or external requests.')
        report['checks']['legacySingleImagePackAppendsWithoutReplacementAndReopens'] = True
    finally:
        context.close()


def check_blob_deduplication(browser):
    context, page, errors, external = open_page(browser)
    try:
        duplicate = dict(FIRST, name='synthetic-reference-same-bytes.png')
        upload(page, [FIRST, duplicate])
        save(page)
        snapshot = export_pack(page)
        assert_gallery(snapshot, [FIRST['name'], duplicate['name']], FIRST['name'])
        select_sheet(page, 'master')
        for view in ['front', 'back']:
            open_for(page, f'#sheet-content [data-attachment={view}]').set_input_files(FIRST)
            page.wait_for_function("selector=>!document.querySelector(selector)?.value", arg=f'#sheet-content [data-attachment={view}]')
        assert_display(page, reference(export_pack(page))[1])
        change_selection(page)
        selected = reference(export_pack(page))[1]
        require(selected['name'] == duplicate['name'], 'Gallery navigation was overridden by Master flats.')
        assert_display(page, selected)
        require(page.locator('#style-reference-images img').get_attribute('alt') == duplicate['name'], 'Pinned image identity did not follow gallery selection alongside Master flats.')
        save(page)
        count = page.evaluate('''async database=>{
          const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(database);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
          try{return await new Promise((resolve,reject)=>{const request=db.transaction('images').objectStore('images').count();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}finally{db.close()}
        }''', DATABASE)
        require(count == 1, 'Identical bytes in gallery and singleton slots were stored as duplicate image Blobs.')
        page.reload()
        wait_ready(page)
        reopened = export_pack(page)
        images, _ = reference(reopened)
        require(len(images) == 2 and images[0]['dataUrl'] == images[1]['dataUrl'] == reopened['attachments']['master']['front']['dataUrl'], 'Deduplicated images did not all hydrate after reload.')
        require(base64.b64decode(images[0]['dataUrl'].split(',', 1)[1]) == FIRST['buffer'], 'Deduplicated original bytes changed.')
        require(not errors and not external, 'Image deduplication generated runtime errors or external requests.')
        report['checks']['identicalImageBytesDeduplicateAcrossGalleryAndSingletonAndHydrate'] = True
        report['checks']['selectedGalleryRemainsPinnedAndNavigableAlongsideMasterFrontBack'] = True
    finally:
        context.close()


def check_phone(browser, width, height):
    context, page, errors, external = open_page(browser, width, height)
    try:
        upload(page, [FIRST, SECOND])
        # Collapsed mobile panel must still expose one current image/navigation.
        if page.locator('#context-panel').evaluate('(el)=>el.open'):
            page.locator('#context-panel > summary .context-panel-heading').click()
        header_next = page.locator('#context-panel > summary [data-gallery-next=reference]')
        require(header_next.is_visible(), 'Collapsed phone reference has no gallery navigation.')
        header_next.click()
        require(not page.locator('#context-panel').evaluate('(el)=>el.open'), 'Gallery navigation toggled collapsed mobile panel.')
        snapshot = export_pack(page)
        assert_gallery(snapshot, [FIRST['name'], SECOND['name']], SECOND['name'])
        assert_display(page, reference(snapshot)[1])
        for sheet in ['wash', 'fit', 'graded', 'master', 'body', 'pattern']:
            select_sheet(page, sheet)
            assert_display(page, reference(snapshot)[1])
            geometry = page.evaluate('''()=>({width:innerWidth,height:innerHeight,
              scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
              nav:[...document.querySelectorAll('#context-panel>summary [data-gallery-next],#context-panel>summary [data-gallery-prev]')].map(el=>el.getBoundingClientRect().toJSON())})''')
            require(geometry['scrollWidth'] <= width + 1 and geometry['scrollHeight'] <= height + 1, 'Phone gallery caused root overflow.')
            for rect in geometry['nav']:
                require(rect['width'] >= 43.5 and rect['height'] >= 43.5, 'Gallery navigation is below44px touch target.')
                require(rect['x'] >= 0 and rect['right'] <= width + 1 and rect['bottom'] <= height + 1, 'Phone gallery navigation is offscreen.')
        require(not errors and not external, 'Phone gallery generated runtime errors or external requests.')
        report['checks'][f'phone{width}x{height}OneImageNavigationAcrossSixTabs'] = True
    finally:
        context.close()


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
BASE_URL = f'http://127.0.0.1:{server.server_port}/'
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
        try:
            check_desktop(browser)
            check_legacy(browser)
            check_blob_deduplication(browser)
            check_phone(browser, 390, 844)
            check_phone(browser, 320, 568)
        except Exception as error:
            report['issues'].append(type(error).__name__ + ': ' + str(error))
            traceback.print_exc()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
report['passed'] = not report['issues']
(args.output / 'reference-gallery-browser.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'passed': report['passed'], 'checks': len(report['checks']), 'issues': report['issues']}, indent=2))
raise SystemExit(0 if report['passed'] else 1)
