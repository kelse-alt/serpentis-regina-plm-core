"""Check and capture the generated Case 1 sheet with Chromium/Playwright.

Run `npm run sheet` first, then `python3 scripts/check-house-sheet-browser.py`.
Requires optional Python Playwright/pypdf packages and /usr/bin/chromium; it does
not add a browser dependency to the measurement application's Node runtime.
"""
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import hashlib
import json
import subprocess
import unicodedata

from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'reports' / 'browser-review')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
REPORT = ROOT / 'reports' / 'SR-FORM-001-measurement-sheet.html'


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/':
            self.send_error(404)
            return
        body = REPORT.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}/'
results = {
    'capturedAtUtc': datetime.now(timezone.utc).isoformat(),
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'uncommittedChanges': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip()),
    'renderMode': 'Real local Chromium render of the standalone report; no live website deployment.',
    'viewports': [],
}

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                    args=['--no-sandbox', '--disable-dev-shm-usage'])
        for name, width, height in [('desktop', 1500, 1000), ('laptop', 1280, 720),
                                    ('mobile', 390, 844), ('small-mobile', 390, 667),
                                    ('landscape', 844, 390), ('narrow-phone', 320, 568),
                                    ('short-phone', 320, 480), ('short-tablet', 768, 400)]:
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
            page = context.new_page()
            errors, external = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
            page.on('request', lambda request: external.append(request.url) if request.url.startswith(('https:', 'http:')) and request.url != BASE else None)
            page.goto(BASE, wait_until='load')
            page.evaluate('document.fonts.ready')
            assert page.locator('#measurements tr').count() == 20
            assert page.locator('thead th').count() == 6
            assert page.locator('#measurements td').count() == 120
            assert 'Source:' not in page.locator('#measurements').inner_text()
            assert page.locator('img').evaluate_all('(images) => images.every(img => img.complete && img.naturalWidth > 0)')
            assert page.evaluate('document.fonts.check("600 40px \'Bodoni Moda\'")')
            assert page.evaluate('document.fonts.check("700 22px \'Barlow Condensed\'")')
            assert page.locator('body').evaluate('(el) => getComputedStyle(el).backgroundColor') in ('rgba(0, 0, 0, 0)', 'rgb(16, 24, 32)')
            assert page.locator('html').evaluate('(el) => getComputedStyle(el).backgroundColor') == 'rgb(16, 24, 32)'
            assert page.locator('.title-bar').evaluate('(el) => getComputedStyle(el).backgroundColor') == 'rgb(228, 0, 43)'
            assert page.locator('th.actual-heading').evaluate('(el) => getComputedStyle(el).backgroundColor') == 'rgb(244, 166, 160)'
            assert page.locator('th.actual-heading').evaluate('(el) => getComputedStyle(el).color') == 'rgb(30, 34, 170)'
            assert page.locator('td.delta').first.evaluate('(el) => getComputedStyle(el).color') == 'rgb(31, 168, 36)'
            layout = page.evaluate('''() => ({
              rootWidth:document.documentElement.scrollWidth, rootHeight:document.documentElement.scrollHeight,
              width:innerWidth, height:innerHeight,
              chartHeight:document.getElementById('measurement-chart').clientHeight,
              chartScrollHeight:document.getElementById('measurement-chart').scrollHeight
            })''')
            assert layout['rootWidth'] <= width + 1, (name, layout)
            assert layout['rootHeight'] <= height + 1, (name, layout)
            assert layout['chartHeight'] >= 120, (name, layout)
            assert layout['chartScrollHeight'] > layout['chartHeight'], (name, layout)
            if name in ('desktop', 'mobile'):
                page.screenshot(path=str(args.output / f'case-1-brand-{name}.png'))
            chart = page.locator('#measurement-chart')
            header_before = page.locator('.masthead').bounding_box()
            tablehead_before = page.locator('thead').bounding_box()
            chart.focus()
            page.keyboard.press('PageDown')
            page.wait_for_function('() => document.getElementById("measurement-chart").scrollTop > 0')
            assert page.locator('.masthead').bounding_box() == header_before
            assert abs(page.locator('thead').bounding_box()['y'] - tablehead_before['y']) < 1
            assert page.evaluate('scrollY') == 0
            chart.evaluate('(el) => el.scrollTop = el.scrollHeight')
            assert page.locator('#measurements tr').last.inner_text().startswith('BF-20')
            page.locator('#search').fill('BF-02')
            assert page.locator('#measurements tr:visible').count() == 1
            assert page.locator('#measurements tr:visible td.actual').inner_text() == '27.25'
            assert page.locator('#measurements tr:visible td.delta').inner_text() == '+0.75'
            page.locator('#search').fill('no-such-measurement')
            assert page.locator('#empty-state').is_visible()
            assert page.locator('#measurements tr:visible').count() == 0
            page.locator('#search').fill('')
            page.locator('[data-filter="missing"]').click()
            assert page.locator('#measurements tr:visible').count() == 13
            assert page.locator('#measurements tr:visible td.mfr').evaluate_all('(cells) => cells.every(cell => cell.textContent === "—")')
            assert page.locator('#measurements tr:visible td.delta').evaluate_all('(cells) => cells.every(cell => cell.textContent === "—")')
            page.locator('[data-filter="compared"]').click()
            assert page.locator('#measurements tr:visible').count() == 7
            page.locator('[data-filter="all"]').click()
            assert page.locator('#measurements tr:visible').count() == 20
            page.evaluate('window.__printInvoked = false; window.print = () => { window.__printInvoked = true; }')
            page.locator('#print-sheet').click()
            assert page.evaluate('window.__printInvoked')
            if name == 'desktop':
                page.emulate_media(media='print')
                assert chart.evaluate('(el) => getComputedStyle(el).overflow') == 'visible'
                assert page.locator('thead').evaluate('(el) => getComputedStyle(el).position') == 'static'
                assert page.locator('#measurements tr:visible').count() == 20
                pdf_path = args.output / 'case-1-brand-print.pdf'
                page.pdf(path=str(pdf_path), print_background=True)
                pdf = PdfReader(str(pdf_path))
                pdf_text = unicodedata.normalize('NFKC', '\n'.join(p.extract_text() or '' for p in pdf.pages))
                assert all(f'BF-{index:02d}' in pdf_text for index in range(1, 21))
                assert 'earlier pending-verification status' in pdf_text
                assert 'not garment tolerances' in pdf_text
                assert 'no MFR value' in pdf_text
                results['print'] = {'pages': len(pdf.pages), 'all20PomsAndProvenanceAndMissingValueNotePresent': True}
            assert not errors, (name, errors)
            assert not external, (name, external)
            results['viewports'].append({'name': name, **layout, 'checks': 'Six columns, original images/fonts, exact brand colors, chart-only keyboard scrolling and sticky headings, search/filter/missing values, print action, no external requests or script/CSP errors.'})
            print(f'{name}: passed', flush=True)
            context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

results['screenshots'] = [{'filename': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size} for path in sorted(args.output.glob('case-1-brand-*.png'))]
(args.output / 'case-1-brand.json').write_text(json.dumps(results, indent=2) + '\n')
print('All eight viewport checks passed. Output:', args.output)
