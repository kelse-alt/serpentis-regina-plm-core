"""Check the embedded Version 2 HTML using one allowed document transport.

The cloud browser blocks file://. Only the HTML is served locally, then networking
is disabled. Models, styles and script must all come from that embedded document.
"""
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
prefix = os.environ.get('PORTAL_CHECK_PREFIX', 'portal-v2.1')
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
    context = browser.new_context(viewport={'width': 1500, 'height': 900}, reduced_motion='reduce')
    page = context.new_page()
    errors, network = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: network.append(request.url) if request.url.startswith(('http:', 'https:')) and request.url != url else None)
    page.route('**/*', lambda route: route.continue_() if route.request.url == url else route.abort())
    page.goto(url, wait_until='domcontentloaded', timeout=60000)
    context.set_offline(True)
    page.wait_for_function('document.documentElement.dataset.ready === "true"', timeout=60000)
    state = page.evaluate('window.portal')
    assert state['version'] == 2 and len(state['loaded']) == 3 and not state['errors'], state
    assert not errors and not network, (errors, network)
    assert page.locator('.world-info:visible').count() == 0
    assert page.locator('header, footer, .finish-picker').count() == 0
    assert page.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(0, 0, 0)'
    print('Version 2 embedded HTML loads all three heads on black without extra requests.', flush=True)

    for name, world_id in [('Amaya Kelsea', 'amaya-kelsea'), ('Serpentis Regina', 'serpentis-regina'), ('KLS', 'kls')]:
        control = page.get_by_role('button', name=f'Reveal {name}', exact=True)
        control.focus()
        expect(page.locator(f'#{world_id}-info')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.locator(f'#{world_id}-info')).to_be_hidden()
        page.keyboard.press('Enter')
        expect(page.locator(f'#{world_id}-info')).to_be_visible()
        page.keyboard.press('Escape')
    expect(page.locator('#serpentis-regina-info a')).to_have_attribute('href', 'https://www.serpentisregina.com/')
    assert not errors and not network, (errors, network)
    record = {
        'version': 2, 'revision': state.get('revision'), 'file': document.name,
        'modelsLoaded': state['loaded'],
        'networkDisabledAfterDocumentLoad': True,
        'fileProtocolVerification': 'Cloud policy blocks file://; one-document loopback transport used',
        'initialHeadsOnly': 'passed', 'focusEnterEscapeForAllWorlds': 'passed',
        'additionalNetworkRequests': len(network), 'pageErrors': errors,
    }
    (root / f'docs/validation/{prefix}-standalone.json').write_text(json.dumps(record, indent=2) + '\n')
    print('Version 2 offline reveal, keyboard dismissal and atelier destination passed.', flush=True)
    browser.close()
server.shutdown()
server.server_close()
