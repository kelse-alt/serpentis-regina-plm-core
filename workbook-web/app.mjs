import { createTechPack, columnsForRow, normalizeTechPack, resolveFieldValue, sharedStyleKey, compareTechPacks, formatMeasure, parseMeasure, difference, csvEncode, serializeTechPack, patternReferenceImages, selectedPatternReference } from '../src/tech-pack.mjs';
import { createPackStore } from '../src/tech-pack-storage.mjs';
import { previewGridPaste, applyGridPaste, createEditHistory } from '../src/workroom-editing.mjs';

const { template, source, form, methods } = WORKBOOK_DATA;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isEditable = item => !item.readonly && !['readonly','calculated'].includes(item.type);
const housePhotos = {front:'/assets/house-sheet/mannequin-front.jpg',back:'/assets/house-sheet/mannequin-back.jpg'};
const styleLabels = {number:'Style number',description:'Description',category:'Garment category',season:'Season / collection',baseSize:'Base size',sampleSize:'Sample size',maker:'Maker / factory',patternRevision:'Pattern revision',owner:'Style owner',fabric:'Fabric reference'};
let pack = createTechPack(template), active = template.sheets[0].id, refUnit = 'in', dirty = false;
let saved = [], revisions = [], storageAvailable = false, conflicted = false, autosaveTimer;
let generation = 0, saveQueue = Promise.resolve(), pendingPaste = null, pasteOrigin = null, restoreTarget = null;
let pendingActions = 0, preparingUpdate = false, recordedRevisionDetails = '';
const revisionDetails = () => JSON.stringify(['revision-name','revision-author','revision-reason'].map(id=>$(id).value.trim()));
const activePackKey = 'serpentis-regina.workroom.active.v2';
function rememberedPack() {
 try { const id=sessionStorage.getItem(activePackKey);if(id)return id; } catch { /* Fall back to this browser's last active pack. */ }
 try { return localStorage.getItem(activePackKey); } catch { return null; }
}
function rememberPack(id) {
 try { localStorage.setItem(activePackKey,id); } catch { /* Draft storage is separate. */ }
 try { sessionStorage.setItem(activePackKey,id);return sessionStorage.getItem(activePackKey)===id; } catch { return false; }
}
const openWorkroomReview = () => pendingPaste||restoreTarget||['export-dialog','paste-dialog','revision-dialog','image-dialog'].some(id=>$(id).open);
const columnViews = {master:'full',wash:'full'};
const editHistory = createEditHistory(40);
const store = createPackStore(template);
const activeSheet = () => template.sheets.find(s => s.id === active);
const patternSheet = template.sheets.find(s=>s.id==='pattern');
const sheetForElement = el => template.sheets.find(s=>s.id===el.closest('[data-editor-sheet]')?.dataset.editorSheet)||activeSheet();
const editorRoots = s => [...document.querySelectorAll(`.sheet-editor[data-editor-sheet="${s.id}"]`)].filter(el=>!el.closest('#print-view'));
const panelPreferenceKey = 'serpentis-regina.workroom.style-panel-visible';
let sidebarImages = [], sidebarGalleryState = '';
const isPatternReference = (s,key) => s.id==='pattern'&&key==='reference';
const patternReferenceIndex = () => pack.attachments.pattern.reference?.selectedIndex??0;
function galleryNavigation(images,index,pinned=false) {
 if(images.length<2)return '';
 return `<span class="gallery-navigation${pinned?' pinned-gallery-navigation':''}" role="group" aria-label="${pinned?'Style reference':'Pattern reference'} gallery"><button type="button" data-gallery-prev="reference" aria-label="Previous ${pinned?'style':'pattern'} reference" ${index===0?'disabled':''}>Previous</button><output ${pinned?'data-style-gallery-count':'data-gallery-count="reference"'} aria-live="polite">${index+1} of ${images.length}</output><button type="button" data-gallery-next="reference" aria-label="Next ${pinned?'style':'pattern'} reference" ${index===images.length-1?'disabled':''}>Next</button></span>`;
}
function selectPatternReference(index,origin) {
 const images=patternReferenceImages(pack);
 if(!Number.isInteger(index)||index<0||index>=images.length||index===patternReferenceIndex())return;
 const root=origin?.closest('#style-reference-images,.sheet-editor'),attribute=['data-gallery-prev','data-gallery-next','data-gallery-select'].find(key=>origin?.hasAttribute(key));
 const editorId=root?.closest('#pinned-pattern-content')?'pinned-pattern-content':root?.id==='style-reference-images'?'style-reference-images':'sheet-content';
 editHistory.breakGroup();rememberEdit('gallery-selection');
 pack.attachments.pattern.reference={images,selectedIndex:index};markDirty();refreshAttachmentViews(patternSheet);editHistory.breakGroup();
 if(attribute){
  const root=$(editorId),target=root.querySelector(`[${attribute}="reference"]`);
  (target&&!target.disabled?target:root.querySelector('[data-gallery-select],button[data-gallery-prev]:not(:disabled),button[data-gallery-next]:not(:disabled)'))?.focus();
 }
 status(`Showing reference ${index+1} of ${images.length}: ${images[index].name}. Selection saves with this pack.`);
}
function setStylePanelVisible(visible,remember=true) {
 $('context-panel').hidden=!visible;
 document.querySelector('.workspace').classList.toggle('style-panel-hidden',!visible);
 $('toggle-style-panel').textContent=visible?'Hide style':'Show style';
 $('toggle-style-panel').setAttribute('aria-expanded',String(visible));
 $('toggle-style-panel').setAttribute('aria-label',(visible?'Hide':'Show')+' style reference panel');
 if(remember)try{localStorage.setItem(panelPreferenceKey,String(visible));}catch{/* This view preference never blocks local drafts. */}
}
function renderReferenceImages() {
 const flats=pack.attachments.master,pattern=selectedPatternReference(pack),gallery=patternReferenceImages(pack),index=patternReferenceIndex();
 const provided=Array.isArray(pack.attachments.pattern.reference?.images)?[]:['front','back'].filter(view=>flats[view]).map(view=>({key:view,label:view==='front'?'Front':'Back',src:flats[view].dataUrl,name:flats[view].name}));
 const images=provided.length?provided:pattern?[{key:'reference',label:'Style reference',src:pattern.dataUrl,name:pattern.name}]:['front','back'].map(view=>({key:view,label:view==='front'?'Front':'Back',src:housePhotos[view],name:'SR-FORM-001 · '+view}));
 const caption=provided.length?'Current style · front/back references':pattern?'Current style · pattern reference':'Example reference · SR-FORM-001';
 $('style-reference-caption').textContent=caption;
 const galleryState=provided.length?'':`${gallery.length}:${index}`;
 if(galleryState===sidebarGalleryState&&images.length===sidebarImages.length&&images.every((image,i)=>Object.keys(image).every(key=>image[key]===sidebarImages[i][key])))return;
 sidebarGalleryState=galleryState;
 sidebarImages=images;
 $('style-reference-images').innerHTML=images.map(image=>`<span class="reference-photo"><button type="button" class="image-open" data-sidebar-image="${image.key}" aria-label="Enlarge ${esc(image.label)} reference"><img src="${image.src}" alt="${esc(image.name)}"></button><span class="reference-photo-caption${image.key==='reference'?' reference-caption-other':''}">${esc(image.label)}</span>${image.key==='reference'?galleryNavigation(gallery,index,true):''}</span>`).join('');
}
function renderPinnedPattern() {
 const content=$('pinned-pattern-content'),scroll=$('context-panel').querySelector('.context-body').scrollTop;
 const opened=new Map([...content.querySelectorAll('[data-details]')].map(el=>[el.dataset.details,el.open]));
 content.innerHTML=`<div class="sheet-editor" data-editor-sheet="pattern">${renderFields(patternSheet)}${renderAttachments(patternSheet)}${patternSheet.tables.map(t=>renderTable(patternSheet,t)).join('')}</div>`;
 for(const el of content.querySelectorAll('[data-details]'))if(opened.has(el.dataset.details))el.open=opened.get(el.dataset.details);
 $('context-panel').querySelector('.context-body').scrollTop=scroll;
}
function refreshAttachmentViews(s) {
 for(const root of editorRoots(s)){
  const current=root.querySelector('.attachment-details');if(!current)continue;
  const fragment=document.createElement('template');fragment.innerHTML=renderAttachments(s);
  const next=fragment.content.firstElementChild;next.open=current.open;current.replaceWith(next);
 }
 renderReferenceImages();
}
function syncDerivedFields() {
 for(const s of template.sheets)for(const f of s.fields||[])if(f.type==='calculated')syncFieldViews(s,f);
}
function updateFieldHint(input,s,f) {
 const key=sharedStyleKey(s.id,f.key);if(!key)return;
 const label=input.closest('.field'),hint=label.querySelector('.inherit-hint'),button=label.querySelector('[data-use-shared]');
 if(hint)hint.textContent=(pack.fields[s.id][f.key]?'Sheet override':'Inherited from shared style')+' · '+styleLabels[key];
 if(button)button.hidden=!pack.fields[s.id][f.key];
}
function syncFieldViews(s,f,origin=null,preserveInvalid=false) {
 for(const root of editorRoots(s))for(const el of root.querySelectorAll(`[data-field="${f.key}"],[data-derived-field="${f.key}"]`)){
  if(preserveInvalid&&el.tagName!=='OUTPUT'&&!el.checkValidity())continue;
  if(el!==origin){if(el.tagName==='OUTPUT')el.textContent=fieldValue(s,f)||'—';else{el.value=fieldValue(s,f)||'';setInlineError(el,'');}}
  updateFieldHint(el,s,f);
 }
}
function syncInheritedFields() {
 for(const s of template.sheets)for(const f of s.fields||[])if(sharedStyleKey(s.id,f.key)||f.type==='calculated')syncFieldViews(s,f,null,true);
}
function syncTableViews(s,t,r,c,origin) {
 const value=valueFor(s,t,r,c);
 for(const root of editorRoots(s))for(const el of root.querySelectorAll(`[data-table="${t.id}"][data-row="${r.id}"][data-col="${c.key}"]`))if(el!==origin){
  el.value=c.type==='measurement'?formatMeasure(value,unitFor(s)||'cm'):value??'';setInlineError(el,'');
 }
}

const unitFor = s => s.reference ? refUnit : pack.unit;
const status = message => { $('status').textContent = message; };
const invalidInputs = () => [...document.querySelectorAll('#sheet-content input,#sheet-content textarea,#pinned-pattern-content input,#pinned-pattern-content textarea,#style-fields input,#pack-title')].filter(el => !el.checkValidity());
function saveState(message) { $('save-state').textContent = message; $('footer-save-state').textContent = message; }
function updateIdentity() {
 $('pack-identity').textContent = `${pack.style.number || pack.title} · ${pack.style.patternRevision ? 'PATTERN '+pack.style.patternRevision+' · ' : ''}${dirty ? 'UNSAVED DRAFT' : 'LOCAL DRAFT'}`;
 $('style-reference-summary').textContent=[pack.style.number||pack.title,pack.style.description,pack.style.sampleSize?'Sample '+pack.style.sampleSize:'',pack.style.patternRevision?'Pattern '+pack.style.patternRevision:''].filter(Boolean).join(' · ');
 $('style-reference-summary').title=$('style-reference-summary').textContent;
}
function updateHistory() { $('undo-edit').disabled = !editHistory.canUndo; $('redo-edit').disabled = !editHistory.canRedo; }
function rememberEdit(key) { editHistory.push(pack,key); }
function markDirty() {
 dirty=true;generation++;
 pack.updatedAt=new Date(Math.max(Date.now(),Date.parse(pack.updatedAt)+1)).toISOString();
 saveState(conflicted?'Conflict · download JSON or reopen saved draft':'Unsaved changes · autosave pending');
 updateIdentity();updateHistory();scheduleAutosave();
}
function scheduleAutosave() {
 clearTimeout(autosaveTimer);
 if(!storageAvailable||conflicted) { if(!storageAvailable)saveState('Not saved · download JSON');return; }
 autosaveTimer=setTimeout(()=>{if(invalidInputs().length){saveState('Correct invalid entry · valid draft retained');return;}saveNow().catch(()=>{});},500);
}
function setInlineError(input,message) {
 const wasInvalid=input.getAttribute('aria-invalid')==='true';
 const id=input.id || ['cell',input.closest('#pinned-pattern-content')?'pinned':'sheet',sheetForElement(input).id,input.dataset.table,input.dataset.row,input.dataset.col || input.dataset.field || input.dataset.styleKey].filter(Boolean).join('-');
 if(!input.id)input.id=id;
 const errorId=id+'-error';let error=document.getElementById(errorId);
 input.setCustomValidity(message);
 if(message){
  input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',errorId);
  if(!error){error=document.createElement('span');error.id=errorId;error.className='cell-error';input.insertAdjacentElement('afterend',error);}
  error.textContent=message;saveState('Correct invalid entry · valid draft retained');status(message);
 }else{
  input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');error?.remove();
  if(wasInvalid&&dirty)scheduleAutosave();
 }
}
function validScreen() {
 const invalid=invalidInputs()[0];
 if(invalid){if(invalid.closest('#context-panel'))setStylePanelVisible(true);for(let ancestor=invalid.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;invalid.focus();invalid.scrollIntoView({block:'nearest'});invalid.reportValidity();status('Correct the marked entry before continuing. Your last valid draft is retained.');return false;}
 return true;
}
async function refreshSaved() {
 if(!storageAvailable)return;
 saved=await store.listDrafts();
 $('saved-packs').innerHTML='<option value="">Select saved pack…</option>'+saved.map(p=>`<option value="${esc(p.id)}">${esc(p.title)} · ${esc(p.updatedAt.slice(0,10))}</option>`).join('');
 if(saved.some(p=>p.id===pack.id))$('saved-packs').value=pack.id;
}
async function refreshRevisions() {
 revisions=storageAvailable?await store.listRevisions(pack.id):[];
 $('revision-list').innerHTML='<option value="">Select revision…</option>'+revisions.map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${esc(r.createdAt.slice(0,16).replace('T',' '))}</option>`).join('');
 $('revision-status').textContent=revisions.length?`${revisions.length} preserved local revision${revisions.length===1?'':'s'}. Restoring creates a new working draft and preserves a backup.`:'No named revisions yet.';
}
async function refreshRecoveries() {
 if(!storageAvailable)return;
 const entries=await store.recoveries();
 $('recovery-panel').hidden=!entries.length;
 $('recovery-list').innerHTML=entries.map(r=>`<div class="recovery-item"><p>${esc(r.reason||'Incompatible older entry')}</p><button type="button" data-recover="${esc(r.id)}">Download original entry</button></div>`).join('');
}
function saveNow() {
 clearTimeout(autosaveTimer);
 if(!validScreen())return Promise.reject(Error('Correct invalid entries before saving.'));
 if(!storageAvailable){const guidance='Local draft storage is unavailable. Export → Download pack JSON keeps your current work and original images.';saveState('Not saved · download JSON');status(guidance);return Promise.reject(Error(guidance));}
 const snapshot=normalizeTechPack(pack,template), savedGeneration=generation;
 saveState('Saving on this device…');
 const operation=saveQueue.catch(()=>{}).then(async()=>{
  await store.saveDraft(snapshot);
  if(pack.id===snapshot.id&&generation===savedGeneration){dirty=false;rememberPack(snapshot.id);saveState('Saved locally · '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}));updateIdentity();}
  await refreshSaved();
 });
 saveQueue=operation.catch(error=>{
  const message=error.message+' Your current draft is still on screen. Export JSON for a backup.';
  if(pack.id===snapshot.id){dirty=true;conflicted=error.name==='ConflictError';saveState(conflicted?'Conflict · download JSON before reopening':'Not saved · download JSON');status(message);updateIdentity();}
  throw Object.assign(new Error(message,{cause:error}),{name:error.name});
 });
 return saveQueue;
}
function valueFor(s,t,r,c) {
 if(c.type==='readonly')return r.values?.[c.key]??'—';
 if(c.type==='calculated'){
  const values=pack.tables[s.id][t.id][r.id];
  if(c.formulaRows&&!c.formulaRows.includes(r.id))return null;
  return c.formula==='actual-minus-base'?difference(values.actual,values.base):difference(values[c.stage+'target'],values[c.stage+'after']);
 }
 return pack.tables[s.id][t.id][r.id][c.key];
}
function fieldValue(s,f){return resolveFieldValue(pack,s,f);}
function renderStyle() {
 $('style-fields').innerHTML=Object.entries(styleLabels).map(([key,label])=>`<label class="field"><span>${esc(label)}</span><input data-style-key="${key}" aria-label="${esc(label)}" maxlength="${key==='description'?4000:2000}" value="${esc(pack.style[key])}"></label>`).join('');
 $('style-unit').value=pack.unit||'';
 renderPinnedPattern();renderReferenceImages();
}
function inheritanceHint(s,f) {
 const key=sharedStyleKey(s.id,f.key);
 if(!key||!isEditable(f))return '';
 const overridden=!!pack.fields[s.id][f.key];
 return `<span class="inherit-hint">${overridden?'Sheet override':'Inherited from shared style'} · ${esc(styleLabels[key]||key)}${overridden&&pack.style[key]?' = '+esc(pack.style[key]):''}</span><button type="button" data-use-shared="${f.key}" ${overridden?'':'hidden'}>Use shared value</button>`;
}
function renderFields(s) {
 if(!s.fields?.length)return '';
 return `<details class="sheet-details" data-details="fields" ${s.tables?.length?'':'open'}><summary>Sheet details · ${s.fields.length} fields</summary><section class="form-section"><div class="field-grid">${s.fields.map(f=>`<label class="field${f.multiline?' wide':''}"><span>${esc(f.label)}</span>${isEditable(f)?f.multiline?`<textarea rows="3" maxlength="${f.multiline?10000:2000}" data-field="${f.key}" aria-label="${esc(f.label)}">${esc(fieldValue(s,f))}</textarea>`:`<input type="${f.inputType==='date'?'date':'text'}" maxlength="2000" data-field="${f.key}" value="${esc(fieldValue(s,f))}" aria-label="${esc(f.label)}">`:`<output data-derived-field="${f.key}">${esc(fieldValue(s,f)||'—')}</output>`}${inheritanceHint(s,f)}</label>`).join('')}</div></section></details>`;
}
function renderAttachments(s) {
 if(!s.attachments?.length)return '';
 return `<details class="sheet-details attachment-details" data-details="attachments" ${s.tables?.length?'':'open'}><summary>Drawings & photographic references · ${s.attachments.length} slots</summary><section class="form-section"><div class="attachment-grid">${s.attachments.map(a=>{
 const gallery=isPatternReference(s,a.key),images=gallery?patternReferenceImages(pack):[],index=gallery?patternReferenceIndex():0,image=gallery?selectedPatternReference(pack):pack.attachments[s.id][a.key];
 return `<article class="attachment-card"><h4>${esc(a.label)}</h4>${image?`<button class="image-open" data-image="${a.key}" type="button" aria-label="Enlarge ${esc(a.label)}"><img src="${image.dataUrl}" alt="${esc(a.label+' · '+image.name)}"></button><p class="attachment-name">${esc(image.name)}</p>${gallery?galleryNavigation(images,index):''}${gallery&&images.length>1?`<label class="field gallery-picker"><span>Displayed photo</span><select data-gallery-select="reference" aria-label="Displayed pattern reference">${images.map((photo,i)=>`<option value="${i}" ${i===index?'selected':''}>${i+1}. ${esc(photo.name)}</option>`).join('')}</select></label>`:''}<button type="button" data-remove="${a.key}">${gallery?'Remove displayed photo':'Remove image'}</button>`:'<p class="attachment-empty">No image attached</p>'}<label class="field"><span>${gallery?'Add photos · PNG, JPEG or WebP · max 5 MB each':`${image?'Replace':'Attach'} PNG, JPEG or WebP · max 5 MB`}</span><input type="file" data-attachment="${a.key}" ${gallery?'multiple':''} accept="image/png,image/jpeg,image/webp" aria-label="Attach ${esc(a.label)}"></label>${gallery?'<p class="hint">One photo is displayed at a time; all photos stay in your pack and JSON backup. Up to 12 photos per pack.</p>':''}</article>`;
 }).join('')}</div></section></details>`;
}
function heading(s,c) { return c.headerField ? pack.fields[s.id][c.headerField] || `${c.label} · ${c.headerField.slice(-1)}` : c.label; }
function visibleColumns(s,t,complete=false) {
 if(complete||columnViews[s.id]!=='comparison')return t.columns;
 const selected=s.id==='master'?['pom','description','tolerance','base','actual','delta','target']:['line','pom','description','atarget','aafter','adelta','btarget','bafter','bdelta'];
 return t.columns.filter(c=>selected.includes(c.key));
}
function renderTable(s,t,complete=false) {
 const unit=unitFor(s),uid=(unit||'?').toUpperCase(),columns=visibleColumns(s,t,complete);
 const compact=!complete&&columnViews[s.id]==='comparison';
 return `<section class="table-section" data-table-section="${t.id}"><h3>${esc(t.title)}</h3>${t.note?`<p class="table-note">${esc(t.note)}</p>`:''}<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(t.title)}; scroll horizontally to compare all columns"><table class="work-table ${s.id==='graded'?'graded-table':s.id==='master'?'master-table':s.id==='pattern'?'pattern-table':s.id==='wash'?'wash-table':''}${compact?' comparison-table':''}" data-table="${t.id}" aria-label="${esc(t.title)}"><colgroup>${columns.map(c=>`<col class="col-${c.type||'text'}">`).join('')}</colgroup><thead><tr>${columns.map(c=>`<th scope="col" data-column="${c.key}">${esc(heading(s,c))}${['measurement','calculated'].includes(c.type)?` <span class="column-unit">(${uid})</span>`:''}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr data-row="${r.id}">${columns.map((definition,i)=>{
 const c=columnsForRow(t,r).find(item=>item.key===definition.key);
 const v=valueFor(s,t,r,c),label=`${t.title}, row ${r.id}, ${heading(s,c)}`;
 const attributes=`data-table="${t.id}" data-row="${r.id}" data-col="${c.key}" aria-label="${esc(label)}"`;
 const numeric=['number','measurement'].includes(c.type);
 let cell;
 if(!isEditable(c))cell=`<output data-result="${c.key}"><span class="matte-ink">${esc(c.type==='calculated'?formatMeasure(v,unit||'cm',true):v)}</span></output>`;
 else if(numeric)cell=`<input type="text" inputmode="${c.type==='measurement'&&unit==='in'?'text':'decimal'}" autocomplete="off" ${attributes} data-numeric="${c.type}" value="${esc(c.type==='measurement'?formatMeasure(v,unit||'cm'):v??'')}" ${c.type==='measurement'&&!unit?'disabled title="Choose a garment unit first"':''}>`;
 else cell=`<textarea rows="2" maxlength="4000" ${attributes}>${esc(v)}</textarea>`;
 return `<td data-column="${c.key}"${i===0?' class="sticky-code"':''}>${cell}</td>`;
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
function sheetMarkup(s,complete=false){return `<div class="sheet-editor" data-editor-sheet="${s.id}">`+(s.reference?approvedReference(s):'')+renderFields(s)+renderAttachments(s)+(s.tables||[]).map(t=>renderTable(s,t,complete)).join('')+`<div id="no-rows" class="empty-state" hidden><p>No rows match. Clear search to show every source row.</p></div>`+renderSource(s)+'</div>';}
function renderSheet(preserve=false){
 const s=activeSheet(), content=$('sheet-content'),scroll=content.scrollTop;
 const opened=new Map([...content.querySelectorAll('[data-details]')].map(el=>[el.dataset.details,el.open]));
 $('sheet-title').textContent=s.title;$('sheet-note').textContent=s.note;
 $('working-panel').setAttribute('aria-labelledby','tab-'+s.id);
 content.innerHTML=sheetMarkup(s);
 if(preserve)for(const el of content.querySelectorAll('[data-details]'))if(opened.has(el.dataset.details))el.open=opened.get(el.dataset.details);
 content.scrollTop=preserve?scroll:0;
 $('pack-unit').value=unitFor(s)||'';
 $('pack-unit').querySelector('option[value=""]').hidden=!!s.reference||!!pack.unit;
 $('style-unit').value=pack.unit||'';
 $('unit-label').textContent=s.reference?'Reference unit':'Garment unit';
 $('column-view-label').hidden=!Object.hasOwn(columnViews,s.id);
 $('column-view').value=columnViews[s.id]||'full';
 $('context-column-view-label').hidden=!Object.hasOwn(columnViews,s.id);
 $('context-column-view').value=columnViews[s.id]||'full';
 for(const b of $('sheet-tabs').children){b.setAttribute('aria-selected',String(b.dataset.sheet===active));b.tabIndex=b.dataset.sheet===active?0:-1;}
 applySearch();
}
function applySearch(){
 const q=$('sheet-search').value.trim().toLowerCase();let shown=0,total=0;
 $('sheet-content').querySelectorAll('tbody tr').forEach(row=>{const strings=[row.textContent,...[...row.querySelectorAll('input,textarea')].map(el=>el.value)];const match=!q||strings.join(' ').toLowerCase().includes(q);row.hidden=!match;shown+=+match;total++;});
 $('row-status').textContent=total?`${shown} of ${total} rows · ${activeSheet().reference?'approved reference & local notes':'local garment draft'}${columnViews[active]==='comparison'?' · comparison columns':''}`:'Sheet details & sample references';
 $('no-rows').hidden=shown>0||total===0;
}
function updateResults(s,tableId,rowId){
 const t=s.tables.find(t=>t.id===tableId),r=t.rows.find(r=>r.id===rowId);
 for(const root of editorRoots(s)){const tr=root.querySelector(`table[data-table="${t.id}"] tr[data-row="${r.id}"]`);if(!tr)continue;
 for(const c of columnsForRow(t,r).filter(c=>c.type==='calculated')){const out=tr.querySelector(`[data-result="${c.key}"] .matte-ink`);if(out)out.textContent=formatMeasure(valueFor(s,t,r,c),unitFor(s)||'cm',true);}}
}
async function loadPack(next,message,{savedDraft=false}={}){
 clearTimeout(autosaveTimer);pack=normalizeTechPack(next,template);generation++;dirty=!savedDraft;conflicted=false;editHistory.reset();updateHistory();
 rememberPack(pack.id);
 if(saved.some(p=>p.id===pack.id))$('saved-packs').value=pack.id;
 $('pack-title').value=pack.title;$('sheet-search').value='';renderStyle();renderSheet();updateIdentity();
 saveState(savedDraft?'Saved locally · '+pack.updatedAt.slice(0,19).replace('T',' '):'Working draft · not saved yet');
 try{await refreshRevisions();status(message);}catch(error){$('revision-status').textContent='Revision history could not be read. Your working draft remains on screen.';status(message+' Revision history unavailable: '+error.message);}
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safeName(){return pack.title.replace(/[^a-z0-9_-]+/gi,'-').slice(0,70)||'tech-pack';}
function exportCsv(){
 if(!validScreen())return;
 const s=activeSheet(),unit=unitFor(s),numericCell=(v,u)=>v===null?'':Number(formatMeasure(v,u));
 const rows=[['SERPENTIS REGINA',pack.title],['Sheet',s.title],['Unit',unit?.toUpperCase()||'NOT SELECTED']];
 for(const [key,label] of Object.entries(styleLabels))rows.push(['Shared '+label,pack.style[key]]);
 for(const f of s.fields||[])rows.push([f.label,fieldValue(s,f)||'']);
 if(s.reference){rows.push([],['POM','BODY MEASUREMENT','HOW TO MEASURE',`MFR (${unit})`,`ACTUAL FORM (${unit})`,`Delta (${unit})`]);for(const r of form.measurements){const m=methods.methods.find(m=>m.pomCode===r.pomCode);rows.push([r.pomCode,m.sourceLabel,m.howToMeasure,numericCell(r.manufacturerReference===null?null:r.manufacturerReference*2.54,unit),numericCell(r.houseStandard*2.54,unit),numericCell(difference(r.houseStandard,r.manufacturerReference)===null?null:difference(r.houseStandard,r.manufacturerReference)*2.54,unit)]);}}
 for(const t of s.tables||[]){rows.push([],[t.title],t.columns.map(c=>heading(s,c)+(['measurement','calculated'].includes(c.type)?` (${(unit||'?').toUpperCase()})`:'')));for(const r of t.rows)rows.push(columnsForRow(t,r).map(c=>['measurement','calculated'].includes(c.type)?numericCell(valueFor(s,t,r,c),unit||'cm'):valueFor(s,t,r,c)));}
 download(safeName()+'-'+s.id+'.csv',csvEncode(rows),'text/csv;charset=utf-8');status('Exported every source row and column on this sheet, independent of search or view.');
}
function buildPrint(){
 const selected=$('print-scope').value==='all'?template.sheets:[activeSheet()];
 const shared=Object.entries(styleLabels).filter(([key])=>pack.style[key]).map(([key,label])=>`<span>${esc(label)}: ${esc(pack.style[key])}</span>`).join(' · ');
 $('print-view').innerHTML=selected.map(s=>`<article class="print-sheet"><header class="print-masthead"><strong>SERPENTIS REGINA</strong><h1>${esc(s.title)}</h1><p>${esc(pack.style.number||pack.title)} · ${s.reference?refUnit.toUpperCase():pack.unit?.toUpperCase()||'UNIT NOT SELECTED'} · LOCAL DRAFT</p></header><p>${shared}</p><p>${esc(s.note)}</p>${sheetMarkup(s,true)}</article>`).join('');
 $('print-view').querySelectorAll('.sheet-details').forEach(el=>el.open=true);
 $('print-view').querySelectorAll('.source-note,.empty-state,input[type=file],button,.inherit-hint,.gallery-picker,.gallery-navigation').forEach(el=>{if(el.classList.contains('image-open'))el.replaceWith(...el.childNodes);else el.remove();});
 $('print-view').querySelectorAll('input,textarea,select').forEach(el=>{const span=document.createElement('span');span.className='print-value';span.textContent=el.value||'—';el.replaceWith(span);});
 $('print-view').querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));$('print-view').setAttribute('aria-hidden','false');
}
function showImage(src,title){$('image-title').textContent=title;$('large-image').src=src;$('large-image').alt=title;$('image-dialog').showModal();}
function applyUndo(direction){
 clearTimeout(autosaveTimer);const next=editHistory[direction](pack);if(!next)return;
 pack=normalizeTechPack(next,template);$('pack-title').value=pack.title;renderStyle();renderSheet(true);markDirty();status(direction==='undo'?'Undid the last edit.':'Redid the edit.');
}
function diffValue(value){if(value===null||value==='')return '—';return typeof value==='object'?JSON.stringify(value):String(value);}
function changeLabel(path){
 const [kind,sheetId,tableId,rowId,columnKey]=path.split('.');
 if(kind==='style')return 'Shared style / '+(styleLabels[sheetId]||sheetId);
 if(kind==='title')return 'Pack title';if(kind==='unit')return 'Garment unit';
 const sheet=template.sheets.find(s=>s.id===sheetId);if(!sheet)return path;
 if(kind==='fields')return sheet.shortTitle+' / '+(sheet.fields.find(f=>f.key===tableId)?.label||tableId);
 if(kind==='attachments')return sheet.shortTitle+' / '+(sheet.attachments.find(a=>a.key===tableId)?.label||tableId);
 const table=sheet.tables.find(t=>t.id===tableId),column=table?.columns.find(c=>c.key===columnKey);
 return `${sheet.shortTitle} / ${table?.title||tableId} / Row ${rowId} / ${column?.label||columnKey}`;
}
function diffCell(change,value,snapshot){
 if(!change.path.startsWith('attachments.'))return esc(diffValue(value));
 const [,sheetId,key]=change.path.split('.'),gallery=sheetId==='pattern'&&key==='reference',image=gallery?selectedPatternReference(snapshot):snapshot.attachments[sheetId]?.[key],images=gallery?patternReferenceImages(snapshot):[];
 return image?`${gallery?`<p>${images.length} photo${images.length===1?'':'s'} · displayed ${(snapshot.attachments.pattern.reference.selectedIndex??0)+1} of ${images.length}</p><ul>${images.map(photo=>`<li>${esc(photo.name)}</li>`).join('')}</ul>`:''}<p>${esc(image.name)}</p><img class="revision-image" src="${image.dataUrl}" alt="${esc(changeLabel(change.path))}">`:'—';
}
async function reviewRevision(restore=false){
 if(!validScreen())return;
 const metadata=revisions.find(r=>r.id===$('revision-list').value);
 if(!metadata){status('Choose a named revision first.');return;}
 const snapshot=await store.getRevision(metadata.id);const changes=compareTechPacks(snapshot,pack);
 restoreTarget=restore?{metadata,snapshot}:null;
 $('revision-title').textContent=restore?'Review revision restore':'Revision comparison';
 $('revision-summary').textContent=`${metadata.name} · ${metadata.author} · ${metadata.createdAt.slice(0,19).replace('T',' ')} · ${changes.length} changes compared with the current draft. Measurements below are canonical CM; approved house reference is unchanged. ${restore?'Restoring preserves a backup of the current draft first.':''}`;
 $('revision-diff').innerHTML=changes.length?`<table><thead><tr><th>Field / cell</th><th>Named revision</th><th>Current draft</th></tr></thead><tbody>${changes.map(c=>`<tr><td>${esc(changeLabel(c.path))}</td><td class="diff-value">${diffCell(c,c.before,snapshot)}</td><td class="diff-value">${diffCell(c,c.after,pack)}</td></tr>`).join('')}</tbody></table>`:'<p>The named revision and current draft contain the same values.</p>';
 $('confirm-restore').hidden=!restore;$('revision-dialog').showModal();
}
function changeGarmentUnit(unit){if(!validScreen()){$('style-unit').value=pack.unit||'';return false;}if(pack.unit===unit)return true;rememberEdit('unit');pack.unit=unit;markDirty();renderSheet(true);return true;}
function previewPaste(event){
 const el=event.target,s=sheetForElement(el);if(!el.dataset.col)return;
 const text=event.clipboardData?.getData('text/plain')||'';
 if(!/[\t\r\n]/.test(text))return;
 event.preventDefault();if(!validScreen())return;
 pasteOrigin={el,text,start:el.selectionStart,end:el.selectionEnd,packId:pack.id};pendingPaste=null;
 $('paste-single').hidden=el.tagName!=='TEXTAREA';
 $('paste-errors').textContent='';$('paste-preview').innerHTML='';$('apply-paste').disabled=true;
 try{
  const table=el.closest('table'),rows=[...table.querySelectorAll('tbody tr:not([hidden])')].map(r=>r.dataset.row);
  pendingPaste=previewGridPaste(pack,template,{sheetId:s.id,tableId:el.dataset.table,rowId:el.dataset.row,columnKey:el.dataset.col,text,columnKeys:[...table.querySelectorAll('thead th[data-column]')].map(c=>c.dataset.column),rowIds:rows,unit:unitFor(s)});
  const targetTable=s.tables.find(t=>t.id===pendingPaste.tableId),columnNames=pendingPaste.columnKeys.map(key=>heading(s,targetTable.columns.find(c=>c.key===key)));
  $('paste-summary').textContent=`${pendingPaste.rowCount} rows × ${pendingPaste.columnCount} editable columns. Locked and calculated columns are skipped. Columns: ${columnNames.join(', ')}. Blank numeric cells remain missing.`;
  $('paste-preview').innerHTML=`<table class="paste-table"><thead><tr><th>Destination</th><th>Before</th><th>After</th></tr></thead><tbody>${pendingPaste.changes.map(c=>`<tr><td>${esc(c.label)}</td><td>${esc(diffValue(c.before))}</td><td>${esc(diffValue(c.after))}</td></tr>`).join('')}</tbody></table><p>Numeric preview values are canonical CM for measurements; quantities are unchanged. Nothing is applied until you choose Apply paste.</p>`;
  $('apply-paste').disabled=false;
 }catch(error){$('paste-summary').textContent='No cells have changed.';$('paste-errors').textContent=error.message;}
 $('paste-dialog').showModal();
}
async function prepareSwitch(){
 clearTimeout(autosaveTimer);
 if(!validScreen())return false;
 const leavingId=pack.id,leavingGeneration=generation;
 if(dirty&&storageAvailable&&!conflicted){try{await saveNow();if(pack.id!==leavingId||generation!==leavingGeneration||dirty||invalidInputs().length){status('The draft changed while saving. Finish the edit, then open the other pack again.');return false;}return true;}catch{}}
 if(dirty)return confirm('This draft is not saved. Download JSON before leaving if you need to keep it. Continue and discard the on-screen draft?');
 await saveQueue.catch(()=>{});
 if(pack.id!==leavingId||generation!==leavingGeneration||invalidInputs().length){status('The draft changed. Finish the edit, then try again.');return false;}
 return true;
}
const run = handler => event => {
 pendingActions++;
 Promise.resolve().then(()=>handler(event)).catch(error=>status(error.message)).finally(()=>pendingActions--);
};
$('sheet-tabs').innerHTML=template.sheets.map((s,i)=>`<button id="tab-${s.id}" type="button" role="tab" aria-controls="working-panel" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-sheet="${s.id}"><span aria-hidden="true">0${i+1} / </span>${esc(s.shortTitle)}</button>`).join('');
$('sheet-tabs').addEventListener('click',event=>{const b=event.target.closest('[data-sheet]');if(!b||!validScreen())return;active=b.dataset.sheet;$('sheet-search').value='';renderSheet();b.scrollIntoView({block:'nearest',inline:'nearest'});});
$('sheet-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...$('sheet-tabs').children],i=buttons.indexOf(document.activeElement);const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;if(validScreen()){buttons[next].click();buttons[next].focus();}});
$('style-fields').addEventListener('input',event=>{
 const el=event.target,key=el.dataset.styleKey;if(!Object.hasOwn(styleLabels,key))return;
 try{
  if(el.value.includes('\0'))throw Error('Remove the unsupported control character.');
  if(!el.checkValidity()&&el.validity.tooLong)throw Error('This style detail is too long.');
  setInlineError(el,'');if(pack.style[key]===el.value)return;
  rememberEdit('style:'+key);pack.style[key]=el.value;markDirty();syncInheritedFields();
 }catch(error){setInlineError(el,error.message);}
});
for(const editor of [$('sheet-content'),$('pinned-pattern-content')]){
editor.addEventListener('input',event=>{
 const el=event.target,s=sheetForElement(el);
 if(el.dataset.field){
  try{
   if(el.value.includes('\0'))throw Error('Remove the unsupported control character.');
   const f=s.fields.find(f=>f.key===el.dataset.field);
   el.setCustomValidity('');if(!el.checkValidity())throw Error('Enter a valid '+f.label+'.');
   setInlineError(el,'');
   if(pack.fields[s.id][f.key]!==el.value){rememberEdit('field:'+s.id+':'+f.key);pack.fields[s.id][f.key]=el.value;markDirty();}
   syncFieldViews(s,f,el);syncDerivedFields();
   for(const t of s.tables||[])for(const c of t.columns.filter(c=>c.headerField===f.key)){
    const table=el.closest('.sheet-editor').querySelector(`table[data-table="${t.id}"]`),th=table.querySelector(`th[data-column="${c.key}"]`);
    if(th)th.innerHTML=esc(heading(s,c))+` <span class="column-unit">(${(unitFor(s)||'?').toUpperCase()})</span>`;
    for(const input of table.querySelectorAll(`[data-col="${c.key}"]`))input.setAttribute('aria-label',`${t.title}, row ${input.dataset.row}, ${heading(s,c)}`);
   }
  }catch(error){setInlineError(el,error.message);}return;
 }
 if(!el.dataset.col)return;
 const t=s.tables.find(t=>t.id===el.dataset.table),r=t.rows.find(r=>r.id===el.dataset.row),c=columnsForRow(t,r).find(c=>c.key===el.dataset.col);
 try{
  let value=el.value;
  if(value.includes('\0'))throw Error('Remove the unsupported control character.');
  if(c.type==='measurement')value=parseMeasure(value,unitFor(s),{allowNegative:!!c.allowNegative});
  else if(c.type==='number')value=parseMeasure(value,'cm',{allowNegative:!!c.allowNegative});
  else if(value.length>(c.maxLength||4000))throw Error('Use at most '+(c.maxLength||4000)+' characters in this cell.');
  setInlineError(el,'');
  if(pack.tables[s.id][t.id][r.id][c.key]!==value){rememberEdit(['cell',s.id,t.id,r.id,c.key].join(':'));pack.tables[s.id][t.id][r.id][c.key]=value;markDirty();}
  syncTableViews(s,t,r,c,el);updateResults(s,t.id,el.dataset.row);status('Entry updated. Valid edits autosave on this device.');
 }catch(error){setInlineError(el,error.message);}
});
editor.addEventListener('focusout',event=>{
 const el=event.target;editHistory.breakGroup();
 if(!el.matches('input,textarea')||!el.checkValidity())return;
 const s=sheetForElement(el);
 if(el.dataset.field){const f=s.fields.find(f=>f.key===el.dataset.field);el.value=fieldValue(s,f)||'';}
 else if(el.dataset.numeric){const value=pack.tables[s.id][el.dataset.table][el.dataset.row][el.dataset.col];el.value=el.dataset.numeric==='measurement'?formatMeasure(value,unitFor(s)||'cm'):value??'';}
 applySearch();
});
editor.addEventListener('paste',previewPaste);
editor.addEventListener('keydown',event=>{
 const el=event.target;
 if(event.key==='Enter'&&el.dataset.numeric&&el.checkValidity()){
  const rows=[...el.closest('tbody').querySelectorAll('tr:not([hidden])')],index=rows.indexOf(el.closest('tr'))+(event.shiftKey?-1:1);
  const next=rows[index]?.querySelector(`[data-col="${el.dataset.col}"]`);if(next){event.preventDefault();next.focus();next.select();}
 }
});
editor.addEventListener('change',run(async event=>{
 const el=event.target,key=el.dataset.attachment,s=sheetForElement(el);
 if(el.dataset.gallerySelect){selectPatternReference(Number(el.value),el);return;}
 if(!key)return;
 const files=[...el.files],uploadPackId=pack.id,gallery=isPatternReference(s,key);if(!files.length)return;
 try{
  if(gallery&&files.length+patternReferenceImages(pack).length>12)throw Error('A reference gallery can hold up to 12 photos. No photos were added.');
  if(files.some(file=>!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024))throw Error('Choose PNG, JPEG or WebP images up to 5 MB each. No photos were added.');
  const images=[];
  for(const file of files){
   const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read image. No photos were added.'));reader.readAsDataURL(file);});
   const image=new Image();image.src=dataUrl;await image.decode();images.push({name:file.name,type:file.type,dataUrl});
  }
  if(pack.id!==uploadPackId)throw Error('The active pack changed during upload. Attach the images in the intended pack.');
  const next=structuredClone(pack);next.attachments[s.id][key]=gallery?{images:[...patternReferenceImages(pack),...images],selectedIndex:patternReferenceIndex()}:images[0];
  const normalized=normalizeTechPack(next,template);editHistory.breakGroup();rememberEdit('image:'+s.id+':'+key);pack=normalized;markDirty();refreshAttachmentViews(s);editHistory.breakGroup();
  status(gallery?`Added ${images.length} photo${images.length===1?'':'s'} to the reference gallery. Use Previous / Next or Displayed photo to choose the preview.`:'Original image attached locally; autosave includes its bytes.');
 }catch(error){el.value='';status(error.message);}
}));
editor.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;const s=sheetForElement(button);
 if(button.dataset.useShared){rememberEdit('shared:'+s.id+':'+button.dataset.useShared);pack.fields[s.id][button.dataset.useShared]='';markDirty();syncFieldViews(s,s.fields.find(f=>f.key===button.dataset.useShared));syncDerivedFields();}
 if(button.dataset.galleryPrev||button.dataset.galleryNext){selectPatternReference(patternReferenceIndex()+(button.dataset.galleryNext?1:-1),button);return;}
 if(button.dataset.remove){
  const key=button.dataset.remove;editHistory.breakGroup();rememberEdit('image:'+s.id+':'+key);
  if(isPatternReference(s,key)){
   const images=[...patternReferenceImages(pack)],index=patternReferenceIndex();images.splice(index,1);
   pack.attachments.pattern.reference=images.length?{images,selectedIndex:Math.min(index,images.length-1)}:null;
  }else pack.attachments[s.id][key]=null;
  markDirty();refreshAttachmentViews(s);editHistory.breakGroup();status('Displayed photo removed. Other gallery photos are kept.');
 }
 if(button.dataset.image){const image=isPatternReference(s,button.dataset.image)?selectedPatternReference(pack):pack.attachments[s.id][button.dataset.image];if(image)showImage(image.dataUrl,image.name);}
 if(button.dataset.housePhoto)showImage(button.querySelector('img').src,'SR-FORM-001 · '+button.dataset.housePhoto);
});
}
$('style-fields').addEventListener('focusout',()=>editHistory.breakGroup());
$('pack-title').addEventListener('input',()=>{rememberEdit('title');pack.title=$('pack-title').value.trim()||'Untitled tech pack';markDirty();});
$('pack-title').addEventListener('focusout',()=>editHistory.breakGroup());
$('pack-unit').addEventListener('change',()=>{
 if(!validScreen()){$('pack-unit').value=unitFor(activeSheet())||'';return;}
 if(activeSheet().reference){refUnit=$('pack-unit').value||'in';renderSheet(true);}else changeGarmentUnit($('pack-unit').value||null);
 status('Displayed measurements updated from canonical values. Measuring instructions are unchanged.');
});
$('style-unit').addEventListener('change',()=>changeGarmentUnit($('style-unit').value||null));
$('column-view').addEventListener('change',()=>{if(!validScreen()){$('column-view').value=columnViews[active]||'full';return;}columnViews[active]=$('column-view').value;renderSheet(true);status('Column view changed. Hidden columns remain in the pack, CSV, and complete printout.');});
$('context-column-view').addEventListener('change',()=>{if(!validScreen())return;columnViews[active]=$('context-column-view').value;renderSheet(true);status('Column view changed. Full worksheets remain in CSV and print.');});
$('sheet-search').addEventListener('input',applySearch);$('clear-search').addEventListener('click',()=>{$('sheet-search').value='';applySearch();$('sheet-search').focus();});
$('save-pack').addEventListener('click',run(async()=>{await saveNow();status('Saved the current working pack on this device. Create a named revision to preserve a separate snapshot.');}));
$('undo-edit').addEventListener('click',()=>applyUndo('undo'));$('redo-edit').addEventListener('click',()=>applyUndo('redo'));
document.addEventListener('keydown',event=>{
 if(!(event.ctrlKey||event.metaKey)||event.altKey||document.querySelector('dialog[open]'))return;
 const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();applyUndo(key==='y'||event.shiftKey?'redo':'undo');}
});
$('apply-paste').addEventListener('click',()=>{
 if(!pendingPaste)return;
 try{const next=applyGridPaste(pack,template,pendingPaste,{unit:unitFor(template.sheets.find(s=>s.id===pendingPaste.sheetId))});rememberEdit('paste:'+Date.now());pack=next;markDirty();$('paste-dialog').close();renderPinnedPattern();renderSheet(true);status(`Applied ${pendingPaste.changes.length} cells as one undoable edit.`);pendingPaste=null;}
 catch(error){$('paste-errors').textContent=error.message;$('apply-paste').disabled=true;}
});
$('cancel-paste').addEventListener('click',()=>{$('paste-dialog').close();pendingPaste=null;});
$('paste-single').addEventListener('click',()=>{
 const origin=pasteOrigin;
 if(!origin||origin.packId!==pack.id||!origin.el.isConnected){$('paste-errors').textContent='The destination changed. Paste again in the intended cell.';return;}
 origin.el.setRangeText(origin.text,origin.start,origin.end,'end');
 origin.el.dispatchEvent(new Event('input',{bubbles:true}));$('paste-dialog').close();
});
$('paste-dialog').addEventListener('close',()=>{pendingPaste=null;pasteOrigin=null;});
$('create-revision').addEventListener('click',run(async()=>{
 if(!validScreen())return;
 const name=$('revision-name').value.trim(),author=$('revision-author').value.trim(),reason=$('revision-reason').value.trim();
 if(!name||!author){const input=!name?$('revision-name'):$('revision-author');input.setCustomValidity('Enter '+(!name?'a revision name.':'the person recording this revision.'));input.reportValidity();input.focus();return;}
 const snapshot=normalizeTechPack(pack,template);await saveNow();
 const revision=await store.createRevision(snapshot,{name,author,reason});await refreshRevisions();$('revision-list').value=revision.id;status('Named revision preserved locally. It is a snapshot, not production approval.');
 recordedRevisionDetails=JSON.stringify([name,author,reason]);
}));
for(const id of ['revision-name','revision-author'])$(id).addEventListener('input',()=>$(id).setCustomValidity(''));
$('compare-revision').addEventListener('click',run(()=>reviewRevision(false)));$('restore-revision').addEventListener('click',run(()=>reviewRevision(true)));
$('close-revision').addEventListener('click',()=>$('revision-dialog').close());
$('revision-dialog').addEventListener('close',()=>{restoreTarget=null;});
$('confirm-restore').addEventListener('click',run(async()=>{
 if(!restoreTarget)return;
 const target=restoreTarget,before=normalizeTechPack(pack,template),restoreGeneration=generation;
 const unchanged=()=>pack.id===before.id&&generation===restoreGeneration&&restoreTarget===target&&!invalidInputs().length;
 await saveNow();if(!unchanged())throw Error('The draft changed or the restore was cancelled. Review the revision again.');
 await store.createRevision(before,{name:'Before restore · '+new Date().toISOString().slice(0,19),author:'Local recovery',reason:'Automatic recovery snapshot before restoring '+target.metadata.name+'. Recorded locally, not an approval.'});
 if(!unchanged())throw Error('The draft changed or the restore was cancelled. A recovery snapshot was kept; review the revision again.');
 rememberEdit('restore:'+Date.now());pack=normalizeTechPack(target.snapshot,template);$('pack-title').value=pack.title;renderStyle();renderSheet(true);markDirty();await saveNow();await refreshRevisions();$('revision-dialog').close();restoreTarget=null;status('Restored the named revision into the working draft. The previous draft and all named revisions remain preserved.');
}));
$('open-pack').addEventListener('click',run(async()=>{
 const id=$('saved-packs').value;if(!id){status('Select a saved pack first.');return;}
 if(!await prepareSwitch())return;
 const openingId=pack.id,openingGeneration=generation;
 const next=await store.getDraft(id);
 if(pack.id!==openingId||generation!==openingGeneration||invalidInputs().length)throw Error('The draft changed while opening. Finish the edit, then open the saved pack again.');
 if(!next)throw Error('That saved pack is unavailable. Check Older pack recovery.');await loadPack(next,'Reopened the saved working draft.',{savedDraft:true});
}));
$('new-pack').addEventListener('click',run(async()=>{if(!await prepareSwitch())return;$('export-dialog').close();await loadPack(createTechPack(template),'New blank garment pack. Approved house reference remains read-only.');markDirty();}));
$('export-menu-toggle').addEventListener('click',()=>$('export-dialog').showModal());$('close-export').addEventListener('click',()=>$('export-dialog').close());
$('export-json').addEventListener('click',()=>{if(!validScreen())return;download(safeName()+'.json',serializeTechPack(normalizeTechPack(pack,template)),'application/json');status('Downloaded the current pack and original images. Named revision history stays on this device.');});
$('export-csv').addEventListener('click',exportCsv);
$('import-json').addEventListener('click',()=>$('json-file').click());
$('json-file').addEventListener('change',run(async()=>{
 const file=$('json-file').files[0];if(!file)return;
 try{
  if(file.size>85*1024*1024)throw Error('JSON file is too large.');let next=normalizeTechPack(JSON.parse(await file.text()),template);
  if(!await prepareSwitch())return;
  const importingId=pack.id,importingGeneration=generation;
  let copied=false;
  if(storageAvailable){const known=await store.listDrafts();if(known.some(p=>p.id===next.id)){const existing=await store.getDraft(next.id);if(compareTechPacks(existing,next).length){next.id=createTechPack(template).id;copied=true;}}}
  if(pack.id!==importingId||generation!==importingGeneration||invalidInputs().length)throw Error('The draft changed while importing. Finish the edit, then import again.');
  $('export-dialog').close();await loadPack(next,copied?'Imported as a separate working copy. The existing saved draft is unchanged.':'Imported the compatible pack. Earlier schema versions migrate without changing measurements.');markDirty();
 }catch(error){status('Import refused: '+error.message);}finally{$('json-file').value='';}
}));
$('print-pack').addEventListener('click',()=>{if(validScreen()){$('export-dialog').close();buildPrint();window.print();}});
window.addEventListener('beforeprint',buildPrint);window.addEventListener('afterprint',()=>{$('print-view').innerHTML='';$('print-view').setAttribute('aria-hidden','true');});
$('recovery-list').addEventListener('click',run(async event=>{const button=event.target.closest('[data-recover]');if(!button)return;download('workroom-original-recovery.json',await store.exportRecovery(button.dataset.recover),'application/json');status('Downloaded the untouched original entry. Valid packs remain available.');}));
$('close-image').addEventListener('click',()=>$('image-dialog').close());
window.addEventListener('beforeunload',event=>{if(dirty||invalidInputs().length||pendingActions){event.preventDefault();event.returnValue='';}});
// iOS can suspend a hidden app before the typing debounce fires. Flush valid
// work on backgrounding as well; the saved label still waits for the database.
const flushBackgroundDraft = () => {
 if(dirty&&storageAvailable&&!conflicted&&!invalidInputs().length)saveNow().catch(()=>{});
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushBackgroundDraft();});
window.addEventListener('pagehide',flushBackgroundDraft);
async function initialize(){
 $('save-pack').disabled=true;$('working-panel').inert=true;$('context-panel').inert=true;
 $('pack-title').value=pack.title;renderStyle();renderSheet();
 try{
  const report=await store.init();storageAvailable=true;await refreshSaved();
  if(saved.length){const selectedId=rememberedPack(),selected=saved.find(p=>p.id===selectedId)||saved[0];const next=await store.getDraft(selected.id);if(next)await loadPack(next,'Recovered your selected local draft.',{savedDraft:true});}
  else saveState('Blank local draft · edits autosave');
  await refreshRecoveries();
  if(report.recoveryCount)status('Valid older packs are available. Open Older pack recovery for entries that need review.');
  else if(!saved.length)status('Start with Shared style record. Valid edits autosave on this device; keep JSON backups.');
 }catch(error){storageAvailable=false;saveState('Not saved · download JSON');status('Local draft storage is unavailable. You can work here and use Export → Download pack JSON. '+error.message);}
 finally{
  $('save-pack').disabled=false;$('working-panel').inert=false;$('context-panel').inert=false;
  if(matchMedia('(max-width: 740px)').matches)$('context-panel').open=false;
  let visible=true;try{visible=localStorage.getItem(panelPreferenceKey)!=='false';}catch{}setStylePanelVisible(visible,false);
  updateIdentity();updateHistory();document.body.dataset.workroomReady='true';window.__workroomReady=true;
 }
}
$('toggle-style-panel').addEventListener('click',()=>setStylePanelVisible($('context-panel').hidden));
$('context-panel').addEventListener('toggle',()=>{$('context-panel').querySelector('.context-summary-action').textContent=$('context-panel').open?'Collapse details':'Open details';});
$('style-reference-images').addEventListener('click',event=>{
 const navigation=event.target.closest('[data-gallery-prev],[data-gallery-next]');
 if(navigation){event.preventDefault();event.stopPropagation();selectPatternReference(patternReferenceIndex()+(navigation.dataset.galleryNext?1:-1),navigation);return;}
 const button=event.target.closest('[data-sidebar-image]');if(!button)return;event.preventDefault();event.stopPropagation();
 const image=sidebarImages.find(image=>image.key===button.dataset.sidebarImage);if(image)showImage(image.src,image.name);
});
await initialize();

// The hosted shell may request an update; it cannot read or export working data.
// Keep edits unlocked until a valid save completes, then prevent the last-moment
// edit/reload race. A failed or timed-out update calls cancel() to unlock again.
window.WORKROOM_UPDATES = {
 async prepare() {
  if(preparingUpdate)return {ready:false,message:'An update check is already in progress.'};
  if(pendingActions)return {ready:false,message:'Wait for the current file or draft operation to finish, then update again.'};
  if(openWorkroomReview())return {ready:false,message:'Finish or cancel the open review before updating the app.'};
  if(['revision-name','revision-author','revision-reason'].some(id=>$(id).value.trim())&&revisionDetails()!==recordedRevisionDetails)return {ready:false,message:'Create the named revision, or clear its unfinished details, before updating the app.'};
  if(!validScreen())return {ready:false,message:'Correct the marked entry before updating. Your last valid draft is retained.'};
  preparingUpdate=true;
  const selectedId=pack.id,selectedGeneration=generation,revisionEntry=revisionDetails();
  try {
   if(!storageAvailable)throw Error('Local storage is unavailable. Export a JSON backup before reopening the app.');
   if(conflicted)throw Error('Resolve the draft conflict or export a JSON backup before updating.');
   await saveNow();
   if(pack.id!==selectedId||generation!==selectedGeneration||dirty||pendingActions||invalidInputs().length||openWorkroomReview()||revisionDetails()!==revisionEntry)throw Error('The draft or review changed while saving. Finish your edit, then update again.');
   if(!rememberPack(selectedId))throw Error('This browser could not remember the active pack. Export a JSON backup before reopening the app.');
   document.querySelector('.app-shell').inert=true;
   return {ready:true,message:'The active pack is saved on this device. Ready to update.'};
  } catch(error) {
   preparingUpdate=false;
   return {ready:false,message:error.message};
  }
 },
 cancel() { preparingUpdate=false;document.querySelector('.app-shell').inert=false; }
};
