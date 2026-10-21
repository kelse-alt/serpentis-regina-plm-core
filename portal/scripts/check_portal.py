"""Functional checks against the actual production preview and GLB assets."""
from pathlib import Path
import json
import os
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
BASE = os.environ.get('PORTAL_CHECK_URL', 'http://127.0.0.1:8035/')
outcomes = []

def ready(page):
    response = page.goto(BASE, wait_until='domcontentloaded', timeout=60000)
    assert response.status == 200
    page.wait_for_function('document.documentElement.dataset.ready === "true"', timeout=60000)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width': 1500, 'height': 1100}, device_scale_factor=1)
    page = context.new_page()
    errors = []
    remote_requests = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: remote_requests.append(request.url) if not request.url.startswith(BASE.rstrip('/')) else None)
    ready(page)
    runtime = page.evaluate('window.portal')
    assert set(runtime['loaded']) == {'amaya-kelsea', 'serpentis-regina', 'kls'}, runtime
    assert not runtime['errors'] and not errors, (runtime, errors)
    assert not remote_requests, remote_requests
    page.screenshot(path=str(ARTIFACTS / 'portal-desktop.png'), full_page=True)
    outcomes.append('Production page loads all three real GLBs without page errors or external requests.')
    print(outcomes[-1], flush=True)

    # Stop autonomous movement, so pixel change here tests drag rather than floating.
    page.emulate_media(reduced_motion='reduce')
    canvas = page.locator('#amaya-kelsea canvas')
    before = canvas.screenshot()
    bounds = canvas.bounding_box()
    x, y = bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] * 0.44
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 100, y, steps=12)
    page.mouse.up()
    after = canvas.screenshot()
    assert before != after, 'Drag did not change the rendered sculpture'
    assert not page.locator('#world-dialog').evaluate('(dialog) => dialog.open'), 'Drag accidentally entered a world'
    outcomes.append('Dragging changes the sculpture orientation without navigating.')
    print(outcomes[-1], flush=True)

    for name, expected_id in [('Amaya Kelsea', 'amaya-kelsea'), ('Serpentis Regina', 'serpentis-regina'), ('KLS', 'kls')]:
        button = page.get_by_role('button', name=f'Enter {name}', exact=True)
        button.focus()
        started = time.monotonic()
        page.keyboard.press('Enter')
        expect(page.get_by_role('dialog')).to_be_visible()
        assert time.monotonic() - started < 0.6, 'Reduced motion still waits for transition'
        expect(page.locator('#dialog-title')).to_have_text(name)
        assert page.evaluate('window.portal.selectedWorld') == expected_id
        if name == 'Serpentis Regina':
            expect(page.locator('#dialog-destination')).to_have_attribute('href', 'https://www.serpentisregina.com/')
            expect(page.locator('#dialog-destination')).to_be_visible()
            page.screenshot(path=str(ARTIFACTS / 'portal-atelier-entry.png'), full_page=True)
        else:
            expect(page.locator('#dialog-destination')).to_be_hidden()
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).not_to_be_visible()
        expect(button).to_be_focused()
    outcomes.append('All three worlds open by keyboard, Escape restores focus, and the atelier points to the real website.')
    print(outcomes[-1], flush=True)

    # An actual sculpture tap/click also enters, independent of the text button.
    center = page.locator('#serpentis-regina canvas').bounding_box()
    page.mouse.click(center['x'] + center['width'] / 2, center['y'] + center['height'] * 0.44)
    expect(page.get_by_role('dialog')).to_be_visible()
    expect(page.locator('#dialog-title')).to_have_text('Serpentis Regina')
    page.get_by_role('button', name='Return to the threshold', exact=True).first.click()
    expect(page.get_by_role('dialog')).not_to_be_visible()
    outcomes.append('Clicking the actual head selects its world.')
    print(outcomes[-1], flush=True)

    reflective = page.locator('#kls canvas').screenshot()
    page.get_by_role('button', name='Pearl', exact=True).click()
    expect(page.get_by_role('button', name='Pearl', exact=True)).to_have_attribute('aria-pressed', 'true')
    assert page.evaluate('window.portal.finish') == 'pearl'
    pearl = page.locator('#kls canvas').screenshot()
    assert reflective != pearl
    page.get_by_role('button', name='Iridescent', exact=True).click()
    page.emulate_media(reduced_motion='no-preference')
    page.get_by_role('button', name='Enter Amaya Kelsea', exact=True).click()
    expect(page.get_by_role('dialog')).to_be_visible()
    page.keyboard.press('Escape')
    outcomes.append('Finish switching changes the rendering; the animated entry also completes.')
    print(outcomes[-1], flush=True)
    assert not errors, errors
    # Release the desktop's three GPU contexts before emulating another device.
    context.close()

    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                                 is_mobile=True, has_touch=True, reduced_motion='reduce')
    mp = mobile.new_page()
    ready(mp)
    assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page overflows horizontally'
    assert len(mp.evaluate('window.portal.loaded')) == 3
    mp.get_by_role('button', name='Enter KLS', exact=True).tap()
    expect(mp.get_by_role('dialog')).to_be_visible()
    expect(mp.locator('#dialog-title')).to_have_text('KLS')
    mp.get_by_role('button', name='Return to the threshold', exact=True).first.tap()
    assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth')
    mp.evaluate('window.scrollTo(0, 0)')
    mp.screenshot(path=str(ARTIFACTS / 'portal-mobile.png'), full_page=True)
    outcomes.append('390px mobile layout has no horizontal overflow; touch entry and close work.')
    print(outcomes[-1], flush=True)
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
    assert fp.get_by_text('The sculpture could not load. You can still enter this world below.', exact=True).count() == 3
    fp.get_by_role('button', name='Enter Serpentis Regina', exact=True).click()
    expect(fp.get_by_role('dialog')).to_be_visible()
    expect(fp.locator('#dialog-destination')).to_have_attribute('href', 'https://www.serpentisregina.com/')
    outcomes.append('Without WebGL, all three text entry controls remain available and the atelier link works.')
    print(outcomes[-1], flush=True)
    assert not errors, errors
    browser.close()

(ARTIFACTS / 'checks.json').write_text(json.dumps({'passed': len(outcomes), 'outcomes': outcomes}, indent=2))
print(f'{len(outcomes)} functional checks passed.', flush=True)
