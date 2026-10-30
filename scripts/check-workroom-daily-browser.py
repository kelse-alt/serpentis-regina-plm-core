"""Check the daily workroom in isolated Chromium contexts.

Build with npm run techpack:build first. Only pristine blank-template screenshots
and non-identifying evidence are written. Synthetic projects, legacy bytes,
downloads and printable PDFs remain temporary or in memory and are discarded.
Requires optional Playwright, pypdf, Pillow, and /usr/bin/chromium.
"""
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO, StringIO
from pathlib import Path
from threading import Thread
import argparse
import csv
import hashlib
import json
import re
import subprocess
import traceback

from PIL import Image
from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = json.loads((ROOT / 'data/templates/tech-pack-workbook.v1.json').read_text())
FORM = json.loads((ROOT / 'data/house-fit-forms/SR-FORM-001.v1.json').read_text())
METHODS = json.loads((ROOT / 'data/house-fit-forms/SR-FORM-001-methods.v1.json').read_text())
SHEETS = TEMPLATE['sheets']
VIEWPORTS = [('desktop', 1500, 1000), ('laptop', 1280, 720), ('mobile', 390, 844),
             ('narrow-phone', 320, 568), ('landscape', 844, 390), ('short-phone', 320, 480)]
DATABASE = 'serpentis-regina.workroom.v2'
LEGACY_KEY = 'serpentis-regina.tech-packs.v1'
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'reports/workroom-daily-review')
parser.add_argument('--layout-only', action='store_true')
parser.add_argument('--workflow-only', action='store_true')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
BASE_URL = ''
report = {
    'capturedAtUtc': datetime.now(timezone.utc).isoformat(),
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'uncommittedChanges': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip()),
    'standalone': True, 'sourceTabs': [sheet['title'] for sheet in SHEETS],
    'layouts': [], 'workflows': {}, 'issues': [],
    'publicationBoundary': 'Screenshots show pristine blank templates only. Synthetic projects, original recovery bytes, downloads and filled PDFs are not published.',
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/':
            self.send_error(404)
            return
        body = (ROOT / 'tech-pack.html').read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def check_source_integrity():
    baseline='e4affb1c3f69b50fddb392bafaf8a305b816fee5'
    paths=['design/brand-tokens.json','data/house-fit-forms/SR-FORM-001.v1.json',
           'data/house-fit-forms/SR-FORM-001-methods.v1.json',
           'data/templates/tech-pack-workbook.v1.json','data/templates/tech-pack-workbook-source.v1.json',
           'assets/house-sheet/mannequin-front.jpg','assets/house-sheet/mannequin-back.jpg',
           'assets/house-sheet/serpentis-regina-seal.png',
           'assets/house-sheet/fonts/barlow-condensed-500.ttf',
           'assets/house-sheet/fonts/barlow-condensed-700.ttf','sheet-web/matte-grain.svg']
    for path in paths:
        original=subprocess.check_output(['git','show',baseline+':'+path],cwd=ROOT)
        require((ROOT/path).read_bytes()==original,'Protected source/artwork changed: '+path)
    report['sourceIntegrity']={'baselineCommit':baseline,'unchangedFiles':paths}


def open_page(browser, width=1500, height=1000, legacy=None, unavailable=False):
    context = browser.new_context(viewport={'width': width, 'height': height}, accept_downloads=True)
    if legacy is not None:
        serialized = json.dumps(legacy, separators=(',', ':'))
        context.add_init_script('''if (!sessionStorage.getItem('daily-seeded')) {
            localStorage.setItem(%s, %s); sessionStorage.setItem('daily-seeded', '1');
        }''' % (json.dumps(LEGACY_KEY), json.dumps(serialized)))
    if unavailable:
        context.add_init_script("Object.defineProperty(window, 'indexedDB', {value:undefined, configurable:true});")
    page = context.new_page()
    errors, external = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.on('request', lambda request: external.append(request.url)
            if request.url.startswith(('http:', 'https:')) and request.url != BASE_URL else None)
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE_URL, wait_until='load')
    wait_ready(page)
    page.evaluate('document.fonts.ready')
    require(not errors and not external, 'Standalone boot produced a runtime error or external request.')
    return context, page, errors, external


def wait_ready(page):
    page.wait_for_selector('#sheet-tabs button', timeout=15000)
    page.wait_for_function("() => document.body.dataset.workroomReady === 'true'", timeout=15000)


def select_sheet(page, sheet_id):
    close_context(page)
    page.locator('#tab-' + sheet_id).click()
    page.wait_for_function('(id)=>document.getElementById("tab-"+id)?.getAttribute("aria-selected")==="true"',arg=sheet_id)
    require(page.locator('#tab-' + sheet_id).get_attribute('aria-selected') == 'true', 'Tab selection failed: ' + sheet_id)


def open_context(page):
    if not page.locator('#context-panel').evaluate('(el) => el.open'):
        page.locator('#context-panel > summary .context-panel-heading').click()


def close_context(page):
    if page.viewport_size['width'] <= 740 and page.locator('#context-panel').evaluate('(el) => el.open'):
        page.locator('#context-panel > summary .context-panel-heading').click()


def open_details_for(page, selector):
    page.locator(selector).evaluate("el => {for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true}")


def cell(page, table, row, column):
    return page.locator(f'#sheet-content [data-table="{table}"][data-row="{row}"][data-col="{column}"]')


def result(page, table, row, column):
    return page.locator(f'#sheet-content table[data-table="{table}"] tr[data-row="{row}"] [data-result="{column}"]')


def exported_json(page):
    page.locator('#export-menu-toggle').click()
    require(page.locator('#export-dialog').is_visible(), 'Export menu did not open.')
    with page.expect_download() as pending:
        page.locator('#export-json').click()
    download = pending.value
    value = json.loads(Path(download.path()).read_text())
    download.delete()
    if page.locator('#export-dialog').is_visible():
        page.keyboard.press('Escape')
    return value


def database_records(page, stores=('drafts', 'revisions', 'recoveries')):
    return page.evaluate('''async ({database, stores}) => {
        const db=await new Promise((resolve,reject)=>{
            const r=indexedDB.open(database);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
        });
        try {
            const tx=db.transaction(stores,'readonly');
            return Object.fromEntries(await Promise.all(stores.map(name=>new Promise((resolve,reject)=>{
                const r=tx.objectStore(name).getAll();r.onerror=()=>reject(r.error);
                r.onsuccess=()=>resolve([name,r.result.map(record=> name==='images'
                    ? {id:record.id,type:record.type,bytes:record.blob?.size,isBlob:record.blob instanceof Blob}
                    : record)]);
            }))));
        } finally {db.close();}
    }''', {'database': DATABASE, 'stores': list(stores)})


def wait_saved_value(page, pack_id, path, expected):
    # This Playwright runtime treats an async wait predicate's Promise as truthy.
    # Await the real IDB read with evaluate, then poll its resolved value here.
    for attempt in range(150):
        record=next((row for row in database_records(page,('drafts',))['drafts'] if row['id']==pack_id),None)
        value=record.get('snapshot') if record else None
        for key in path:
            value=value.get(key) if isinstance(value,dict) else value[key] if isinstance(value,list) and isinstance(key,int) and 0<=key<len(value) else None
        if value==expected:return
        page.wait_for_timeout(100)
    raise AssertionError('Expected valid autosave was not persisted: '+'.'.join(map(str,path)))


def pristine(page):
    require(page.locator('#pack-title').input_value() == 'Untitled tech pack', 'Refusing to capture a filled project title.')
    require(page.locator('#saved-packs option').count() == 1, 'Refusing to capture saved project names.')
    require(page.locator('[data-style-key]').evaluate_all('(els) => els.every(el=>el.value==="")'), 'Refusing to capture filled shared metadata.')
    require(page.locator('#sheet-content [data-field]').evaluate_all('(els)=>els.every(el=>el.value==="")'), 'Refusing to capture filled sheet metadata.')
    require(page.locator('#sheet-content textarea,#sheet-content input[type=text]').evaluate_all('(els)=>els.every(el=>el.value==="")'), 'Refusing to capture filled specifications.')
    require(page.locator('#sheet-content .attachment-card img,#pinned-pattern-content .attachment-card img').count() == 0, 'Refusing to capture attached project images.')
    require(page.locator('#pinned-pattern-content input,#pinned-pattern-content textarea').evaluate_all('(els)=>els.every(el=>!el.value)'), 'Refusing to capture filled pinned Pattern Card data.')
    require(page.locator('#style-reference-caption').inner_text() == 'Example reference · SR-FORM-001', 'Refusing to capture a private style reference.')


def capture(page, suffix):
    pristine(page)
    filename = f'workroom-daily-{suffix}.png'
    page.screenshot(path=str(args.output / filename))
    return filename


def color_rules(page):
    return page.locator('.app-shell').evaluate('''shell=>{
        const electric='rgb(30, 34, 170)',ruby='rgb(228, 0, 43)',salmon='rgb(244, 166, 160)';
        const violations=[];
        for(const el of [shell,...shell.querySelectorAll('*')]){
            if(!el.getClientRects().length)continue;
            const s=getComputedStyle(el),label=el.id||el.className||el.tagName;
            if(s.backgroundColor===electric&&s.color!==ruby)violations.push({label,rule:'Electric requires Ruby'});
            for(const key of ['color','backgroundColor','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','outlineColor'])
                if(s[key]===salmon)violations.push({label,rule:'Salmon forbidden',key});
            if(s.color===ruby){
                let background='';for(let p=el;p;p=p.parentElement){const c=getComputedStyle(p).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'){background=c;break;}}
                if(background!==electric)violations.push({label,rule:'Ruby lettering outside Electric'});
            }
        }
        return violations;
    }''')


def layout_geometry(page):
    return page.evaluate('''()=>{
        const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
        return {viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
            content:rect(document.getElementById('sheet-content')),footer:rect(document.querySelector('.app-footer')),
            masthead:rect(document.querySelector('.masthead')),tabs:rect(document.querySelector('.tab-strip')),
            context:rect(document.querySelector('#context-panel')),toolbar:rect(document.querySelector('.sheet-toolbar')),
            primary:[...document.querySelectorAll('.footer-actions > button')].map(el=>({id:el.id,...rect(el),disabled:el.disabled})),
            font:getComputedStyle(document.body).fontFamily,
            sealLoaded:[...document.querySelectorAll('.house-seal img')].some(el=>el.complete&&el.naturalWidth>0)};
    }''')


def check_table_counts(page, sheet):
    for table in sheet.get('tables', []):
        require(page.locator(f'#sheet-content table[data-table="{table["id"]}"] tbody tr').count() == len(table['rows']), 'Source rows missing from ' + table['id'])
    if sheet.get('reference'):
        require(page.locator('#sheet-content tr[data-reference]').count() == 20, 'Approved reference lost a row.')
        require(page.locator('#sheet-content .photos img').evaluate_all('(els)=>els.length===2&&els.every(el=>el.complete&&el.naturalWidth>0)'), 'Original mannequin photos failed offline.')


def check_layouts(browser):
    for name, width, height in VIEWPORTS:
        context, page, errors, external = open_page(browser, width, height)
        try:
            for sheet in SHEETS:
                select_sheet(page, sheet['id'])
                check_table_counts(page, sheet)
                geometry = layout_geometry(page)
                require(geometry['document']['width'] <= width + 1 and geometry['document']['height'] <= height + 1, f'{name}/{sheet["id"]}: document overflow.')
                if geometry['content']['height'] < 44:report['layoutFailure']={'layout':name,'sheet':sheet['id'],**geometry}
                require(geometry['content']['height'] >= 44, f'{name}/{sheet["id"]}: working content below one usable control ({geometry["content"]["height"]:.2f}px).')
                require(geometry['footer']['bottom'] <= height + 1, f'{name}/{sheet["id"]}: footer outside viewport.')
                require({c['id'] for c in geometry['primary']} == {'save-pack','toggle-style-panel','undo-edit','redo-edit','export-menu-toggle'}, 'Footer must retain Save, style visibility, Undo, Redo and Export.')
                for control in geometry['primary']:
                    require(control['x'] >= -1 and control['right'] <= width + 1 and control['y'] >= 0 and control['bottom'] <= height + 1, f'{name}/{sheet["id"]}: primary action offscreen: '+control['id'])
                    require(control['height'] >= 33.5, 'Primary action is too short to operate.')
                require(not color_rules(page), f'{name}/{sheet["id"]}: changed house color assignment.')
                require(geometry['sealLoaded'] and 'Barlow Condensed' in geometry['font'], 'Original seal or Barlow font failed.')
                require(page.evaluate('document.fonts.check("700 22px Barlow Condensed")'), 'Barlow font is unavailable.')
                if name == 'desktop' and sheet['id'] == 'pattern':
                    geometry['blankScreenshot'] = capture(page, 'desktop')
                if name == 'mobile' and sheet['id'] == 'pattern':
                    geometry['blankScreenshot'] = capture(page, 'mobile')
                if name == 'desktop' and sheet['id'] == 'master':
                    page.locator('#column-view').select_option('comparison')
                    geometry['blankComparisonScreenshot'] = capture(page, 'master')
                    page.locator('#column-view').select_option('full')
                report['layouts'].append({'layout': name, 'sheet': sheet['id'], **geometry})
            open_context(page)
            open_details_for(page, '[data-style-key="number"]')
            require(page.locator('[data-style-key="number"]').is_visible(), 'Shared style editor did not open.')
            require(page.locator('.context-body').evaluate('(el)=>el.clientHeight') >= 44, 'Shared style editor has no scrollable space.')
            if name == 'desktop':
                capture(page, 'style')
            close_context(page)
            page.locator('#export-menu-toggle').click()
            for selector in ('#export-json', '#import-json', '#export-csv', '#print-scope', '#print-pack', '#new-pack'):
                require(page.locator('#export-dialog ' + selector).is_visible(), 'Export dialog hides an action: ' + selector)
            page.keyboard.press('Escape')
            require(not errors and not external, 'Layout interaction caused a runtime error or external request.')
            print(f'layout {name}: six tabs passed', flush=True)
        finally:
            context.close()


def paste(page, target, text):
    target.evaluate('''(el,text)=>{const data=new DataTransfer();data.setData('text/plain',text);
        el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));}''', text)
    page.locator('#paste-dialog').wait_for(state='visible')


def grid_values(page):
    return [cell(page, 'specs', row, col).input_value() for row in ['1', '2'] for col in ['base', 'actual']]


def check_reference(page):
    select_sheet(page, 'body')
    page.locator('#pack-unit').select_option('in')
    labels = {entry['pomCode']: entry for entry in METHODS['methods']}
    for record in FORM['measurements']:
        row = page.locator(f'#sheet-content tr[data-reference="{record["pomCode"]}"]')
        values = row.locator('td').all_text_contents()
        require(values[0] == labels[record['pomCode']]['sourceLabel'] and values[1] == labels[record['pomCode']]['howToMeasure'], 'Approved POM source wording changed.')
        require(float(values[3]) == record['houseStandard'], 'Approved house measurement changed.')
        require(row.locator('input,textarea').count() == 0, 'Approved reference became editable.')
        if record['manufacturerReference'] is None:
            require(values[2].strip() == '—' and values[4].strip() == '—', 'Missing manufacturer value became numeric.')
        else:
            require(float(values[2]) == record['manufacturerReference'], 'MFR reference changed.')
    page.locator('#pack-unit').select_option('cm')
    for record in FORM['measurements']:
        row = page.locator(f'#sheet-content tr[data-reference="{record["pomCode"]}"]')
        require(abs(float(row.locator('td').nth(3).inner_text()) - record['houseStandard'] * 2.54) < 0.000001, 'Reference CM conversion failed.')
    report['workflows']['approvedReferenceReadonlyExactAndUnitConversion'] = True


def print_sheet(page, scope):
    page.evaluate('() => {window.__dailyPrintCalls=0; window.print=()=>{window.__dailyPrintCalls++;};}')
    page.locator('#export-menu-toggle').click()
    page.locator('#print-scope').select_option(scope)
    page.locator('#print-pack').click()
    page.wait_for_function('() => window.__dailyPrintCalls === 1')
    if page.locator('#export-dialog').is_visible():
        page.keyboard.press('Escape')
    page.emulate_media(media='print')
    row_count = page.locator('#print-view table tbody tr').count()
    table_columns = page.locator('#print-view table[data-table]').evaluate_all('(tables)=>Object.fromEntries(tables.map(t=>[t.dataset.table,t.querySelectorAll("thead th").length]))')
    widths = page.locator('#print-view .work-table').evaluate_all('(els)=>els.map(el=>({width:el.getBoundingClientRect().width,available:document.getElementById("print-view").getBoundingClientRect().width}))')
    require(all(row['width'] <= row['available'] + 1 for row in widths), 'Printed table is wider than its available space.')
    require(page.locator('#print-view img').evaluate_all('(els)=>els.every(el=>el.complete&&el.naturalWidth>0)'), 'Printed original image failed to load.')
    pdf = page.pdf(print_background=True, prefer_css_page_size=True)
    reader = PdfReader(BytesIO(pdf))
    text = re.sub(r'\s+', ' ', '\n'.join(p.extract_text() or '' for p in reader.pages))
    page.emulate_media(media='screen')
    return {'pages': len(reader.pages), 'tableWidths': widths, 'rows': row_count, 'tableColumns': table_columns}, text


def check_daily_workflow(browser):
    context, page, errors, external = open_page(browser)
    try:
        page.locator('#tab-pattern').focus()
        page.keyboard.press('End')
        require(page.locator('#tab-body').get_attribute('aria-selected') == 'true', 'Keyboard End did not select the last tab.')
        check_reference(page)
        page.locator('#tab-body').focus()
        page.keyboard.press('Home')
        require(page.locator('#tab-pattern').get_attribute('aria-selected') == 'true', 'Keyboard Home did not select the first tab.')
        open_context(page)
        open_details_for(page, '[data-style-key="number"]')
        page.locator('#pack-title').fill('SYNTHETIC DAILY WORKFLOW')
        for key, value in {'number':'SYNTHETIC-STYLE-01', 'description':'Synthetic style description', 'fabric':'Synthetic fabric reference', 'baseSize':'8', 'sampleSize':'8', 'owner':'Synthetic operator'}.items():
            page.locator(f'[data-style-key="{key}"]').fill(value)
        page.locator('#style-unit').select_option('in')
        first = exported_json(page)
        pack_id = first['id']
        require(first['schemaVersion'] == 2 and first['style']['number'] == 'SYNTHETIC-STYLE-01', 'Shared style did not export in the new schema.')
        wait_saved_value(page, pack_id, ['style', 'number'], 'SYNTHETIC-STYLE-01')
        select_sheet(page, 'master')
        open_details_for(page, '#sheet-content [data-field="style"]')
        require(page.locator('#sheet-content [data-field="style"]').input_value() == 'SYNTHETIC-STYLE-01', 'Master did not inherit shared style.')
        page.locator('#sheet-content [data-field="style"]').fill('SYNTHETIC-MASTER-OVERRIDE')
        select_sheet(page, 'graded')
        open_details_for(page, '#sheet-content [data-field="style"]')
        require(page.locator('#sheet-content [data-field="style"]').input_value() == 'SYNTHETIC-STYLE-01', 'Master override leaked into another sheet.')
        select_sheet(page, 'master')
        open_details_for(page, '#sheet-content [data-field="style"]')
        require(page.locator('#sheet-content [data-field="style"]').input_value() == 'SYNTHETIC-MASTER-OVERRIDE', 'Explicit override was lost.')
        page.locator('#sheet-content [data-use-shared="style"]').click()
        require(page.locator('#sheet-content [data-field="style"]').input_value() == 'SYNTHETIC-STYLE-01', 'Use shared did not restore inheritance.')
        restored = exported_json(page)
        require(restored['fields']['master']['style'] == '', 'Use shared must clear the override rather than copy a value.')
        report['workflows']['sharedStyleInheritanceAndExplicitOverrides'] = True

        cell(page, 'specs', '1', 'base').fill('24 3/8')
        cell(page, 'specs', '1', 'actual').fill('25')
        require(result(page, 'specs', '1', 'delta').inner_text() == '+0.625', 'Fractional inch input or master delta failed.')
        wait_saved_value(page, pack_id, ['tables','master','specs','1','base'], 61.9125)
        cell(page, 'specs', '1', 'base').fill('2/0')
        require(cell(page, 'specs', '1', 'base').get_attribute('aria-invalid') == 'true', 'Invalid fraction lacks inline invalid state.')
        require(page.locator('.cell-error:visible').count() > 0, 'Invalid input lacks a visible cell error.')
        page.wait_for_timeout(900)
        stored = next(row for row in database_records(page)['drafts'] if row['id'] == pack_id)
        require(stored['snapshot']['tables']['master']['specs']['1']['base'] == 61.9125, 'Invalid raw text overwrote a valid autosaved measurement.')
        page.locator('#tab-wash').click()
        require(page.locator('#tab-master').get_attribute('aria-selected') == 'true', 'Invalid numeric input should block leaving the sheet.')
        cell(page, 'specs', '1', 'base').fill('24 3/8')
        require(cell(page, 'specs', '1', 'base').get_attribute('aria-invalid') != 'true', 'Correcting a cell left its invalid flag set.')
        require(page.locator('.cell-error:visible').count() == 0, 'Correcting a cell left its error visible.')
        cell(page, 'specs', '1', 'actual').fill('26')
        page.locator('#undo-edit').click()
        require(cell(page, 'specs', '1', 'actual').input_value() == '25', 'Undo did not restore the previous valid edit.')
        page.locator('#redo-edit').click()
        require(cell(page, 'specs', '1', 'actual').input_value() == '26', 'Redo did not restore the undone edit.')
        report['workflows'].update({'fractionalInchesCanonicalAndSignedDelta':True, 'invalidRawNeverAutosaved':True,
            'inlineErrorClearsAfterCorrection':True, 'invalidInputBlocksNavigation':True, 'undoAndRedo':True})

        page.locator('#pack-unit').select_option('cm')
        before = grid_values(page)
        paste(page, cell(page,'specs','1','base'), '10\t12\n11\t13')
        require(grid_values(page) == before, 'Paste changed the draft before confirmation.')
        require(page.locator('#apply-paste').is_enabled(), 'A valid rectangular paste was refused.')
        page.locator('#apply-paste').click()
        require(grid_values(page) == ['10','12','11','13'], 'Confirmed paste did not apply both complete rows.')
        require(result(page,'specs','1','delta').inner_text() == '+2', 'Paste overwrote or failed to recalculate the calculated delta.')
        after_good = grid_values(page)
        paste(page, cell(page,'specs','1','base'), '14\t16\n15\tnot-a-measurement')
        require(page.locator('#apply-paste').is_disabled(), 'Invalid paste must disable applying the rectangle.')
        require(page.locator('#paste-dialog .paste-errors').is_visible(), 'Invalid paste lacks an explanation.')
        require(grid_values(page) == after_good, 'Invalid paste partially changed the draft.')
        page.locator('#cancel-paste').click()
        paste(page, cell(page,'specs','1','base'), '20\t22')
        page.evaluate("const unit=document.getElementById('pack-unit');unit.value='in';unit.dispatchEvent(new Event('change',{bubbles:true}));")
        if page.locator('#paste-dialog').is_visible() and page.locator('#apply-paste').is_enabled():
            page.locator('#apply-paste').click()
        if page.locator('#paste-dialog').is_visible():
            require(page.locator('#paste-dialog .paste-errors').is_visible() or page.locator('#apply-paste').is_disabled(), 'Stale unit paste was not rejected.')
            page.locator('#cancel-paste').click()
        rejected = exported_json(page)
        require(rejected['tables']['master']['specs']['1']['base'] == 10 and rejected['tables']['master']['specs']['1']['actual'] == 12, 'A stale paste changed canonical values.')
        page.locator('#pack-unit').select_option('cm')
        report['workflows'].update({'pastePreviewBeforeMutation':True, 'pasteAtomicValidAndInvalidRectangles':True,
            'calculatedColumnsSkippedDuringPaste':True, 'staleUnitPasteRejected':True})

        full = exported_json(page)
        full_count = page.locator('table[data-table="specs"] thead th').count()
        page.locator('#column-view').select_option('comparison')
        require(page.locator('table[data-table="specs"] thead th').count() < full_count, 'Comparison view did not reduce displayed columns.')
        require(exported_json(page) == full, 'Changing visible columns modified the saved pack.')
        page.locator('#column-view').select_option('full')
        require(page.locator('table[data-table="specs"] thead th').count() == full_count, 'Full view failed to restore columns.')
        report['workflows']['columnViewIsPresentationOnly'] = True

        open_context(page)
        open_details_for(page, '#revision-name')
        page.locator('#revision-name').fill('Synthetic reviewed snapshot')
        page.locator('#revision-author').fill('Synthetic reviewer')
        page.locator('#revision-reason').fill('Synthetic reference point for a recovery test')
        page.locator('#create-revision').click()
        page.wait_for_function("() => document.querySelectorAll('#revision-list option').length > 1")
        records = database_records(page)
        revisions = [row for row in records['revisions'] if row['packId'] == pack_id]
        require(len(revisions) == 1, 'Named revision was not stored independently.')
        revision = revisions[0]
        cell(page,'specs','1','actual').fill('22')
        wait_saved_value(page, pack_id, ['tables','master','specs','1','actual'], 22)
        require(next(row for row in database_records(page)['revisions'] if row['id']==revision['id']) == revision, 'Editing the working draft changed its named revision.')
        page.locator('#revision-list').select_option(revision['id'])
        page.locator('#compare-revision').click()
        page.locator('#revision-dialog').wait_for(state='visible')
        require(page.locator('#revision-dialog').is_visible(), 'Revision comparison failed to open.')
        require(page.locator('#revision-dialog').inner_text().count('22') > 0, 'Comparison did not show the changed measurement.')
        page.keyboard.press('Escape')
        page.locator('#restore-revision').click()
        page.locator('#revision-dialog').wait_for(state='visible')
        require(page.locator('#revision-dialog').is_visible() and page.locator('#confirm-restore').is_visible(), 'Restore must require review of the comparison first.')
        require(cell(page,'specs','1','actual').input_value() == '22', 'Restore changed data before confirmation.')
        page.locator('#confirm-restore').click()
        page.wait_for_function('() => document.querySelector(\'[data-table="specs"][data-row="1"][data-col="actual"]\')?.value === "12"')
        require(cell(page,'specs','1','actual').input_value() == '12', 'Confirmed restore did not restore the selected snapshot.')
        restored_revisions = database_records(page)['revisions']
        require(len([row for row in restored_revisions if row['packId']==pack_id]) == 2, 'Restore did not preserve the overwritten working draft as a backup revision.')
        require(next(row for row in restored_revisions if row['id']==revision['id']) == revision, 'Restore changed the immutable original revision.')
        wait_saved_value(page, pack_id, ['tables','master','specs','1','actual'], 12)
        page.reload(wait_until='load')
        wait_ready(page)
        select_sheet(page,'master')
        require(cell(page,'specs','1','actual').input_value() == '12', 'Reload failed to recover the latest valid draft.')
        report['workflows'].update({'immutableNamedRevisions':True,'revisionComparison':True,
            'restoreRequiresConfirmationAndBackup':True,'autosaveAndReloadRecovery':True})

        select_sheet(page,'wash')
        cell(page,'measurements','1','atarget').fill('20')
        cell(page,'measurements','1','aafter').fill('18')
        require(result(page,'measurements','1','adelta').inner_text() == '+2', 'Wash delta must remain Target minus After Wash.')
        cell(page,'measurements','1','aafter').fill('')
        require(result(page,'measurements','1','adelta').inner_text().strip() in ['', '—'], 'Missing wash value became zero.')
        cell(page,'measurements','1','atarget').fill('0')
        cell(page,'measurements','1','aafter').fill('0')
        require(result(page,'measurements','1','adelta').inner_text() == '0', 'Explicit wash zero was lost.')
        cell(page,'measurements','30','adelta').fill('-1.25')
        require(cell(page,'measurements','30','adelta').input_value() == '-1.25', 'Manual signed wash delta was lost.')
        select_sheet(page,'graded')
        open_details_for(page,'[data-field="sizeF"]')
        page.locator('[data-field="sizeF"]').fill('SYNTHETIC-SIZE')
        require(all('SYNTHETIC-SIZE' in page.locator(f'table[data-table="{table}"] thead').inner_text() for table in ['before','after']), 'Graded size header did not update both stages.')
        report['workflows'].update({'distinctWashFormulaZeroAndMissing':True,'manualSourceDeltaCellsPreserved':True,'gradedSizeHeaderUpdates':True})

        select_sheet(page,'pattern')
        open_details_for(page,'#sheet-content [data-attachment="reference"]')
        image = BytesIO()
        Image.new('RGB',(2,2),(16,24,32)).save(image,format='PNG')
        page.locator('#sheet-content [data-attachment="reference"]').set_input_files({'name':'synthetic-reference.png','mimeType':'image/png','buffer':image.getvalue()})
        page.wait_for_function('() => document.querySelector("#sheet-content .attachment-card img")?.naturalWidth === 2')
        page.locator('#save-pack').click()
        wait_saved_value(page,pack_id,['attachments','pattern','reference','images',0,'name'],'synthetic-reference.png')
        images = database_records(page,('images',))['images']
        require(len(images)==1 and images[0]['isBlob'] and images[0]['bytes']==len(image.getvalue()), 'Original raster was not kept as an IndexedDB Blob.')
        with_image = exported_json(page)
        gallery=with_image['attachments']['pattern']['reference']
        require(len(gallery['images'])==1 and gallery['selectedIndex']==0, 'Portable JSON lost the reference gallery selection.')
        import base64
        require(base64.b64decode(gallery['images'][0]['dataUrl'].split(',',1)[1])==image.getvalue(), 'Portable JSON changed the embedded original raster.')
        page.locator('#json-file').set_input_files({'name':'synthetic-roundtrip.json','mimeType':'application/json','buffer':json.dumps(with_image).encode()})
        page.wait_for_function("() => /import/i.test(document.getElementById('status').textContent)")
        require('import' in page.locator('#status').inner_text().lower(), 'Compatible JSON import did not reopen the pack.')
        bad = json.loads(json.dumps(with_image))
        bad['fields']['pattern']['unexpected'] = 'refuse'
        page.locator('#json-file').set_input_files({'name':'synthetic-invalid.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
        page.wait_for_function("() => /refus/i.test(document.getElementById('status').textContent)")
        require('refus' in page.locator('#status').inner_text().lower(), 'Unknown imported fields were accepted.')
        require(exported_json(page)['id']==pack_id, 'Invalid JSON replaced the current draft.')
        report['workflows'].update({'imagesStoredAsOriginalBlobs':True,'portableJsonRasterRoundtrip':True,'invalidImportDoesNotReplaceDraft':True})

        page.locator('#export-menu-toggle').click()
        page.locator('#new-pack').click()
        page.wait_for_function("() => document.getElementById('pack-title').value === 'Untitled tech pack'")
        second=exported_json(page)
        require(second['id']!=pack_id and all(value=='' for value in second['style'].values()), 'New blank reused the prior identity or shared style.')
        open_context(page)
        page.locator('#pack-title').fill('SYNTHETIC SECOND PACK')
        wait_saved_value(page,second['id'],['title'],'SYNTHETIC SECOND PACK')
        require(page.locator('#saved-packs option').count()==3, 'Creating a new pack discarded the earlier saved draft.')
        page.locator('#saved-packs').select_option(pack_id)
        page.locator('#open-pack').click()
        page.wait_for_function("() => document.getElementById('pack-title').value === 'SYNTHETIC DAILY WORKFLOW'")
        reopened=exported_json(page)
        require(reopened['id']==pack_id and reopened['attachments']['pattern']['reference']==with_image['attachments']['pattern']['reference'], 'Reopening a saved pack lost its original image.')
        transferred=json.loads(json.dumps(reopened))
        transferred['id']='synthetic-new-id-transfer'
        transferred['title']='SYNTHETIC TRANSFERRED PACK'
        page.locator('#json-file').set_input_files({'name':'synthetic-transfer.json','mimeType':'application/json','buffer':json.dumps(transferred).encode()})
        page.wait_for_function("() => document.getElementById('pack-title').value === 'SYNTHETIC TRANSFERRED PACK'")
        require(exported_json(page)['id']==transferred['id'], 'A valid pack from another browser could not be imported under its new ID.')
        report['workflows'].update({'newBlankKeepsPriorSavedPacks':True,'reopenedDraftHydratesOriginalImages':True,'jsonImportAcceptsNewPackIdentity':True})

        select_sheet(page,'master')
        cell(page,'specs','1','note').fill('=SYNTHETIC_FORMULA()')
        page.locator('#sheet-search').fill('no-matching-row')
        page.locator('#column-view').select_option('comparison')
        page.locator('#export-menu-toggle').click()
        with page.expect_download() as pending:
            page.locator('#export-csv').click()
        download=pending.value
        csv_rows=list(csv.reader(StringIO(Path(download.path()).read_text())))
        download.delete()
        if page.locator('#export-dialog').is_visible():page.keyboard.press('Escape')
        require(any("'=SYNTHETIC_FORMULA()" in row for row in csv_rows) and len(csv_rows)>=30, 'CSV did not preserve all rows/columns or formula-safe text.')
        current,text=print_sheet(page,'current')
        require(current['rows']==30, 'Current-sheet print lost filtered rows.')
        require(current['tableColumns'].get('specs')==full_count, 'Current-sheet print copied the reduced comparison view.')
        require('SYNTHETIC-STYLE-01' in text and 'CM' in text, 'Printed current sheet lost inherited style identity or active unit.')
        require(page.locator('#sheet-search').input_value()=='no-matching-row' and page.locator('#column-view').input_value()=='comparison', 'Print changed view-only screen state.')
        all_print,text=print_sheet(page,'all')
        require(all_print['rows']==190, 'All-sheet print lost source rows.')
        for sheet in SHEETS:require(sheet['title'] in text, 'Printed pack omitted a source tab.')
        require(page.locator('#sheet-search').input_value()=='no-matching-row' and page.locator('#column-view').input_value()=='comparison', 'All-sheet print changed the working screen.')
        report['workflows'].update({'csvAllRowsAllColumnsAndFormulaSafety':True,'currentPrint':current,'allSheetPrint':{'rows':190,**all_print},'printPreservesSearchAndColumnView':True})
        require(not errors and not external,'Synthetic workflows produced runtime errors or external requests.')
        print('daily editing, revisions, recovery, paste and printing: passed',flush=True)
    finally:
        context.close()


def legacy_pack():
    pack={'schemaVersion':1,'templateId':TEMPLATE['id'],'id':'synthetic-legacy-good','title':'SYNTHETIC LEGACY PACK','unit':'cm',
          'fields':{},'tables':{},'attachments':{},'updatedAt':'2026-10-22T10:00:00.000Z'}
    editable=lambda item:not item.get('readonly') and item.get('type') not in ['readonly','calculated']
    for sheet in SHEETS:
        pack['fields'][sheet['id']]={field['key']:'' for field in sheet.get('fields',[]) if editable(field)}
        pack['tables'][sheet['id']]={}
        for table in sheet.get('tables',[]):
            rows={}
            for row in table['rows']:
                columns=[{**column,**row.get('columnOverrides',{}).get(column['key'],{}),'key':column['key']} for column in table['columns']]
                rows[row['id']]={column['key']:None if column.get('type') in ['measurement','number'] else '' for column in columns if editable(column)}
            pack['tables'][sheet['id']][table['id']]=rows
        pack['attachments'][sheet['id']]={slot['key']:None for slot in sheet.get('attachments',[])}
    pack['fields']['pattern']['style']='SYNTHETIC-LEGACY-STYLE'
    pack['tables']['master']['specs']['1']['base']=20
    return pack


def check_legacy_migration(browser):
    good=legacy_pack()
    incompatible={'id':'synthetic-legacy-corrupt','schemaVersion':900,'privateSyntheticBytes':'SYNTHETIC RECOVERY CONTENT'}
    legacy=[good,incompatible]
    original=json.dumps(legacy,separators=(',',':'))
    context,page,errors,external=open_page(browser,legacy=legacy)
    try:
        page.wait_for_function("() => [...document.querySelectorAll('#saved-packs option')].some(option=>option.value==='synthetic-legacy-good')")
        records=database_records(page)
        saved=next(record for record in records['drafts'] if record['id']==good['id'])
        require(saved['snapshot']['schemaVersion']==2 and saved['snapshot']['tables']==good['tables'], 'Legacy migration changed source measurements or failed schema migration.')
        require(saved['snapshot']['fields']==good['fields'], 'Migration rewrote legacy sheet fields.')
        require(len(records['recoveries'])==1,'One incompatible legacy record should be isolated without hiding valid packs.')
        require(json.loads(records['recoveries'][0]['raw'])==incompatible,'Recovery did not retain the exact invalid record.')
        require(page.evaluate('(key)=>localStorage.getItem(key)',LEGACY_KEY)==original,'Migration replaced the original legacy bytes.')
        open_context(page)
        open_details_for(page,'#recovery-list')
        require(page.locator('#recovery-list button').count()>=1,'Isolated recovery bytes are not available to download.')
        with page.expect_download() as pending:page.locator('#recovery-list button').first.click()
        download=pending.value
        require(json.loads(Path(download.path()).read_text())==incompatible,'Recovery download did not contain the isolated original record.')
        download.delete()
        page.locator('#saved-packs').select_option(good['id'])
        page.locator('#open-pack').click()
        page.wait_for_function("()=>document.getElementById('status').textContent==='Reopened the saved working draft.'")
        open_details_for(page,'[data-style-key="number"]')
        page.locator('[data-style-key="number"]').fill('SYNTHETIC-LEGACY-EDITED')
        wait_saved_value(page,good['id'],['style','number'],'SYNTHETIC-LEGACY-EDITED')
        page.reload(wait_until='load')
        wait_ready(page)
        records=database_records(page)
        saved=next(record for record in records['drafts'] if record['id']==good['id'])
        require(saved['snapshot']['style']['number']=='SYNTHETIC-LEGACY-EDITED','Repeated migration overwrote a newer recovered draft.')
        require(len(records['recoveries'])==1,'Reload duplicated the same recovery record.')
        require(not errors and not external,'Legacy recovery produced a runtime error or external request.')
        report['workflows'].update({'legacyV1MigratesPerRecord':True,'incompatibleLegacyIsolatedAndDownloadable':True,
            'originalLegacyBytesUnchanged':True,'migrationDoesNotOverwriteNewerDraft':True,'recoveryReloadIsIdempotent':True})
        print('legacy migration and isolated recovery: passed',flush=True)
    finally:context.close()


def check_async_generation_guards(browser):
    first=legacy_pack()
    first.update({'id':'synthetic-async-a','title':'SYNTHETIC ASYNC A','updatedAt':'2026-10-22T09:00:00.000Z'})
    second=legacy_pack()
    second.update({'id':'synthetic-async-b','title':'SYNTHETIC ASYNC B','updatedAt':'2026-10-22T10:00:00.000Z'})
    context,page,errors,external=open_page(browser,legacy=[first,second])
    try:
        require(exported_json(page)['id']==second['id'],'Async guard test did not recover its latest synthetic draft.')
        open_context(page)
        open_details_for(page,'[data-style-key="description"]')
        page.evaluate('''() => {
            window.__dailyDelayMs=0;window.__dailyDelayedTransactions=0;window.__dailyReadKeys=[];
            const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
            Object.defineProperty(IDBTransaction.prototype,'oncomplete',{
                configurable:true,enumerable:descriptor.enumerable,get:descriptor.get,
                set(handler){const delay=window.__dailyDelayMs||0;if(delay)window.__dailyDelayedTransactions++;
                    descriptor.set.call(this,typeof handler==='function'&&delay?function(event){setTimeout(()=>handler.call(this,event),delay);}:handler);}
            });
            const original=IDBObjectStore.prototype.get;
            IDBObjectStore.prototype.get=function(key){if(this.name==='drafts')window.__dailyReadKeys.push(String(key));return original.call(this,key);};
        }''')
        page.locator('[data-style-key="description"]').fill('Synthetic change before switching')
        page.evaluate('() => {window.__dailyDelayMs=600;}')
        delayed=page.evaluate('window.__dailyDelayedTransactions')
        page.locator('#saved-packs').select_option(first['id'])
        page.locator('#open-pack').click()
        page.wait_for_function('(before)=>window.__dailyDelayedTransactions>before',arg=delayed)
        page.locator('[data-style-key="description"]').fill('Synthetic newer edit during save')
        page.wait_for_function("() => /draft changed.*saving/i.test(document.getElementById('status').textContent)",timeout=15000)
        page.evaluate('() => {window.__dailyDelayMs=0;}')
        current=exported_json(page)
        require(current['id']==second['id'] and current['style']['description']=='Synthetic newer edit during save','Saving during a switch discarded a newer edit.')
        wait_saved_value(page,second['id'],['style','description'],'Synthetic newer edit during save')
        page.wait_for_function("() => /saved locally/i.test(document.getElementById('footer-save-state').textContent)",timeout=15000)

        page.evaluate('() => {window.__dailyDelayMs=600;window.__dailyReadKeys=[];}')
        page.locator('#saved-packs').select_option(first['id'])
        page.locator('#open-pack').click()
        page.wait_for_function('(id)=>window.__dailyReadKeys.includes(id)',arg=first['id'],timeout=15000)
        page.locator('[data-style-key="description"]').fill('Synthetic newer edit during open read')
        page.wait_for_function("() => /draft changed while opening/i.test(document.getElementById('status').textContent)",timeout=15000)
        page.evaluate('() => {window.__dailyDelayMs=0;}')
        current=exported_json(page)
        require(current['id']==second['id'] and current['style']['description']=='Synthetic newer edit during open read','Opening a saved pack discarded an edit made during its read.')
        wait_saved_value(page,second['id'],['style','description'],'Synthetic newer edit during open read')
        page.wait_for_function("() => /saved locally/i.test(document.getElementById('footer-save-state').textContent)",timeout=15000)

        open_details_for(page,'#revision-name')
        page.locator('#revision-name').fill('Synthetic async restore checkpoint')
        page.locator('#revision-author').fill('Synthetic reviewer')
        page.locator('#create-revision').click()
        page.wait_for_function("() => document.querySelectorAll('#revision-list option').length > 1")
        revision=next(row for row in database_records(page)['revisions'] if row['packId']==second['id'])
        page.locator('[data-style-key="description"]').fill('Synthetic working value before restore')
        wait_saved_value(page,second['id'],['style','description'],'Synthetic working value before restore')
        page.locator('#revision-list').select_option(revision['id'])
        page.locator('#restore-revision').click()
        page.locator('#revision-dialog').wait_for(state='visible')
        page.evaluate('() => {window.__dailyDelayMs=600;}')
        delayed=page.evaluate('window.__dailyDelayedTransactions')
        page.locator('#confirm-restore').click()
        page.wait_for_function('(before)=>window.__dailyDelayedTransactions>before',arg=delayed)
        page.keyboard.press('Escape')
        page.locator('[data-style-key="description"]').fill('Synthetic newer edit after cancelling restore')
        page.wait_for_function("() => /restore was cancelled|draft changed/i.test(document.getElementById('status').textContent)",timeout=15000)
        page.evaluate('() => {window.__dailyDelayMs=0;}')
        current=exported_json(page)
        require(current['id']==second['id'] and current['style']['description']=='Synthetic newer edit after cancelling restore','A cancelled restore discarded a newer working edit.')
        require(next(row for row in database_records(page)['revisions'] if row['id']==revision['id'])==revision,'Cancelling an async restore changed its immutable named revision.')
        require(not errors and not external,'Async guard interactions caused a runtime error or external request.')
        report['workflows'].update({'asyncSwitchSaveProtectsNewerEdits':True,'asyncOpenReadProtectsNewerEdits':True,
            'cancelledAsyncRestoreProtectsNewerEdits':True})
        print('delayed save/open/restore preserves newer edits: passed',flush=True)
    finally:context.close()


def check_unavailable_storage(browser):
    context,page,errors,external=open_page(browser,unavailable=True)
    try:
        page.locator('#save-pack').click()
        require('json' in page.locator('#status').inner_text().lower(),'Unavailable storage must offer portable JSON rather than claim a save.')
        require(exported_json(page)['templateId']==TEMPLATE['id'],'Portable backup failed without IndexedDB.')
        require(not errors and not external,'Unavailable storage produced an uncaught error or external request.')
        report['workflows']['unavailableStorageKeepsPortableJsonBackup']=True
    finally:context.close()


server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
BASE_URL=f'http://127.0.0.1:{server.server_port}/'
Thread(target=server.serve_forever,daemon=True).start()
try:
    check_source_integrity()
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            if not args.workflow_only:check_layouts(browser)
            if not args.layout_only:
                check_daily_workflow(browser)
                check_legacy_migration(browser)
                check_async_generation_guards(browser)
                check_unavailable_storage(browser)
        except Exception as error:
            report['issues'].append(type(error).__name__+': '+str(error))
            traceback.print_exc()
        finally:browser.close()
except Exception as error:
    report['issues'].append(type(error).__name__+': '+str(error))
    traceback.print_exc()
finally:
    server.shutdown()
    server.server_close()
report['passed']=not report['issues']
report['buildSha256']=hashlib.sha256((ROOT/'tech-pack.html').read_bytes()).hexdigest()
report['screenshots']=[{'filename':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
                       for path in sorted(args.output.glob('workroom-daily-*.png'))]
(args.output/'workroom-daily.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'layouts':len(report['layouts']),'workflowChecks':len(report['workflows']),'issues':report['issues']},indent=2))
raise SystemExit(0 if report['passed'] else 1)
