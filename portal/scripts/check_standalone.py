"""Verify the one-file HTML with every resource embedded and subsequent network disabled.

The cloud browser's managed policy disallows file:// navigation. Serve only this
document over approved loopback HTTP; no app assets or model routes are served.
"""
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
document = root / 'Serpentis-Regina-Portal.html'
class DocumentOnly(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/portal.html':
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(document.read_bytes())
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), DocumentOnly)
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/portal.html'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1500, 'height': 1100},
                                  reduced_motion='reduce')
    page = context.new_page()
    errors, network = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: network.append(request.url) if request.url.startswith(('http:', 'https:')) and request.url != url else None)
    page.route('**/*', lambda route: route.continue_() if route.request.url == url else route.abort())
    page.goto(url, wait_until='domcontentloaded', timeout=60000)
    context.set_offline(True)
    page.wait_for_function('document.documentElement.dataset.ready === "true"', timeout=60000)
    state = page.evaluate('window.portal')
    assert len(state['loaded']) == 3 and not state['errors'], state
    assert not errors and not network, (errors, network)
    print('One-file HTML loads all three embedded models with no additional network requests or page errors.', flush=True)

    canvas = page.locator('#amaya-kelsea canvas')
    before = canvas.screenshot()
    rect = canvas.bounding_box()
    x, y = rect['x'] + rect['width'] / 2, rect['y'] + rect['height'] * 0.44
    page.mouse.move(x, y); page.mouse.down()
    page.mouse.move(x + 100, y, steps=10); page.mouse.up()
    assert before != canvas.screenshot()
    assert not page.locator('#world-dialog').evaluate('(e) => e.open')
    print('Offline drag rotates the actual sculpture without entering.', flush=True)

    for name in ['Amaya Kelsea', 'Serpentis Regina', 'KLS']:
        page.get_by_role('button', name=f'Enter {name}', exact=True).click()
        expect(page.locator('#dialog-title')).to_have_text(name)
        expect(page.get_by_role('dialog')).to_be_visible()
        if name == 'Serpentis Regina':
            expect(page.locator('#dialog-destination')).to_have_attribute('href', 'https://www.serpentisregina.com/')
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).not_to_be_visible()
    page.get_by_role('button', name='Pearl', exact=True).click()
    assert page.evaluate('window.portal.finish') == 'pearl'
    page.get_by_role('button', name='Iridescent', exact=True).click()
    page.get_by_role('link', name='Serpentis Regina — the threshold', exact=True).click()
    assert page.url == url + '#top', page.url
    assert not errors and not network, (errors, network)
    page.screenshot(path=str(root / 'artifacts/portal-standalone.png'), full_page=True)
    (root / 'artifacts/standalone-check.json').write_text(json.dumps({
        'file': document.name, 'networkDisabledAfterDocumentLoad': True,
        'fileProtocolVerification': 'Blocked by cloud browser policy; single-document loopback transport used',
        'modelsLoaded': state['loaded'],
        'rotation': 'passed', 'worldEntryAndClose': 'passed',
        'finishSwitching': 'passed', 'sameFileNavigation': 'passed',
        'remoteRequests': len(network), 'pageErrors': errors,
    }, indent=2))
    print('Offline world entry, close, finishes and same-file navigation passed.', flush=True)
    browser.close()
server.shutdown()
server.server_close()
