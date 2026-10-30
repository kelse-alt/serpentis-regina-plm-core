import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTechPack, normalizeTechPack, compareTechPacks, serializeTechPack } from '../src/tech-pack.mjs';
import { previewComponentWorkbook, applyComponentWorkbook } from '../src/garment-development.mjs';

const template = JSON.parse(await readFile(new URL('../data/templates/tech-pack-workbook.v1.json', import.meta.url), 'utf8'));
const cell = value => ({ value, formula:null, type:'s' });
const source = () => ({fileName:'synthetic-components.xlsx',sha256:'a'.repeat(64),sheets:[{
  name:'EXAMPLE-SPEC',merges:[],cells:{A11:cell('X01'),B11:cell('Example width'),D11:cell('Measure between the marked seams.'),E11:{value:99,formula:null,type:'n'},H11:{value:null,formula:'IF(E11="","",E11-G11)',type:'n'}},
}]});
function componentPack() {
  const pack=createTechPack(template);
  pack.schemaVersion=3;
  pack.development=applyComponentWorkbook(null,previewComponentWorkbook(source()));
  return pack;
}

test('component packs round-trip schema 3 without changing the six existing worksheets or legacy schemas',()=>{
  const legacy=createTechPack(template), pack=componentPack();
  assert.equal(legacy.schemaVersion,2);
  assert.deepEqual(normalizeTechPack(legacy,template),legacy);
  for(const key of ['style','fields','tables','attachments'])assert.deepEqual(pack[key],legacy[key]);
  assert.equal(pack.unit,null);
  assert.equal(pack.development.components[0].rows[0].targetCm,null,'Source numbers are context, not working specifications.');
  assert.equal(pack.development.source.sheets[0].cells.E11.value,99);
  assert.deepEqual(normalizeTechPack(JSON.parse(serializeTechPack(pack)),template),pack);
  const before=structuredClone(pack);
  pack.unit='in';
  pack.development.samples.push({id:'example-sample',label:'Example sample',round:'First',notes:'Independent sides'});
  const row=pack.development.components[0].rows[0];
  row.targetCm=25.4;
  row.observations['example-sample']={general:null,front:26.67,back:25.4,left:0,right:null};
  const reopened=normalizeTechPack(JSON.parse(serializeTechPack(pack)),template);
  assert.deepEqual(reopened,pack);
  assert.equal(before.development.components[0].rows[0].targetCm,null);
  assert.deepEqual(reopened.tables,legacy.tables);
});

test('component comparisons include source definition changes and every independent sample-side value',()=>{
  const before=componentPack(), after=structuredClone(before);
  after.unit='cm';
  after.development.samples.push({id:'s1',label:'Synthetic',round:'1',notes:''});
  const row=after.development.components[0].rows[0];
  row.targetCm=10;row.toleranceMinusCm=0;row.tolerancePlusCm=0;
  row.observations.s1={general:null,front:10,back:11,left:0,right:null};
  const changes=compareTechPacks(before,after);
  assert.ok(changes.some(c=>c.path.endsWith('.observations.s1.front')&&c.after===10));
  assert.ok(changes.some(c=>c.path.endsWith('.observations.s1.left')&&c.after===0));
  assert.ok(changes.some(c=>c.path.endsWith('.targetCm')&&c.after===10));
  const revised=source();revised.sha256='b'.repeat(64);revised.sheets[0].cells.D11.value='Revised synthetic method.';
  const preview=previewComponentWorkbook(revised,after.development,{unit:'cm'});
  after.development=applyComponentWorkbook(after.development,preview,{unit:'cm'});
  const history=normalizeTechPack(after,template).development.components[0].rows[0].definitionHistory;
  assert.equal(history[0].method,'Measure between the marked seams.');
  assert.equal(history[0].sourceSha256,'a'.repeat(64));
  assert.ok(compareTechPacks(before,after).some(c=>c.path.endsWith('.definitionHistory.0.method')));
});

test('malformed component JSON and unassigned units cannot enter the existing storage workflow',()=>{
  const pack=componentPack();
  const before=structuredClone(pack);
  for(const mutate of [
    p=>{delete p.development;},p=>{p.development.unknown='unsupported';},
    p=>{p.development.components[0].rows[0].targetCm=10;},
    p=>{p.development.components[0].rows[0].observations['unknown']={general:1,front:null,back:null,left:null,right:null};},
    p=>{p.fields.master.approval='Invented';},p=>{p.schemaVersion=4;},
  ]){
    const invalid=structuredClone(pack);mutate(invalid);
    assert.throws(()=>normalizeTechPack(invalid,template));
  }
  assert.deepEqual(pack,before);
});

test('component packs retain the current photo gallery and selected reference through portable JSON',()=>{
  const pack=componentPack();
  const image={name:'synthetic-reference.png',type:'image/png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0QAAAABJRU5ErkJggg=='};
  pack.attachments.pattern.reference={images:[image,{...image,name:'second-synthetic-reference.png'}],selectedIndex:1};
  const reopened=normalizeTechPack(JSON.parse(serializeTechPack(pack)),template);
  assert.deepEqual(reopened.attachments.pattern.reference,pack.attachments.pattern.reference);
  assert.deepEqual(reopened.development,pack.development);
  assert.equal(reopened.schemaVersion,3);
});
