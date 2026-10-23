"""Render the existing house seal component as Home Screen icon UI assets.

The supplied artwork is read without modification. Chromium composes the same
CSS-framed seal used by the sheets on the house Obsidian background. Optional
Python Playwright and /usr/bin/chromium are needed only to regenerate icons.
"""
from pathlib import Path
from base64 import b64encode
from hashlib import sha256
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'assets/house-sheet/serpentis-regina-seal.png'
original = source.read_bytes()
output = ROOT / 'pwa/icons'
output.mkdir(parents=True, exist_ok=True)
markup = '''<!doctype html><html><head><style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:#101820}
body{display:grid;place-items:center}.seal{position:relative;width:72%;aspect-ratio:704/786;overflow:hidden}
.seal img{position:absolute;display:block;width:194.034%;max-width:none;height:auto;left:-47.017%;top:-13.486%}
</style></head><body><div class="seal"><img src="data:image/png;base64,SOURCE_ICON_DATA" alt="Serpentis Regina house seal"></div></body></html>'''.replace('SOURCE_ICON_DATA', b64encode(original).decode())
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
        page = browser.new_page(viewport={'width':size,'height':size}, device_scale_factor=1)
        page.set_content(markup, wait_until='load')
        page.wait_for_function('() => document.querySelector("img").complete && document.querySelector("img").naturalWidth > 0')
        page.screenshot(path=str(output/name))
        page.close()
    browser.close()
assert source.read_bytes() == original
(output/'README.md').write_text('''# Workroom Home Screen icons

Rendered from the existing `assets/house-sheet/serpentis-regina-seal.png`
using the same CSS framing as the sheet seal, centered on Obsidian `#101820`.
The original artwork bytes, colors and proportions are preserved as a source;
these files are browser-rendered UI icons at 180, 192 and 512 pixels.
No new artwork or lettering was introduced.

Regenerate with `python3 scripts/render-workroom-icons.py` when Chromium and
Python Playwright are available. Normal app builds use the tracked PNGs.

Original source SHA-256: `%s`.
''' % sha256(original).hexdigest())
print('Rendered three house-seal icons; original source unchanged.')
