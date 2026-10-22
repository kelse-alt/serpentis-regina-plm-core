"""Verify the Case 1 workroom revision using the actual standalone report.

Run ``npm run sheet`` first, then this script. Optional review dependencies are
Python Playwright, pypdf and /usr/bin/chromium; the application still has no
third-party runtime dependencies. --output selects the local evidence folder.
"""
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import hashlib
import json
import re
import subprocess
import unicodedata

from playwright.sync_api import sync_playwright
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
BASELINE = 'e5b94d183f7daf6cb7782d768b47bf9efe0c4f3b'
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'reports' / 'workroom-review')
parser.add_argument('--viewport', action='append', help='Run only the named viewport; repeat to select several.')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
REPORT = ROOT / 'reports' / 'SR-FORM-001-measurement-sheet.html'
MEASUREMENTS = json.loads((ROOT / 'data/house-fit-forms/SR-FORM-001.v1.json').read_text())['measurements']


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/':
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(REPORT.read_bytes())

    def log_message(self, *_args):
        pass


def source_preservation():
    paths = ['design/brand-tokens.json', 'data/house-fit-forms/SR-FORM-001.v1.json',
             'data/house-fit-forms/SR-FORM-001-methods.v1.json',
             'assets/house-sheet/mannequin-front.jpg', 'assets/house-sheet/mannequin-back.jpg',
             'assets/house-sheet/serpentis-regina-seal.png', 'sheet-web/matte-grain.svg',
             'assets/house-sheet/fonts/barlow-condensed-500.ttf',
             'assets/house-sheet/fonts/barlow-condensed-700.ttf']
    hashes = {}
    for path in paths:
        baseline_bytes = subprocess.check_output(['git', 'show', f'{BASELINE}:{path}'], cwd=ROOT)
        current_bytes = (ROOT / path).read_bytes()
        assert current_bytes == baseline_bytes, f'Controlled source changed: {path}'
        hashes[path] = hashlib.sha256(current_bytes).hexdigest()
    return {'comparedWith': BASELINE, 'exactSourceBytesPreserved': True, 'sha256': hashes}


def format_value(value, unit, signed=False):
    if value is None:
        return '—'
    factor = Decimal('2.54') if unit == 'cm' else Decimal(1)
    rounded = (Decimal(str(value)) * factor).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
    rounded = Decimal(0) if rounded == 0 else rounded
    label = format(rounded, 'f')
    if '.' in label:
        label = label.rstrip('0').rstrip('.')
    return ('+' if signed and rounded > 0 else '') + label


def check_values(page, unit):
    assert page.locator('#measurement-unit').input_value() == unit
    actual = page.locator('#measurements tr').evaluate_all("""rows => rows.map(row => ({
        pom:row.querySelector('.pom').textContent.trim(),
        mfr:row.querySelector('.mfr').textContent.trim(),
        actual:row.querySelector('.actual').textContent.trim(),
        delta:row.querySelector('.delta').textContent.trim()
    }))""")
    expected = []
    for record in MEASUREMENTS:
        reference = record['manufacturerReference']
        delta = None if reference is None else Decimal(str(record['houseStandard'])) - Decimal(str(reference))
        expected.append({'pom': record['pomCode'], 'mfr': format_value(reference, unit),
                         'actual': format_value(record['houseStandard'], unit),
                         'delta': format_value(delta, unit, signed=True)})
    assert actual == expected, {'unit': unit, 'actual': actual, 'expected': expected}
    labels = page.locator('thead [data-unit-label]').all_text_contents()
    assert len(labels) == 3 and all(label.strip() == ('(CM)' if unit == 'cm' else '(IN)') for label in labels), labels
    assert page.locator('#unit-print').text_content() == 'UNIT / ' + ('CM' if unit == 'cm' else 'INCHES')
    assert 'INCHES / CM' in page.locator('.identity-strip').inner_text()


def check_colors(page, state):
    # Inspect the dialog as well as the sheet: image enlargement reuses the same
    # exact original caption pairing, while all new buttons stay Electric/Ruby.
    result = page.locator('body').evaluate(r"""body => {
        const electric='rgb(30, 34, 170)', ruby='rgb(228, 0, 43)', green='rgb(31, 168, 36)';
        const allowed=new Set([electric,ruby,green,'rgb(16, 24, 32)','rgb(146, 152, 157)','rgb(41, 50, 57)','rgba(0, 0, 0, 0)']);
        const salmon=/rgba?\(\s*244[\s,]+166[\s,]+160(?:\s*[,/)]|$)/;
        const hasRuby=value=>/rgba?\(\s*228[\s,]+0[\s,]+43(?:\s*[,/)]|$)/.test(value);
        const background=el=>{for(let a=el;a;a=a.parentElement){const c=getComputedStyle(a).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent')return c;}return 'transparent';};
        const violations=[];
        for(const el of [body,...body.querySelectorAll('*')]) {
            const s=getComputedStyle(el), r=el.getBoundingClientRect();
            if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none'||Number(s.opacity)===0)continue;
            const id={tag:el.tagName,class:el.className,id:el.id};
            for(const property of ['color','backgroundColor']) {
                if(!allowed.has(s[property]))violations.push({...id,rule:'Color outside the unchanged house palette',property,value:s[property]});
            }
            for(const property of ['color','backgroundColor','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','outlineColor','scrollbarColor','boxShadow','textShadow']) {
                if(salmon.test(s[property]))violations.push({...id,rule:'Salmon UI',property});
            }
            if((hasRuby(s.color)||hasRuby(s.webkitTextFillColor))&&background(el)!==electric)violations.push({...id,rule:'Ruby text outside Electric'});
            if(s.backgroundColor===electric&&s.color!==ruby)violations.push({...id,rule:'Electric fill without Ruby text'});
            const directText=[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
            if(directText&&background(el)===electric&&s.color!==ruby)violations.push({...id,rule:'Non-Ruby text on Electric'});
            if(s.color===green&&!el.closest('.identity-strip,.case,.formula'))violations.push({...id,rule:'Green foreground outside metadata/formula'});
            if(s.backgroundColor===green&&!el.matches('.photo-pair figcaption,.photo-viewer-pair figcaption'))violations.push({...id,rule:'Green background outside photo captions'});
            for(const side of ['Top','Right','Bottom','Left']) {
                if(parseFloat(s['border'+side+'Width'])>0&&s['border'+side+'Style']!=='none'&&(hasRuby(s['border'+side+'Color'])||s['border'+side+'Color']===green))violations.push({...id,rule:'Colored border',side});
            }
            if(parseFloat(s.outlineWidth)>0&&s.outlineStyle!=='none'&&(hasRuby(s.outlineColor)||s.outlineColor===green))violations.push({...id,rule:'Colored outline'});
            if(el.matches('.matte-ink')&&s.webkitTextFillColor==='rgba(0, 0, 0, 0)'&&(!s.backgroundImage.includes('data:image/svg+xml')||![s.backgroundClip,s.webkitBackgroundClip].includes('text')))violations.push({...id,rule:'Missing matte texture'});
        }
        return {violations};
    }""")
    assert not result['violations'], (state, result['violations'])
    expected = {'.title-bar': ('backgroundColor', 'rgb(228, 0, 43)'),
                '.title-bar h1': ('color', 'rgb(16, 24, 32)'),
                '.wordmark': ('color', 'rgb(30, 34, 170)'),
                '.case': ('color', 'rgb(31, 168, 36)'),
                '.division': ('color', 'rgb(16, 24, 32)'),
                '.formula': ('color', 'rgb(31, 168, 36)'),
                'td.actual': ('color', 'rgb(146, 152, 157)'),
                'td.delta': ('color', 'rgb(146, 152, 157)'),
                '#measurement-unit': ('color', 'rgb(146, 152, 157)')}
    for selector, (property_name, expected_value) in expected.items():
        assert page.locator(selector).first.evaluate('(el,p)=>getComputedStyle(el)[p]', property_name) == expected_value, (state, selector)
    assert page.locator('.toolbar button').evaluate_all("""buttons => buttons.every(el =>
        getComputedStyle(el).backgroundColor==='rgb(30, 34, 170)'&&getComputedStyle(el).color==='rgb(228, 0, 43)')""")
    assert page.locator('.brand-line,.identity-strip').evaluate_all("""els=>els.every(el=>getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)')""")
    return {'exactBrandAssignmentsPreserved': True, 'rubyScopedToElectric': True, 'noSalmon': True,
            'neutralBorders': True, 'greenScopesPreserved': True}


def check_filter_indicator(page):
    assert page.locator('[data-filter][aria-pressed=true]').count() == 1
    assert page.locator('[data-filter][aria-pressed=true] .filter-check').is_visible()
    for indicator in page.locator('[data-filter][aria-pressed=false] .filter-check').all():
        assert not indicator.is_visible(), 'Only the selected filter should display its checkmark.'


STATE_JS = """() => ({
    search:document.querySelector('#search').value,
    filter:[...document.querySelectorAll('[data-filter]')].map(el=>({filter:el.dataset.filter,pressed:el.getAttribute('aria-pressed')})),
    visible:[...document.querySelectorAll('#measurements tr')].filter(el=>!el.hidden).map(el=>el.querySelector('.pom').textContent),
    count:document.querySelector('#count').textContent,
    notesOpen:document.querySelector('.record-notes').open,
    emptyHidden:document.querySelector('#empty-state').hidden,
    scrollTop:document.querySelector('#measurement-chart').scrollTop,
    scrollLeft:document.querySelector('#measurement-chart').scrollLeft,
    unit:document.querySelector('#measurement-unit').value
})"""


def check_print(page, scenario, unit):
    chart = page.locator('#measurement-chart')
    page.locator('#measurement-unit').select_option(unit)
    page.locator('#search').fill('')
    page.locator('[data-filter=all]').click()
    if scenario == 'waist-search':
        page.locator('#search').fill('BF-02')
    elif scenario == 'missing-only':
        page.locator('[data-filter=missing]').click()
        page.locator('.record-notes').evaluate('(el)=>el.open=true')
    elif scenario == 'empty-search':
        page.locator('#search').fill('not-a-real-pom')
    chart.evaluate('(el)=>{el.scrollTop=el.scrollHeight;el.scrollLeft=el.scrollWidth;}')
    before = page.evaluate(STATE_JS)
    pdf_path = args.output / f'case-1-workroom-print-{scenario}.pdf'
    page.pdf(path=str(pdf_path), print_background=True)
    page.wait_for_function("""expected => document.querySelector('#count').textContent===expected.count&&document.querySelector('.record-notes').open===expected.notesOpen""", arg=before)
    after = page.evaluate(STATE_JS)
    assert after == before, {'scenario': scenario, 'before': before, 'after': after}
    reader = PdfReader(str(pdf_path))
    text = unicodedata.normalize('NFKC', '\n'.join(p.extract_text() or '' for p in reader.pages))
    assert all(f'BF-{i:02d}' in text for i in range(1, 21)), (scenario, 'Incomplete print')
    assert 'earlier pending-verification status' in text and 'not garment tolerances' in text
    assert 'no MFR reference' in text and 'delta unavailable' in text
    assert re.search(r'UNIT\s*/\s*' + ('CM' if unit == 'cm' else 'INCHES') + r'\b', text), (scenario, 'Wrong print unit')
    assert ('69.215' in text and '+1.905' in text) if unit == 'cm' else ('27.25' in text and '+0.75' in text)
    return {'scenario': scenario, 'pages': len(reader.pages), 'unit': unit,
            'all20PomsAndNotesPresent': True, 'screenStateRestoredExactly': True}


results = {'capturedAtUtc': datetime.now(timezone.utc).isoformat(),
           'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
           'uncommittedChanges': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip()),
           'renderMode': 'Real local Chromium render of the standalone report; no live deployment.',
           'sources': source_preservation(), 'viewports': [], 'print': []}
server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}/'

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                    args=['--no-sandbox', '--disable-dev-shm-usage'])
        for name, width, height in [('desktop', 1500, 1000), ('laptop', 1280, 720),
                                    ('mobile', 390, 844), ('small-mobile', 390, 667),
                                    ('landscape', 844, 390), ('narrow-phone', 320, 568),
                                    ('short-phone', 320, 480), ('short-tablet', 768, 400),
                                    ('reduced-layout', 750, 500)]:
            if args.viewport and name not in args.viewport:
                continue
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
            page = context.new_page()
            errors, external = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
            page.on('request', lambda request: external.append(request.url) if request.url.startswith(('https:', 'http:')) and request.url != BASE else None)
            page.goto(BASE, wait_until='load')
            page.evaluate('document.fonts.ready')
            assert page.locator('#measurements tr').count() == 20 and page.locator('thead th').count() == 6
            assert page.locator('#measurements td').count() == 120
            assert 'Source:' not in page.locator('#measurements').inner_text()
            assert page.evaluate("""document.fonts.check("700 22px 'Barlow Condensed'")""")
            assert page.locator('.seal-zone').inner_text().strip() == ''
            assert page.locator('.seal-zone img').count() == 1
            assert page.locator('aside.form-panel .photo-pair img').evaluate_all('(images)=>images.every(img=>img.complete&&img.naturalWidth>0)')
            check_values(page, 'in')
            colors = check_colors(page, name)
            check_filter_indicator(page)
            chart = page.locator('#measurement-chart')
            layout = page.evaluate("""() => {
                const chart=document.querySelector('#measurement-chart'), cr=chart.getBoundingClientRect();
                const hr=document.querySelector('thead').getBoundingClientRect();
                return {rootWidth:document.documentElement.scrollWidth,rootHeight:document.documentElement.scrollHeight,
                    width:innerWidth,height:innerHeight,chartHeight:chart.clientHeight,chartScrollHeight:chart.scrollHeight,
                    mastheadHeight:document.querySelector('.masthead').getBoundingClientRect().height,
                    completeVisibleRows:[...document.querySelectorAll('#measurements tr')].filter(el=>{const r=el.getBoundingClientRect();return r.top>=hr.bottom-1&&r.bottom<=cr.bottom+1;}).length};
            }""")
            assert layout['rootWidth'] <= width + 1 and layout['rootHeight'] <= height + 1, (name, layout)
            assert layout['chartHeight'] >= 120 and layout['chartScrollHeight'] > layout['chartHeight'], (name, layout)
            assert layout['completeVisibleRows'] >= 1, (name, layout)
            if name == 'desktop':
                assert layout['completeVisibleRows'] >= 7, (name, layout)
                assert layout['mastheadHeight'] <= 160, (name, layout)
            if name == 'mobile':
                assert layout['chartHeight'] >= 300, (name, layout)
            photos = page.locator('aside.form-panel .photo-pair img').evaluate_all("""images=>images.map(img=>({y:img.getBoundingClientRect().y,height:img.clientHeight,width:img.clientWidth,fit:getComputedStyle(img).objectFit,src:img.src}))""")
            assert len(photos) == 2 and abs(photos[0]['y'] - photos[1]['y']) < 1 and abs(photos[0]['height'] - photos[1]['height']) < 1
            assert all(photo['fit'] == 'cover' and photo['height'] > 0 for photo in photos)
            if name in ('desktop', 'mobile', 'landscape'):
                page.screenshot(path=str(args.output / f'case-1-workroom-{name}.png'))
            for turn in range(3):
                page.locator('#measurement-unit').select_option('cm')
                check_values(page, 'cm')
                if name == 'desktop' and turn == 0:
                    page.screenshot(path=str(args.output / 'case-1-workroom-desktop-cm.png'))
                page.locator('#measurement-unit').select_option('in')
                check_values(page, 'in')
            header_before = page.locator('.masthead').bounding_box()
            tablehead_before = page.locator('thead').bounding_box()
            chart.focus()
            page.keyboard.press('PageDown')
            page.wait_for_function('()=>document.querySelector("#measurement-chart").scrollTop>0')
            assert page.locator('.masthead').bounding_box() == header_before
            assert abs(page.locator('thead').bounding_box()['y'] - tablehead_before['y']) < 1
            assert page.evaluate('scrollY') == 0
            chart.evaluate('(el)=>el.scrollTop=0')
            pom_x = page.locator('#measurements tr').first.locator('.pom').bounding_box()['x']
            chart.evaluate('(el)=>el.scrollLeft=el.scrollWidth')
            assert abs(page.locator('#measurements tr').first.locator('.pom').bounding_box()['x'] - pom_x) < 1, (name, 'POM scrolled out of view')
            if name == 'mobile':
                page.locator('#measurement-unit').select_option('cm')
                page.screenshot(path=str(args.output / 'case-1-workroom-mobile-values.png'))
            chart.evaluate('(el)=>el.scrollLeft=0')
            page.locator('#search').fill('BF-02')
            assert page.locator('#measurements tr:visible').count() == 1
            page.locator('#measurement-unit').select_option('cm')
            check_values(page, 'cm')
            assert page.locator('#search').input_value() == 'BF-02'
            assert page.locator('#measurements tr:visible td.actual').inner_text() == '69.215'
            page.locator('#search').fill('no-such-measurement')
            assert page.locator('#empty-state').is_visible()
            page.locator('#reset-view').click()
            assert page.locator('#search').input_value() == '' and page.locator('#measurements tr:visible').count() == 20
            assert page.locator('#search').evaluate('(el)=>el===document.activeElement')
            page.locator('[data-filter=missing]').click()
            assert page.locator('#measurements tr:visible').count() == 13
            page.locator('#measurement-unit').select_option('in')
            assert page.locator('[data-filter=missing]').get_attribute('aria-pressed') == 'true'
            assert page.locator('#measurements tr:visible td.mfr').evaluate_all('(cells)=>cells.every(el=>el.textContent==="—")')
            check_filter_indicator(page)
            page.locator('[data-filter=compared]').click()
            assert page.locator('#measurements tr:visible').count() == 7
            page.locator('[data-filter=all]').click()
            page.locator('#enlarge-photos').focus()
            page.keyboard.press('Enter')
            dialog = page.locator('#photo-dialog')
            assert dialog.is_visible() and dialog.evaluate('(el)=>el.open')
            viewer_images = dialog.locator('.photo-viewer-pair img')
            assert viewer_images.count() == 2
            assert viewer_images.evaluate_all('(images)=>images.every(img=>img.complete&&img.naturalWidth>0&&getComputedStyle(img).objectFit==="contain")')
            assert viewer_images.evaluate_all('(images)=>images.map(img=>img.src)') == [photo['src'] for photo in photos]
            check_colors(page, name + ': photographs open')
            if name == 'desktop':
                page.screenshot(path=str(args.output / 'case-1-workroom-photo-dialog.png'))
            page.keyboard.press('Tab')
            assert page.evaluate('Boolean(document.activeElement.closest("#photo-dialog"))')
            page.keyboard.press('Escape')
            assert not dialog.is_visible()
            assert page.locator('#enlarge-photos').evaluate('(el)=>el===document.activeElement')
            page.locator('#enlarge-photos').click()
            page.locator('#close-photos').click()
            assert not dialog.is_visible()
            check_colors(page, name + ': controls exercised')
            if name == 'desktop':
                results['print'] = [check_print(page, 'waist-search', 'cm'),
                                    check_print(page, 'missing-only', 'in'),
                                    check_print(page, 'empty-search', 'cm')]
            assert not errors and not external, (name, errors, external)
            results['viewports'].append({'name': name, **layout, 'colors': colors,
                'canonicalValuesVerifiedInBothUnits': True, 'roundTripsWithoutRoundingDrift': 3,
                'searchFilterAndReset': True, 'fixedMastheadStickyHeadingsAndPom': True,
                'originalPhotographsEnlargedWithKeyboardReturn': True})
            print(f'{name}: passed', flush=True)
            context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

results['reducedLayoutLimit'] = '750×500 CSS pixels exercises the available layout at a reduced viewport; this is not a claim that actual browser zoom or assistive technology was audited.'
results['screenshots'] = [{'filename': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                           'bytes': path.stat().st_size} for path in sorted(args.output.glob('case-1-workroom-*.png'))]
(args.output / 'case-1-workroom.json').write_text(json.dumps(results, indent=2) + '\n')
assert results['viewports'], 'No matching viewport was selected.'
print(f"All {len(results['viewports'])} viewport checks and {len(results['print'])} filtered-print checks passed. Output:", args.output)
