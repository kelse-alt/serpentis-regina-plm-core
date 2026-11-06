import test from 'node:test';
import assert from 'node:assert/strict';
import { createTechPack, normalizeTechPack, compareTechPacks } from '../src/tech-pack.mjs';
import { createDevelopment } from '../src/garment-development.mjs';
import { createDwilla, createSyntheticDwillaDictionary, startDwillaFitting, saveDwillaSnapshot } from '../src/dwilla-workroom.mjs';
const template={id:'SYNTHETIC-INTEGRATION',sheets:[]};
function integrated(){
 const pack=createTechPack(template);pack.schemaVersion=4;pack.style.number='SR-001';pack.development=createDevelopment();
 pack.dwilla=startDwillaFitting(createDwilla(createSyntheticDwillaDictionary()),{sampleKey:'synthetic-sample',sampleId:'SYNTHETIC-SAMPLE',sampleRevision:'SYNTHETIC-1',patternRevision:'SYNTHETIC-A',unit:'IN',date:'2026-11-06'});
 pack.development.samples.push({id:'synthetic-sample',label:'SYNTHETIC-SAMPLE',round:'SYNTHETIC-1',notes:'SYNTHETIC pattern A'});
 return pack;
}
test('existing blank packs keep schema2 while integrated fitting packs roundtrip shared style/sample identity',()=>{
 assert.equal(normalizeTechPack(createTechPack(template),template).schemaVersion,2);
 const pack=integrated();const restored=normalizeTechPack(JSON.parse(JSON.stringify(pack)),template);
 assert.deepEqual(restored,pack);assert.equal(restored.unit,null);assert.equal(restored.dwilla.draft.fitting.unit,'IN');
});
test('a fitting cannot be silently assigned to a different style or detached from its working sample',()=>{
 const pack=integrated();pack.style.number='SYNTHETIC-OTHER';assert.throws(()=>normalizeTechPack(pack,template),/shared style/);
 pack.style.number='SR-001';pack.development.samples=[];assert.throws(()=>normalizeTechPack(pack,template),/shared development sample/);
});
test('named pack comparisons include contextual fitting changes and retained history',async()=>{
 const before=integrated();const after=structuredClone(before);
 after.dwilla.draft.fitting.readings.push({id:'synthetic-reading',pomCode:'M01',context:'front-left',value:0,unit:'IN',condition:'unwashed',observer:'SYNTHETIC observer',landmarkIds:[]});
 after.dwilla=await saveDwillaSnapshot(after.dwilla);
 const changes=compareTechPacks(before,normalizeTechPack(after,template));
 assert.ok(changes.some(change=>change.path.includes('readings.0.value')&&change.after===0));
 assert.ok(changes.some(change=>change.path.includes('snapshots.0')));
 assert.equal(before.dwilla.draft.fitting.readings.length,0);
});
