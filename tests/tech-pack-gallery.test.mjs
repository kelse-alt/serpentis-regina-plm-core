import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTechPack, normalizeTechPack, serializeTechPack, patternReferenceImages, selectedPatternReference, compareTechPacks } from '../src/tech-pack.mjs';
import { createEditHistory } from '../src/workroom-editing.mjs';

const template = JSON.parse(await readFile(new URL('../data/templates/tech-pack-workbook.v1.json', import.meta.url), 'utf8'));
const first = { name: 'synthetic-front.png', type: 'image/png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0QAAAABJRU5ErkJggg==' };
const second = { name: 'synthetic-back.png', type: 'image/png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' };
const galleryPack = () => {
  const pack = createTechPack(template);
  pack.attachments.pattern.reference = { images: [structuredClone(first), structuredClone(second)], selectedIndex: 1 };
  return pack;
};

test('existing single-image packs reopen unchanged and select their original reference', () => {
  const pack = createTechPack(template);
  assert.deepEqual(patternReferenceImages(pack), []);
  assert.equal(selectedPatternReference(pack), null);
  pack.attachments.pattern.reference = structuredClone(first);
  const original = structuredClone(pack);
  assert.deepEqual(normalizeTechPack(pack, template), original);
  assert.deepEqual(patternReferenceImages(pack), [first]);
  assert.deepEqual(selectedPatternReference(pack), first);
  assert.deepEqual(pack, original);
});

test('gallery JSON transfer preserves original image bytes, order and selected image independently', () => {
  const pack = galleryPack();
  const original = structuredClone(pack);
  const reopened = normalizeTechPack(JSON.parse(serializeTechPack(pack)), template);
  assert.deepEqual(reopened, original);
  assert.deepEqual(patternReferenceImages(reopened), [first, second]);
  assert.deepEqual(selectedPatternReference(reopened), second);
  reopened.attachments.pattern.reference.images[0].name = 'Changed on reopened copy';
  reopened.attachments.pattern.reference.images.reverse();
  assert.deepEqual(pack, original);
});

test('gallery imports reject missing images, invalid selections and unsafe or unsupported image data', () => {
  const invalid = [
    { images: [], selectedIndex: 0 },
    { images: {}, selectedIndex: 0 },
    { images: [first], selectedIndex: -1 },
    { images: [first], selectedIndex: 1 },
    { images: [first], selectedIndex: 0.5 },
    { images: [first], selectedIndex: '0' },
    { images: [first] },
    { images: [first], selectedIndex: 0, unknown: 'Do not discard this silently' },
    { images: [null], selectedIndex: 0 },
    { images: [{ images: [first], selectedIndex: 0 }], selectedIndex: 0 },
    { images: [{ ...first, dataUrl: 'https://example.com/image.png' }], selectedIndex: 0 },
    { images: [{ ...first, type: 'image/svg+xml' }], selectedIndex: 0 },
    { images: [{ ...first, dataUrl: 'data:image/png;base64,AAAA' }], selectedIndex: 0 },
    { images: [{ ...first, script: 'unexpected' }], selectedIndex: 0 },
  ];
  for (const gallery of invalid) {
    const pack = createTechPack(template);
    pack.attachments.pattern.reference = structuredClone(gallery);
    assert.throws(() => normalizeTechPack(pack, template));
  }
  const pack = galleryPack();
  pack.attachments.master.front = pack.attachments.pattern.reference;
  assert.throws(() => normalizeTechPack(pack, template), /known template fields/,
    'Only the Pattern Card reference slot supports galleries.');
});

test('the existing twelve-image limit counts gallery members and other worksheet references together', () => {
  const pack = galleryPack();
  pack.attachments.pattern.reference = { images: Array.from({ length: 12 }, () => ({ ...first })), selectedIndex: 11 };
  assert.equal(patternReferenceImages(normalizeTechPack(pack, template)).length, 12);
  pack.attachments.master.front = { ...second };
  assert.throws(() => normalizeTechPack(pack, template), /at most 12.*across all sheets/);
  pack.attachments.pattern.reference.images.pop();
  pack.attachments.pattern.reference.selectedIndex = 10;
  assert.equal(patternReferenceImages(normalizeTechPack(pack, template)).length, 11);
  pack.attachments.pattern.reference.images.push({ ...first }, { ...first });
  assert.throws(() => normalizeTechPack(pack, template), /between 1 and 12/);
});

test('revision comparisons include gallery selection, order and content without embedding raster payloads', () => {
  const before = galleryPack(), after = structuredClone(before);
  after.attachments.pattern.reference.selectedIndex = 0;
  let changes = compareTechPacks(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].path, 'attachments.pattern.reference');
  assert.equal(changes[0].before.selectedIndex, 1);
  assert.equal(changes[0].after.selectedIndex, 0);
  assert.equal(changes[0].after.images[0].name, first.name);
  assert.ok(changes[0].after.images.every(image => image.bytes > 0 && /^[a-f\d]{8}$/.test(image.contentFingerprint)));
  assert.ok(!JSON.stringify(changes).includes('data:image'));
  after.attachments.pattern.reference.images.reverse();
  changes = compareTechPacks(before, after);
  assert.equal(changes[0].after.images[0].name, second.name);
  assert.notEqual(changes[0].after.images[0].contentFingerprint, changes[0].before.images[0].contentFingerprint);
});

test('undo and redo keep independent gallery membership, image metadata and selected references', () => {
  const history = createEditHistory();
  const original = galleryPack();
  history.push(original, 'gallery-selection');
  original.attachments.pattern.reference.images[0].name = 'Changed after snapshot';
  original.attachments.pattern.reference.images.push({ ...first });
  original.attachments.pattern.reference.selectedIndex = 2;
  const undone = history.undo(original);
  assert.deepEqual(undone.attachments.pattern.reference, galleryPack().attachments.pattern.reference);
  undone.attachments.pattern.reference.images[0].name = 'Changed after undo';
  undone.attachments.pattern.reference.images.pop();
  const redone = history.redo(undone);
  assert.equal(redone.attachments.pattern.reference.images.length, 3);
  assert.equal(redone.attachments.pattern.reference.images[0].name, 'Changed after snapshot');
  assert.equal(redone.attachments.pattern.reference.selectedIndex, 2);
  assert.deepEqual(selectedPatternReference(redone), first);
});
