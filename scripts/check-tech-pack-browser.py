"""Verify the standalone six-tab workroom; publish only pristine template captures.

Build with npm run techpack:build. Requires Playwright, Chromium, and pypdf.
Synthetic workflow values stay inside temporary browser contexts and downloads.
PDF bytes are read in memory and discarded; output contains no filled packs.
"""
from datetime import datetime, timezone
from io import BytesIO, StringIO
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from pathlib import Path
import argparse
import csv
import hashlib
import json
import re

from playwright.sync_api import sync_playwright
from pypdf import PdfReader
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = json.loads((ROOT / 'data/templates/tech-pack-workbook.v1.json').read_text())
FORM = json.loads((ROOT / 'data/house-fit-forms/SR-FORM-001.v1.json').read_text())
METHODS = json.loads((ROOT / 'data/house-fit-forms/SR-FORM-001-methods.v1.json').read_text())
SHEETS = TEMPLATE['sheets']
VIEWPORTS = [('desktop', 1500, 1000), ('laptop', 1280, 720), ('mobile', 390, 844),
             ('narrow-phone', 320, 568), ('landscape', 844, 390)]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'reports' / 'tech-pack-review')
parser.add_argument('--layout-only', action='store_true')
parser.add_argument('--workflow-only', action='store_true')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
BASE_URL = ''


class StandaloneHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/':
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write((ROOT / 'tech-pack.html').read_bytes())

    def log_message(self, *_args):
        pass


report = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'standalone': True,
          'sourceTabs': [s['title'] for s in SHEETS], 'layouts': [], 'workflow': {}, 'issues': []}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def open_page(browser, width=1500, height=1000, no_storage=False):
    context = browser.new_context(viewport={'width': width, 'height': height}, accept_downloads=True)
    if no_storage:
        context.add_init_script("Storage.prototype.getItem=function(){throw Error('Synthetic unavailable storage');};Storage.prototype.setItem=function(){throw Error('Synthetic unavailable storage');};")
    page = context.new_page()
    errors, external = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: external.append(r.url) if r.url.startswith(('http:', 'https:')) and not r.url.startswith(BASE_URL) else None)
    page.on('dialog', lambda d: d.accept())
    page.goto(BASE_URL, wait_until='load')
    page.wait_for_selector('#sheet-tabs button', timeout=10000)
    page.evaluate('document.fonts.ready')
    require(not errors, 'Standalone runtime error: ' + '; '.join(errors))
    require(not external, 'Standalone made an external request.')
    return context, page, errors, external


def select_sheet(page, sheet_id):
    page.locator('#tab-' + sheet_id).click()
    require(page.locator('#tab-' + sheet_id).get_attribute('aria-selected') == 'true', 'Tab did not become selected.')


def open_details_for(page, selector):
    page.locator(selector).evaluate("el=>{const d=el.closest('details');if(d)d.open=true}")


def pristine(page):
    require(page.locator('#pack-title').input_value() == 'Untitled tech pack', 'Refusing to capture a filled pack title.')
    require(page.locator('#saved-packs option').count() == 1, 'Refusing to capture saved pack names.')
    require(page.locator('#sheet-content [data-field]').evaluate_all('els=>els.every(el=>el.value==="")'), 'Refusing to capture filled metadata.')
    require(page.locator('#sheet-content textarea,#sheet-content input[type=text]').evaluate_all('els=>els.every(el=>el.value==="")'), 'Refusing to capture filled editable rows.')
    require(page.locator('#sheet-content .attachment-card img').count() == 0, 'Refusing to capture attached pack images.')


def layout(page):
    return page.evaluate("""()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};const root=document.documentElement;const controls=[...document.querySelectorAll('.app-footer button,.app-footer select')];return {viewport:{width:innerWidth,height:innerHeight},document:{width:root.scrollWidth,height:root.scrollHeight},content:rect('#sheet-content'),footer:rect('.app-footer'),controls:controls.map(el=>({id:el.id,height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width,reachable:el.getBoundingClientRect().height>0})),font:getComputedStyle(document.body).fontFamily,blueTextMismatches:[...document.querySelectorAll('body *')].filter(el=>el.getClientRects().length&&getComputedStyle(el).backgroundColor==='rgb(30, 34, 170)'&&getComputedStyle(el).color!=='rgb(228, 0, 43)').map(el=>el.tagName+'.'+el.className),sealLoaded:[...document.querySelectorAll('.house-seal img,img.house-seal')].some(el=>el.complete&&el.naturalWidth>0)}}""")


def check_table_counts(page, sheet):
    for table in sheet.get('tables', []):
        require(page.locator(f'#sheet-content table[data-table="{table["id"]}"] tbody tr').count() == len(table['rows']), 'A source row is missing: ' + table['id'])
    if sheet.get('reference'):
        require(page.locator('#sheet-content tr[data-reference]').count() == 20, 'Approved reference must have 20 rows.')
        require(page.locator('#sheet-content .photos img').evaluate_all('els=>els.length===2&&els.every(el=>el.complete&&el.naturalWidth>0)'), 'Original front/back photos failed to load offline.')


def capture_layouts(browser):
    for viewport, width, height in VIEWPORTS:
        context, page, errors, external = open_page(browser, width, height)
        try:
            for sheet in SHEETS:
                select_sheet(page, sheet['id'])
                check_table_counts(page, sheet)
                data = layout(page)
                require(data['document']['width'] <= width + 1, f'{viewport}/{sheet["id"]}: horizontal root overflow.')
                require(data['document']['height'] <= height + 1, f'{viewport}/{sheet["id"]}: vertical root overflow.')
                require(data['content']['height'] >= 44, f'{viewport}/{sheet["id"]}: working content is not usable.')
                require(data['footer']['bottom'] <= height + 1, f'{viewport}/{sheet["id"]}: footer beyond viewport.')
                require(all(c['height'] >= 43.5 for c in data['controls']), f'{viewport}/{sheet["id"]}: footer control below44px.')
                require(not data['blueTextMismatches'], f'{viewport}/{sheet["id"]}: Electric surface does not have Ruby text.')
                require(data['sealLoaded'] and 'Barlow Condensed' in data['font'], 'Original seal or Barlow font failed.')
                require(page.evaluate('document.fonts.check("700 22px Barlow Condensed")'), 'Title weight font unavailable.')
                if viewport == 'desktop' or (viewport == 'mobile' and sheet['id'] in ['pattern', 'body', 'graded']):
                    pristine(page)
                    filename = f'tech-pack-{sheet["id"]}-{viewport}.png'
                    page.screenshot(path=str(args.output / filename))
                    data['blankScreenshot'] = filename
                report['layouts'].append({'viewport': viewport, 'sheet': sheet['id'], **data})
            # Native details must remain usable as the phone editor expands.
            if width <= 740:
                page.locator('#context-panel summary').click()
                require(page.locator('#pack-title').is_visible(), 'Mobile pack details editor failed to open.')
                body = page.locator('.context-body').evaluate('(el)=>({height:el.clientHeight,scrollHeight:el.scrollHeight})')
                require(body['height'] >= 44, 'Mobile context body has no scroll space.')
                page.locator('#context-panel summary').click()
            require(not errors and not external, 'Runtime/external request during layout checks.')
        finally:
            context.close()


def cell(page, table, row, column):
    return page.locator(f'#sheet-content [data-table="{table}"][data-row="{row}"][data-col="{column}"]')


def result(page, table, row, column):
    return page.locator(f'#sheet-content table[data-table="{table}"] tr[data-row="{row}"] [data-result="{column}"]')


def exported_json(page):
    with page.expect_download() as pending:
        page.locator('#export-json').click()
    download = pending.value
    content = json.loads(Path(download.path()).read_text())
    download.delete()
    return content


def print_geometry(page):
    page.emulate_media(media='print')
    widths = page.locator('#print-view .work-table').evaluate_all('els=>els.map(el=>({width:el.getBoundingClientRect().width,available:document.getElementById("print-view").getBoundingClientRect().width}))')
    require(all(row['width'] <= row['available'] + 1 for row in widths), 'Printed table exceeds printable content width.')
    require(page.locator('#print-view img').evaluate_all('els=>els.every(el=>el.complete&&el.naturalWidth>0)'), 'Print contains an unloaded reference image.')
    return widths


def check_reference(page):
    select_sheet(page, 'body')
    require(page.locator('#pack-unit').input_value() == 'in', 'Reference must start in canonical inches display.')
    rows = page.locator('#sheet-content tr[data-reference]')
    require(rows.count() == 20 and rows.locator('input,textarea').count() == 0, 'Approved measurements must be read-only.')
    labels = {m['pomCode']: m for m in METHODS['methods']}
    missing = 0
    for record in FORM['measurements']:
        row = page.locator(f'#sheet-content tr[data-reference="{record["pomCode"]}"]')
        values = row.locator('td').all_text_contents()
        require(values[0] == labels[record['pomCode']]['sourceLabel'], 'Source POM label changed.')
        require(values[1] == labels[record['pomCode']]['howToMeasure'], 'Source method changed.')
        require(float(values[3]) == record['houseStandard'], 'Approved actual form changed.')
        if record['manufacturerReference'] is None:
            missing += 1
            require(values[2].strip() in ['—', ''] and values[4].strip() in ['—', ''], 'Missing MFR produced a number.')
        else:
            require(float(values[2]) == record['manufacturerReference'], 'Manufacturer reference changed.')
    require(missing == 13, 'Expected13 absent and7 present manufacturer references.')
    page.locator('#pack-unit').select_option('cm')
    require('2.54' not in page.locator('#sheet-note').inner_text(), 'Unexpected source method mutation.')
    page.locator('#pack-unit').select_option('in')
    report['workflow']['approvedReference'] = {'rows': 20, 'manufacturerReferences': 7, 'missingReferences': 13, 'readonly': True, 'exactLabelsMethodsValues': True}


def check_workflow(browser):
    context, page, errors, external = open_page(browser)
    try:
        # Keyboard tabs keep focus and selection coordinated.
        page.locator('#tab-pattern').focus()
        page.keyboard.press('End')
        require(page.locator('#tab-body').get_attribute('aria-selected') == 'true', 'End key did not select final tab.')
        # Reference targets have their own IN display while garment unit is unset.
        cell(page, 'referenceNotes', '1', 'houseTarget').fill('10')
        reference_only = exported_json(page)
        require(reference_only['unit'] is None, 'Reference entry must not invent a garment unit.')
        require(reference_only['tables']['body']['referenceNotes']['1']['houseTarget'] == 25.4, 'Reference target must export canonical CM without a garment unit.')
        report['workflow']['referenceTargetWithoutGarmentUnit'] = True
        page.locator('#tab-body').focus()
        page.keyboard.press('Home')
        require(page.locator('#tab-pattern').get_attribute('aria-selected') == 'true', 'Home key did not select first tab.')
        open_details_for(page, '[data-field=style]')
        page.locator('[data-field=style]').fill('SYNTHETIC-WORKROOM-TEST')
        select_sheet(page, 'fit')
        require('SYNTHETIC-WORKROOM-TEST' in page.locator('#sheet-content').inner_text(), 'FIT style link did not follow Pattern Card.')
        select_sheet(page, 'wash')
        require(cell(page, 'measurements', '1', 'atarget').is_disabled(), 'Garment unit selection must precede measurement entry.')
        page.locator('#pack-unit').select_option('cm')
        cell(page, 'measurements', '1', 'atarget').fill('20')
        cell(page, 'measurements', '1', 'aafter').fill('18')
        require(result(page, 'measurements', '1', 'adelta').inner_text() == '+2', 'Wash delta must equal Target − After Wash.')
        cell(page, 'measurements', '1', 'aafter').fill('')
        require(result(page, 'measurements', '1', 'adelta').inner_text().strip() in ['', '—'], 'Missing wash value must not become zero.')
        cell(page, 'measurements', '1', 'atarget').fill('0')
        cell(page, 'measurements', '1', 'aafter').fill('0')
        require(result(page, 'measurements', '1', 'adelta').inner_text() == '0', 'Measured zero must calculate as zero.')
        cell(page, 'measurements', '30', 'atarget').fill('20')
        cell(page, 'measurements', '30', 'aafter').fill('18')
        require(cell(page, 'measurements', '30', 'adelta').input_value() == '', 'Source spec row without a formula must start blank.')
        cell(page, 'measurements', '30', 'adelta').fill('-1.25')
        cell(page, 'measurements', '31', 'bdelta').fill('0.75')
        require(cell(page, 'measurements', '30', 'adelta').input_value() == '-1.25', 'Manual source delta must accept signed entry without auto-calculation.')
        with page.expect_download() as pending:
            page.locator('#export-csv').click()
        manual_csv = pending.value
        manual_rows = list(csv.reader(StringIO(Path(manual_csv.path()).read_text())))
        manual_csv.delete()
        require(any('-1.25' in row for row in manual_rows) and any('0.75' in row for row in manual_rows), 'CSV omitted manual signed delta entries.')
        cell(page, 'measurements', '1', 'atarget').fill('oops')
        page.locator('#tab-master').click()
        require(page.locator('#tab-wash').get_attribute('aria-selected') == 'true', 'Invalid input must block tab change.')
        cell(page, 'measurements', '1', 'atarget').fill('20')
        select_sheet(page, 'master')
        cell(page, 'specs', '1', 'base').fill('20')
        cell(page, 'specs', '1', 'actual').fill('24.75')
        require(result(page, 'specs', '1', 'delta').inner_text() == '+4.75', 'Master delta must equal Actual − Base.')
        page.locator('#pack-unit').select_option('in')
        require(abs(float(cell(page, 'specs', '1', 'base').input_value()) - 20 / 2.54) < 0.000001, 'IN display conversion failed.')
        for _ in range(3):
            page.locator('#pack-unit').select_option('cm')
            page.locator('#pack-unit').select_option('in')
        page.locator('#pack-unit').select_option('cm')
        require(cell(page, 'specs', '1', 'base').input_value() == '20', 'Unit round-trip accumulated rounding.')
        cell(page, 'specs', '1', 'note').fill('=SYNTHETIC_FORMULA()')
        page.locator('#sheet-search').fill('SYNTHETIC_FORMULA')
        require(page.locator('#sheet-content table[data-table=specs] tbody tr:visible').count() == 1, 'POM search did not filter rows.')
        with page.expect_download() as pending:
            page.locator('#export-csv').click()
        download = pending.value
        csv_rows = list(csv.reader(StringIO(Path(download.path()).read_text())))
        download.delete()
        require(any("'=SYNTHETIC_FORMULA()" in row for row in csv_rows), 'CSV did not neutralize formula-like text.')
        require(len(csv_rows) >= 30, 'CSV omitted rows hidden by the search.')
        page.locator('#clear-search').click()
        select_sheet(page, 'graded')
        open_details_for(page, '[data-field=sizeF]')
        page.locator('[data-field=sizeF]').fill('SYNTHETIC-SIZE')
        require('SYNTHETIC-SIZE' in page.locator('table[data-table=before] thead').inner_text(), 'Graded header must update immediately.')
        require('SYNTHETIC-SIZE' in cell(page, 'before', '1', 'sizeF').get_attribute('aria-label'), 'Graded input label must update immediately with size header.')
        require('SYNTHETIC-SIZE' in page.locator('table[data-table=after] thead').inner_text(), 'Both graded grids must update immediately.')
        select_sheet(page, 'pattern')
        select_sheet(page, 'graded')
        require('SYNTHETIC-SIZE' in page.locator('table[data-table=before] thead').inner_text(), 'Graded size header did not persist.')
        check_reference(page)
        # Local raster attachment is included in the same JSON snapshot.
        select_sheet(page, 'pattern')
        open_details_for(page, '[data-attachment=reference]')
        image_bytes = BytesIO()
        Image.new('RGB', (2, 2), (16, 24, 32)).save(image_bytes, format='PNG')
        page.locator('[data-attachment=reference]').set_input_files({'name': 'synthetic-reference.png', 'mimeType': 'image/png', 'buffer': image_bytes.getvalue()})
        page.wait_for_function('()=>document.querySelector("#sheet-content .attachment-card img")?.naturalWidth===2')
        page.locator('#pack-title').fill('SYNTHETIC PACK ONE')
        page.locator('#save-pack').click()
        require('saved' in page.locator('#status').inner_text().lower(), 'First local save failed.')
        first = exported_json(page)
        require(first['fields']['pattern']['style'] == 'SYNTHETIC-WORKROOM-TEST', 'JSON omitted first-tab metadata.')
        require(first['tables']['master']['specs']['1']['base'] == 20, 'JSON lost canonical CM values.')
        require(first['tables']['wash']['measurements']['30']['adelta'] == -1.25 and first['tables']['wash']['measurements']['31']['bdelta'] == 0.75, 'Manual signed source delta cells were not saved/exported.')
        require(first['fields']['graded']['sizeF'] == 'SYNTHETIC-SIZE', 'JSON omitted size header.')
        require(first['attachments']['pattern']['reference']['type'] == 'image/png', 'JSON omitted local image attachment.')
        report['workflow']['rasterAttachmentRoundtrip'] = True
        page.locator('#new-pack').click()
        page.locator('#pack-title').fill('SYNTHETIC PACK TWO')
        page.locator('#save-pack').click()
        require(page.locator('#saved-packs option').count() == 3, 'Two drafts were not retained separately.')
        page.locator('#saved-packs').select_option(first['id'])
        page.locator('#open-pack').click()
        select_sheet(page, 'master')
        require(cell(page, 'specs', '1', 'actual').input_value() == '24.75', 'Reopened draft lost its measurements.')
        page.locator('#json-file').set_input_files({'name': 'synthetic-roundtrip.json', 'mimeType': 'application/json', 'buffer': json.dumps(first).encode()})
        require('Imported pack' in page.locator('#status').inner_text(), 'Compatible JSON import failed.')
        # Untrusted import must not replace the current pack.
        bad = json.loads(json.dumps(first))
        bad['fields']['pattern']['unexpected'] = 'reject'
        page.locator('#json-file').set_input_files({'name': 'synthetic-invalid.json', 'mimeType': 'application/json', 'buffer': json.dumps(bad).encode()})
        require('Import refused' in page.locator('#status').inner_text(), 'Unknown import field was accepted.')
        require(page.locator('#pack-title').input_value() == 'SYNTHETIC PACK ONE', 'Rejected import damaged current pack.')
        # Actual printing uses every row and leaves the screen selection and query intact.
        page.locator('#sheet-search').fill('SYNTHETIC_FORMULA')
        page.evaluate('window.print=()=>{}')
        page.locator('#print-scope').select_option('current')
        page.locator('#print-pack').click()
        require(page.locator('#print-view table[data-table=specs] tbody tr').count() == 30, 'Print omitted filtered rows.')
        current_widths = print_geometry(page)
        pdf = page.pdf(print_background=True, prefer_css_page_size=True)
        page.emulate_media(media='screen')
        current_reader = PdfReader(BytesIO(pdf))
        current_text = '\n'.join(p.extract_text() for p in current_reader.pages)
        require('SYNTHETIC_FORMULA' in current_text and '24.75' in current_text, 'Current-sheet PDF lost fields.')
        require(page.locator('#sheet-search').input_value() == 'SYNTHETIC_FORMULA', 'Print changed the working filter.')
        page.locator('#print-scope').select_option('all')
        page.locator('#print-pack').click()
        require(page.locator('#print-view table tbody tr').count() == 190, 'All-sheet print lost source rows.')
        all_widths = print_geometry(page)
        pdf = page.pdf(print_background=True, prefer_css_page_size=True)
        page.emulate_media(media='screen')
        reader = PdfReader(BytesIO(pdf))
        text = re.sub(r'\s+', ' ', '\n'.join(p.extract_text() for p in reader.pages))
        for sheet in SHEETS:
            require(sheet['title'] in text, 'All-sheet PDF omitted ' + sheet['title'])
        require(page.locator('#sheet-search').input_value() == 'SYNTHETIC_FORMULA', 'All-sheet print changed screen state.')
        report['workflow'].update({'keyboardTabs': True, 'unitChoiceRequired': True, 'washFormula': True,
            'sourceFormulaGapsAndManualDeltaEntriesPreserved': True, 'zeroAndMissingDistinct': True, 'invalidInputBlocksNavigation': True,
            'masterFormula': True, 'canonicalUnitRoundtrip': True, 'fitStyleLink': True, 'gradedHeaderPersisted': True,
            'search': True, 'csvAllRowsAndFormulaSafety': True, 'twoSavedDrafts': True, 'jsonRoundtrip': True,
            'unsafeImportRejected': True, 'currentSheetPrint': {'pages': len(current_reader.pages), 'tableWidths': current_widths},
            'allSheetsPrint': {'pages': len(reader.pages), 'rows': 190, 'tableWidths': all_widths}, 'printRestoresFilter': True})
        require(not errors and not external, 'Runtime error or external request in workflow.')
    finally:
        context.close()
    context, page, errors, external = open_page(browser, no_storage=True)
    try:
        page.locator('#save-pack').click()
        require('Download JSON' in page.locator('#status').inner_text(), 'Unavailable storage needs JSON backup guidance.')
        require(exported_json(page)['templateId'] == TEMPLATE['id'], 'Offline export must work without storage.')
        report['workflow']['unavailableStorageBackup'] = True
    finally:
        context.close()


server = ThreadingHTTPServer(('127.0.0.1', 0), StandaloneHandler)
BASE_URL = f'http://127.0.0.1:{server.server_port}/'
Thread(target=server.serve_forever, daemon=True).start()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    try:
        if not args.workflow_only:
            capture_layouts(browser)
        if not args.layout_only:
            check_workflow(browser)
    except Exception as error:
        report['issues'].append(str(error))
    finally:
        browser.close()
server.shutdown()
server.server_close()
report['passed'] = not report['issues']
report['buildSha256'] = hashlib.sha256((ROOT / 'tech-pack.html').read_bytes()).hexdigest()
(args.output / 'tech-pack-browser.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'passed': report['passed'], 'layouts': len(report['layouts']), 'workflowChecks': len(report['workflow']), 'issues': report['issues']}, indent=2))
raise SystemExit(0 if report['passed'] else 1)
