import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadClientIntakeStyles } from '../src/client-intake-assets.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const expected={obsidian:'#101820',ruby:'#E4002B',salmon:'#EE2737',slytheren:'#1FA824',electric:'#1E22AA',ox:'#622128'};
test('launch palette matches all six founder screenshot HEX values exactly',async()=>{
 const brand=JSON.parse(await read('design/brand-tokens.json'));assert.deepEqual(brand.colors,expected);
 const allowed=new Set(Object.values(expected));assert.ok(allowed.has(brand.houseMeasurementSheet.matteInk.color));assert.ok(allowed.has(brand.houseMeasurementSheet.matteInk.line));
 const styles=await loadClientIntakeStyles();for(const [name,color] of Object.entries(expected))assert.ok(styles.includes(`--${name}:${color}`));
});
test('deployed interface styles use palette colors without white/gray paint or fractional-opacity tinting',async()=>{
 const allowed=new Set(Object.values(expected).map(value=>value.toLowerCase()));
 for(const path of ['workbook-web/app.css','workbook-web/dwilla.css','client-web/app.css','pwa/app.css','sheet-web/sheet.css']){
  const css=(await read(path)).replace(/\/\*[\s\S]*?\*\//g,'');
  for(const [color] of css.matchAll(/#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b/gi))assert.ok(allowed.has(color.toLowerCase()),`${path}: ${color}`);
  assert.doesNotMatch(css,/:\s*(?:white|black|gr[ae]y)\b|rgba?\(|hsla?\(|background-image\s*:\s*var\(--matte-grain\)/i,path);
  for(const [,value] of css.matchAll(/\bopacity\s*:\s*([\d.]+)/g))assert.ok([0,1].includes(Number(value)),`${path}: opacity ${value}`);
 }
});
