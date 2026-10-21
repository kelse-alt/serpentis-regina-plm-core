"""Exercise the actual built portal inside a cross-origin Squarespace fixture.

Run ``npm run build`` first. The unmodified embed fragment is used with only its
iframe URL changed to a local Pages-like /serpentis-regina-plm-core/ URL. A second
HTTP origin supplies representative Squarespace wrappers. This is not a check
of an authenticated Squarespace editor, the account's plan or a published site.
"""
from datetime import datetime, timezone
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from threading import Thread
from urllib.parse import unquote, urlsplit

from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'dist'
SNIPPET = ROOT / 'integrations' / 'squarespace.html'
PROJECT_PATH = '/serpentis-regina-plm-core/'
PAGES_URL = 'https://kelse-alt.github.io/serpentis-regina-plm-core/'
ATELIER_URL = 'https://www.serpentisregina.com/home'
DRIVE_URL = 'https://drive.google.com/drive/folders/1NWWe-fKklVC0gDS5jVu3IcHMhTCRxe7s'
COLLECTION = 'collection-6a8bb66559785a1838e75235'
WORLDS = {'amaya-kelsea', 'serpentis-regina', 'kls'}
MODELS = {'kelsea-mother.glb', 'serpentis-maiden.glb', 'crown.glb'}
PREVIEWS = ROOT / 'docs' / 'previews'
VALIDATION = ROOT / 'docs' / 'validation'
PREVIEWS.mkdir(parents=True, exist_ok=True)
VALIDATION.mkdir(parents=True, exist_ok=True)
assert (BUILD / 'index.html').is_file(), 'Build portal/dist first.'
fragment = SNIPPET.read_text()
assert fragment.count(PAGES_URL) == 1, 'Expected the identified Pages URL once.'


class PagesLike(SimpleHTTPRequestHandler):
    """Expose only dist at a nested project URL, never the repository root."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BUILD), **kwargs)

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if not path.startswith(PROJECT_PATH):
            self.send_error(404)
            return
        self.path = '/' + path[len(PROJECT_PATH):]
        super().do_GET()

    def log_message(self, *args):
        pass


pages_server = ThreadingHTTPServer(('127.0.0.1', 0), PagesLike)
pages_url = f'http://127.0.0.1:{pages_server.server_port}{PROJECT_PATH}'
local_fragment = fragment.replace(PAGES_URL, pages_url)


def parent_document(path):
    editing = path == '/editor'
    collection = 'collection-unrelated' if path == '/other' else COLLECTION
    body_class = 'sqs-edit-mode-active' if editing else ''
    toolbar = '<aside id="sqs-editor-toolbar">Fixture editor controls</aside>' if editing else ''
    return f'''<!doctype html><html lang="en"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Squarespace wrapper fixture</title>
      <style>
        * {{ box-sizing: border-box; }}
        html, body {{ margin: 0; padding: 0; }}
        body {{ background: #fff; color: #111; }}
        #header {{ height: 72px; background: #eee; }}
        #footer-sections {{ height: 60px; background: #ddd; }}
        #page.container {{ max-width: 1400px; padding: 20px; margin: auto; }}
        .page-section {{ min-height: 400px; padding: 24px; }}
        .content-wrapper {{ max-width: 1200px; margin: auto; padding: 16px; }}
        .fluid-engine {{ display: grid; grid-template-columns: repeat(24,1fr); grid-template-rows: repeat(10,20px); gap: 10px; }}
        .fe-block {{ grid-area: 1 / 1 / 11 / 25; }}
        .sqs-block-code {{ padding: 17px; }}
        #sqs-editor-toolbar {{ position: sticky; top: 0; z-index: 1000; padding: 10px; background: #ffd; }}
      </style></head><body id="{collection}" class="{body_class}">
      {toolbar}<div id="siteWrapper"><header id="header">Fixture site header</header>
      <main id="page" class="container"><div class="sections"><section class="page-section">
      <div class="content-wrapper"><div class="content"><div class="fluid-engine">
      <div class="fe-block"><div class="sqs-block sqs-block-code"><div class="sqs-block-content">
      {local_fragment}
      </div></div></div></div></div></div></section></div></main>
      <footer id="footer-sections">Fixture site footer</footer></div></body></html>'''


class SquarespaceLike(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        if path not in ('/landing-portal', '/other', '/editor'):
            self.send_error(404)
            return
        content = parent_document(path).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, *args):
        pass


parent_server = ThreadingHTTPServer(('127.0.0.1', 0), SquarespaceLike)
parent_url = f'http://127.0.0.1:{parent_server.server_port}'
for server in (pages_server, parent_server):
    Thread(target=server.serve_forever, daemon=True).start()


def embedded_portal(page):
    response = page.goto(parent_url + '/landing-portal', wait_until='domcontentloaded', timeout=60000)
    assert response and response.status == 200
    iframe = page.locator('iframe.sr-portal-frame')
    expect(iframe).to_be_visible()
    expect(iframe).to_have_attribute('title', 'The three worlds — Serpentis Regina portal')
    frame = iframe.element_handle().content_frame()
    assert frame is not None
    frame.wait_for_function('document.documentElement.dataset.ready === "true"', timeout=60000)
    state = frame.evaluate('window.portal')
    assert set(state['loaded']) == WORLDS and not state['errors'], state
    assert all(scene['head'] > 0 and scene['extra'] == 0 for scene in state['sceneMeshes'].values()), state
    assert frame.locator('canvas').count() == 3
    assert frame.locator('.world-info:visible').count() == 0
    assert frame.locator('header, footer, .finish-picker').count() == 0
    assert frame.locator('.head-control').evaluate_all('''controls => controls.every(control => {
        const style = getComputedStyle(control), bounds = control.getBoundingClientRect();
        return style.clipPath !== 'none' && bounds.width <= 1 && bounds.height <= 1;
    })''')
    assert frame.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(0, 0, 0)'
    expect(page.locator('#header')).to_be_hidden()
    expect(page.locator('#footer-sections')).to_be_hidden()
    return frame


def viewport_metrics(page, frame):
    parent = page.evaluate('''() => {
        const iframe = document.querySelector('iframe').getBoundingClientRect();
        return { width: innerWidth, height: innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            scrollHeight: document.documentElement.scrollHeight,
            iframe: {x:iframe.x,y:iframe.y,width:iframe.width,height:iframe.height} };
    }''')
    child = frame.evaluate('''() => ({ width: innerWidth, height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight })''')
    for metrics in (parent, child):
        assert metrics['scrollWidth'] <= metrics['width'] + 1, metrics
        assert metrics['scrollHeight'] <= metrics['height'] + 1, metrics
    box = parent['iframe']
    assert abs(box['x']) <= 1 and abs(box['y']) <= 1, parent
    assert abs(box['width'] - parent['width']) <= 1, parent
    assert abs(box['height'] - parent['height']) <= 1, parent
    assert child['width'] == parent['width'] and child['height'] == parent['height'], (parent, child)
    return {'parent': parent, 'portal': child}


def check_top_navigation(page, frame, label='Enter the atelier', destination=ATELIER_URL):
    link = frame.get_by_role('link', name=label, exact=True)
    expect(link).to_have_attribute('href', destination)
    expect(link).to_have_attribute('target', '_top')
    page.route(destination, lambda route: route.fulfill(
        status=200, content_type='text/html', body='<h1>Destination navigation fixture</h1>'))
    link.click()
    page.wait_for_url(destination)
    expect(page.get_by_role('heading', name='Destination navigation fixture')).to_be_visible()
    assert page.locator('iframe').count() == 0, 'Destination stayed inside the portal iframe'


errors, unexpected_requests, asset_responses = [], [], []
outcomes, viewports = [], {}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                    args=['--no-sandbox', '--disable-dev-shm-usage'])
        for mode, viewport in [('desktop', {'width': 1500, 'height': 900}),
                               ('mobile', {'width': 390, 'height': 844})]:
            context = browser.new_context(viewport=viewport, device_scale_factor=1,
                reduced_motion='reduce', is_mobile=mode == 'mobile', has_touch=mode == 'mobile')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: asset_responses.append(
                {'path': urlsplit(response.url).path, 'status': response.status})
                if response.url.startswith(pages_url) else None)
            page.on('request', lambda request: unexpected_requests.append(request.url)
                if request.url.startswith(('http:', 'https:')) and
                not request.url.startswith((pages_url, parent_url)) and request.url not in (ATELIER_URL, DRIVE_URL) else None)
            frame = embedded_portal(page)
            viewports[mode] = viewport_metrics(page, frame)
            page.screenshot(path=str(PREVIEWS / f'squarespace-embedded-{mode}.png'), full_page=True)

            if mode == 'desktop':
                canvas = frame.locator('#amaya-kelsea canvas')
                bounds = canvas.bounding_box()
                x, y = bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] / 2
                before = frame.evaluate('window.portal.rotations["amaya-kelsea"]')
                page.mouse.move(x, y)
                page.mouse.down()
                page.mouse.move(x + 60, y, steps=8)
                page.mouse.up()
                page.mouse.move(0, 0)
                assert frame.evaluate('window.portal.rotations["amaya-kelsea"]') != before
                frame.get_by_role('button', name='Reveal Serpentis Regina', exact=True).focus()
            else:
                canvas = frame.locator('#serpentis-regina canvas')
                bounds = canvas.bounding_box()
                canvas.tap(position={'x': bounds['width'] / 2, 'y': bounds['height'] / 2})
            expect(frame.locator('#serpentis-regina .world-info')).to_be_visible()
            check_top_navigation(page, frame)
            frame = embedded_portal(page)
            frame.get_by_role('button', name='Reveal Amaya Kelsea', exact=True).focus()
            expect(frame.locator('#amaya-kelsea .world-info')).to_be_visible()
            assert frame.locator('#kls .world-info a').count() == 0
            page.screenshot(path=str(PREVIEWS / f'amaya-drive-{mode}.png'), full_page=True)
            check_top_navigation(page, frame, 'Open Google Drive', DRIVE_URL)
            outcomes.append(f'{mode}: nested Pages assets, three real GLBs, heads-only black framing, viewport fit, reveal and top-window atelier and Amaya Drive navigation passed.')
            print(outcomes[-1], flush=True)
            context.close()

        # Use a lightweight document in the iframe for page-CSS scope checks.
        # Rendering has already been checked above; this avoids extra GPU contexts.
        context = browser.new_context(viewport={'width': 1500, 'height': 900})
        page = context.new_page()
        page.route(pages_url + '**', lambda route: route.fulfill(
            status=200, content_type='text/html', body='<body style="margin:0;background:black"></body>'))
        page.goto(parent_url + '/other')
        expect(page.locator('#header')).to_be_visible()
        expect(page.locator('#footer-sections')).to_be_visible()
        assert page.locator('#header').evaluate('el => getComputedStyle(el).display') != 'none'
        outcomes.append('Unrelated collection: site header and footer remain visible.')
        page.goto(parent_url + '/editor')
        expect(page.locator('#sqs-editor-toolbar')).to_be_visible()
        expect(page.locator('#header')).to_be_visible()
        expect(page.locator('#footer-sections')).to_be_visible()
        iframe = page.locator('iframe')
        assert iframe.evaluate('el => getComputedStyle(el).pointerEvents') == 'none'
        assert iframe.bounding_box()['height'] < 900
        outcomes.append('Editor fixture: toolbar, header and footer remain visible; iframe stays in document flow with editing interactions disabled.')
        context.close()
        browser.close()
finally:
    for server in (parent_server, pages_server):
        server.shutdown()
        server.server_close()

assert not errors, errors
assert not unexpected_requests, unexpected_requests
assert all(response['status'] == 200 for response in asset_responses), asset_responses
loaded_paths = {response['path'] for response in asset_responses}
assert {PROJECT_PATH + 'models/' + name for name in MODELS} <= loaded_paths, loaded_paths
assert any(path.startswith(PROJECT_PATH + 'assets/') and path.endswith('.js') for path in loaded_paths)
assert any(path.startswith(PROJECT_PATH + 'assets/') and path.endswith('.css') for path in loaded_paths)
record = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'passed': True,
    'portalRevision': '2.1',
    'pagesLikePath': PROJECT_PATH,
    'distinctParentAndIframeOrigins': True,
    'snippetSha256': sha256(fragment.encode()).hexdigest(),
    'buildIndexSha256': sha256((BUILD / 'index.html').read_bytes()).hexdigest(),
    'outcomes': outcomes,
    'viewports': viewports,
    'assetResponses': asset_responses,
    'atelierNavigation': {'destination': ATELIER_URL, 'topWindow': True,
                           'responseStubbed': True, 'liveSquarespaceVisited': False},
    'amayaDriveNavigation': {'destination': DRIVE_URL, 'label': 'Open Google Drive',
                            'topWindow': True, 'responseStubbed': True,
                            'driveSharingPermissionsChanged': False},
    'pageErrors': errors,
    'unexpectedExternalRequests': unexpected_requests,
    'limits': 'Local representative Squarespace wrappers and emulated mobile Chromium. This does not validate an authenticated Squarespace editor, plan-level custom-code support, the live page or physical-device GPU performance. The GitHub Pages URL was not deployed or contacted by this check.',
}
(VALIDATION / 'squarespace-integration.json').write_text(json.dumps(record, indent=2) + '\n')
print('Squarespace embedding and cross-origin navigation checks passed.', flush=True)
