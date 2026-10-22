import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createIntakeDraft, parseClientMeasurement, displayClientMeasurement, summarizeIntake, validateIntakeDraft, intakeToCsv } from '../src/client-intake.mjs';
import { CLIENT_INTAKE_ASSETS, loadClientIntakeStyles } from '../src/client-intake-assets.mjs';

const template = JSON.parse(await readFile(new URL('../data/templates/remote-bespoke-client-intake.v1.json', import.meta.url), 'utf8'));
function draftWithClient() {
  return createIntakeDraft(template, { fields: { clientId: 'DEMO-CLIENT', clientName: 'Demo Client', measurementDate: '2026-10-20' } });
}

test('the uploaded template preserves 34 source POMs, the RC-21 gap, 19 required rows, and unit choices', () => {
  assert.equal(template.measurements.length, 34);
  assert.equal(template.measurements.filter(record => record.required).length, 19);
  assert.deepEqual(template.measurements.map(record => record.pomCode), Array.from({ length: 35 }, (_, index) => `RC-${String(index + 1).padStart(2, '0')}`).filter(code => code !== 'RC-21'));
  assert.deepEqual(template.unitOptions, ['CM', 'IN']);
  assert.equal(template.defaultUnit, 'CM');
  assert.equal(template.source.formulaCount, 0);
  assert.deepEqual(template.measurements.filter(record => record.methodNeedsConfirmation).map(record => record.pomCode), ['RC-12', 'RC-13']);
  assert.ok(template.measurements.every(record => record.sourceLabel && record.howToMeasure && record.sourceRow));
});

test('source palette provenance is preserved while the intake uses the current shared house colors', async () => {
  assert.deepEqual(template.palette, {
    brandRed: '#E4002B', royalBlue: '#1E22AA', sectionRed: '#EE2737', referenceGreen: '#1FA824',
    measurementBurgundy: '#612028', tableDark: '#0F1720', tableRed: '#ED2637', entryBlush: '#FFF4F4',
    text: '#101820', white: '#FFFFFF',
  });
  const css = await loadClientIntakeStyles();
  const brand = JSON.parse(await readFile(new URL('../design/brand-tokens.json', import.meta.url), 'utf8'));
  for (const [name, value] of Object.entries({ obsidian: brand.colors.obsidian, ruby: brand.colors.ruby,
    electric: brand.colors.electric, slytheren: brand.colors.slytheren,
    'ash-ink': brand.houseMeasurementSheet.matteInk.color, 'ash-line': brand.houseMeasurementSheet.matteInk.line })) {
    assert.ok(css.includes(`--${name}:${value}`));
  }
  assert.doesNotMatch(css, /#(?:fff4f4|f4a6a0|612028)\b|--entry-blush|--measurement-burgundy/i);
});

test('new intakes start with empty client values and never populate measurements from an existing client', () => {
  const original = structuredClone(template);
  const draft = createIntakeDraft(template);
  assert.equal(draft.fields.clientId, '');
  assert.equal(draft.fields.clientName, '');
  assert.equal(draft.fields.projectDescription, '');
  assert.equal(draft.fields.projectType, '');
  assert.equal(draft.fields.measuredBy, '');
  assert.equal(draft.measurements.length, 34);
  assert.ok(draft.measurements.every(record => record.valueCm === null));
  draft.measurements[0].valueCm = 100;
  assert.deepEqual(template, original);
});

test('the distributed intake embeds the blank source template and every original house asset for offline use', async () => {
  const html = await readFile(new URL('../client-intake.html', import.meta.url), 'utf8');
  const embeddedTemplate = html.match(/window\.__CLIENT_INTAKE_TEMPLATE__ = (.*);\n/);
  assert.ok(embeddedTemplate, 'The standalone form must include its controlled blank template.');
  assert.deepEqual(JSON.parse(embeddedTemplate[1]), template);
  for (const [url, [path, type]] of CLIENT_INTAKE_ASSETS) {
    assert.ok(html.includes(`data:${type};base64,${(await readFile(path)).toString('base64')}`), `Original asset missing: ${url}`);
    assert.ok(!html.includes(url), `Runtime asset request remains: ${url}`);
  }
  assert.doesNotMatch(html, /(?:src|href)=["']\/(?:intake\.css|intake-app\.mjs)/);
  assert.match(html, /img-src data:; font-src data:; connect-src 'none'/);
});

test('decimal measurements convert to canonical centimetres, preserving explicit zero and missing values', () => {
  assert.equal(parseClientMeasurement('10', 'IN'), 25.4);
  assert.equal(parseClientMeasurement('0.125', 'IN'), 0.3175);
  assert.equal(parseClientMeasurement(' 12.7 ', 'CM'), 12.7);
  assert.equal(parseClientMeasurement('0', 'CM'), 0);
  assert.equal(parseClientMeasurement(' ', 'IN'), null);
  assert.equal(displayClientMeasurement(null, 'CM'), '');
  assert.equal(displayClientMeasurement(12.7, 'IN'), '5');
  assert.equal(displayClientMeasurement(0, 'IN'), '0');
  assert.equal(displayClientMeasurement(20, 'IN'), '7.874016');
  for (const bad of [-1, 'NaN', Infinity, undefined, true, '0x10', '1/2', [], {}]) assert.throws(() => parseClientMeasurement(bad, 'CM'));
  assert.throws(() => parseClientMeasurement(10, 'other'));
  assert.throws(() => displayClientMeasurement(Infinity, 'CM'));
});

test('display-unit changes retain the canonical values and do not mutate the template or convert twice', () => {
  const draft = draftWithClient();
  draft.measurements[0].valueCm = 20;
  draft.unit = 'IN';
  assert.equal(displayClientMeasurement(draft.measurements[0].valueCm, draft.unit), '7.874016');
  const saved = validateIntakeDraft(draft, template);
  assert.equal(saved.measurements[0].valueCm, 20);
  saved.unit = 'CM';
  assert.equal(displayClientMeasurement(saved.measurements[0].valueCm, saved.unit), '20');
  assert.equal(draft.unit, 'IN');
});

test('partial client drafts save while required measurements remain visibly incomplete', () => {
  const input = draftWithClient();
  input.measurements.find(record => record.pomCode === 'RC-27').valueCm = 0;
  const validated = validateIntakeDraft(input, template);
  const summary = summarizeIntake(validated, template);
  assert.equal(summary.total, 34);
  assert.equal(summary.measured, 1);
  assert.equal(summary.requiredTotal, 19);
  assert.equal(summary.requiredMeasured, 0);
  assert.equal(summary.optionalTotal, 15);
  assert.equal(summary.missingRequired.length, 19);
  assert.throws(() => validateIntakeDraft(input, template, { requireComplete: true }), /Required measurements/);
  assert.throws(() => validateIntakeDraft(createIntakeDraft(template), template), /before saving/);
  assert.equal(validateIntakeDraft(createIntakeDraft(template), template, { allowEmpty: true }).measurements.length, 34);
});

test('a completeness check requires identity, date, and the source-required POMs, without inventing approval', () => {
  const draft = draftWithClient();
  for (const record of draft.measurements) if (template.measurements.find(item => item.pomCode === record.pomCode).required) record.valueCm = 100;
  const result = validateIntakeDraft(draft, template, { requireComplete: true });
  assert.equal(summarizeIntake(result, template).requiredMeasured, 19);
  assert.equal(result.approval, undefined);
  assert.equal(result.measurements.filter(record => record.valueCm === null).length, 15);
  result.fields.measurementDate = '';
  assert.throws(() => validateIntakeDraft(result, template, { requireComplete: true }), /measurement date/);
});

test('malformed identity, units, metadata, POMs, and stored numbers cannot enter an intake snapshot', () => {
  for (const edit of [
    d => { d.templateId = 'OTHER'; }, d => { d.unit = 'cm'; },
    d => { d.fields.measurementDate = '2026-02-30'; }, d => { d.fields.clientId = 99; },
    d => { d.fields.unrecognized = 'unexpected'; }, d => { d.extra = 'unexpected'; },
    d => { d.fields.clientName = 'x'.repeat(1001); }, d => { d.croquisReference = 'x'.repeat(4001); },
    d => { d.measurements.pop(); }, d => { d.measurements[0].pomCode = 'BF-01'; },
    d => { d.measurements[1].pomCode = d.measurements[0].pomCode; },
    d => { d.measurements[0].valueCm = -1; }, d => { d.measurements[0].valueCm = '10'; },
    d => { d.measurements[0].valueCm = NaN; },
  ]) {
    const invalid = draftWithClient(); edit(invalid);
    assert.throws(() => validateIntakeDraft(invalid, template));
  }
});

test('CSV exports all 34 source rows, selected-unit values, missing blanks, methods, and formula-safe client text', () => {
  const draft = draftWithClient(); draft.unit = 'IN';
  draft.fields.clientName = '=HYPERLINK("example")';
  draft.measurements[0].valueCm = 12.7;
  draft.clientReference = '+a client note';
  const csv = intakeToCsv(validateIntakeDraft(draft, template), template);
  assert.equal(csv.trim().split('\r\n').length, 35);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'+a client note"));
  assert.ok(csv.includes('"IN","RC-01"'));
  assert.ok(csv.includes('"5"'));
  assert.ok(csv.includes('RC-35'));
  assert.ok(csv.includes(template.measurements[0].howToMeasure));
  assert.ok(csv.includes('house clarification pending'));
});
