"""Review the blank Case 2 client intake in standalone and local SQLite modes.

Run ``npm run intake:build`` first. Optional review dependencies are Python
Playwright, pypdf, Node.js 24+, and /usr/bin/chromium. Public screenshots are
captured before entering any values. Interaction fixtures are unmistakably
synthetic, private to temporary browser contexts/databases, and never included
in screenshots or output JSON. Filled PDFs stay in memory; downloads are deleted.
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
import select
import subprocess
import tempfile
import unicodedata

from playwright.sync_api import sync_playwright
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
BASELINE = '8c40eb82f23d2918ed502d9938899fc6d2631cac'
TEMPLATE_PATH = 'data/templates/remote-bespoke-client-intake.v1.json'
TEMPLATE = json.loads((ROOT / TEMPLATE_PATH).read_text())
POMS = [record['pomCode'] for record in TEMPLATE['measurements']]
REQUIRED = [record['pomCode'] for record in TEMPLATE['measurements'] if record['required']]
VIEWPORTS = [('desktop', 1500, 1000), ('laptop', 1280, 720), ('mobile', 390, 844),
             ('small-mobile', 390, 667), ('landscape', 844, 390), ('narrow-phone', 320, 568),
             ('short-phone', 320, 480), ('short-tablet', 768, 400), ('reduced-layout', 750, 500)]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'reports' / 'client-intake-workroom-review')
parser.add_argument('--viewport', action='append', help='Select a viewport; repeat for several. Default: all nine.')
parser.add_argument('--mode', choices=['standalone', 'sqlite'], action='append', help='Select a runtime. Default: both.')
scope = parser.add_mutually_exclusive_group()
scope.add_argument('--viewports-only', action='store_true', help='Run blank layout checks without private workflow tests.')
scope.add_argument('--workflow-only', action='store_true', help='Run private functional checks without taking screenshots.')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
MODES = args.mode or ['standalone', 'sqlite']


def preserved_sources():
    paths = [TEMPLATE_PATH, 'data/house-fit-forms/SR-FORM-001.v1.json',
             'data/house-fit-forms/SR-FORM-001-methods.v1.json', 'design/brand-tokens.json',
             'sheet-web/sheet.css', 'sheet-web/sheet.js', 'sheet-web/matte-grain.svg',
             'src/house-measurement-sheet.mjs', 'src/house-sheet-units.mjs', 'src/client-intake.mjs',
             'assets/house-sheet/mannequin-front.jpg', 'assets/house-sheet/mannequin-back.jpg',
             'assets/house-sheet/serpentis-regina-seal.png',
             'assets/house-sheet/fonts/barlow-condensed-500.ttf',
             'assets/house-sheet/fonts/barlow-condensed-700.ttf']
    hashes = {}
    for path in paths:
        current = (ROOT / path).read_bytes()
        original = subprocess.check_output(['git', 'show', f'{BASELINE}:{path}'], cwd=ROOT)
        assert current == original, f'Controlled source changed: {path}'
        hashes[path] = hashlib.sha256(current).hexdigest()
    return {'comparedWith': BASELINE, 'allControlledBytesPreserved': True, 'sha256': hashes}


class StandaloneHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/':
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write((ROOT / 'client-intake.html').read_bytes())

    def log_message(self, *_args):
        pass


NODE_SERVER = """const {createClientIntakeServer}=await import(process.argv[1]);
const server=await createClientIntakeServer({databasePath:process.argv[2]});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
console.log(JSON.stringify({base:'http://127.0.0.1:'+server.address().port+'/'}));
process.once('SIGTERM',()=>server.close());
"""


def start_sqlite(runtime_directory):
    process = subprocess.Popen(['node', '--input-type=module', '-e', NODE_SERVER,
                                (ROOT / 'src/client-intake-server.mjs').as_uri(),
                                str(Path(runtime_directory) / 'synthetic-intake-tests.sqlite')],
                               cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if not select.select([process.stdout], [], [], 20)[0]:
        process.terminate()
        raise AssertionError('The temporary local intake service did not start.')
    line = process.stdout.readline()
    if not line:
        raise AssertionError('The temporary local intake service failed: ' + process.stderr.read())
    return process, json.loads(line)['base']


def stop_sqlite(process):
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def open_page(browser, base, width=1500, height=1000, storage_unavailable=False):
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                  accept_downloads=True)
    if storage_unavailable:
        context.add_init_script("""Storage.prototype.getItem=function(){throw new Error('Synthetic unavailable-storage fixture');};
            Storage.prototype.setItem=function(){throw new Error('Synthetic unavailable-storage fixture');};""")
    page = context.new_page()
    failures, external, api_requests = [], [], []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.on('console', lambda message: failures.append(message.text) if message.type == 'error' else None)
    page.on('request', lambda request: external.append(request.url) if request.url.startswith(('http:', 'https:')) and not request.url.startswith(base) else None)
    page.on('request', lambda request: api_requests.append(request.method) if '/api/client-intake/' in request.url else None)
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(base, wait_until='load')
    page.wait_for_function('()=>document.documentElement.dataset.ready === "true"')
    page.evaluate('document.fonts.ready')
    return context, page, failures, external, api_requests


def show_context(page, tab):
    context = page.locator('#intake-context')
    if context.get_attribute('open') is None:
        context.locator('summary').click()
    page.locator(f'[data-context-tab="{tab}"]').click()
    assert page.locator(f'#context-{tab}').is_visible()


def assert_blank(page):
    # This guard runs immediately before every public screenshot.
    for definition in TEMPLATE['fields']:
        value = page.locator('#client-' + definition['key']).input_value()
        if definition['type'] == 'date':
            assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', value), 'Blank intake should retain the generated measurement date.'
        else:
            assert value == TEMPLATE.get('defaults', {}).get(definition['key'], ''), 'Refusing to capture a populated client field.'
    assert page.locator('#intake-rows input[data-field=measurement]').evaluate_all('inputs=>inputs.every(el=>el.value==="")'), 'Refusing to capture populated measurements.'
    assert page.locator('#croquis-reference').input_value() == '' and page.locator('#client-reference').input_value() == ''
    assert page.locator('#saved-intakes option').count() == 1, 'Refusing to capture a saved-client listing.'


def capture_blank(page, filename):
    assert_blank(page)
    page.screenshot(path=str(args.output / filename))


def check_template(page):
    rows = page.locator('#intake-rows tr')
    assert rows.count() == 34 and page.locator('#intake-table thead th').count() == 5
    assert rows.evaluate_all('rows=>rows.map(row=>row.dataset.pom)') == POMS
    assert 'RC-21' not in POMS and len(REQUIRED) == 19
    assert page.locator('#intake-rows .tag.required').count() == 19
    assert page.locator('#intake-unit').input_value() == 'CM'
    assert page.locator('#intake-unit option').evaluate_all('options=>options.map(el=>el.value)') == ['CM', 'IN']
    assert not re.search(r'\b(?:MFR|DELTA)\b', page.locator('#intake-table thead').inner_text(), re.IGNORECASE)
    for definition in TEMPLATE['measurements']:
        row = page.locator(f'#intake-rows tr[data-pom="{definition["pomCode"]}"]')
        assert row.locator('.method-text').text_content() == definition['howToMeasure']
        assert row.locator('.measure-label').text_content() == definition['label']
        assert bool(row.locator('.method-warning').count()) == bool(definition.get('methodNeedsConfirmation'))
    assert page.locator('#intake-rows tr[data-pom=RC-12] .method-warning').count() == 1
    assert page.locator('#intake-rows tr[data-pom=RC-13] .method-warning').count() == 1
    assert page.evaluate("""document.fonts.check("700 22px 'Barlow Condensed'")""")
    assert 'Barlow Condensed' in page.locator('body').evaluate('(el)=>getComputedStyle(el).fontFamily')
    seal = page.locator('.seal-zone img')
    assert seal.count() == 1 and seal.evaluate('(el)=>el.complete&&el.naturalWidth>0')
    assert page.locator('.seal-zone').inner_text().strip() == ''


def check_colors(page, state):
    result = page.locator('body').evaluate(r"""body=>{
        const blue='rgb(30, 34, 170)',ruby='rgb(228, 0, 43)',ash='rgb(146, 152, 157)',obsidian='rgb(16, 24, 32)',green='rgb(31, 168, 36)',line='rgb(41, 50, 57)';
        const allowed=new Set([blue,ruby,ash,obsidian,green,line,'rgba(0, 0, 0, 0)']);
        const bg=el=>{for(let a=el;a;a=a.parentElement){const c=getComputedStyle(a).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent')return c;}return 'transparent';};
        const violations=[];
        for(const el of [body,...body.querySelectorAll('*')]){
            const s=getComputedStyle(el),r=el.getBoundingClientRect();
            if(!r.width||!r.height||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)continue;
            const id={tag:el.tagName,id:el.id,class:el.className};
            for(const p of ['color','backgroundColor'])if(!allowed.has(s[p]))violations.push({...id,rule:'Unexpected interface color',property:p,value:s[p]});
            if(s.backgroundColor===blue&&s.color!==ruby)violations.push({...id,rule:'Electric fill requires Ruby text'});
            const direct=[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
            if(direct&&bg(el)===blue&&s.color!==ruby)violations.push({...id,rule:'Text on Electric must be Ruby'});
            if((s.color===ruby||s.webkitTextFillColor===ruby)&&bg(el)!==blue)violations.push({...id,rule:'Ruby text outside Electric'});
            for(const side of ['Top','Right','Bottom','Left'])if(parseFloat(s['border'+side+'Width'])>0&&s['border'+side+'Style']!=='none'&&[ruby,green].includes(s['border'+side+'Color']))violations.push({...id,rule:'Colored border'});
            if(parseFloat(s.outlineWidth)>0&&s.outlineStyle!=='none'&&[ruby,green].includes(s.outlineColor))violations.push({...id,rule:'Colored outline'});
        }
        return {violations,bodyColor:getComputedStyle(body).color};
    }""")
    assert not result['violations'], (state, result['violations'])
    assert result['bodyColor'] == 'rgb(146, 152, 157)'
    return {'housePaletteOnly': True, 'electricRubyPairing': True, 'ashBodyText': True,
            'neutralBorders': True, 'noSalmonOrLegacyWorkbookUi': True}


def check_filter_checkmarks(page):
    selected = page.locator('[data-intake-filter][aria-pressed=true]')
    assert selected.count() == 1 and selected.locator('.filter-check').is_visible()
    for check in page.locator('[data-intake-filter][aria-pressed=false] .filter-check').all():
        assert not check.is_visible()


def show_all_rows(page):
    page.locator('#intake-search').fill('')
    page.locator('[data-intake-filter=all]').click()


def chart_layout(page):
    return page.evaluate("""()=>{
        const chart=document.querySelector('.table-wrap'),cr=chart.getBoundingClientRect(),hr=document.querySelector('#intake-table thead').getBoundingClientRect();
        return {width:innerWidth,height:innerHeight,rootWidth:document.documentElement.scrollWidth,
            chartHeight:chart.clientHeight,chartScrollHeight:chart.scrollHeight,
            completeVisibleRows:[...document.querySelectorAll('#intake-rows tr')].filter(el=>{const r=el.getBoundingClientRect();return !el.hidden&&r.top>=hr.bottom-1&&r.bottom<=cr.bottom+1;}).length};
    }""")


def check_blank_viewport(browser, base, mode, name, width, height):
    context, page, errors, external, api_requests = open_page(browser, base, width, height)
    try:
        check_template(page)
        assert_blank(page)
        colors = check_colors(page, f'{mode}:{name}')
        check_filter_checkmarks(page)
        details = page.locator('#intake-context')
        assert (details.get_attribute('open') is not None) == (width > 740), (mode, name, 'Unexpected default context state')
        layout = chart_layout(page)
        assert layout['rootWidth'] <= width + 1, (mode, name, layout)
        assert layout['completeVisibleRows'] >= 1, (mode, name, layout)
        assert layout['chartScrollHeight'] > layout['chartHeight'], (mode, name, layout)
        if name in ('desktop', 'mobile', 'landscape'):
            capture_blank(page, f'case-2-client-intake-{mode}-{name}.png')
        chart = page.locator('.table-wrap')
        fixed_header = page.locator('.masthead').bounding_box()
        table_header = page.locator('#intake-table thead').bounding_box()
        chart.focus()
        page.keyboard.press('PageDown')
        page.wait_for_function('()=>document.querySelector(".table-wrap").scrollTop>0')
        assert page.locator('.masthead').bounding_box() == fixed_header
        assert abs(page.locator('#intake-table thead').bounding_box()['y'] - table_header['y']) < 1
        chart.evaluate('(el)=>el.scrollTop=0')
        pom_x = page.locator('#intake-rows tr').first.locator('.pom-code').bounding_box()['x']
        chart.evaluate('(el)=>el.scrollLeft=el.scrollWidth')
        assert abs(page.locator('#intake-rows tr').first.locator('.pom-code').bounding_box()['x'] - pom_x) < 1
        if name == 'mobile':
            capture_blank(page, f'case-2-client-intake-{mode}-mobile-values.png')
        chart.evaluate('(el)=>el.scrollLeft=0')
        page.locator('[data-intake-filter=required]').click()
        assert page.locator('#intake-rows tr:visible').count() == 19
        page.locator('[data-intake-filter=missing]').click()
        assert page.locator('#intake-rows tr:visible').count() == 19
        check_filter_checkmarks(page)
        page.locator('#intake-search').fill('not-a-pom')
        assert page.locator('#intake-rows tr:visible').count() == 0
        page.locator('#clear-intake-search').click()
        assert page.locator('#intake-search').input_value() == ''
        assert page.locator('#intake-rows tr:visible').count() == 34
        assert page.locator('#save-intake').is_disabled(), 'Search and filters must not dirty a blank intake.'
        for tab in ('client', 'references', 'drafts'):
            show_context(page, tab)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            if name == 'desktop' and tab in ('references', 'drafts'):
                capture_blank(page, f'case-2-client-intake-{mode}-{tab}.png')
        show_context(page, 'client')
        for definition in TEMPLATE['fields']:
            control = page.locator('#client-' + definition['key'])
            control.focus()
            control.scroll_into_view_if_needed()
            assert control.is_visible(), (mode, name, definition['key'])
        assert not external and not errors, (mode, name, external, errors)
        if mode == 'standalone':
            assert not api_requests, 'Standalone intake must not call the local SQLite API.'
        return {'name': name, **layout, 'colors': colors,
                'blankCaptureGuard': True, 'fiveColumnsAnd34OriginalPoms': True,
                'requiredAndMissingFilters': True, 'stickyPomAndHeadings': True,
                'contextFieldsReachable': True}
    finally:
        context.close()


def downloaded_text(page, button):
    with page.expect_download() as event:
        page.locator(button).click()
    download = event.value
    path = download.path()
    try:
        return Path(path).read_text(encoding='utf-8-sig')
    finally:
        download.delete()


PRINT_STATE = """()=>({query:document.querySelector('#intake-search').value,
    filters:[...document.querySelectorAll('[data-intake-filter]')].map(el=>el.getAttribute('aria-pressed')),
    hidden:[...document.querySelectorAll('#intake-rows tr')].map(el=>el.hidden),
    contextOpen:document.querySelector('#intake-context').open,
    pages:['client','references','drafts'].map(id=>document.querySelector('#context-'+id).hidden),
    tabs:[...document.querySelectorAll('[data-context-tab]')].map(el=>({selected:el.getAttribute('aria-selected'),tabIndex:el.tabIndex})),
    contextScrollTop:document.querySelector('.context-body').scrollTop,
    count:document.querySelector('#visible-count').textContent,
    scrollTop:document.querySelector('.table-wrap').scrollTop,
    scrollLeft:document.querySelector('.table-wrap').scrollLeft,
    unit:document.querySelector('#intake-unit').value})"""


def check_private_print(page, scenario, unit, tab):
    show_context(page, 'drafts')
    page.locator('#intake-unit').select_option(unit)
    show_all_rows(page)
    if scenario == 'required-search' and page.locator('#intake-context summary').is_visible():
        page.locator('[data-intake-filter=required]').click()
        page.locator('#intake-search').fill('RC-01')
    elif scenario == 'missing-only':
        page.locator('[data-intake-filter=missing]').click()
    else:
        page.locator('#intake-search').fill('not-a-pom')
    show_context(page, tab)
    if scenario == 'required-search':
        page.locator('#intake-context summary').click()
    page.locator('.table-wrap').evaluate('(el)=>{el.scrollTop=el.scrollHeight;el.scrollLeft=el.scrollWidth;}')
    page.locator('.context-body').evaluate('(el)=>el.scrollTop=el.scrollHeight')
    before = page.evaluate(PRINT_STATE)
    pdf_bytes = page.pdf(print_background=True)
    after = page.evaluate(PRINT_STATE)
    assert after == before, f'Print did not restore the prior view: {scenario}'
    reader = PdfReader(BytesIO(pdf_bytes))
    text = unicodedata.normalize('NFKC', '\n'.join(p.extract_text() or '' for p in reader.pages))
    compact = re.sub(r'\s+', '', text)
    assert all(code in text for code in POMS), f'Incomplete printed POM set: {scenario}'
    assert 'SYNTHETIC-BROWSER-ONLY' in compact and 'Syntheticcroquisreferenceonly' in compact and 'Syntheticshoereferenceonly' in compact
    assert all(re.sub(r'\s+', '', note) in compact for note in TEMPLATE['notes']), 'Original template notes missing from print.'
    assert '5cmbelowCFNECK?' in compact and '5cmbelowCBNECK?' in compact, 'Original RC-12/13 questions missing from print.'
    assert 'CLIENTVALUE(' + unit + ')' in compact, 'Printed numeric column must identify the selected unit.'
    assert all(re.sub(r'\s+', '', value) in compact for value in TEMPLATE['defaults'].values()), 'Original draft status/fitting defaults missing from print.'
    assert '7.874016' in text if unit == 'IN' else '20' in text
    # The PDF and its private fixture values are intentionally never written.
    return {'scenario': scenario, 'pages': len(reader.pages), 'unit': unit,
            'all34PomsAndOriginalQuestions': True, 'metadataAndReferenceValuesPresent': True,
            'screenStateRestoredExactly': True, 'filledPdfKeptInMemoryOnly': True}


def check_private_workflow(browser, base, mode):
    context, page, errors, external, api_requests = open_page(browser, base)
    try:
        show_context(page, 'client')
        page.locator('#client-clientId').fill('   ')
        page.locator('#client-clientName').fill('   ')
        show_context(page, 'drafts')
        page.locator('#check-required').click()
        assert page.locator('#context-client').is_visible()
        assert page.locator('#client-clientId').evaluate('(el)=>el===document.activeElement'), 'Whitespace-only identity must reveal Client metadata.'
        page.locator('#client-clientName').fill('')
        page.locator('#client-clientId').fill('SYNTHETIC-BROWSER-ONLY')
        page.locator('#client-measurementDate').fill('2026-10-22')
        show_context(page, 'references')
        page.locator('#croquis-reference').fill('Synthetic croquis reference only')
        page.locator('#client-reference').fill('Synthetic shoe reference only')
        page.locator('#measurement-RC-01').fill('20')
        page.locator('#measurement-RC-02').fill('0')
        for _ in range(3):
            page.locator('#intake-unit').select_option('IN')
            assert page.locator('#measurement-RC-01').input_value() == '7.874016'
            assert page.locator('#measurement-RC-02').input_value() == '0'
            page.locator('#intake-unit').select_option('CM')
            assert page.locator('#measurement-RC-01').input_value() == '20'
        page.locator('#measurement-RC-03').fill('-1')
        page.locator('#intake-unit').select_option('IN')
        assert page.locator('#intake-unit').input_value() == 'CM'
        assert page.locator('#measurement-RC-03').get_attribute('aria-invalid') == 'true'
        check_colors(page, mode + ': invalid input')
        page.locator('#measurement-RC-03').fill('')
        page.locator('#measurement-RC-18').fill('-1')
        page.locator('[data-intake-filter=missing]').click()
        show_context(page, 'drafts')
        page.locator('#check-required').click()
        assert page.locator('[data-intake-filter=all]').get_attribute('aria-pressed') == 'true'
        assert page.locator('#measurement-RC-18').is_visible()
        assert page.locator('#measurement-RC-18').evaluate('(el)=>el===document.activeElement'), 'Invalid optional input must take priority over earlier missing required values.'
        page.locator('#measurement-RC-18').fill('')
        page.locator('#intake-search').fill('RC-35')
        show_context(page, 'drafts')
        page.locator('#check-required').click()
        assert page.locator('#intake-search').input_value() == ''
        assert page.locator('[data-intake-filter=missing]').get_attribute('aria-pressed') == 'true'
        missing = page.locator('#measurement-RC-03')
        assert missing.is_visible() and missing.evaluate('(el)=>el===document.activeElement')
        assert page.locator('#intake-rows tr:visible').count() == 17
        missing.fill('10')
        assert page.locator('#intake-rows tr[data-pom=RC-03]').is_visible(), 'A row must stay visible while its measurement is being typed.'
        page.keyboard.press('Tab')
        page.wait_for_function('()=>document.querySelector("#intake-rows tr[data-pom=RC-03]").hidden')
        assert page.locator('#measurement-RC-04').is_visible()
        assert page.locator('#measurement-RC-04').evaluate('(el)=>el===document.activeElement'), 'Tab must reach the next missing measurement.'
        show_all_rows(page)
        page.locator('#measurement-RC-03').fill('')
        check_colors(page, mode + ': missing required')
        show_context(page, 'drafts')
        exported = json.loads(downloaded_text(page, '#download-json'))
        values = {record['pomCode']: record['valueCm'] for record in exported['measurements']}
        assert values['RC-01'] == 20 and values['RC-02'] == 0 and values['RC-03'] is None
        assert len(values) == 34 and 'RC-21' not in values and exported['unit'] == 'CM'
        rows = list(csv.DictReader(StringIO(downloaded_text(page, '#download-csv'))))
        assert len(rows) == 34 and [row['POM'] for row in rows] == POMS
        assert rows[0]['Client measurement'] == '20' and rows[1]['Client measurement'] == '0' and rows[2]['Client measurement'] == ''
        assert all(row['Unit'] == 'CM' for row in rows)
        page.locator('#save-intake').click()
        page.wait_for_function('()=>document.querySelector("#saved-intakes").value && !document.querySelector("#saved-intakes").disabled')
        first_id = page.locator('#saved-intakes').input_value()
        assert page.locator('#saved-intakes option').count() == 2
        show_all_rows(page)
        page.locator('#measurement-RC-01').fill('21')
        show_context(page, 'drafts')
        page.locator('#save-intake').click()
        page.wait_for_function('()=>document.querySelector("#saved-intakes").options.length===3 && !document.querySelector("#saved-intakes").disabled')
        assert page.locator('#saved-intakes').input_value() != first_id
        page.locator('#saved-intakes').select_option(first_id)
        page.locator('#open-intake').click()
        page.wait_for_function('()=>document.querySelector("#measurement-RC-01").value==="20"')
        assert page.locator('#measurement-RC-02').input_value() == '0'
        assert page.locator('#save-intake').is_disabled()
        page.locator('[data-intake-filter=required]').click()
        page.locator('#intake-search').fill('RC-01')
        assert page.locator('#measurement-RC-01').input_value() == '20' and page.locator('#save-intake').is_disabled(), 'View changes must not dirty or drop entered values.'
        show_all_rows(page)
        show_context(page, 'drafts')
        page.locator('#new-intake').click()
        assert page.locator('#measurement-RC-01').input_value() == ''
        page.locator('#import-json').set_input_files({'name': 'synthetic-memory-backup.json', 'mimeType': 'application/json', 'buffer': json.dumps(exported).encode()})
        page.wait_for_function('()=>document.querySelector("#measurement-RC-01").value==="20"')
        assert page.locator('#measurement-RC-02').input_value() == '0' and page.locator('#measurement-RC-03').input_value() == ''
        prints = [check_private_print(page, 'required-search', 'CM', 'references'),
                  check_private_print(page, 'missing-only', 'IN', 'drafts'),
                  check_private_print(page, 'empty-search', 'CM', 'client')]
        show_all_rows(page)
        for code in REQUIRED:
            if code not in ('RC-01', 'RC-02'):
                page.locator('#measurement-' + code).fill('20')
        show_context(page, 'drafts')
        page.locator('#check-required').click()
        assert '19 / 19' in page.locator('#stat-required').inner_text()
        assert 'not approval' in page.locator('#status').inner_text().lower()
        check_colors(page, mode + ': completeness success')
        if mode == 'standalone':
            assert not api_requests
            stored = page.evaluate('JSON.parse(localStorage.getItem("sr-client-intake-v1"))')
            assert len(stored) == 2 and stored[-1]['intake']['measurements'][0]['valueCm'] == 20
        else:
            response = page.request.get(base + 'api/client-intake/sessions')
            assert response.ok and len(response.json()['sessions']) == 2
            response = page.request.get(base + 'api/client-intake/sessions/' + first_id)
            assert response.ok and response.json()['intake']['measurements'][0]['valueCm'] == 20
        show_context(page, 'drafts')
        page.locator('#new-intake').click()
        if mode == 'standalone':
            page.evaluate('localStorage.removeItem("sr-client-intake-v1")')
        assert page.locator('#measurement-RC-01').input_value() == ''
        assert page.locator('#client-clientId').input_value() == ''
        assert not errors and not external, (mode, errors, external)
        return {'canonicalCentimetersAndThreeUnitRoundTrips': True, 'zeroAndNullPreserved': True,
                'invalidInputPreventsUnitSwitch': True, 'missingRequiredRevealedAndFocused': True,
                'invalidOptionalTakesPriorityAndWhitespaceIdentityRecovers': True,
                'missingRowRemainsDuringTypingThenTabAdvances': True, 'viewChangesDoNotDirtyOrDropValues': True,
                'jsonAndCsvExportVerifiedAndTemporaryDownloadsDeleted': True,
                'newDraftSaveAndEarlierRecordReopen': True, 'memoryOnlyJsonImport': True,
                'completenessIsNotApproval': True, 'separateLocalStorageVerified': True,
                'syntheticFieldsClearedBeforeClosing': True, 'print': prints}
    finally:
        context.close()


def check_storage_unavailable(browser, base):
    context, page, errors, external, _requests = open_page(browser, base, storage_unavailable=True)
    try:
        show_context(page, 'client')
        page.locator('#client-clientId').fill('SYNTHETIC-UNAVAILABLE-STORAGE')
        page.locator('#measurement-RC-01').fill('20')
        show_context(page, 'drafts')
        assert page.locator('#save-intake').is_disabled()
        assert not page.locator('#download-json').is_disabled()
        assert 'storage' in page.locator('#status').inner_text().lower()
        exported = json.loads(downloaded_text(page, '#download-json'))
        assert exported['measurements'][0]['valueCm'] == 20
        check_colors(page, 'standalone: unavailable storage')
        assert not errors and not external
        return {'saveUnavailableExplained': True, 'jsonBackupStillWorks': True,
                'temporaryDownloadDeleted': True, 'errorColorsRemainHousePalette': True}
    finally:
        context.close()


results = {'capturedAtUtc': datetime.now(timezone.utc).isoformat(),
           'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
           'uncommittedChanges': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip()),
           'renderMode': 'Local Chromium review of blank standalone and temporary SQLite intake apps; no deployment.',
           'privacy': 'All screenshots show blank forms only. Synthetic test values, client metadata, downloads and filled PDFs are excluded from published evidence.',
           'sources': preserved_sources(), 'modes': {}}
standalone_server = ThreadingHTTPServer(('127.0.0.1', 0), StandaloneHandler)
Thread(target=standalone_server.serve_forever, daemon=True).start()
standalone_base = f'http://127.0.0.1:{standalone_server.server_port}/'
sqlite_process = None
try:
    with tempfile.TemporaryDirectory(prefix='client-intake-browser-runtime-', dir='/workspace/work') as runtime:
        if 'sqlite' in MODES:
            sqlite_process, sqlite_base = start_sqlite(runtime)
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                        args=['--no-sandbox', '--disable-dev-shm-usage'])
            for mode in MODES:
                base = standalone_base if mode == 'standalone' else sqlite_base
                results['modes'][mode] = {'viewports': []}
                for name, width, height in VIEWPORTS:
                    if args.workflow_only:
                        continue
                    if args.viewport and name not in args.viewport:
                        continue
                    result = check_blank_viewport(browser, base, mode, name, width, height)
                    results['modes'][mode]['viewports'].append(result)
                    print(f'{mode} {name}: passed (blank capture only)', flush=True)
                if not args.workflow_only:
                    assert results['modes'][mode]['viewports'], 'No matching viewport was selected.'
                if not args.viewports_only:
                    results['modes'][mode]['workflow'] = check_private_workflow(browser, base, mode)
                    print(f'{mode}: private synthetic workflow and three in-memory print cases passed', flush=True)
            if 'standalone' in MODES and not args.viewports_only:
                results['storageUnavailable'] = check_storage_unavailable(browser, standalone_base)
            browser.close()
        if sqlite_process is not None:
            stop_sqlite(sqlite_process)
            sqlite_process = None
finally:
    if sqlite_process is not None:
        stop_sqlite(sqlite_process)
    standalone_server.shutdown()
    standalone_server.server_close()

results['limits'] = '750×500 CSS pixels checks a reduced layout, not actual browser zoom. This does not establish assistive-technology compliance or remote client submission.'
results['screenshots'] = [{'filename': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                           'bytes': path.stat().st_size} for path in sorted(args.output.glob('case-2-client-intake-*.png'))]
(args.output / 'case-2-client-intake-workroom.json').write_text(json.dumps(results, indent=2) + '\n')
print('All selected client-intake viewport, storage, unit, import/export and print checks passed. Output:', args.output)
