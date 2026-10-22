import { createIntakeDraft, parseClientMeasurement, displayClientMeasurement, validateIntakeDraft, summarizeIntake, intakeToCsv } from '/client-intake.mjs';

async function startClientIntake() {
  const byId = id => document.getElementById(id);
  const offline = window.__OFFLINE_CLIENT_INTAKE__ === true;
  const storageKey = 'sr-client-intake-v1';
  const api = '/api/client-intake';
  let template;
  let draft;
  let dirty = false;
  let busy = false;
  let storageAvailable = true;
  let checkAttempted = false;
  let controls = [];
  const fieldControls = new Map();
  const contextPanel = byId('intake-context');
  const contextTabs = [...document.querySelectorAll('[data-context-tab]')];
  const contextPages = [...document.querySelectorAll('.context-page')];
  const contextBody = document.querySelector('.context-body');
  const chart = document.querySelector('.table-wrap');
  const search = byId('intake-search');
  const filterButtons = [...document.querySelectorAll('[data-intake-filter]')];
  const compactLayout = window.matchMedia('(max-width: 740px)');
  let viewFilter = 'all';
  let printState = null;

  function selectContext(name, focusTab = false) {
    for (const tab of contextTabs) {
      const selected = tab.dataset.contextTab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) tab.focus();
    }
    for (const page of contextPages) page.hidden = page.id !== 'context-' + name;
    contextPanel.open = true;
    contextBody.scrollTop = 0;
  }

  function updateView(resetScroll = false) {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const control of controls) {
      // Keep the row being entered visible until the operator leaves its input.
      const missing = control.record.valueCm === null || control.input === document.activeElement;
      const matchesFilter = viewFilter === 'all' || (viewFilter === 'required' && control.definition.required)
        || (viewFilter === 'missing' && control.definition.required && missing);
      control.row.hidden = !(matchesFilter && control.row.dataset.search.includes(query));
      if (!control.row.hidden) visible++;
    }
    for (const button of filterButtons) button.setAttribute('aria-pressed', String(button.dataset.intakeFilter === viewFilter));
    byId('visible-count').textContent = `Showing ${visible} of ${controls.length} measurements`;
    byId('intake-empty').hidden = visible !== 0;
    if (resetScroll) chart.scrollTop = 0;
    if (!visible) chart.scrollLeft = 0;
  }

  function revealMeasurement(control, missingOnly = false) {
    search.value = '';
    viewFilter = missingOnly ? 'missing' : 'all';
    updateView(true);
    if (compactLayout.matches) contextPanel.open = false;
    control.input.focus({ preventScroll: true });
    control.input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function matteText(text) {
    const span = document.createElement('span');
    span.className = 'matte-ink';
    span.textContent = text;
    return span;
  }

  function setStatus(message, tone = '') {
    byId('status').textContent = message;
    byId('status').className = 'status-message' + (tone ? ' ' + tone : '');
  }

  function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  async function request(path, options = {}) {
    let response;
    try { response = await fetch(api + path, options); }
    catch { throw Error('The local intake service could not be reached. Your entries remain on this sheet; download JSON to keep a copy.'); }
    let result;
    try { result = await response.json(); }
    catch { throw Error('The intake service returned an unreadable response. The current sheet has not been saved.'); }
    if (!response.ok) throw Error(result.error || 'The intake request could not be completed.');
    return result;
  }

  function titleFor(intake) {
    return [intake.fields.clientId, intake.fields.clientName].filter(Boolean).join(' · ') || intake.fields.projectDescription || 'Untitled client intake';
  }

  function readBrowserRecords() {
    try {
      const records = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(records)) throw Error('Invalid storage');
      return records.map(record => {
        if (!record || typeof record.id !== 'string' || typeof record.createdAt !== 'string') throw Error('Invalid record');
        return { ...record, intake: validateIntakeDraft(record.intake, template, { allowEmpty: true }) };
      });
    } catch { throw Error('Browser storage is unavailable or unreadable. Use Download JSON to keep a copy of this intake.'); }
  }

  function markDirty() {
    dirty = true;
    if (!storageAvailable) setStatus('Browser storage is unavailable. Download JSON to keep this intake; it cannot be saved in this browser.', 'error');
    else setStatus('Unsaved changes. Save a new draft or download a copy to keep this intake.');
    updateButtons();
  }

  function updateButtons() {
    byId('save-intake').disabled = busy || !storageAvailable || !dirty;
    byId('save-intake').textContent = busy ? 'Working…' : 'Save draft';
    for (const element of document.querySelectorAll('#client-intake-form input, #client-intake-form select, #client-intake-form textarea')) element.disabled = busy;
    for (const id of ['new-intake', 'check-required', 'download-csv', 'download-json', 'import-json', 'print-intake', 'saved-intakes']) byId(id).disabled = busy;
    byId('open-intake').disabled = busy || !byId('saved-intakes').value;
    document.querySelector('.import-label').setAttribute('aria-disabled', String(busy));
  }

  function updateMetadataPrint() {
    for (const { input, print } of fieldControls.values()) print.textContent = input.value || '—';
    byId('document-client-id').textContent = fieldControls.get('clientId').input.value || '—';
    byId('document-client-id').title = fieldControls.get('clientId').input.value;
    byId('croquis-print').textContent = byId('croquis-reference').value || '—';
    byId('client-reference-print').textContent = byId('client-reference').value || '—';
    byId('print-unit').textContent = draft.unit;
  }

  function renderMetadata() {
    for (const definition of template.fields) {
      const slot = document.querySelector(`[data-field-slot="${definition.key}"]`);
      if (!slot) throw Error('An original intake field has no display position.');
      const label = document.createElement('label');
      label.className = 'field';
      const caption = document.createElement('span');
      caption.textContent = definition.label;
      const input = document.createElement('input');
      input.type = definition.type === 'date' ? 'date' : 'text';
      input.id = 'client-' + definition.key;
      input.name = definition.key;
      input.dataset.fieldKey = definition.key;
      input.maxLength = 1000;
      input.autocomplete = 'off';
      if (definition.type !== 'date') input.placeholder = 'Enter ' + definition.label.toLowerCase();
      const print = document.createElement('span');
      print.className = 'print-only print-value';
      label.htmlFor = input.id;
      label.append(caption, input, print);
      slot.append(label);
      fieldControls.set(definition.key, { input, print });
      input.addEventListener('input', () => { draft.fields[definition.key] = input.value; updateMetadataPrint(); markDirty(); });
    }
  }

  function updateProgress() {
    const summary = summarizeIntake(draft, template);
    byId('stat-total').textContent = summary.total;
    byId('stat-measured').textContent = summary.measured;
    byId('stat-required').textContent = summary.requiredMeasured + ' / ' + summary.requiredTotal;
    byId('stat-optional').textContent = summary.optionalTotal;
    const missing = new Set(summary.missingRequired);
    for (const row of controls) {
      const missingRequired = checkAttempted && missing.has(row.definition.pomCode);
      row.row.classList.toggle('missing-required', missingRequired);
      row.input.setAttribute('aria-invalid', String(row.invalid || missingRequired));
      row.error.textContent = row.invalid ? row.message : missingRequired ? 'Required measurement not entered.' : '';
      row.print.textContent = row.input.value || '—';
    }
    updateView();
  }

  function renderMeasurements() {
    const body = byId('intake-rows');
    body.replaceChildren();
    controls = [];
    const records = new Map(draft.measurements.map(record => [record.pomCode, record]));
    for (const definition of template.measurements) {
      const record = records.get(definition.pomCode);
      const row = document.createElement('tr');
      row.dataset.pom = definition.pomCode;
      row.dataset.search = [definition.pomCode, definition.label, definition.sourceLabel, definition.howToMeasure].join(' ').toLowerCase();
      const code = document.createElement('th');
      code.scope = 'row';
      code.className = 'pom-code';
      code.append(matteText(definition.pomCode));
      const critical = document.createElement('td');
      critical.className = 'critical-cell';
      const tag = document.createElement('span');
      tag.className = 'tag ' + (definition.required ? 'required' : 'optional');
      tag.textContent = definition.required ? 'REQUIRED' : 'Optional';
      critical.append(tag);
      const label = document.createElement('td');
      label.className = 'measure-label';
      label.append(matteText(definition.label));
      const method = document.createElement('td');
      method.className = 'method-cell';
      const methodText = document.createElement('p');
      methodText.className = 'method-text';
      methodText.append(matteText(definition.howToMeasure));
      method.append(methodText);
      if (definition.methodNeedsConfirmation) {
        const warning = document.createElement('p');
        warning.className = 'method-warning';
        warning.textContent = 'Source question retained · measuring method needs house clarification.';
        method.append(warning);
      }
      const measurement = document.createElement('td');
      measurement.className = 'measurement-cell';
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = 'any';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.dataset.field = 'measurement';
      input.id = 'measurement-' + definition.pomCode;
      input.value = displayClientMeasurement(record.valueCm, draft.unit);
      input.placeholder = 'Enter value';
      input.setAttribute('aria-label', `${definition.label}, ${definition.pomCode}, ${draft.unit}${definition.required ? ', required' : ''}`);
      const unit = document.createElement('span');
      unit.className = 'measurement-unit';
      unit.textContent = draft.unit.toLowerCase();
      const error = document.createElement('span');
      error.className = 'row-error';
      error.id = 'measurement-error-' + definition.pomCode;
      input.setAttribute('aria-describedby', error.id);
      const print = document.createElement('span');
      print.className = 'print-only print-value';
      const control = { row, definition, record, input, error, print, invalid: false, message: '' };
      input.addEventListener('input', () => {
        input.setCustomValidity('');
        try {
          if (input.validity.badInput) throw Error('Enter a decimal number, or leave it blank.');
          record.valueCm = parseClientMeasurement(input.value, draft.unit);
          control.invalid = false;
          control.message = '';
        } catch (problem) {
          record.valueCm = null;
          control.invalid = true;
          control.message = problem.message;
          input.setCustomValidity(problem.message);
        }
        updateProgress();
        markDirty();
      });
      input.addEventListener('blur', () => updateView());
      controls.push(control);
      measurement.append(input, unit, print, error);
      row.append(code, critical, label, method, measurement);
      body.append(row);
    }
    for (const node of document.querySelectorAll('.current-unit')) node.textContent = draft.unit;
    byId('intake-unit-status').textContent = `Client values displayed in ${draft.unit}. Original measuring landmarks remain unchanged.`;
    updateProgress();
  }

  function showDraft(next) {
    draft = structuredClone(next);
    search.value = '';
    viewFilter = 'all';
    for (const [key, control] of fieldControls) control.input.value = draft.fields[key];
    byId('intake-unit').value = draft.unit;
    byId('croquis-reference').value = draft.croquisReference;
    byId('client-reference').value = draft.clientReference;
    checkAttempted = false;
    renderMeasurements();
    updateMetadataPrint();
    dirty = false;
    updateButtons();
  }

  function confirmDiscard(message) {
    return !dirty || window.confirm(message + ' Save or download the current intake first if you want to keep it.');
  }

  function newIntake(initial = false) {
    if (!initial && !confirmDiscard('Discard unsaved changes and start a blank intake?')) return;
    showDraft(createIntakeDraft(template, { fields: { measurementDate: localToday() } }));
    byId('saved-intakes').value = '';
    updateButtons();
    setStatus('Blank intake ready. Save a draft at any stage.');
  }

  function collectDraft(options = {}) {
    const invalid = controls.find(control => control.invalid || control.input.validity.badInput);
    if (invalid) {
      revealMeasurement(invalid);
      invalid.input.reportValidity();
      throw Error('Correct the highlighted measurement value before continuing.');
    }
    for (const [key, control] of fieldControls) draft.fields[key] = control.input.value;
    draft.croquisReference = byId('croquis-reference').value;
    draft.clientReference = byId('client-reference').value;
    const invalidField = [...fieldControls.values()].find(control => !control.input.validity.valid);
    if (invalidField) {
      selectContext('client');
      invalidField.input.reportValidity();
      throw Error('Check the highlighted intake fields.');
    }
    if (!byId('client-intake-form').reportValidity()) throw Error('Check the highlighted intake fields.');
    updateMetadataPrint();
    // Measurement values remain canonical centimetres. Do not reparse rounded display values here.
    return validateIntakeDraft(draft, template, options);
  }

  function setSavedOptions(records) {
    const select = byId('saved-intakes');
    const selected = select.value;
    select.replaceChildren();
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = records.length ? 'Choose a saved intake…' : 'No saved intakes yet';
    select.append(blank);
    for (const record of records) {
      const option = document.createElement('option');
      option.value = record.id;
      const date = new Date(record.createdAt);
      const savedTime = Number.isFinite(date.getTime()) ? date.toLocaleString() : '';
      option.textContent = `${record.title} · ${record.requiredMeasured}/${record.requiredTotal} required · ${record.unit}${savedTime ? ' · ' + savedTime : ''}`;
      select.append(option);
    }
    select.value = selected;
    updateButtons();
  }

  async function refreshSaved() {
    if (offline) {
      setSavedOptions(readBrowserRecords().map(record => {
        const summary = summarizeIntake(record.intake, template);
        return { id: record.id, title: titleFor(record.intake), createdAt: record.createdAt, unit: record.intake.unit,
          measuredCount: summary.measured, requiredMeasured: summary.requiredMeasured, requiredTotal: summary.requiredTotal };
      }));
    } else setSavedOptions((await request('/sessions')).sessions);
  }

  async function saveIntake() {
    try {
      const normalized = collectDraft();
      busy = true;
      updateButtons();
      let saved;
      if (offline) {
        const records = readBrowserRecords();
        const id = globalThis.crypto?.randomUUID?.() || 'intake-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        saved = { id, createdAt: new Date().toISOString(), intake: normalized };
        try { localStorage.setItem(storageKey, JSON.stringify([saved, ...records])); }
        catch { throw Error('Browser storage could not save this intake. Download JSON to keep a copy.'); }
      } else saved = await request('/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalized) });
      showDraft(normalized);
      setStatus(offline ? 'Draft saved in this browser on this device. Download JSON as a portable backup.' : 'Draft saved as a separate local SQLite record. Earlier intake drafts are unchanged.', 'success');
      try {
        await refreshSaved();
        byId('saved-intakes').value = saved.id;
      } catch (problem) { setStatus('The draft was saved, but its list could not refresh. ' + problem.message, 'error'); }
    } catch (problem) { setStatus(problem.message, 'error'); }
    finally { busy = false; updateButtons(); }
  }

  async function openIntake() {
    const id = byId('saved-intakes').value;
    if (!id || !confirmDiscard('Open the saved intake and discard unsaved changes?')) return;
    busy = true;
    updateButtons();
    try {
      const saved = offline ? readBrowserRecords().find(record => record.id === id) : await request('/sessions/' + encodeURIComponent(id));
      if (!saved) throw Error('That saved intake was not found.');
      showDraft(validateIntakeDraft(saved.intake, template, { allowEmpty: true }));
      setStatus('Saved draft opened. Save any changes as a new draft to preserve the original.');
    } catch (problem) { setStatus(problem.message, 'error'); }
    finally { busy = false; updateButtons(); }
  }

  function download(contents, type, extension) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const anchor = document.createElement('a');
    const name = (draft.fields.clientId || draft.fields.clientName || 'client-intake').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'client-intake';
    anchor.href = url;
    anchor.download = `${name}-${draft.fields.measurementDate || 'undated'}.${extension}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportIntake(format) {
    try {
      const current = collectDraft({ allowEmpty: true });
      if (format === 'csv') download(intakeToCsv(current, template), 'text/csv;charset=utf-8', 'csv');
      else download(JSON.stringify(current, null, 2), 'application/json;charset=utf-8', 'json');
      setStatus(format.toUpperCase() + ' downloaded. Keep the file with the separate client references.');
    } catch (problem) { setStatus(problem.message, 'error'); }
  }

  function checkRequired() {
    checkAttempted = true;
    updateProgress();
    try {
      collectDraft({ requireComplete: true });
      const pending = template.measurements.filter(record => record.methodNeedsConfirmation).map(record => record.pomCode);
      setStatus('All required measurements and identifying details are entered. This is a completeness check, not approval.' + (pending.length ? ` Source method notes still need clarification: ${pending.join(', ')}.` : ''), 'success');
    } catch (problem) {
      setStatus(problem.message, 'error');
      const invalid = controls.find(control => control.invalid || control.input.validity.badInput);
      if (invalid) {
        revealMeasurement(invalid);
      } else if (!draft.fields.clientId.trim() && !draft.fields.clientName.trim()) {
        selectContext('client');
        fieldControls.get('clientId').input.focus();
      } else if (!draft.fields.measurementDate) {
        selectContext('client');
        fieldControls.get('measurementDate').input.focus();
      } else {
        const missing = controls.find(control => control.invalid || (control.definition.required && control.record.valueCm === null));
        if (missing) revealMeasurement(missing, missing.definition.required);
      }
    }
  }

  async function importIntake() {
    const file = byId('import-json').files?.[0];
    if (!file) return;
    try {
      if (file.size > 256 * 1024) throw Error('Choose a JSON intake backup smaller than 256 KB.');
      let parsed;
      try { parsed = JSON.parse(await file.text()); }
      catch { throw Error('The selected file is not a readable JSON intake backup.'); }
      const normalized = validateIntakeDraft(parsed.intake ?? parsed, template, { allowEmpty: true });
      if (!confirmDiscard('Import this backup and discard unsaved changes?')) return;
      showDraft(normalized);
      byId('saved-intakes').value = '';
      dirty = true;
      updateButtons();
      setStatus('JSON backup opened. Save it as a new draft to add it to this device’s saved intakes.');
    } catch (problem) { setStatus(problem.message, 'error'); }
    finally { byId('import-json').value = ''; }
  }

  template = offline ? window.__CLIENT_INTAKE_TEMPLATE__ : await request('/template');
  if (!template || !Array.isArray(template.measurements) || template.measurements.length !== 34) throw Error('The 34-POM client intake template could not be loaded.');
  // Source palette values remain provenance; the current house style is shared in CSS.
  byId('client-heading').textContent = template.sections?.client || 'CLIENT MEASUREMENTS';
  byId('source-measurements-heading').textContent = template.sections?.measurements || 'REMOTE CLIENT ACTUAL BODY MEASUREMENTS';
  byId('croquis-title').textContent = template.referenceAreas.croquisTitle;
  byId('client-reference-title').textContent = template.referenceAreas.clientReferenceTitle;
  byId('unit-label').textContent = template.unitLabel;
  for (const text of template.notes) {
    const note = document.createElement('li');
    note.textContent = text;
    byId('source-intake-notes').append(note);
  }
  byId('storage-mode').textContent = offline ? 'Browser storage · this device' : 'Local client-intake SQLite';
  byId('storage-help').textContent = offline
    ? 'Drafts save only in this browser on this device and do not sync to SQLite. Browser data can be cleared; download JSON as a portable backup. Each save creates a separate record.'
    : 'Client drafts save in a separate local SQLite store and do not sync to the standalone browser file. Each save creates a separate record. Saving does not approve measurements.';
  renderMetadata();
  newIntake(true);
  contextPanel.open = !compactLayout.matches;
  compactLayout.addEventListener('change', event => { contextPanel.open = !event.matches; });
  for (const [index, tab] of contextTabs.entries()) {
    tab.addEventListener('click', () => selectContext(tab.dataset.contextTab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % contextTabs.length;
      if (event.key === 'ArrowLeft') next = (index + contextTabs.length - 1) % contextTabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = contextTabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectContext(contextTabs[next].dataset.contextTab, true); }
    });
  }
  search.addEventListener('input', () => updateView(true));
  for (const button of filterButtons) button.addEventListener('click', () => {
    viewFilter = button.dataset.intakeFilter;
    updateView(true);
  });
  byId('clear-intake-search').addEventListener('click', () => {
    search.value = '';
    viewFilter = 'all';
    updateView(true);
    chart.scrollLeft = 0;
    search.focus();
  });
  byId('client-intake-form').addEventListener('submit', event => event.preventDefault());
  for (const id of ['croquis-reference', 'client-reference']) byId(id).addEventListener('input', () => { updateMetadataPrint(); markDirty(); });
  byId('intake-unit').addEventListener('change', () => {
    if (controls.some(control => control.invalid || control.input.validity.badInput)) {
      byId('intake-unit').value = draft.unit;
      setStatus('Correct the highlighted measurement before changing units.', 'error');
      return;
    }
    draft.unit = byId('intake-unit').value;
    const scrollPosition = { top: chart.scrollTop, left: chart.scrollLeft };
    renderMeasurements();
    updateMetadataPrint();
    chart.scrollTop = scrollPosition.top;
    chart.scrollLeft = scrollPosition.left;
    markDirty();
  });
  byId('save-intake').addEventListener('click', saveIntake);
  byId('new-intake').addEventListener('click', () => newIntake());
  byId('saved-intakes').addEventListener('change', updateButtons);
  byId('open-intake').addEventListener('click', openIntake);
  byId('check-required').addEventListener('click', checkRequired);
  byId('download-csv').addEventListener('click', () => exportIntake('csv'));
  byId('download-json').addEventListener('click', () => exportIntake('json'));
  byId('import-json').addEventListener('change', importIntake);
  byId('print-intake').addEventListener('click', () => {
    try { collectDraft({ allowEmpty: true }); window.print(); }
    catch (problem) { setStatus(problem.message, 'error'); }
  });
  window.addEventListener('beforeprint', () => {
    if (printState) return;
    updateMetadataPrint();
    printState = {
      open: contextPanel.open,
      hiddenPages: contextPages.map(page => page.hidden),
      hiddenRows: controls.map(control => control.row.hidden),
      emptyHidden: byId('intake-empty').hidden,
      count: byId('visible-count').textContent,
      chartTop: chart.scrollTop,
      chartLeft: chart.scrollLeft,
      contextTop: contextBody.scrollTop,
    };
    contextPanel.open = true;
    for (const page of contextPages) page.hidden = page.id === 'context-drafts';
    for (const control of controls) control.row.hidden = false;
    byId('intake-empty').hidden = true;
    byId('visible-count').textContent = 'Showing 34 of 34 measurements';
  });
  window.addEventListener('afterprint', () => {
    if (!printState) return;
    const saved = printState;
    printState = null;
    contextPanel.open = saved.open;
    contextPages.forEach((page, index) => { page.hidden = saved.hiddenPages[index]; });
    controls.forEach((control, index) => { control.row.hidden = saved.hiddenRows[index]; });
    byId('intake-empty').hidden = saved.emptyHidden;
    byId('visible-count').textContent = saved.count;
    chart.scrollTop = saved.chartTop;
    chart.scrollLeft = saved.chartLeft;
    contextBody.scrollTop = saved.contextTop;
  });
  window.addEventListener('beforeunload', event => {
    if (dirty) { event.preventDefault(); event.returnValue = ''; }
  });
  try { await refreshSaved(); }
  catch (problem) {
    if (offline) storageAvailable = false;
    setStatus(problem.message, 'error');
    updateButtons();
  }
  document.documentElement.dataset.ready = 'true';
}

startClientIntake().catch(problem => {
  const status = document.getElementById('status');
  status.textContent = 'The intake form could not start. ' + problem.message;
  status.className = 'status-message error';
});
