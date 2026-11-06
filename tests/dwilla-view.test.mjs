import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDwilla } from '../workbook-web/dwilla-view.mjs';
import { createDwilla, createSyntheticDwillaDictionary, startDwillaFitting, saveDwillaSnapshot } from '../src/dwilla-workroom.mjs';
function state(){return startDwillaFitting(createDwilla(createSyntheticDwillaDictionary()),{sampleKey:'synthetic-sample',sampleId:'SYNTHETIC-SAMPLE',sampleRevision:'SYNTHETIC-1',patternRevision:'SYNTHETIC-A',unit:'IN',date:'2026-11-06'});}
test('imported method and description text render literally without executable HTML',()=>{
 const s=state();s.draft.fitting.readings.push({id:'synthetic-reading',pomCode:'M01',context:'SYNTHETIC front',value:1,unit:'IN',condition:'unwashed',observer:'SYNTHETIC observer',landmarkIds:[]});s.dictionary.definitions[0].description='<img src=x onerror="synthetic()">';s.dictionary.definitions[0].howToMeasure='SYNTHETIC <script>synthetic()</script> & instruction';
 for(const view of [{},{complete:true}]){const html=renderDwilla(s,view);assert.ok(!html.includes('<script>synthetic()'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;script&gt;synthetic()&lt;/script&gt;'));}
});
test('complete fitting print retains readings outside selected POM and prior pattern snapshots',async()=>{
 let s=state();s.draft.fitting.readings.push({id:'synthetic-reading',pomCode:'M32',context:'SYNTHETIC right',value:0,unit:'IN',condition:'unwashed',observer:'SYNTHETIC observer',landmarkIds:[]});s=await saveDwillaSnapshot(s);
 const html=renderDwilla(s,{pomCode:'M01',complete:true});assert.ok(html.includes('M32'));assert.ok(html.includes('SYNTHETIC right'));assert.ok(html.includes('SYNTHETIC-A'));assert.ok(html.includes('SYNTHETIC observer'));assert.ok(!html.includes('<button'));assert.ok(!html.includes('<input'));assert.ok(html.includes('BF-20'));
});
test('existing shared working samples stay selectable without an inferred pattern revision',()=>{
 const s=createDwilla(createSyntheticDwillaDictionary());const html=renderDwilla(s,{sharedSamples:[{id:'synthetic-existing',label:'SYNTHETIC old sample',round:'SYNTHETIC old round',notes:''}]});assert.ok(html.includes('synthetic-existing'));assert.ok(html.includes('pattern must be identified'));
});

test('reopened contextual specifications populate editable values while an explicit blank remains a clear request',()=>{
 const s=state();s.draft.fitting.specs.push({pomCode:'M01',context:'general',target:10,tolerance:{minus:0,plus:0.25},authority:'SYNTHETIC reviewed specification'});
 const html=renderDwilla(s,{});assert.match(html,/id="dw-target"[^>]*value="10"/);assert.match(html,/id="dw-toleranceMinus"[^>]*value="0"/);assert.match(html,/id="dw-authority"[^>]*value="SYNTHETIC reviewed specification"/);
 assert.match(renderDwilla(s,{target:''}),/id="dw-target"[^>]*value=""/);
});
