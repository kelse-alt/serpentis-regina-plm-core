import { formatMeasure } from '../src/tech-pack.mjs';
import { compareObservation } from '../src/garment-development.mjs';

const SIDES = ['general', 'front', 'back', 'left', 'right'];
const sideLabel = side => side === 'general' ? 'General / whole component' : side[0].toUpperCase() + side.slice(1);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const present = value => typeof value === 'number' && Number.isFinite(value);
const display = (value, unit, signed = false) => present(value) ? formatMeasure(value, unit || 'cm', signed) : '—';
const ink = value => `<span class="matte-ink">${value}</span>`;
const sampleTitle = sample => [sample.label, sample.round ? `Round: ${sample.round}` : ''].filter(Boolean).join(' · ');

function sourceContext(development, esc) {
  const source = development.source;
  if (!source) return '<p class="development-source-context">No component workbook imported.</p>';
  return `<div class="development-source-context"><p>Local workbook: ${esc(source.fileName || 'Imported XLSX')}${source.sha256 ? ` · SHA-256: ${esc(source.sha256)}` : ''}</p><p>Original POM codes, labels and methods stay with their source sheet and row. Workbook values, ± labels and Adj labels remain source context; they do not set working targets, tolerance limits or proposed adjustments. Workbook images are not imported.</p></div>`;
}

function rowSource(component, row, esc) {
  return `<p class="development-source-context">${esc(component.sourceSheet || component.name)} · source row ${esc(row.sourceRow)}${row.retired ? ' · Retained from an earlier import; absent from the latest source.' : ''}</p>`;
}

function assessment(row, comparison) {
  if (!present(row.targetCm)) return 'Working target not entered';
  if (!present(comparison.actualCm)) return 'Sample actual not entered';
  if (!present(row.toleranceMinusCm) || !present(row.tolerancePlusCm)) return 'Set both tolerance limits to assess';
  return comparison.toleranceStatus === 'within' ? 'Within configured tolerance' : comparison.toleranceStatus === 'outside' ? 'Outside configured tolerance' : 'Tolerance assessment unavailable';
}

function resultAttributes(component, row, result, sampleId, side, esc) {
  return `data-dev-result="${result}" data-dev-component="${esc(component.id)}" data-dev-row="${esc(row.id)}" data-dev-sample="${esc(sampleId || '')}" data-dev-side="${esc(side)}"`;
}

function numericInput(component, row, key, label, value, options) {
  const { unit, sampleId, side, observation = false, esc } = options;
  const disabled = !unit || (observation && !sampleId);
  const reason = !unit ? 'Choose garment CM or IN before entering measurements.' : 'Add or select a sample before entering actual measurements.';
  return `<input type="text" inputmode="${unit === 'in' ? 'text' : 'decimal'}" autocomplete="off" data-dev-field="${key}" data-dev-component="${esc(component.id)}" data-dev-row="${esc(row.id)}"${observation ? ` data-dev-observation="actualCm" data-dev-sample="${esc(sampleId || '')}" data-dev-side="${esc(side)}"` : ''} aria-label="${esc(`${component.name}, ${row.code}, ${label}${unit ? ', ' + unit.toUpperCase() : ', unit not selected'}`)}" value="${present(value) ? esc(formatMeasure(value, unit || 'cm', key === 'proposedDeltaCm')) : ''}"${disabled ? ` disabled title="${esc(reason)}"` : ''}>`;
}

function sourceCell(component, row, esc, complete = false) {
  const history = row.definitionHistory || [];
  const historyMarkup = history.length ? `<details class="source-note development-definition-history"${complete ? ' open' : ''}><summary>Earlier source definitions · ${history.length}</summary><p>Kept from earlier imports; review changes in measuring context before comparing observations.</p>${history.map((previous, index) => `<section><h4>Previous definition ${index + 1}</h4><p class="measure-label">${ink(esc(previous.description))}</p><p class="development-method">${ink(esc(previous.method || 'No measuring method was supplied in this earlier source row.'))}</p><p class="development-source-context">${esc(component.sourceSheet || component.name)} · source row ${esc(previous.sourceRow)} · SHA-256: ${esc(previous.sourceSha256)}</p></section>`).join('')}</details>` : '';
  return `<p class="measure-label">${ink(esc(row.description))}</p><p class="development-method">${ink(esc(row.method || 'No measuring method was supplied in this source row.'))}</p>${rowSource(component, row, esc)}${historyMarkup}`;
}

function developmentRows(component, options) {
  const { unit, sampleId, side, esc } = options;
  return component.rows.map(row => {
    const comparison = compareObservation(row, sampleId, side);
    const attrs = (key) => resultAttributes(component, row, key, sampleId, side, esc);
    const numeric = (key, label, value, extra = {}) => numericInput(component, row, key, label, value, { ...options, ...extra });
    const context = `${component.name}, ${row.code}`;
    return `<tr data-dev-row="${esc(row.id)}" data-dev-component="${esc(component.id)}" data-development-row="true"${row.retired ? ' data-dev-retired="true"' : ''}>
      <th scope="row" class="sticky-code" data-dev-column="code">${ink(esc(row.code))}${row.retired ? '<span class="development-retired">Retained row</span>' : ''}</th>
      <td data-dev-column="description">${sourceCell(component, row, esc)}</td>
      <td data-dev-column="target">${numeric('targetCm', 'Working target', row.targetCm)}</td>
      <td data-dev-column="toleranceMinus">${numeric('toleranceMinusCm', 'Tolerance below target, positive magnitude', row.toleranceMinusCm)}</td>
      <td data-dev-column="tolerancePlus">${numeric('tolerancePlusCm', 'Tolerance above target, positive magnitude', row.tolerancePlusCm)}</td>
      <td data-dev-column="actual">${numeric('actualCm', `${sampleId ? 'Selected sample' : 'No sample selected'}, ${sideLabel(side)}, actual measurement`, comparison.actualCm, { observation: true })}</td>
      <td data-dev-column="delta"><output ${attrs('deltaCm')} aria-label="${esc(context + ', actual minus working target')}">${ink(esc(display(comparison.deltaCm, unit, true)))}</output></td>
      <td data-dev-column="assessment"><output class="development-assessment" ${attrs('toleranceStatus')} aria-label="${esc(context + ', tolerance assessment')}">${ink(esc(assessment(row, comparison)))}</output></td>
      <td data-dev-column="proposedAdjustment">${numeric('proposedDeltaCm', 'Proposed signed adjustment, unapproved', row.proposedDeltaCm)}</td>
      <td data-dev-column="proposedTarget"><output ${attrs('proposedTargetCm')} aria-label="${esc(context + ', proposed target, unapproved')}">${ink(esc(display(comparison.proposedTargetCm, unit)))}</output></td>
      <td data-dev-column="notes"><textarea rows="2" maxlength="4000" data-dev-field="notes" data-dev-component="${esc(component.id)}" data-dev-row="${esc(row.id)}" aria-label="${esc(context + ', local development notes')}">${esc(row.notes)}</textarea></td>
    </tr>`;
  }).join('');
}

function workingTable(component, options) {
  const { unit, sampleId, side, esc } = options;
  const uid = unit ? unit.toUpperCase() : 'UNIT NOT SELECTED';
  const columns = [
    ['code', 'POM'], ['description', 'Original label / how to measure'], ['target', `Working target (${uid})`],
    ['toleranceMinus', `− tolerance (${uid})`], ['tolerancePlus', `+ tolerance (${uid})`],
    ['actual', `Sample actual · ${sideLabel(side)} (${uid})`], ['delta', `Actual − target (${uid})`],
    ['assessment', 'Tolerance assessment'], ['proposedAdjustment', `Proposed signed adjustment · unapproved (${uid})`],
    ['proposedTarget', `Proposed target · unapproved (${uid})`], ['notes', 'Local notes'],
  ];
  return `<section class="table-section development-component" data-development-component="${esc(component.id)}"><h3>${esc(component.name)} · ${component.rows.length} POMs</h3><p class="table-note">Source sheet: ${esc(component.sourceSheet || component.name)}. ${sampleId ? `Showing ${esc(sideLabel(side).toLowerCase())} actuals for the selected sample.` : 'Select or add a sample to enter actual measurements.'} Unknown values stay blank; zero is a measurement.</p><div class="table-wrap development-table-wrap" tabindex="0" role="region" aria-label="${esc(component.name)} component measurements; scroll horizontally for all working columns"><table class="work-table development-table" aria-label="${esc(component.name)} development measurements"><colgroup>${columns.map(([key]) => `<col data-dev-column="${key}">`).join('')}</colgroup><thead><tr>${columns.map(([key, label]) => `<th scope="col" data-dev-column="${key}">${esc(label)}</th>`).join('')}</tr></thead><tbody>${developmentRows(component, options)}</tbody></table></div></section>`;
}

function printComponent(component, development, options) {
  const { unit, esc } = options;
  const uid = unit ? unit.toUpperCase() : 'UNIT NOT SELECTED';
  const columns = [['code', 'POM'], ['description', 'Original label / how to measure'], ['target', `Working target (${uid})`], ['toleranceMinus', `− tolerance (${uid})`], ['tolerancePlus', `+ tolerance (${uid})`], ['proposedAdjustment', `Proposed adjustment · unapproved (${uid})`], ['proposedTarget', `Proposed target · unapproved (${uid})`], ['notes', 'Local notes']];
  const rows = component.rows.map(row => {
    const proposed = present(row.targetCm) && present(row.proposedDeltaCm) ? row.targetCm + row.proposedDeltaCm : null;
    return `<tr data-development-row="true"><th scope="row" class="sticky-code" data-dev-column="code">${ink(esc(row.code))}${row.retired ? '<span class="development-retired">Retained row</span>' : ''}</th><td data-dev-column="description">${sourceCell(component, row, esc, true)}</td>${[['target', row.targetCm], ['toleranceMinus', row.toleranceMinusCm], ['tolerancePlus', row.tolerancePlusCm], ['proposedAdjustment', row.proposedDeltaCm], ['proposedTarget', proposed]].map(([key, value]) => `<td data-dev-column="${key}"><span class="print-value">${ink(esc(display(value, unit, key === 'proposedAdjustment')))}</span></td>`).join('')}<td data-dev-column="notes"><span class="print-value">${ink(esc(row.notes || '—'))}</span></td></tr>`;
  }).join('');
  const observations = [];
  for (const sample of development.samples) {
    for (const row of component.rows) {
      for (const side of SIDES) {
        const comparison = compareObservation(row, sample.id, side);
        if (present(comparison.actualCm)) observations.push(`<tr><th scope="row" class="sticky-code">${ink(esc(row.code))}</th><td>${ink(esc(sampleTitle(sample)))}${sample.notes ? `<p class="development-observation-context">${ink(esc(sample.notes))}</p>` : ''}</td><td>${ink(esc(sideLabel(side)))}</td><td>${ink(esc(display(comparison.actualCm, unit)))}</td><td>${ink(esc(display(row.targetCm, unit)))}</td><td>${ink(esc(display(comparison.deltaCm, unit, true)))}</td><td>${ink(esc(assessment(row, comparison)))}</td></tr>`);
      }
    }
  }
  return `<section class="development-print-component"><section class="table-section"><h3>${esc(component.name)} · all ${component.rows.length} POMs</h3><p class="table-note">Source sheet: ${esc(component.sourceSheet || component.name)}. Targets and tolerance limits are local working values. Proposed adjustments are unapproved and have not changed the targets.</p><div class="table-wrap"><table class="work-table development-table" aria-label="${esc(component.name)}, complete working targets and original methods"><colgroup>${columns.map(([key]) => `<col data-dev-column="${key}">`).join('')}</colgroup><thead><tr>${columns.map(([key, label]) => `<th scope="col" data-dev-column="${key}">${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></section><section class="table-section"><h3>${esc(component.name)} · all entered sample observations</h3>${observations.length ? `<div class="table-wrap"><table class="work-table development-observations" aria-label="${esc(component.name)}, all nonblank sample and side observations"><thead><tr><th scope="col">POM</th><th scope="col">Sample / round / notes</th><th scope="col">Side</th><th scope="col">Actual (${uid})</th><th scope="col">Working target (${uid})</th><th scope="col">Actual − target (${uid})</th><th scope="col">Tolerance assessment</th></tr></thead><tbody>${observations.join('')}</tbody></table></div>` : '<p class="table-note">No actual measurements entered for this component.</p>'}</section></section>`;
}

/** Render only local working component data; source cells never become targets. */
export function renderDevelopment(development, { unit = null, componentId, sampleId, side = 'general', complete = false, esc = escapeHtml } = {}) {
  const components = development?.components || [];
  if (!components.length) return `<section class="development-view empty-state"><h3>Component development</h3><p>Import a garment component XLSX to start this working measurement sheet.</p><p>The import preview lets you review original POM codes, labels and measuring methods before applying changes. Working targets, tolerance limits, sample actuals and proposed adjustments start blank. Select garment CM or IN before entering measurements.</p><p>Use Import component XLSX in the workroom controls. The original workbook stays unchanged; its images are not imported.</p></section>`;
  const samples = development.samples || [];
  const selectedComponent = components.find(component => component.id === componentId) || components[0];
  const selectedSample = samples.find(sample => sample.id === sampleId);
  const activeSide = SIDES.includes(side) ? side : 'general';
  const options = { unit, componentId: selectedComponent.id, sampleId: selectedSample?.id || '', side: activeSide, esc };
  const rowCount = components.reduce((total, component) => total + component.rows.length, 0);
  if (complete) return `<section class="development-view development-print"><h2>Garment component development</h2><p class="development-summary">${components.length} component sheets · ${rowCount} POMs · active display unit ${unit ? esc(unit.toUpperCase()) : 'NOT SELECTED'} · all components and all entered sample observations.</p><p class="development-approval-note">Working draft. Delta = sample actual − working target. Tolerance assessment uses only both explicitly configured limits; it does not approve a garment. Proposed signed adjustments and proposed targets remain unapproved and do not change working targets.</p>${sourceContext(development, esc)}${components.map(component => printComponent(component, development, options)).join('')}</section>`;
  return `<section class="development-view"><div class="development-toolbar"><label class="field" for="component-select"><span>Component sheet</span><select id="component-select">${components.map(component => `<option value="${esc(component.id)}"${component.id === selectedComponent.id ? ' selected' : ''}>${esc(component.name)} · ${component.rows.length} POMs</option>`).join('')}</select></label><label class="field" for="development-sample"><span>Working sample</span><select id="development-sample"><option value="">Select a sample…</option>${samples.map(sample => `<option value="${esc(sample.id)}"${sample.id === selectedSample?.id ? ' selected' : ''}>${esc(sampleTitle(sample))}</option>`).join('')}</select></label><label class="field" for="development-side"><span>Measurement side / context</span><select id="development-side">${SIDES.map(item => `<option value="${item}"${item === activeSide ? ' selected' : ''}>${esc(sideLabel(item))}</option>`).join('')}</select></label></div><div class="development-sample-add"><label class="field" for="development-sample-name"><span>New sample name</span><input id="development-sample-name" type="text" maxlength="240" autocomplete="off" placeholder="Enter a sample name"></label><label class="field" for="development-sample-round"><span>Round / version (optional)</span><input id="development-sample-round" type="text" maxlength="240" autocomplete="off" placeholder="Enter a round or version"></label><label class="field" for="development-sample-notes"><span>Sample notes (optional)</span><input id="development-sample-notes" type="text" maxlength="2000" autocomplete="off" placeholder="Sample context or measuring conditions"></label><button id="add-development-sample" type="button">Add working sample</button></div><p class="development-summary">${components.length} component sheets · ${rowCount} POMs · ${samples.length} working sample${samples.length === 1 ? '' : 's'}${selectedSample ? ` · Selected: ${esc(sampleTitle(selectedSample))}` : ''}</p>${selectedSample?.notes ? `<p class="development-observation-context">Selected sample notes: ${esc(selectedSample.notes)}</p>` : ''}${!unit ? '<p class="development-notice" role="note">Select garment CM / IN before entering targets, tolerance limits, actual measurements or proposed adjustments.</p>' : `<p class="development-notice">Entry and display unit: ${esc(unit.toUpperCase())}. ${unit === 'in' ? 'Decimal and fractional inches are accepted.' : 'Enter decimal centimetres.'} Tolerance − / + fields are non-negative distances below / above the working target.</p>`}<p class="development-approval-note">Delta = sample actual − working target. Tolerance is assessed only when both limits, target and actual are entered. A proposal is separate from the working target: proposed target = working target + proposed signed adjustment. Proposals and tolerance results do not approve a garment.</p>${workingTable(selectedComponent, options)}${sourceContext(development, esc)}</section>`;
}

/** Preview an XLSX replacement before the application applies it atomically. */
export function renderWorkbookPreview(preview) {
  const esc = escapeHtml;
  const components = preview?.components || [];
  const summary = preview?.summary || {};
  const workbook = preview?.workbook || {};
  return `<section class="workbook-preview"><p class="workbook-preview-summary">${esc(workbook.fileName || 'Component workbook')} · ${esc(summary.components ?? components.length)} component sheets · ${esc(summary.rows ?? components.reduce((total, component) => total + component.rows.length, 0))} POMs</p><p>Review this import before applying it. Matching component/POM identities keep local targets, tolerance limits, observations and proposals; replaced source labels and methods remain visible in the change list. The original XLSX is unchanged.</p><p class="workbook-preview-summary">${esc(summary.added ?? 0)} rows added · ${esc(summary.changed ?? 0)} rows changed · ${esc(summary.retired ?? 0)} rows retained from an earlier import</p>${(preview?.warnings || []).length ? `<div class="workbook-preview-warning" role="note"><h3>Import notes</h3><ul>${preview.warnings.map(warning => `<li>${esc(warning)}</li>`).join('')}<li>Workbook images are not imported. Retain the original XLSX with its source references.</li></ul></div>` : '<p class="workbook-preview-warning">Workbook images are not imported. Retain the original XLSX with its source references.</p>'}<div class="workbook-preview-list">${components.map(component => `<section><h3>${esc(component.name)} · ${component.rows.length} POMs</h3><p>Original sheet: ${esc(component.sourceSheet || component.name)}</p><ol>${component.rows.map(row => `<li><strong>${esc(row.code)}</strong> · ${esc(row.description)}${row.retired ? ' · Retained row' : ''}<p class="development-method">${esc(row.method || 'No measuring method was supplied.')}</p><p class="development-source-context">Source row ${esc(row.sourceRow)}</p></li>`).join('')}</ol></section>`).join('')}</div><details class="source-note" open><summary>Changes to review · ${(preview?.changes || []).length}</summary>${(preview?.changes || []).length ? `<ul>${preview.changes.map(change => `<li>${esc(change.message)}</li>`).join('')}</ul>` : '<p>No POM labels or methods changed. Applying this import refreshes local source context.</p>'}</details></section>`;
}
