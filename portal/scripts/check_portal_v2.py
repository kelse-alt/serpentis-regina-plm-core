"""Functional checks for the heads-only black-abyss entrance.

Run against the actual production preview, not a mocked renderer. The three
original GLBs must load. Contexts are released between desktop, touch and
unavailable-WebGL checks to avoid exhausting the software GPU in cloud runs.
"""
from pathlib import Path
import json
import os
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
PREVIEWS = ROOT / 'docs' / 'previews'
VALIDATION = ROOT / 'docs' / 'validation'
PREVIEWS.mkdir(parents=True, exist_ok=True)
VALIDATION.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('PORTAL_CHECK_URL', 'http://127.0.0.1:8035/')
PREFIX = os.environ.get('PORTAL_CHECK_PREFIX', 'portal-v2.1')
WORLDS = [('amaya-kelsea', 'Amaya Kelsea'), ('serpentis-regina', 'Serpentis Regina'), ('kls', 'KLS')]
OUTCOMES = []


def passed(message):
    OUTCOMES.append(message)
    print(message, flush=True)


def ready(page):
    response = page.goto(BASE, wait_until='domcontentloaded', timeout=60000)
    assert response and response.status == 200
    page.wait_for_function('document.documentElement.dataset.ready === "true"', timeout=60000)


def panels_hidden(page):
    return page.locator('.world-info').evaluate_all('''panels => panels.every(panel => {
        const style = getComputedStyle(panel);
        return panel.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
    })''')


def visible_text(page):
    """Ignore accessibility-only text while detecting painted labels or chrome."""
    return page.evaluate('''() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const visible = [];
        let node;
        while ((node = walker.nextNode())) {
            if (!node.textContent.trim() || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement?.tagName)) continue;
            let hidden = false;
            for (let el = node.parentElement; el; el = el.parentElement) {
                const style = getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                if (el.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 ||
                    ((style.clipPath !== 'none' || style.overflow === 'hidden') && rect.width <= 2 && rect.height <= 2)) {
                    hidden = true;
                    break;
                }
            }
            if (hidden) continue;
            const range = document.createRange(); range.selectNodeContents(node);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth)
                visible.push(node.textContent.trim());
        }
        return visible;
    }''')


def check_framing(page):
    assert page.locator('.world').count() == 3
    assert page.locator('.sculpture-stage canvas').count() == 3
    metrics = page.evaluate('''() => ({
        width: innerWidth, height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        background: getComputedStyle(document.body).backgroundColor,
        canvases: [...document.querySelectorAll('.sculpture-stage canvas')].map(c => {
            const r = c.getBoundingClientRect();
            return {x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom};
        })
    })''')
    assert metrics['background'] == 'rgb(0, 0, 0)', metrics
    assert metrics['scrollWidth'] <= metrics['width'] + 1, metrics
    assert metrics['scrollHeight'] <= metrics['height'] + 1, metrics
    for bounds in metrics['canvases']:
        assert bounds['width'] > 0 and bounds['height'] > 0
        assert bounds['x'] >= -1 and bounds['y'] >= -1, bounds
        assert bounds['right'] <= metrics['width'] + 1 and bounds['bottom'] <= metrics['height'] + 1, bounds
    assert not page.locator('.masthead, .intro, .gallery-notes, .finish-picker, footer').count()
    return metrics


def center(canvas):
    bounds = canvas.bounding_box()
    assert bounds
    return bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] / 2


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                args=['--no-sandbox', '--disable-dev-shm-usage'])
    desktop = browser.new_context(viewport={'width': 1500, 'height': 900}, device_scale_factor=1,
                                  reduced_motion='reduce')
    page = desktop.new_page()
    errors, remote = [], []
    origin = (urlsplit(BASE).scheme, urlsplit(BASE).netloc)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: remote.append(request.url) if request.url.startswith(('http:', 'https:')) and
            (urlsplit(request.url).scheme, urlsplit(request.url).netloc) != origin else None)
    ready(page)
    state = page.evaluate('window.portal')
    assert state['version'] == 2, state
    assert set(state['loaded']) == {item[0] for item in WORLDS} and not state['errors'], state
    assert set(state['sceneMeshes']) == {item[0] for item in WORLDS}, state
    assert all(scene['head'] > 0 and scene['extra'] == 0 for scene in state['sceneMeshes'].values()), state
    assert not errors and not remote, (errors, remote)
    assert panels_hidden(page)
    assert not visible_text(page), visible_text(page)
    desktop_metrics = check_framing(page)
    page.screenshot(path=str(PREVIEWS / f'{PREFIX}-desktop.png'), full_page=True)
    passed('Desktop opens on a black, viewport-sized scene with three real GLBs and no visible text or page chrome.')

    # A transient mouse hover should reveal only that head's information.
    x, y = center(page.locator('#serpentis-regina canvas'))
    page.mouse.move(x, y)
    expect(page.locator('#serpentis-regina .world-info')).to_be_visible()
    expect(page.locator('#serpentis-regina .world-info')).to_contain_text('Serpentis Regina')
    for world_id, _ in WORLDS:
        if world_id != 'serpentis-regina':
            expect(page.locator(f'#{world_id} .world-info')).to_be_hidden()
    page.screenshot(path=str(PREVIEWS / f'{PREFIX}-info.png'), full_page=True)
    page.mouse.move(0, 0)
    page.wait_for_function('''() => [...document.querySelectorAll('.world-info')].every(e => e.hidden || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden' || Number(getComputedStyle(e).opacity) === 0)''')
    passed('Hover reveals the matching information beneath the head and leaving dismisses the unpinned information.')

    # Reduced motion prevents idle animation from creating a false pixel-change pass.
    canvas = page.locator('#amaya-kelsea canvas')
    before = canvas.screenshot()
    rotation_before = page.evaluate('window.portal.rotations["amaya-kelsea"]')
    x, y = center(canvas)
    page.mouse.move(x, y); page.mouse.down()
    page.mouse.move(x + 80, y, steps=12); page.mouse.up(); page.mouse.move(0, 0)
    after = canvas.screenshot()
    assert before != after, 'Dragging did not change the sculpture rendering'
    assert page.evaluate('window.portal.rotations["amaya-kelsea"]') != rotation_before
    assert panels_hidden(page), 'Dragging pinned or opened information'
    assert page.evaluate('window.portal.selectedWorld') is None
    passed('Dragging rotates the actual sculpture without selecting a world or leaving its information open.')

    for world_id, name in WORLDS:
        control = page.get_by_role('button', name=f'Reveal {name}', exact=True)
        control.focus()
        expect(page.locator(f'#{world_id} .world-info')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.locator(f'#{world_id} .world-info')).to_be_hidden()
        expect(control).to_be_focused()
        page.keyboard.press('Enter')
        expect(page.locator(f'#{world_id} .world-info')).to_be_visible()
        expect(control).to_have_attribute('aria-expanded', 'true')
        if world_id == 'serpentis-regina':
            expect(page.locator(f'#{world_id} .world-info a')).to_have_attribute('href', 'https://www.serpentisregina.com/')
        page.keyboard.press('Escape')
        expect(page.locator(f'#{world_id} .world-info')).to_be_hidden()
        expect(control).to_be_focused()
    passed('All three heads support keyboard focus, reveal, Escape dismissal and focus return; the atelier link remains correct.')
    assert not errors, errors
    desktop.close()

    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                                 is_mobile=True, has_touch=True, reduced_motion='reduce')
    mp = mobile.new_page()
    mobile_errors = []
    mp.on('pageerror', lambda error: mobile_errors.append(str(error)))
    ready(mp)
    assert len(mp.evaluate('window.portal.loaded')) == 3
    assert not visible_text(mp), visible_text(mp)
    mobile_metrics = check_framing(mp)
    mp.screenshot(path=str(PREVIEWS / f'{PREFIX}-mobile.png'), full_page=True)
    for world_id, _ in WORLDS:
        c = mp.locator(f'#{world_id} canvas')
        bounds = c.bounding_box()
        c.tap(position={'x': bounds['width'] / 2, 'y': bounds['height'] / 2})
        expect(mp.locator(f'#{world_id} .world-info')).to_be_visible()
        c.tap(position={'x': bounds['width'] / 2, 'y': bounds['height'] / 2})
        expect(mp.locator(f'#{world_id} .world-info')).to_be_hidden()
    assert not mobile_errors, mobile_errors
    check_framing(mp)
    passed('All three heads fit the 390px mobile viewport; tapping each head reveals and dismisses its information without overflow.')
    mobile.close()

    fallback = browser.new_context(viewport={'width': 1200, 'height': 900}, reduced_motion='reduce')
    fallback.add_init_script('''
        const originalContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            if (String(type).includes('webgl')) return null;
            return originalContext.call(this, type, ...args);
        };
    ''')
    fp = fallback.new_page()
    ready(fp)
    assert len(fp.evaluate('window.portal.errors')) == 3
    for world_id, name in WORLDS:
        control = fp.get_by_role('button', name=f'Reveal {name}', exact=True)
        control.focus()
        fp.keyboard.press('Escape')
        fp.keyboard.press('Enter')
        expect(fp.locator(f'#{world_id} .world-info')).to_be_visible()
        fp.keyboard.press('Escape')
    passed('When WebGL is unavailable, keyboard reveal controls still expose all three world identities and destinations.')
    browser.close()

record = {
    'version': 2,
    'revision': state.get('revision'),
    'passed': len(OUTCOMES),
    'outcomes': OUTCOMES,
    'desktopViewport': desktop_metrics,
    'mobileViewport': mobile_metrics,
    'pageErrors': errors + mobile_errors,
    'externalRequests': remote,
    'limits': 'Software Chromium and emulated touch; not a physical mobile GPU or full accessibility certification.',
}
(VALIDATION / f'{PREFIX}-checks.json').write_text(json.dumps(record, indent=2) + '\n')
print(f'{len(OUTCOMES)} version-2 functional check groups passed.', flush=True)
