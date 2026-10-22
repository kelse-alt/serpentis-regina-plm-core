import { createTechPack, columnsForRow, normalizeTechPack, formatMeasure, parseMeasure, difference, csvEncode, serializeTechPack } from '../src/tech-pack.mjs';

const { template, source, form, methods } = WORKBOOK_DATA;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isEditable = item => !['readonly','calculated'].includes(item.type);
const storageKey = 'serpentis-regina.tech-packs.v1';
let pack = createTechPack(template), active = template.sheets[0].id, refUnit = 'in', dirty = false;
let saved = [], storageAvailable = true;
try { saved = JSON.parse(localStorage.getItem(storageKey) || '[]').map(p => normalizeTechPack(p, template)); }
catch { storageAvailable = false; saved = []; }
const housePhotos = {front:'/assets/house-sheet/mannequin-front.jpg',back:'/assets/house-sheet/mannequin-back.jpg'};
const activeSheet = () => template.sheets.find(s => s.id === active);
const unitFor = s => s.reference ? refUnit : pack.unit;
const status = message => { $('status').textContent = message; };
function markDirty() { dirty = true; pack.updatedAt = new Date().toISOString(); $('save-state').textContent = 'Unsaved changes · all six tabs'; updateIdentity(); }
function updateIdentity() {
 $('pack-identity').textContent = `${pack.title} · 6 SOURCE TABS · ${dirty ? 'UNSAVED DRAFT' : 'LOCAL DRAFT'}`;
}
function refreshSaved() {
 $('saved-packs').innerHTML = '<option value="">Select saved pack…</option>' + saved.map(p=>`<option value="${esc(p.id)}">${esc(p.title)} · ${esc(p.updatedAt.slice(0,10))}</option>`).join('');
}
function validScreen() {
 const invalid = [...$('sheet-content').querySelectorAll('input,textarea')].find(el => !el.checkValidity());
 if (invalid) { invalid.reportValidity(); invalid.focus(); status('Correct the highlighted value before continuing.'); return false; }
 return true;
}
function valueFor(s,t,r,c) {
 if(c.type === 'readonly') return r.values?.[c.key] ?? '—';
 if(c.type === 'calculated') {
  const values = pack.tables[s.id][t.id][r.id];
  if(c.formulaRows && !c.formulaRows.includes(r.id)) return null;
  return c.formula === 'actual-minus-base' ? difference(values.actual,values.base) : difference(values[c.stage+'target'],values[c.stage+'after']);
 }
 return pack.tables[s.id][t.id][r.id][c.key];
}
function fieldValue(s,f) { return f.type==='calculated' && s.id==='fit' ? pack.fields.pattern.style : pack.fields[s.id][f.key]; }
function renderFields(s) {
 if(!s.fields?.length) return '';
 return `<details class="sheet-details" ${s.tables?.length?'':'open'}><summary>Sheet details · ${s.fields.length} fields</summary><section class="form-section"><div class="field-grid">${s.fields.map(f=>`<label class="field${f.multiline?' wide':''}"><span>${esc(f.label)}</span>${isEditable(f) ? f.multiline ? `<textarea rows="3" maxlength="${f.multiline?10000:2000}" data-field="${f.key}" aria-label="${esc(f.label)}">${esc(fieldValue(s,f))}</textarea>` : `<input type="${f.inputType==='date'?'date':'text'}" maxlength="${f.multiline?10000:2000}" data-field="${f.key}" value="${esc(fieldValue(s,f))}" aria-label="${esc(f.label)}">` : `<output>${esc(fieldValue(s,f)||'—')}</output>`}</label>`).join('')}</div></section></details>`;
}
function renderAttachments(s) {
 if(!s.attachments?.length)return '';
 return `<details class="sheet-details attachment-details" ${s.tables?.length?'':'open'}><summary>Drawings & photographic references · ${s.attachments.length} slots</summary><section class="form-section"><div class="attachment-grid">${s.attachments.map(a=>{
 const image=pack.attachments[s.id][a.key];
 return `<article class="attachment-card"><h4>${esc(a.label)}</h4>${image?`<button class="image-open" data-image="${a.key}" type="button" aria-label="Enlarge ${esc(a.label)}"><img src="${image.dataUrl}" alt="${esc(a.label+' · '+image.name)}"></button><p>${esc(image.name)}</p><button type="button" data-remove="${a.key}">Remove image</button>`:'<p class="attachment-empty">No image attached</p>'}<label class="field"><span>${image?'Replace':'Attach'} PNG, JPEG or WebP · max 5 MB</span><input type="file" data-attachment="${a.key}" accept="image/png,image/jpeg,image/webp" aria-label="Attach ${esc(a.label)}"></label></article>`;
 }).join('')}</div></section></details>`;
}
function heading(s,c) { return c.headerField ? pack.fields[s.id][c.headerField] || `${c.label} · ${c.headerField.slice(-1)}` : c.label; }
function renderTable(s,t) {
 const unit=unitFor(s), uid=(unit||'?').toUpperCase();
 return `<section class="table-section" data-table-section="${t.id}"><h3>${esc(t.title)}</h3>${t.note?`<p class="table-note">${esc(t.note)}</p>`:''}<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(t.title)}; scroll horizontally to compare all columns"><table class="work-table ${s.id==='graded'?'graded-table':s.id==='master'?'master-table':s.id==='pattern'?'pattern-table':s.id==='wash'?'wash-table':''}" data-table="${t.id}" aria-label="${esc(t.title)}"><colgroup>${t.columns.map(c=>`<col class="col-${c.type||'text'}">`).join('')}</colgroup><thead><tr>${t.columns.map(c=>`<th scope="col">${esc(heading(s,c))}${['measurement','calculated'].includes(c.type)?` <span class="column-unit">(${uid})</span>`:''}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr data-row="${r.id}">${columnsForRow(t,r).map((c,i)=>{
 const v=valueFor(s,t,r,c), label=`${t.title}, row ${r.id}, ${heading(s,c)}`;
 const attributes=`data-table="${t.id}" data-row="${r.id}" data-col="${c.key}" aria-label="${esc(label)}"`;
 const numeric=['number','measurement'].includes(c.type);
 let cell;
 if(!isEditable(c)) cell=`<output data-result="${c.key}"><span class="matte-ink">${esc(c.type==='calculated'?formatMeasure(v,unit||'cm',true):v)}</span></output>`;
 else if(numeric)cell=`<input type="text" inputmode="decimal" autocomplete="off" ${attributes} data-numeric="${c.type}" value="${esc(c.type==='measurement' ? formatMeasure(v,unit||'cm').replace(/^—$/,'') : v??'')}" ${c.type==='measurement'&&!unit?'disabled title="Choose a garment unit first"':''}>`;
 else cell=`<textarea rows="2" maxlength="4000" ${attributes}>${esc(v)}</textarea>`;
 return `<td${i===0?' class="sticky-code"':''}>${cell}</td>`;
 }).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}
function approvedReference(s) {
 const unit=unitFor(s);
 const formatted=(v,signed=false)=>v===null?'—':formatMeasure(v*2.54,unit,signed);
 const how=new Map(methods.methods.map(m=>[m.pomCode,m]));
 return `<section class="reference-layout"><div class="photos">${['front','back'].map(view=>`<figure><button type="button" data-house-photo="${view}" class="image-open" aria-label="Enlarge original ${view} photo"><img src="${housePhotos[view]}" alt="Original ${view} photograph of SR-FORM-001"></button><figcaption>${view==='front'?'Front':'Back'}</figcaption></figure>`).join('')}</div><div class="reference-copy"><h3>Approved house form · size 8</h3><p>Actual Form is the approved physical house standard. Seven manufacturer references are present; thirteen are absent.</p><p class="formula">Delta = ACTUAL FORM − MFR</p><p>The source workbook retains an earlier pending-verification label. This viewer follows the approved versioned house record; it does not change the workbook.</p></div></section>
 <section class="table-section"><h3>HOUSE FIT FORM — ACTUAL BODY MEASUREMENTS</h3><div class="table-wrap" tabindex="0" role="region" aria-label="Approved house measurements; scroll horizontally"><table class="work-table reference-table" aria-label="Approved house mannequin reference"><thead><tr><th scope="col">POM</th><th scope="col">BODY MEASUREMENT</th><th scope="col">HOW TO MEASURE</th><th scope="col">MFR (${unit.toUpperCase()})</th><th scope="col">ACTUAL FORM (${unit.toUpperCase()})</th><th scope="col">Delta (${unit.toUpperCase()})</th></tr></thead><tbody>${form.measurements.map(r=>{const m=how.get(r.pomCode);return `<tr data-reference="${r.pomCode}"><th scope="row" class="sticky-code"><span class="matte-ink">${esc(r.pomCode)}</span></th><td><span class="matte-ink">${esc(m.sourceLabel)}</span></td><td><span class="matte-ink">${esc(m.howToMeasure)}</span></td><td><span class="matte-ink">${formatted(r.manufacturerReference)}</span></td><td><span class="matte-ink">${formatted(r.houseStandard)}</span></td><td><span class="matte-ink">${formatted(difference(r.houseStandard,r.manufacturerReference),true)}</span></td></tr>`;}).join('')}</tbody></table></div></section>`;
}
function renderSource(s) {
 const original=source.sheets.find(item=>item.title===s.title);
 return `<details class="source-note"><summary>Source notes, original cells & formulas</summary><p>Exact original tab: ${esc(s.title)}. Source values and formulas below are provenance; they are not editable draft values.</p>${s.id==='master'?`<p>${esc(template.sourceExamples.note)} Original pairs: 20 / 24.75, 25 / 37, 25 / 24.75. No source unit is supplied.</p>`:''}${s.reference?'<p>HOUSE TARGET / TARGET DELTA: source I31:I33 refers to blank column G. These unresolved formulas are preserved below and are not relabelled as target minus actual form.</p>':''}<pre>${esc(JSON.stringify(original,null,2))}</pre></details>`;
}
function sheetMarkup(s) { return (s.reference?approvedReference(s):'')+renderFields(s)+renderAttachments(s)+(s.tables||[]).map(t=>renderTable(s,t)).join('')+`<div id="no-rows" class="empty-state" hidden><p>No rows match. Clear search to show every source row.</p></div>`+renderSource(s); }
function renderSheet() {
 const s=activeSheet();
 $('sheet-title').textContent=s.title; $('sheet-note').textContent=s.note;
 $('working-panel').setAttribute('aria-labelledby','tab-'+s.id);
 $('sheet-content').innerHTML=sheetMarkup(s); $('sheet-content').scrollTop=0;
 $('pack-unit').value=unitFor(s)||'';
 $('pack-unit').querySelector('option[value=""]').hidden=!!s.reference||!!pack.unit;
 $('unit-label').textContent=s.reference?'Reference unit':'Garment unit';
 for(const b of $('sheet-tabs').children) {b.setAttribute('aria-selected',String(b.dataset.sheet===active));b.tabIndex=b.dataset.sheet===active?0:-1;}
 applySearch();
}
function applySearch() {
 const q=$('sheet-search').value.trim().toLowerCase(); let shown=0,total=0;
 $('sheet-content').querySelectorAll('tbody tr').forEach(row=>{
 const strings=[row.textContent,...[...row.querySelectorAll('input,textarea')].map(el=>el.value)];
 const match=!q||strings.join(' ').toLowerCase().includes(q);row.hidden=!match;shown+=+match;total++;
 });
 $('row-status').textContent=total?`${shown} of ${total} rows · ${activeSheet().reference?'approved reference & local notes':'local garment draft'}`:'Sheet details & sample references';
 $('no-rows').hidden=shown>0||total===0;
}
function updateResults(tableId,rowId) {
 const s=activeSheet(),t=s.tables.find(t=>t.id===tableId),r=t.rows.find(r=>r.id===rowId);
 const tr=$('sheet-content').querySelector(`table[data-table="${t.id}"] tr[data-row="${r.id}"]`);
 for(const c of columnsForRow(t,r).filter(c=>c.type==='calculated'))tr.querySelector(`[data-result="${c.key}"] .matte-ink`).textContent=formatMeasure(valueFor(s,t,r,c),unitFor(s)||'cm',true);
}
function loadPack(next,message) {
 pack=normalizeTechPack(next,template);dirty=false;$('pack-title').value=pack.title;updateIdentity();$('save-state').textContent='Local draft · '+pack.updatedAt.slice(0,10);$('sheet-search').value='';renderSheet();status(message);
}
function download(name,content,type) {
 const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function safeName() {return pack.title.replace(/[^a-z0-9_-]+/gi,'-').slice(0,70)||'tech-pack';}
function savePack() {
 if(!validScreen())return;
 try {
  const clean=normalizeTechPack(pack,template); const next=[clean,...saved.filter(p=>p.id!==clean.id)];
  localStorage.setItem(storageKey,JSON.stringify(next));saved=next;dirty=false;storageAvailable=true;refreshSaved();updateIdentity();$('saved-packs').value=pack.id;$('save-state').textContent='Saved locally · '+pack.updatedAt.slice(0,19).replace('T',' ');status('All six tabs saved in this browser. Download JSON for a portable backup.');
 }catch(error){storageAvailable=false;status('Browser storage could not save this pack. Download JSON now to keep all six tabs and images. '+error.message);}
}
function exportCsv() {
 if(!validScreen())return;
 const s=activeSheet(), unit=unitFor(s), numericCell=(v,u)=>v===null?'':Number(formatMeasure(v,u)), rows=[['SERPENTIS REGINA',pack.title],['Sheet',s.title],['Unit',unit?.toUpperCase()||'NOT SELECTED']];
 for(const f of s.fields||[])rows.push([f.label,fieldValue(s,f)||'']);
 if(s.reference){rows.push([],['POM','BODY MEASUREMENT','HOW TO MEASURE',`MFR (${unit})`,`ACTUAL FORM (${unit})`,`Delta (${unit})`]);for(const r of form.measurements){const m=methods.methods.find(m=>m.pomCode===r.pomCode);rows.push([r.pomCode,m.sourceLabel,m.howToMeasure,numericCell(r.manufacturerReference===null?null:r.manufacturerReference*2.54,unit),numericCell(r.houseStandard*2.54,unit),numericCell(difference(r.houseStandard,r.manufacturerReference)===null?null:difference(r.houseStandard,r.manufacturerReference)*2.54,unit)]);}}
 for(const t of s.tables||[]) {rows.push([],[t.title],t.columns.map(c=>heading(s,c)+(['measurement','calculated'].includes(c.type)?` (${(unit||'?').toUpperCase()})`:'')));for(const r of t.rows)rows.push(columnsForRow(t,r).map(c=>['measurement','calculated'].includes(c.type)?numericCell(valueFor(s,t,r,c),unit||'cm'):valueFor(s,t,r,c)));}
 download(safeName()+'-'+s.id+'.csv',csvEncode(rows),'text/csv;charset=utf-8');status('Exported every row on this sheet, independent of search. Images are included in JSON backups.');
}
function buildPrint() {
 const selected=$('print-scope').value==='all'?template.sheets:[activeSheet()];
 $('print-view').innerHTML=selected.map(s=>`<article class="print-sheet"><header class="print-masthead"><strong>SERPENTIS REGINA</strong><h1>${esc(s.title)}</h1><p>${esc(pack.title)} · ${s.reference?refUnit.toUpperCase():pack.unit?.toUpperCase()||'UNIT NOT SELECTED'} · LOCAL DRAFT</p></header><p>${esc(s.note)}</p>${sheetMarkup(s)}</article>`).join('');
 $('print-view').querySelectorAll('.sheet-details').forEach(el=>el.open=true);
 $('print-view').querySelectorAll('.source-note,.empty-state,input[type=file],button').forEach(el=>{
  if(el.classList.contains('image-open'))el.replaceWith(...el.childNodes);else el.remove();
 });
 $('print-view').querySelectorAll('input,textarea,select').forEach(el=>{const span=document.createElement('span');span.className='print-value';span.textContent=el.value||'—';el.replaceWith(span);});
 $('print-view').querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
 $('print-view').setAttribute('aria-hidden','false');
}
function showImage(src,title) { $('image-title').textContent=title;$('large-image').src=src;$('large-image').alt=title;$('image-dialog').showModal(); }
$('sheet-tabs').innerHTML=template.sheets.map((s,i)=>`<button id="tab-${s.id}" type="button" role="tab" aria-controls="working-panel" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-sheet="${s.id}"><span aria-hidden="true">0${i+1} / </span>${esc(s.shortTitle)}</button>`).join('');
$('sheet-tabs').addEventListener('click',event=>{const b=event.target.closest('[data-sheet]');if(!b||!validScreen())return;active=b.dataset.sheet;$('sheet-search').value='';renderSheet();b.scrollIntoView({block:'nearest',inline:'nearest'});});
$('sheet-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...$('sheet-tabs').children],i=buttons.indexOf(document.activeElement);const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;if(validScreen()){buttons[next].click();buttons[next].focus();}});
$('sheet-content').addEventListener('input',event=>{
 const el=event.target,s=activeSheet();
 if(el.dataset.field){
  pack.fields[s.id][el.dataset.field]=el.value;markDirty();
  for(const t of s.tables||[])for(const c of t.columns.filter(c=>c.headerField===el.dataset.field)) {
   const index=t.columns.indexOf(c),table=$('sheet-content').querySelector(`table[data-table="${t.id}"]`);
   table.querySelectorAll('thead th')[index].innerHTML=esc(heading(s,c))+` <span class="column-unit">(${(unitFor(s)||'?').toUpperCase()})</span>`;
   for(const input of table.querySelectorAll(`[data-col="${c.key}"]`))input.setAttribute('aria-label',`${t.title}, row ${input.dataset.row}, ${heading(s,c)}`);
  }
  return;
 }
 if(!el.dataset.col)return;
 const t=s.tables.find(t=>t.id===el.dataset.table),r=t.rows.find(r=>r.id===el.dataset.row),c=columnsForRow(t,r).find(c=>c.key===el.dataset.col);
 try {
  let value=el.value;
  if(c.type==='measurement')value=parseMeasure(el.value,unitFor(s),{allowNegative:!!c.allowNegative});
  else if(c.type==='number')value=parseMeasure(el.value,'cm',{allowNegative:!!c.allowNegative});
  el.setCustomValidity('');pack.tables[s.id][t.id][el.dataset.row][c.key]=value;markDirty();updateResults(t.id,el.dataset.row);
 }catch(error){el.setCustomValidity(error.message);status(error.message);}
});
$('sheet-content').addEventListener('focusout',event=>{if(event.target.matches('input,textarea'))applySearch();});
$('sheet-content').addEventListener('change',async event=>{
 const el=event.target,key=el.dataset.attachment,s=activeSheet();if(!key)return;
 const file=el.files[0], uploadPackId=pack.id;if(!file)return;
 try {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a PNG, JPEG or WebP up to 5 MB.');
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read image.'));reader.readAsDataURL(file);});
  const image=new Image();image.src=dataUrl;await image.decode();
  if(pack.id!==uploadPackId)throw Error('The active pack changed during upload. Attach the image again in the intended pack.');
  const next=structuredClone(pack);next.attachments[s.id][key]={name:file.name,type:file.type,dataUrl};pack=normalizeTechPack(next,template);markDirty();renderSheet();status('Image attached locally. Save or download JSON to keep it.');
 }catch(error){el.value='';status(error.message);}
});
$('sheet-content').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const s=activeSheet();if(button.dataset.remove){pack.attachments[s.id][button.dataset.remove]=null;markDirty();renderSheet();}if(button.dataset.image){const image=pack.attachments[s.id][button.dataset.image];showImage(image.dataUrl,image.name);}if(button.dataset.housePhoto){showImage(button.querySelector('img').src,'SR-FORM-001 · '+button.dataset.housePhoto);}});
$('pack-title').addEventListener('input',()=>{pack.title=$('pack-title').value.trim()||'Untitled tech pack';markDirty();});
$('pack-unit').addEventListener('change',()=>{if(!validScreen()){$('pack-unit').value=unitFor(activeSheet())||'';return;}if(activeSheet().reference){refUnit=$('pack-unit').value||'in';}else {pack.unit=$('pack-unit').value||null;markDirty();}renderSheet();status('Displayed measurements updated from canonical values. Measuring instructions are unchanged.');});
$('sheet-search').addEventListener('input',applySearch);$('clear-search').addEventListener('click',()=>{$('sheet-search').value='';applySearch();$('sheet-search').focus();});
$('save-pack').addEventListener('click',savePack);
$('open-pack').addEventListener('click',()=>{const next=saved.find(p=>p.id===$('saved-packs').value);if(!next){status('Select a saved pack first.');return;}if(dirty&&!confirm('Open saved pack and discard unsaved changes?'))return;loadPack(next,'Reopened all six tabs from this browser.');});
$('new-pack').addEventListener('click',()=>{if(dirty&&!confirm('Start a blank pack and discard unsaved changes?'))return;loadPack(createTechPack(template),'New blank garment pack. Approved house reference remains read-only.');});
$('export-json').addEventListener('click',()=>{if(!validScreen())return;download(safeName()+'.json',serializeTechPack(normalizeTechPack(pack,template)),'application/json');status('Downloaded all six tabs and attached images as JSON.');});
$('export-csv').addEventListener('click',exportCsv);
$('import-json').addEventListener('click',()=>$('json-file').click());
$('json-file').addEventListener('change',async()=>{const file=$('json-file').files[0];if(!file)return;try {if(file.size>85*1024*1024)throw Error('JSON file is too large.');const next=normalizeTechPack(JSON.parse(await file.text()),template);if(dirty&&!confirm('Import this pack and discard unsaved changes?'))return;loadPack(next,'Imported pack. Save locally or keep the downloaded JSON as your backup.');markDirty();}catch(error){status('Import refused: '+error.message);}finally{$('json-file').value='';}});
$('print-pack').addEventListener('click',()=>{if(validScreen()){buildPrint();window.print();}});
window.addEventListener('beforeprint',buildPrint);window.addEventListener('afterprint',()=>{$('print-view').innerHTML='';$('print-view').setAttribute('aria-hidden','true');});
$('close-image').addEventListener('click',()=>$('image-dialog').close());
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
if(matchMedia('(max-width: 740px)').matches)$('context-panel').open=false;
refreshSaved();$('pack-title').value=pack.title;renderSheet();updateIdentity();
if(!storageAvailable)status('Browser storage is unavailable or contains an incompatible record. Download JSON to save this pack.');
