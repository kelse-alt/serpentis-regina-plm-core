/** Shared house styling and original static assets for local/offline client intake. */
import { readFile } from 'node:fs/promises';

export const CLIENT_INTAKE_ASSETS = new Map([
  ['/assets/house-sheet/serpentis-regina-seal.png', [new URL('../assets/house-sheet/serpentis-regina-seal.png', import.meta.url), 'image/png']],
  ['/assets/house-sheet/fonts/barlow-condensed-500.ttf', [new URL('../assets/house-sheet/fonts/barlow-condensed-500.ttf', import.meta.url), 'font/ttf']],
  ['/assets/house-sheet/fonts/barlow-condensed-700.ttf', [new URL('../assets/house-sheet/fonts/barlow-condensed-700.ttf', import.meta.url), 'font/ttf']],
  ['/intake-grain.svg', [new URL('../sheet-web/matte-grain.svg', import.meta.url), 'image/svg+xml']],
]);

export async function loadClientIntakeStyles() {
  const [brandText, css] = await Promise.all([
    readFile(new URL('../design/brand-tokens.json', import.meta.url), 'utf8'),
    readFile(new URL('../client-web/app.css', import.meta.url), 'utf8'),
  ]);
  const brand = JSON.parse(brandText);
  const colors = {
    obsidian: brand.colors.obsidian,
    ruby: brand.colors.ruby,
    electric: brand.colors.electric,
    slytheren: brand.colors.slytheren,
    'ash-ink': brand.houseMeasurementSheet.matteInk.color,
    'ash-line': brand.houseMeasurementSheet.matteInk.line,
  };
  const tokens = ':root{' + Object.entries(colors).map(([name, value]) => {
    if (!/^#[\da-f]{6}$/i.test(value)) throw Error('Invalid house color token.');
    return `--${name}:${value}`;
  }).join(';') + '}';
  return tokens + '\n' + css;
}

export async function inlineClientIntakeAssets(contents) {
  let result = contents;
  for (const [url, [path, type]] of CLIENT_INTAKE_ASSETS) {
    const encoded = (await readFile(path)).toString('base64');
    result = result.split(url).join(`data:${type};base64,${encoded}`);
  }
  return result;
}
