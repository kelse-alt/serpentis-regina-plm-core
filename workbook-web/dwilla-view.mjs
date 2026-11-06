/** Touch fitting tools inside the existing Workroom. No data leaves this browser. */
import { createDwilla, normalizeDwilla, startDwillaFitting, saveDwillaSnapshot, advanceDwillaFitting, reopenDwillaSnapshot, createSyntheticDwillaDictionary, DWILLA_LIMITS } from '../src/dwilla-workroom.mjs';
import { evaluateReading } from '../src/dwilla-fitting.mjs';

const GROUPS = [['main', 'Main / mesh · 32'], ['cutout', 'Cutout · 11'], ['silkShell', 'Silk shell · 11'], ['skirt', 'Skirt · 6']];
const CONDITIONS = [['unwashed', 'Unwashed'], ['before-wash', 'Before wash'], ['after-wash', 'After wash'], ['not-applicable', 'Wash not applicable']];
const QUALITATIVE = [['mobility', 'Mobility'], ['closureAccess', 'Closure access'], ['cutoutStability', 'Cutout stability'], ['meshShell', 'Mesh / silk shell interaction']];
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ESCAPES[character]);
const uuid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
const present = value => typeof value === 'number' && Number.isFinite(value);
const numberText = value => present(value) ? String(Number(value.toFixed(6))) : '—';
const signed = value => present(value) ? `${value > 0 ? '+' : ''}${numberText(value)}` : '—';
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };

function textField(view, key, label, options = {}) {
  const { type = 'text', max = 240, placeholder = '', inputmode, required = false, value } = options;
  return `<label class="field" for="dw-${key}"><span>${esc(label)}${required ? ' *' : ''}</span><input id="dw-${key}" data-dw-view="${key}" type="${esc(type)}" value="${esc(value ?? view[key] ?? '')}" maxlength="${max}" autocomplete="off"${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}${inputmode ? ` inputmode="${esc(inputmode)}"` : ''}></label>`;
}

function textarea(view, key, label, max = 4000) {
  return `<label class="field" for="dw-${key}"><span>${esc(label)}</span><textarea id="dw-${key}" data-dw-view="${key}" rows="3" maxlength="${max}">${esc(view[key] ?? '')}</textarea></label>`;
}

function selectField(view, key, label, options, initial = '') {
  const selected = view[key] ?? initial;
  return `<label class="field" for="dw-${key}"><span>${esc(label)}</span><select id="dw-${key}" data-dw-view="${key}">${options.map(([value, text]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
}

function sessionSample(state, session) { return state.samples.find(sample => sample.key === session.sampleKey); }
function sampleLabel(sample) { return sample ? `${sample.id} · sample ${sample.revision} · pattern ${sample.patternRevision}` : 'Sample not selected'; }
function selectedDefinition(state, view) {
  const group = GROUPS.some(([id]) => id === view.group) ? view.group : 'main';
  const definitions = state.dictionary.definitions.filter(definition => definition.group === group);
  return { group, definitions, definition: definitions.find(definition => definition.pomCode === view.pomCode) ?? definitions[0] };
}

function entrySetup(state, view) {
  const shared = (view.sharedSamples ?? []).filter(sample => !state.samples.some(known => known.key === sample.id));
  const options = [['', 'New sample identity…'], ...state.samples.map(sample => [sample.key, sampleLabel(sample)]), ...shared.map(sample => [sample.id, `Existing working sample: ${sample.label || sample.id}${sample.round ? ' · ' + sample.round : ''} · pattern must be identified`])];
  return `<details class="dwilla-card" data-dw-details="setup"${state.draft ? '' : ' open'}><summary>Select sample &amp; pattern / start fitting</summary><p>Use the sample revision actually produced by this pattern. New readings belong to a fitting; earlier snapshots remain available.</p><div class="dwilla-form-grid">${selectField(view, 'sampleSelection', 'Existing sample', options)}${textField(view, 'sampleId', 'Sample ID', { required: true, placeholder: 'Enter your sample ID' })}${textField(view, 'sampleRevision', 'Sample revision', { required: true, placeholder: 'Enter sample revision' })}${textField(view, 'patternRevision', 'Pattern that produced this sample', { required: true, placeholder: 'Enter pattern revision' })}${selectField(view, 'unit', 'Confirm fitting unit *', [['', 'Choose IN or CM explicitly'], ['IN', 'IN · decimal inches'], ['CM', 'CM · centimetres']])}${textField(view, 'date', 'Fitting date', { type: 'date', required: true, value: view.date ?? today() })}</div><div class="dwilla-actions"><button type="button" data-dw-action="start" id="dw-start-fitting" data-primary>Start first fitting</button></div><p class="dwilla-muted">Save a fitting snapshot before opening another fitting. The unit is fixed for that fitting and is independent of the Workroom display-unit selector. Source landmark wording never selects it.</p></details>`;
}

function readingAssessment(reading, fitting) {
  const spec = fitting.specs.find(spec => spec.pomCode === reading.pomCode && spec.context === reading.context);
  const result = evaluateReading(reading, spec);
  const label = { 'missing-target': 'Target missing · not assessed', 'missing-tolerance': 'Tolerance missing · not assessed', 'within-tolerance': 'Within configured tolerance', 'out-of-tolerance': 'Outside configured tolerance' }[result.status] ?? result.status;
  return `${label}${result.delta === null ? '' : ` · delta ${signed(result.delta)} ${fitting.unit}`}`;
}

function measurementEntry(state, view) {
  const { group, definitions, definition } = selectedDefinition(state, view);
  const fitting = state.draft.fitting;
  const context = view.context ?? 'general';
  const spec = fitting.specs.find(spec => spec.pomCode === definition.pomCode && spec.context === context);
  const specView = { ...view, target: view.target ?? spec?.target ?? '', toleranceMinus: view.toleranceMinus ?? spec?.tolerance?.minus ?? '', tolerancePlus: view.tolerancePlus ?? spec?.tolerance?.plus ?? '', authority: view.authority ?? spec?.authority ?? '' };
  const readings = fitting.readings.filter(reading => reading.pomCode === definition.pomCode);
  const measured = new Set(fitting.readings.map(reading => reading.pomCode));
  const missing = state.dictionary.definitions.filter(definition => !measured.has(definition.pomCode));
  return `<section class="dwilla-card"><h3 class="dwilla-section-heading">Measure with context</h3><div class="dwilla-stats"><span class="dwilla-stat"><strong>${measured.size} / 60</strong> POMs with a reading</span><span class="dwilla-stat"><strong>${missing.length}</strong> missing POMs</span><span class="dwilla-stat"><strong>${fitting.readings.length}</strong> individual readings</span></div><div class="dwilla-form-grid">${selectField({ ...view, group }, 'group', 'Measurement group', GROUPS)}${selectField({ ...view, pomCode: definition.pomCode }, 'pomCode', 'POM · exact source code', definitions.map(item => [item.pomCode, `${item.pomCode} · ${item.description}`]))}</div><article class="dwilla-method"><p class="dwilla-badge">${esc(definition.pomCode)} · ${esc(fitting.unit)}</p><h4>${esc(definition.description)}</h4><p>${esc(definition.howToMeasure)}</p></article><div class="dwilla-form-grid">${textField(view, 'context', 'Context · shared by repeats against one target', { value: context, placeholder: 'front-left / back / right / configuration name', required: true })}${selectField(view, 'condition', 'Measurement condition', CONDITIONS, 'unwashed')}${textField(view, 'observer', 'Measured by', { required: true, max: 160 })}${textField(view, 'readingValue', `New reading (${fitting.unit})`, { inputmode: 'decimal', required: true, placeholder: 'Decimal value · zero is valid' })}</div><div class="dwilla-actions"><button type="button" data-dw-action="reading" id="dw-add-reading" data-primary>Add reading / repeat</button></div><p class="dwilla-muted">Each reading stays separate. Front/back and left/right contexts do not overwrite each other or get averaged.</p><div class="dwilla-reading-list">${readings.length ? readings.map((reading, index) => `<article class="dwilla-reading"><strong>${index + 1}. ${esc(numberText(reading.value))} ${esc(reading.unit)}</strong><span>${esc(reading.context)} · ${esc(reading.condition)} · ${esc(reading.observer)}</span><p class="dwilla-tolerance">${esc(readingAssessment(reading, fitting))}</p></article>`).join('') : '<p class="dwilla-empty">No reading for this POM yet. Missing is not zero and never an automatic pass.</p>'}</div><details data-dw-details="spec"><summary>Working target &amp; tolerance for this exact POM / context</summary><p>Only enter confirmed values and their authority. These do not change the source dictionary or approve production.</p><div class="dwilla-form-grid">${textField(specView, 'target', `Target (${fitting.unit}) · optional`, { inputmode: 'decimal', placeholder: spec?.target === null || !spec ? 'Missing' : numberText(spec.target) })}${textField(specView, 'toleranceMinus', `− tolerance (${fitting.unit}) · positive magnitude`, { inputmode: 'decimal', placeholder: spec?.tolerance ? numberText(spec.tolerance.minus) : 'Missing' })}${textField(specView, 'tolerancePlus', `+ tolerance (${fitting.unit}) · positive magnitude`, { inputmode: 'decimal', placeholder: spec?.tolerance ? numberText(spec.tolerance.plus) : 'Missing' })}${textField(specView, 'authority', 'Target / tolerance authority or rationale', { max: 2000, required: true, placeholder: spec?.authority ?? '' })}</div><p>${spec ? `Stored target: ${esc(numberText(spec.target))} ${esc(fitting.unit)} · tolerance: ${spec.tolerance ? `−${esc(numberText(spec.tolerance.minus))} / +${esc(numberText(spec.tolerance.plus))}` : 'missing'} · authority: ${esc(spec.authority)}` : 'No working target or tolerance saved for this exact context.'}</p><button type="button" data-dw-action="spec" id="dw-save-spec">Set working target / tolerance</button></details><details data-dw-details="missing"><summary>Missing POMs · ${missing.length}</summary><div class="dwilla-actions">${missing.map(item => `<button type="button" class="dwilla-pom-link" data-dw-action="select-pom" data-dw-pom="${esc(item.pomCode)}">${esc(item.pomCode)}</button>`).join('') || '<p>All 60 POMs have at least one reading. This is completeness, not approval.</p>'}</div></details></section>`;
}

function configurations(state) {
  return `<section class="dwilla-card"><h3 class="dwilla-section-heading">Two wearing configurations</h3><p>Name both ways of wearing this garment and record qualitative observations. These are not additional POMs or specifications.</p><div class="dwilla-config-grid">${state.draft.configurations.map((configuration, index) => `<article><label class="field"><span>Configuration ${index + 1} name</span><input id="dw-configuration-${index}" data-dw-config="${esc(configuration.id)}" data-dw-config-field="name" value="${esc(configuration.name)}" maxlength="240"></label>${QUALITATIVE.map(([key, label]) => `<label class="field"><span>${esc(label)}</span><textarea data-dw-config="${esc(configuration.id)}" data-dw-config-field="${key}" rows="3" maxlength="4000">${esc(configuration[key])}</textarea></label>`).join('')}</article>`).join('')}</div></section>`;
}

function issues(state, view) {
  const session = state.draft;
  const { definition } = selectedDefinition(state, view);
  return `<section class="dwilla-card"><h3 class="dwilla-section-heading">Fit issues &amp; alteration actions</h3><div class="dwilla-form-grid">${selectField(view, 'issuePom', 'Related POM', [['', 'General garment observation'], ...state.dictionary.definitions.map(item => [item.pomCode, item.pomCode])], definition.pomCode)}${textField(view, 'issueAuthor', 'Recorded by', { required: true, max: 160 })}${textField(view, 'issuePattern', 'Correction belongs to next pattern revision', { placeholder: 'Explicit revision or leave unassigned' })}</div>${textarea(view, 'issueText', 'Issue / requested alteration *')}<button type="button" data-dw-action="issue" id="dw-add-issue">Record open action</button><div class="dwilla-session-list">${session.actions.map(action => `<article class="dwilla-reading"><p><strong>${esc(action.pomCode ?? 'General')} · ${esc(action.status.toUpperCase())}</strong> · ${esc(action.author)}</p><p>${esc(action.text)}</p><p>Correction pattern: ${esc(action.nextPatternRevision || 'Not assigned')}</p>${action.resolution ? `<p>Resolved by ${esc(action.resolution.author)}: ${esc(action.resolution.reason)}</p>` : `<details data-dw-details="resolve-${esc(action.id)}"><summary>Record an explicit resolution</summary><label class="field"><span>Resolved by</span><input data-dw-resolution-author="${esc(action.id)}" maxlength="240"></label><label class="field"><span>Resolution / evidence</span><textarea data-dw-resolution-reason="${esc(action.id)}" maxlength="4000" rows="2"></textarea></label><button type="button" data-dw-action="resolve" data-dw-id="${esc(action.id)}">Resolve this action</button></details>`}</article>`).join('') || '<p class="dwilla-empty">No fit actions recorded. Unresolved actions will carry forward to the next fitting.</p>'}</div></section>`;
}

function photos(state, view) {
  const session = state.draft;
  const { definition } = selectedDefinition(state, view);
  return `<section class="dwilla-card"><h3 class="dwilla-section-heading">Private fit photos &amp; numbered markers</h3><p>Original PNG, JPEG or WebP bytes remain in this browser’s local database. No network upload. Maximum 5 MB each and 12 per fitting. Backups contain the originals and must be kept privately.</p><div class="dwilla-form-grid">${selectField(view, 'photoPom', 'Photo POM link', [['', 'General garment'], ...state.dictionary.definitions.map(item => [item.pomCode, item.pomCode])], definition.pomCode)}${selectField(view, 'photoAction', 'Photo alteration-action link', [['', 'No action link'], ...session.actions.map((action, index) => [action.id, `${index + 1}. ${action.pomCode ?? 'General'} · ${action.text.slice(0, 65)}`])])}</div>${textarea(view, 'photoNote', 'Photo observation / note')}<label class="field"><span>Attach local photo · original retained</span><input type="file" id="dw-photo-file" data-dw-photo-file accept="image/png,image/jpeg,image/webp"></label><p class="dwilla-muted" data-dw-photo-storage-note></p><div class="dwilla-photo-grid">${session.photos.map(photo => `<article class="dwilla-photo-card"><h4>${esc(photo.name)}</h4><p>${esc(photo.pomCode ?? 'General')} · ${esc(photo.note || 'No photo note')}${photo.actionId ? ' · linked to alteration action' : ''}</p><div class="dwilla-photo-stage"><img src="${esc(photo.dataUrl)}" alt="${esc(photo.note || photo.name)}" data-dw-photo-marker="${esc(photo.id)}">${photo.markers.map(marker => `<span class="dwilla-marker" style="left:${marker.x * 100}%;top:${marker.y * 100}%" aria-hidden="true">${marker.number}</span>`).join('')}</div><label class="field"><span>Marker note · then tap the image</span><input data-dw-marker-note="${esc(photo.id)}" maxlength="2000" placeholder="Describe the marked fit issue"></label><details data-dw-details="marker-${esc(photo.id)}"><summary>Add marker using coordinates</summary><div class="dwilla-form-grid"><label class="field"><span>X (% from left)</span><input inputmode="decimal" data-dw-marker-x="${esc(photo.id)}"></label><label class="field"><span>Y (% from top)</span><input inputmode="decimal" data-dw-marker-y="${esc(photo.id)}"></label></div><button type="button" data-dw-action="marker" data-dw-id="${esc(photo.id)}">Add numbered marker</button></details><ol>${photo.markers.map(marker => `<li value="${marker.number}">${esc(marker.note)} · ${numberText(marker.x * 100)}%, ${numberText(marker.y * 100)}%</li>`).join('')}</ol></article>`).join('') || '<p class="dwilla-empty">No photo attached to this fitting.</p>'}</div></section>`;
}

function progression(state, view) {
  const session = state.draft;
  const decision = session.fitting.decision;
  return `<section class="dwilla-card"><h3 class="dwilla-section-heading">Fitting decision &amp; next sample</h3><p>Advancing requests another sample. It does not approve production and does not resolve open actions.</p><div class="dwilla-form-grid">${selectField(view, 'decisionAction', 'Decision', [['', 'Choose a decision…'], ['hold', 'Hold'], ['revise', 'Revise'], ['advance', 'Request next sample']])}${textField(view, 'decisionAuthor', 'Decision recorded by', { required: true, max: 160 })}</div>${textarea(view, 'decisionReason', 'Decision reason / remaining work *')}<button type="button" data-dw-action="decision" id="dw-record-decision">Record decision</button><p>${decision ? `Recorded: ${esc(decision.action)} · ${esc(decision.author)} · ${esc(decision.reason)}` : 'No decision recorded.'}</p><details data-dw-details="next-sample"><summary>Request next sample revision</summary><p>A saved “Request next sample” decision, a new sample revision and its explicit pattern revision are required. Readings reset; open actions carry forward.</p><div class="dwilla-form-grid">${textField(view, 'nextSampleId', 'Next sample ID', { required: true, placeholder: session.fitting.sampleId })}${textField(view, 'nextSampleRevision', 'Next sample revision', { required: true })}${textField(view, 'nextPatternRevision', 'Pattern producing the next sample', { required: true })}${textField(view, 'nextDate', 'Next fitting date', { type: 'date', value: view.nextDate ?? today(), required: true })}</div><button type="button" data-dw-action="advance" id="dw-request-next">Request next sample revision</button></details></section>`;
}

function history(state) {
  return `<section class="dwilla-card"><h3 class="dwilla-section-heading">Preserved fitting snapshots</h3><p>Opening a snapshot creates a working copy. Earlier snapshots retain their readings, decisions, photos and pattern trace.</p><div class="dwilla-session-list">${[...state.snapshots].reverse().map(snapshot => `<article class="dwilla-reading"><p><strong>${esc(sampleLabel(sessionSample(state, snapshot.session)))}</strong></p><p>${esc(snapshot.session.fitting.stage)} · ${esc(snapshot.savedAt)} · ${snapshot.session.fitting.readings.length} readings · ${snapshot.session.actions.filter(action => action.status === 'open').length} open actions</p><button type="button" data-dw-action="open-snapshot" data-dw-id="${esc(snapshot.id)}">Open saved fitting</button></article>`).join('') || '<p class="dwilla-empty">No fitting snapshot saved yet.</p>'}</div></section>`;
}

/** Printing is independent of the active POM, search, forms and closed details. */
function completeSession(state, session, heading, metadata = '') {
  const fitting = session.fitting;
  const measured = new Set(fitting.readings.map(reading => reading.pomCode));
  const missing = state.dictionary.definitions.filter(definition => !measured.has(definition.pomCode));
  const definitionFor = code => state.dictionary.definitions.find(definition => definition.pomCode === code);
  return `<section class="dwilla-card dwilla-print-session"><h3 class="dwilla-section-heading">${esc(heading)}</h3><p><strong>${esc(sampleLabel(sessionSample(state, session)))}</strong></p><p>${esc(fitting.stage)} · ${esc(fitting.date)} · fitting unit ${esc(fitting.unit)}${metadata ? ` · ${esc(metadata)}` : ''}</p><p>Fitting ID: ${esc(session.id)}${fitting.predecessor ? ` · prior fitting fingerprint: ${esc(fitting.predecessor)}` : ''}</p><p>${measured.size} / 60 POMs measured · ${fitting.readings.length} separate readings · ${session.actions.filter(action => action.status === 'open').length} open alteration actions.</p><h4>Every contextual reading</h4>${fitting.readings.map((reading, index) => {
    const definition = definitionFor(reading.pomCode);
    return `<article class="dwilla-reading"><h4>${index + 1}. ${esc(reading.pomCode)} · ${esc(definition.description)}</h4><p>${esc(definition.howToMeasure)}</p><p><strong>Actual ${esc(numberText(reading.value))} ${esc(reading.unit)}</strong> · context ${esc(reading.context)} · ${esc(reading.condition)} · measured by ${esc(reading.observer)}</p><p>${esc(readingAssessment(reading, fitting))}</p>${reading.landmarkIds.length ? `<p>Landmarks: ${reading.landmarkIds.map(id => esc(id)).join(', ')}</p>` : ''}</article>`;
  }).join('') || '<p>No actual readings recorded.</p>'}<p>Missing POMs: ${missing.length ? missing.map(definition => esc(definition.pomCode)).join(', ') : 'None'}. Missing never means zero or passing.</p><h4>Every working target / tolerance</h4>${fitting.specs.map(spec => `<article class="dwilla-reading"><p><strong>${esc(spec.pomCode)} · context ${esc(spec.context)}</strong></p><p>Target: ${esc(numberText(spec.target))} ${esc(fitting.unit)} · tolerance: ${spec.tolerance ? `−${esc(numberText(spec.tolerance.minus))} / +${esc(numberText(spec.tolerance.plus))} ${esc(fitting.unit)}` : 'missing'}</p><p>Authority: ${esc(spec.authority)}</p></article>`).join('') || '<p>No working target or tolerance recorded.</p>'}${fitting.landmarks.length ? `<h4>Confirmed session landmarks</h4>${fitting.landmarks.map(landmark => `<p><strong>${esc(landmark.id)}</strong> · ${esc(landmark.description)}</p>`).join('')}` : ''}<h4>Fit notes</h4>${fitting.notes.map(note => `<p><strong>${esc(note.pomCode ?? 'General')} · ${esc(note.status)} · ${esc(note.author)}</strong><br>${esc(note.text)}</p>`).join('') || '<p>No fit notes recorded.</p>'}<h4>Alteration actions &amp; resolutions</h4>${session.actions.map((action, index) => `<article class="dwilla-reading"><p><strong>${index + 1}. ${esc(action.pomCode ?? 'General')} · ${esc(action.status)} · ${esc(action.author)}</strong></p><p>${esc(action.text)}</p><p>Correction belongs to pattern: ${esc(action.nextPatternRevision || 'Not assigned')}</p>${action.resolution ? `<p>Resolved by ${esc(action.resolution.author)} · ${esc(action.resolution.reason)}</p>` : '<p>Open action · no resolution recorded.</p>'}</article>`).join('') || '<p>No alteration actions recorded.</p>'}<h4>Two qualitative wearing configurations</h4>${session.configurations.map((configuration, index) => `<article class="dwilla-reading"><p><strong>${index + 1}. ${esc(configuration.name || 'Not yet named')}</strong></p>${QUALITATIVE.map(([key, label]) => `<p><strong>${esc(label)}:</strong> ${esc(configuration[key] || 'Not recorded')}</p>`).join('')}</article>`).join('')}<h4>Original fit photos &amp; numbered markers</h4><div class="dwilla-photo-grid">${session.photos.map(photo => `<article class="dwilla-photo-card"><h4>${esc(photo.name)}</h4><p>POM: ${esc(photo.pomCode ?? 'General')} · alteration action: ${esc(photo.actionId ?? 'No action link')}</p><p>${esc(photo.note || 'No photo note')}</p><div class="dwilla-photo-stage"><img src="${esc(photo.dataUrl)}" alt="${esc(photo.note || photo.name)}">${photo.markers.map(marker => `<span class="dwilla-marker" style="left:${marker.x * 100}%;top:${marker.y * 100}%" aria-hidden="true">${marker.number}</span>`).join('')}</div><ol>${photo.markers.map(marker => `<li value="${marker.number}">${esc(marker.note)} · ${esc(numberText(marker.x * 100))}% from left, ${esc(numberText(marker.y * 100))}% from top</li>`).join('')}</ol></article>`).join('') || '<p>No fit photos recorded.</p>'}</div><h4>Decision</h4>${fitting.decision ? `<p><strong>${esc(fitting.decision.action)} · ${esc(fitting.decision.author)}</strong><br>${esc(fitting.decision.reason)}</p>` : '<p>No decision recorded.</p>'}<p>Advancing a sample is not production approval. Qualitative observations are not garment POMs or specifications.</p></section>`;
}

function renderCompleteDwilla(state) {
  if (!state) return '<section class="dwilla-workspace"><h2>DWILLA fittings</h2><p>No private dictionary or fitting records in this pack.</p></section>';
  return `<section class="dwilla-workspace dwilla-print"><h2>DWILLA SR-001 · complete fitting record</h2><p>Dictionary revision: ${esc(state.dictionary.dictionaryVersion)} · source SHA-256: ${esc(state.dictionary.sourceSha256)}. Garment measurements remain separate from the 20 body-form references. Each fitting retains its explicitly chosen unit.</p>${state.draft ? completeSession(state, state.draft, 'Current working fitting · unapproved draft') : '<p>No current fitting draft.</p>'}${state.snapshots.map((snapshot, index) => completeSession(state, snapshot.session, `Preserved snapshot ${index + 1}`, `${snapshot.savedAt} · snapshot ${snapshot.id} · fingerprint ${snapshot.fingerprint}`)).join('')}<section class="dwilla-card"><h3 class="dwilla-section-heading">Separate fit-form reference · all 20 body measurements</h3><p>Imported reference: ${esc(state.dictionary.fitFormReference.referenceId ?? 'Not supplied')} · ${esc(state.dictionary.fitFormReference.approval ?? 'No approval recorded')}. This does not change the approved house-form register or supply garment targets.</p>${state.dictionary.fitFormReference.measurements.map(measurement => `<article class="dwilla-reading"><h4>${esc(measurement.pomCode)} · ${esc(measurement.description ?? '')}</h4><p>${esc(measurement.howToMeasure ?? '')}</p></article>`).join('')}</section></section>`;
}

export function renderDwilla(state, view = {}) {
  if (view.complete) return renderCompleteDwilla(state);
  const status = `<p id="dw-status" class="dwilla-status" role="status" aria-live="polite">${esc(view.status ?? 'Work stays in this browser on this device. Save and keep a private backup.')}</p><p id="dw-error" class="dwilla-error" role="alert">${esc(view.error ?? '')}</p>`;
  if (!state) return `<section class="dwilla-workspace"><header class="dwilla-hero"><p class="dwilla-badge">SR-001 / GARMENT DEVELOPMENT</p><h3>DWILLA fitting workspace</h3><p>Continue a style through sample measurement, fit decisions and the next pattern revision.</p></header>${status}<section class="dwilla-card"><h3 class="dwilla-section-heading">Choose DWILLA</h3><p>Import the private dictionary produced by the workbook importer from PR #22. Its exact 60 garment POMs remain separate from the 20 fit-form references. This public app contains no DWILLA workbook text or measurements.</p><label class="field"><span>Import private DWILLA dictionary JSON · maximum 12 MB</span><input type="file" id="dw-dictionary-file" data-dw-dictionary accept="application/json,.json"></label><p>For a safe walkthrough, open the clearly labelled synthetic version below. Its descriptions and methods are invented demonstration text.</p><button type="button" data-dw-action="synthetic" id="dw-open-synthetic">Select DWILLA · synthetic demo</button></section></section>`;
  const draft = state.draft;
  const synthetic = state.dictionary.dictionaryVersion.toLowerCase().includes('synthetic');
  return `<section class="dwilla-workspace"><header class="dwilla-hero"><p class="dwilla-badge">SR-001 / ${synthetic ? 'SYNTHETIC DEMO' : 'PRIVATE DICTIONARY'}</p><h3>DWILLA · fitting workspace</h3><p>60 garment POMs · four measurement groups · 20 separate fit-form references</p>${draft ? `<p class="dwilla-identity"><strong>${esc(sampleLabel(sessionSample(state, draft)))}</strong><br>${esc(draft.fitting.stage)} · ${esc(draft.fitting.date)} · ${esc(draft.fitting.unit)}</p>` : ''}</header>${status}${entrySetup(state, view)}${draft ? `<div class="dwilla-save-bar"><button type="button" data-dw-action="save" id="dw-save-fitting" data-primary>Save fitting snapshot</button><span>Save preserves a new snapshot and the current pack.</span></div>${measurementEntry(state, view)}${issues(state, view)}${configurations(state)}${photos(state, view)}${progression(state, view)}` : '<p class="dwilla-empty">Select a sample and its pattern revision, choose units, then start a fitting.</p>'}${history(state)}<details class="dwilla-card" data-dw-details="fit-form"><summary>Separate fit-form reference · 20 body measurements</summary><p>This is provenance from the imported workbook. It is separate from garment targets and the approved house-form register.</p><ol>${state.dictionary.fitFormReference.measurements.map(measurement => `<li><strong>${esc(measurement.pomCode)} · ${esc(measurement.description ?? '')}</strong><p>${esc(measurement.howToMeasure ?? '')}</p></li>`).join('')}</ol></details><p class="dwilla-muted">Dictionary revision: ${esc(state.dictionary.dictionaryVersion)}. Device-local records do not synchronize between Samsung, iPad, Safari or an installed app. Use the Workroom private backup workflow for recovery or transfer.</p></section>`;
}

function numeric(value, label, optional = false) {
  const raw = String(value ?? '').trim();
  if (!raw && optional) return null;
  if (!raw || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) throw Error(`${label}: enter a non-negative decimal number.`);
  const number = Number(raw);
  if (!Number.isFinite(number) || number > 1e9) throw Error(`${label}: number exceeds the supported limit.`);
  return number;
}

function required(value, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw Error(`${label} is required.`);
  return clean;
}

function hasUnsnapshottedEdits(state) {
  if (!state?.draft) return false;
  return !state.snapshots.some(snapshot => JSON.stringify(snapshot.session) === JSON.stringify(state.draft));
}

function imageData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error('Could not read the selected image. The previous fitting is unchanged.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/** Hooks update the existing pack; explicit save uses the existing IndexedDB store. */
export function mountDwilla(root, hooks, view = {}) {
  const getState = () => hooks.getPack().dwilla;
  const initialSelection = getState() ? selectedDefinition(getState(), view) : null;
  const mountedSelection = { group: initialSelection?.group, pomCode: initialSelection?.definition.pomCode, context: view.context ?? 'general' };
  const render = () => hooks.render();
  const report = (message, error = false) => {
    view[error ? 'error' : 'status'] = message;
    if (!error) view.error = '';
    const element = root.querySelector(error ? '#dw-error' : '#dw-status');
    if (element) { element.textContent = message; if (error) element.scrollIntoView?.({ block: 'nearest' }); }
    if (!error) { const previous = root.querySelector('#dw-error'); if (previous) previous.textContent = ''; }
  };
  const commit = (state, message, redraw = true) => {
    hooks.change(normalizeDwilla(state));
    if (message) report(message);
    if (redraw) render();
  };
  const changeDraft = callback => {
    const next = structuredClone(getState());
    if (!next?.draft) throw Error('Start or reopen a fitting first.');
    callback(next.draft, next);
    return next;
  };
  const run = async operation => {
    hooks.busy?.(1);
    try { await operation(); }
    catch (error) { report(error.message || String(error), true); }
    finally { hooks.busy?.(-1); }
  };
  const capture = () => ({ packId: hooks.getPack().id, state: JSON.stringify(getState()) });
  const assertCurrent = token => { if (hooks.getPack().id !== token.packId || JSON.stringify(getState()) !== token.state) throw Error('The open fitting changed during the operation. Your current pack was not replaced. Please try again.'); };
  const clearPending = keys => {
    for (const key of keys) if (view.pendingFields) delete view.pendingFields[key];
    view.pendingEntry = Object.keys(view.pendingFields ?? {}).length > 0;
  };
  const setPending = key => { view.pendingFields ??= {}; view.pendingFields[key] = true; view.pendingEntry = true; };
  const rememberDetails = () => {
    view.details = Object.fromEntries([...root.querySelectorAll('[data-dw-details]')].map(details => [details.dataset.dwDetails, details.open]));
  };
  for (const details of root.querySelectorAll('[data-dw-details]')) {
    if (Object.hasOwn(view.details ?? {}, details.dataset.dwDetails)) details.open = view.details[details.dataset.dwDetails];
  }
  const input = event => {
    const key = event.target.dataset.dwView;
    if (key) {
      view[key] = event.target.value;
      if (!['group', 'pomCode', 'sampleSelection', 'issuePom', 'photoPom', 'photoAction', 'condition'].includes(key)) { if (event.target.value.trim()) setPending(key); else clearPending([key]); }
    }
    if (event.target.dataset.dwConfig) setPending('config-' + event.target.dataset.dwConfig + '-' + event.target.dataset.dwConfigField);
    for (const attribute of ['dwMarkerNote', 'dwMarkerX', 'dwMarkerY', 'dwResolutionAuthor', 'dwResolutionReason']) {
      if (event.target.dataset[attribute]) setPending(attribute + '-' + event.target.dataset[attribute]);
    }
  };
  const change = event => run(async () => {
    const target = event.target;
    if (target.dataset.dwView) {
      view[target.dataset.dwView] = target.value;
      if (['decisionAction', 'unit'].includes(target.dataset.dwView)) setPending(target.dataset.dwView);
      if (target.dataset.dwView === 'sampleSelection') {
        const sample = getState()?.samples.find(sample => sample.key === target.value);
        const shared = !sample ? (view.sharedSamples ?? []).find(sample => sample.id === target.value) : null;
        for (const [key, value] of Object.entries({ sampleId: sample?.id ?? shared?.label ?? '', sampleRevision: sample?.revision ?? shared?.round ?? '', patternRevision: sample?.patternRevision ?? '' })) view[key] = value;
        rememberDetails(); render();
      }
      if (['group', 'pomCode', 'context'].includes(target.dataset.dwView)) {
        if (['readingValue', 'target', 'toleranceMinus', 'tolerancePlus', 'authority'].some(key => view.pendingFields?.[key] && String(view[key] ?? '').trim())) {
          view[target.dataset.dwView] = mountedSelection[target.dataset.dwView];
          target.value = mountedSelection[target.dataset.dwView];
          throw Error('Add the pending reading or set its target / tolerance before changing POM or context. Clear the pending entry if it is no longer needed.');
        }
        for (const key of ['target', 'toleranceMinus', 'tolerancePlus', 'authority']) delete view[key];
        rememberDetails(); render();
      }
    }
    if (target.dataset.dwConfig) {
      const next = changeDraft(draft => { const configuration = draft.configurations.find(configuration => configuration.id === target.dataset.dwConfig); if (!configuration) throw Error('Configuration is unavailable.'); configuration[target.dataset.dwConfigField] = target.value; });
      commit(next, 'Configuration observation updated · not yet snapshotted.', false);
      clearPending(['config-' + target.dataset.dwConfig + '-' + target.dataset.dwConfigField]);
    }
    if (target.hasAttribute('data-dw-dictionary')) {
      const file = target.files?.[0]; if (!file) return;
      if (getState()) throw Error('Create a new blank pack before importing another dictionary. Existing fitting history is preserved.');
      if (file.size > DWILLA_LIMITS.dictionaryBytes) throw Error('Dictionary JSON must be no larger than 12 MB.');
      const token = capture();
      const parsed = JSON.parse(await file.text()); assertCurrent(token);
      const next = createDwilla(parsed);
      commit(next, 'Private dictionary imported locally. No measurements or approvals were inferred.');
    }
    if (target.hasAttribute('data-dw-photo-file')) {
      const file = target.files?.[0]; if (!file) return;
      if (!hooks.canAttach()) throw Error('Private device storage must be available before adding a photo. Save a private backup if storage is unavailable.');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) throw Error('Choose a PNG, JPEG or WebP no larger than 5 MB.');
      const captured = getState(), token = capture();
      if (!captured?.draft || captured.draft.photos.length >= 12) throw Error('A fitting supports at most 12 original photos.');
      const dataUrl = await imageData(file);
      assertCurrent(token);
      const { definition } = selectedDefinition(captured, view);
      const next = changeDraft(draft => draft.photos.push({ id: uuid('photo'), name: file.name, type: file.type, dataUrl,
        pomCode: (view.photoPom ?? definition.pomCode) || null, actionId: view.photoAction || null, note: view.photoNote ?? '', markers: [] }));
      clearPending(['photoNote']); view.photoNote = '';
      rememberDetails(); commit(next, 'Original photo attached locally. Add a note, then tap the image to place a numbered marker.');
    }
  });
  const addMarker = (photoId, x, y) => {
    const note = required(root.querySelector(`[data-dw-marker-note="${photoId}"]`)?.value, 'Marker note');
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) throw Error('Marker coordinates must be between 0% and 100%.');
    const next = changeDraft(draft => {
      const photo = draft.photos.find(photo => photo.id === photoId); if (!photo) throw Error('Photo is unavailable.');
      photo.markers.push({ number: photo.markers.length + 1, x, y, note });
    });
    clearPending(['dwMarkerNote-' + photoId, 'dwMarkerX-' + photoId, 'dwMarkerY-' + photoId]);
    rememberDetails(); commit(next, 'Numbered marker added; original image bytes are unchanged.');
  };
  const click = event => run(async () => {
    const image = event.target.closest('[data-dw-photo-marker]');
    if (image) {
      const box = image.getBoundingClientRect();
      addMarker(image.dataset.dwPhotoMarker, (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
      return;
    }
    const button = event.target.closest('[data-dw-action]'); if (!button) return;
    event.preventDefault(); rememberDetails();
    const state = getState(), action = button.dataset.dwAction;
    if (action === 'synthetic') {
      if (state) throw Error('Open a blank pack to select the synthetic demo.');
      commit(createDwilla(createSyntheticDwillaDictionary()), 'Synthetic DWILLA selected. Every description and method in this demonstration is invented.');
    } else if (action === 'start') {
      if (hasUnsnapshottedEdits(state) || (state.draft && Object.keys(view.pendingFields ?? {}).some(key => !['sampleId', 'sampleRevision', 'patternRevision', 'unit', 'date'].includes(key)))) throw Error('Finish pending entries and save a fitting snapshot before starting another fitting.');
      const unit = required(view.unit, 'Fitting unit');
      const startState = structuredClone(state); startState.draft = null;
      const next = startDwillaFitting(startState, { sampleKey: view.sampleSelection || uuid('sample'), sampleId: required(view.sampleId, 'Sample ID'), sampleRevision: required(view.sampleRevision, 'Sample revision'), patternRevision: required(view.patternRevision, 'Pattern revision'), unit, date: view.date ?? today() });
      clearPending(['sampleId', 'sampleRevision', 'patternRevision', 'unit', 'date']);
      view.details = { ...view.details, setup: false };
      commit(next, 'First fitting started · no reading entered yet.');
    } else if (action === 'select-pom') {
      if (['readingValue', 'target', 'toleranceMinus', 'tolerancePlus', 'authority'].some(key => view.pendingFields?.[key] && String(view[key] ?? '').trim())) throw Error('Finish or clear the pending measurement entry before changing POM.');
      const definition = state.dictionary.definitions.find(definition => definition.pomCode === button.dataset.dwPom);
      view.group = definition.group; view.pomCode = definition.pomCode; render();
    } else if (action === 'reading') {
      const { definition } = selectedDefinition(state, view);
      const next = changeDraft(draft => draft.fitting.readings.push({ id: uuid('reading'), pomCode: definition.pomCode, context: required(view.context ?? 'general', 'Reading context'), value: numeric(view.readingValue, 'Reading'), unit: draft.fitting.unit, condition: view.condition ?? 'unwashed', observer: required(view.observer, 'Measured by'), landmarkIds: [] }));
      view.readingValue = ''; clearPending(['readingValue', 'observer', 'context']); commit(next, 'Reading added separately. Save a snapshot to preserve this fitting revision.');
    } else if (action === 'spec') {
      const { definition } = selectedDefinition(state, view);
      const context = required(view.context ?? 'general', 'Spec context');
      const stored = state.draft.fitting.specs.find(spec => spec.pomCode === definition.pomCode && spec.context === context);
      const target = numeric(view.target ?? stored?.target, 'Target', true), minus = numeric(view.toleranceMinus ?? stored?.tolerance?.minus, 'Minus tolerance', true), plus = numeric(view.tolerancePlus ?? stored?.tolerance?.plus, 'Plus tolerance', true);
      if ((minus === null) !== (plus === null)) throw Error('Enter both tolerance limits, or leave both missing.');
      const spec = { pomCode: definition.pomCode, context, target, tolerance: minus === null ? null : { minus, plus }, authority: required(view.authority ?? stored?.authority, 'Spec authority') };
      const next = changeDraft(draft => { const index = draft.fitting.specs.findIndex(previous => previous.pomCode === spec.pomCode && previous.context === spec.context); if (index < 0) draft.fitting.specs.push(spec); else draft.fitting.specs[index] = spec; });
      clearPending(['target', 'toleranceMinus', 'tolerancePlus', 'authority', 'context']);
      commit(next, 'Working target / tolerance recorded only for this exact POM and context.');
    } else if (action === 'issue') {
      const { definition } = selectedDefinition(state, view);
      const pomCode = (view.issuePom ?? definition.pomCode) || null;
      const text = required(view.issueText, 'Issue / alteration'), author = required(view.issueAuthor, 'Recorded by');
      const next = changeDraft(draft => { draft.actions.push({ id: uuid('action'), pomCode, text, author, status: 'open', nextPatternRevision: view.issuePattern ?? '', resolution: null }); draft.fitting.notes.push({ pomCode, text, author, status: 'open' }); });
      view.issueText = ''; clearPending(['issueText', 'issueAuthor', 'issuePattern']); commit(next, 'Open fit action recorded. It will carry forward until explicitly resolved.');
    } else if (action === 'resolve') {
      const id = button.dataset.dwId;
      const author = required(root.querySelector(`[data-dw-resolution-author="${id}"]`)?.value, 'Resolved by');
      const reason = required(root.querySelector(`[data-dw-resolution-reason="${id}"]`)?.value, 'Resolution evidence');
      const next = changeDraft(draft => { const found = draft.actions.find(action => action.id === id); if (!found || found.status !== 'open') throw Error('This action is unavailable or already resolved.'); found.status = 'resolved'; found.resolution = { author, reason }; const note = draft.fitting.notes.find(note => note.pomCode === found.pomCode && note.text === found.text && note.author === found.author && note.status === 'open'); if (note) note.status = 'resolved'; });
      clearPending(['dwResolutionAuthor-' + id, 'dwResolutionReason-' + id]);
      commit(next, 'Explicit resolution recorded with its author and reason. Prior snapshots remain unchanged.');
    } else if (action === 'decision') {
      const next = changeDraft(draft => { draft.fitting.decision = { action: required(view.decisionAction, 'Decision'), author: required(view.decisionAuthor, 'Decision recorded by'), reason: required(view.decisionReason, 'Decision reason') }; });
      clearPending(['decisionAction', 'decisionAuthor', 'decisionReason']);
      commit(next, 'Decision recorded with attribution. Save the fitting snapshot before progression.');
    } else if (action === 'save') {
      if (view.pendingEntry) throw Error('Finish or clear the pending entry before saving a fitting snapshot. Use its Add / Record / Set control first.');
      const token = capture();
      const next = await saveDwillaSnapshot(state); assertCurrent(token);
      commit(next, 'Saving fitting snapshot…', false);
      await hooks.save();
      report('Fitting snapshot and pack saved locally. Keep a private backup for recovery.'); render();
    } else if (action === 'advance') {
      if(Object.keys(view.pendingFields??{}).some(key=>!['nextSampleId','nextSampleRevision','nextPatternRevision','nextDate'].includes(key)))throw Error('Record or clear pending measurements, issues and annotations before moving to the next sample.');
      if (hasUnsnapshottedEdits(state)) throw Error('Save the recorded decision in a fitting snapshot before requesting the next sample.');
      const token = capture();
      const next = await advanceDwillaFitting(state, { sampleKey: uuid('sample'), sampleId: required(view.nextSampleId || state.draft?.fitting.sampleId, 'Next sample ID'), sampleRevision: required(view.nextSampleRevision, 'Next sample revision'), patternRevision: required(view.nextPatternRevision, 'Next pattern revision'), date: view.nextDate ?? today() }); assertCurrent(token);
      clearPending(['nextSampleId', 'nextSampleRevision', 'nextPatternRevision', 'nextDate']);
      commit(next, 'Next sample requested. Open actions carried forward; readings reset. This is not production approval.', false);
      await hooks.save(); render();
    } else if (action === 'open-snapshot') {
      if (view.pendingEntry || hasUnsnapshottedEdits(state)) throw Error('Finish pending entries and save the current fitting snapshot before opening an earlier fitting.');
      const snapshot = state.snapshots.find(snapshot => snapshot.id === button.dataset.dwId); if (!snapshot) throw Error('Snapshot is unavailable.');
      const next = reopenDwillaSnapshot(state, snapshot.id);
      commit(next, 'Saved fitting reopened as a working copy. Its original snapshot is preserved.');
    } else if (action === 'marker') {
      const id = button.dataset.dwId;
      addMarker(id, numeric(root.querySelector(`[data-dw-marker-x="${id}"]`)?.value, 'Marker X') / 100, numeric(root.querySelector(`[data-dw-marker-y="${id}"]`)?.value, 'Marker Y') / 100);
    }
  });
  root.addEventListener('input', input);
  root.addEventListener('change', change);
  root.addEventListener('click', click);
  const file = root.querySelector('[data-dw-photo-file]');
  if (file) {
    file.disabled = !hooks.canAttach();
    const note = root.querySelector('[data-dw-photo-storage-note]');
    if (note) note.textContent = hooks.canAttach() ? 'Private device storage is available. The app does not upload this attachment.' : 'Photo attachment is unavailable until private device-local storage is available.';
  }
  return () => { root.removeEventListener('input', input); root.removeEventListener('change', change); root.removeEventListener('click', click); };
}
