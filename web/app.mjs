import { createMeasurementSession, calculateDelta, summarizeSession, validateMeasurementSession, sessionToCsv, parseMeasurement } from '/measurement-session.mjs';

async function bootstrapGenerator() {
  const byId = id => document.getElementById(id);
  const offline = window.__OFFLINE_GENERATOR__ === true;
  const storageKey = 'sr-measurement-generator-v1';
  const modeLabels = {
    house: 'Approved house standard',
    manufacturer: 'Manufacturer reference',
    custom: 'Custom references',
  };
  const modeHelp = {
    house: 'Reference values come from the approved house form. Enter your new measurements beside them; the approved values remain unchanged.',
    manufacturer: 'Reference values come from the recorded manufacturer values. A blank reference stays missing, so no delta is invented for it.',
    custom: 'Enter your own comparison references in the Reference column. These are session values and do not change the approved register.',
  };
  let template;
  let session;
  let dirty = false;
  let saving = false;
  let storageAvailable = true;
  let rowControls = [];

  function setStatus(message, tone = '') {
    byId('status').textContent = message;
    byId('status').className = 'status-message' + (tone ? ' ' + tone : '');
  }

  function localToday() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async function request(path, options = {}) {
    let response;
    try { response = await fetch(path, options); }
    catch { throw new Error('The local service could not be reached. Your entries are still on this sheet; download JSON to keep a copy.'); }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('The local service returned an unreadable response. Your entries have not been saved.'); }
    if (!response.ok) throw new Error(result.error || result.message || 'The request could not be completed.');
    return result;
  }

  function readBrowserRecords() {
    try {
      const records = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(records)) throw new Error('Invalid saved records');
      return records;
    } catch {
      throw new Error('Browser storage is unavailable or unreadable. Download JSON to keep your measurements.');
    }
  }

  function markDirty() {
    if (!storageAvailable) setStatus('Browser storage is unavailable. Download JSON to keep your measurements; this sheet cannot save them in the browser.', 'error');
    else if (!dirty || byId('status').classList.contains('error')) setStatus('Unsaved changes. Save this session or download a copy to keep your measurements.');
    dirty = true;
    updateButtons();
  }

  function readNumber(input) {
    if (input.validity.badInput) throw new Error('Enter a decimal number, or leave blank.');
    return parseMeasurement(input.value);
  }

  function synchronizeRows() {
    let valid = true;
    for (const controls of rowControls) {
      const errors = [];
      for (const field of ['reference', 'measured']) {
        const input = controls[field];
        input.setCustomValidity('');
        try {
          controls.record[field] = readNumber(input);
          input.removeAttribute('aria-invalid');
        } catch (error) {
          controls.record[field] = null;
          input.setCustomValidity(error.message);
          input.setAttribute('aria-invalid', 'true');
          errors.push((field === 'reference' ? 'Reference: ' : 'Measurement: ') + error.message);
          valid = false;
        }
      }
      controls.error.textContent = errors.join(' ');
      let delta = null;
      try { delta = calculateDelta(controls.record.measured, controls.record.reference); }
      catch { valid = false; }
      controls.delta.textContent = delta === null ? '—' : delta > 0 ? '+' + delta : String(delta);
      controls.delta.className = delta === null ? 'empty' : delta < 0 ? 'negative' : '';
      controls.progress.textContent = errors.length ? 'Check value' : controls.record.measured === null ? 'Not measured' : controls.record.reference === null ? 'No reference' : 'Compared';
      controls.progress.className = !errors.length && delta !== null ? 'compared' : '';
    }
    const stats = summarizeSession(session);
    byId('stat-total').textContent = stats.total;
    byId('stat-measured').textContent = stats.measured;
    byId('stat-compared').textContent = stats.compared;
    byId('stat-missing').textContent = stats.missingReferences;
    return valid;
  }

  function updateButtons() {
    const hasMeasurements = session && session.measurements.some(record => record.measured !== null);
    byId('save-session').disabled = saving || !storageAvailable || !hasMeasurements || !dirty;
    byId('save-session').textContent = saving ? 'Saving…' : 'Save as new session';
    for (const control of document.querySelectorAll('#session-details input, #session-details select, #session-details textarea, #measurement-rows input')) control.disabled = saving;
    for (const id of ['new-sheet', 'download-csv', 'download-json', 'print-sheet', 'saved-sessions']) byId(id).disabled = saving;
    byId('open-session').disabled = saving || !byId('saved-sessions').value;
  }

  function renderRows() {
    const body = byId('measurement-rows');
    body.replaceChildren();
    rowControls = [];
    for (const record of session.measurements) {
      const row = document.createElement('tr');
      row.dataset.pom = record.pomCode;
      const code = document.createElement('th');
      code.scope = 'row';
      code.className = 'pom-code';
      code.textContent = record.pomCode;
      const information = document.createElement('td');
      const name = document.createElement('p');
      name.className = 'measurement-name';
      name.textContent = record.description;
      const source = document.createElement('small');
      source.className = 'source-label';
      source.textContent = 'Source: ' + record.sourceLabel;
      const details = document.createElement('details');
      details.className = 'measurement-method';
      const summary = document.createElement('summary');
      summary.textContent = 'How to measure';
      const method = document.createElement('p');
      method.textContent = record.howToMeasure;
      details.append(summary, method);
      information.append(name, source, details);
      const error = document.createElement('small');
      error.className = 'row-error';
      error.id = 'error-' + record.pomCode;
      const controls = { record, error };
      const numericCells = [];
      for (const field of ['reference', 'measured']) {
        const cell = document.createElement('td');
        cell.className = 'number-cell';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = 'any';
        input.inputMode = 'decimal';
        input.autocomplete = 'off';
        input.dataset.field = field;
        input.value = record[field] === null ? '' : String(record[field]);
        input.placeholder = field === 'measured' ? 'Enter value' : '—';
        input.setAttribute('aria-label', (field === 'measured' ? 'New measurement' : 'Reference') + ' for ' + record.pomCode + ' ' + record.description + ' in inches');
        input.setAttribute('aria-describedby', error.id);
        if (field === 'reference') input.readOnly = session.referenceMode !== 'custom';
        input.addEventListener('input', () => { synchronizeRows(); markDirty(); updateButtons(); });
        controls[field] = input;
        cell.append(input);
        numericCells.push(cell);
      }
      numericCells[1].append(error);
      const difference = document.createElement('td');
      difference.className = 'number-cell delta-cell';
      const delta = document.createElement('output');
      delta.dataset.field = 'delta';
      delta.setAttribute('aria-label', 'Delta for ' + record.pomCode);
      difference.append(delta);
      const progressCell = document.createElement('td');
      progressCell.className = 'row-progress';
      const progress = document.createElement('span');
      progressCell.append(progress);
      Object.assign(controls, { delta, progress });
      rowControls.push(controls);
      row.append(code, information, ...numericCells, difference, progressCell);
      body.append(row);
    }
    synchronizeRows();
  }

  function showSession(nextSession) {
    session = structuredClone(nextSession);
    byId('session-name').value = session.name;
    byId('measurement-date').value = session.measurementDate;
    byId('notes').value = session.note || '';
    byId('reference-mode').value = session.referenceMode;
    byId('reference-help').textContent = modeHelp[session.referenceMode];
    renderRows();
    dirty = false;
    updateButtons();
  }

  function newSheet() {
    showSession(createMeasurementSession(template, { name: 'New measurement session', measurementDate: localToday() }));
    byId('saved-sessions').value = '';
    byId('open-session').disabled = true;
    setStatus('New sheet ready. Enter a measurement to see its delta immediately.');
  }

  function collectSession({ requireMeasurement = true } = {}) {
    const valid = synchronizeRows();
    session.name = byId('session-name').value.trim();
    session.measurementDate = byId('measurement-date').value;
    session.note = byId('notes').value;
    if (!valid) {
      const invalid = rowControls.flatMap(control => [control.reference, control.measured]).find(input => !input.checkValidity());
      invalid?.reportValidity();
      throw new Error('Check the highlighted measurement values before continuing.');
    }
    if (!byId('session-details').reportValidity()) throw new Error('Enter a session name and measurement date.');
    if (requireMeasurement) return validateMeasurementSession(session, template);
    return structuredClone(session);
  }

  function setSavedOptions(records) {
    const select = byId('saved-sessions');
    const previous = select.value;
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = records.length ? 'Choose a saved session…' : 'No saved sessions yet';
    select.append(placeholder);
    for (const record of records) {
      const option = document.createElement('option');
      option.value = record.id;
      option.textContent = `${record.name} · ${record.measurementDate} · ${record.measuredCount} entered · ${modeLabels[record.referenceMode] || 'Reference'}`;
      select.append(option);
    }
    select.value = previous;
    byId('open-session').disabled = saving || !select.value;
  }

  async function refreshSaved() {
    let records;
    if (offline) {
      records = readBrowserRecords().map(record => ({
        id: record.id, name: record.session.name, measurementDate: record.session.measurementDate,
        referenceMode: record.session.referenceMode, measuredCount: record.session.measurements.filter(row => row.measured !== null).length,
      }));
    } else {
      const result = await request('/api/sessions');
      records = result.sessions;
    }
    setSavedOptions(records);
  }

  async function saveSession() {
    try {
      const normalized = collectSession();
      saving = true;
      updateButtons();
      let saved;
      if (offline) {
        const records = readBrowserRecords();
        const id = globalThis.crypto?.randomUUID?.() || 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        saved = { id, createdAt: new Date().toISOString(), session: normalized };
        try { localStorage.setItem(storageKey, JSON.stringify([saved, ...records])); }
        catch { throw new Error('Browser storage could not save this session. Download JSON to keep your measurements.'); }
      } else {
        saved = await request('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalized) });
      }
      showSession(normalized);
      setStatus(offline ? 'Saved in this browser on this device. Download JSON as a portable backup.' : 'Saved as a new SQLite session. The approved baseline and earlier sessions are unchanged.', 'success');
      try {
        await refreshSaved();
        byId('saved-sessions').value = saved.id;
        byId('open-session').disabled = false;
      } catch (error) {
        setStatus('The session was saved, but the saved-session list could not refresh. ' + error.message, 'error');
      }
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      saving = false;
      updateButtons();
    }
  }

  async function openSession() {
    try {
      const id = byId('saved-sessions').value;
      if (!id) return;
      if (dirty && !window.confirm('This sheet has unsaved changes. Open the saved session and discard these changes? Save or download a copy first if you want to keep them.')) return;
      const saved = offline ? readBrowserRecords().find(record => record.id === id) : await request('/api/sessions/' + encodeURIComponent(id));
      if (!saved) throw new Error('That saved session was not found.');
      const normalized = validateMeasurementSession(saved.session, template);
      showSession(normalized);
      setStatus('Saved session opened. Changes can be saved as a new session, leaving this record intact.');
    } catch (error) { setStatus(error.message, 'error'); }
  }

  function download(contents, type, extension) {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeName = (session.name || 'measurement-session').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 65) || 'measurement-session';
    anchor.href = url;
    anchor.download = `${safeName}-${session.measurementDate || 'undated'}.${extension}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportSession(format) {
    try {
      const current = collectSession();
      if (format === 'csv') download(sessionToCsv(current), 'text/csv;charset=utf-8', 'csv');
      else download(JSON.stringify(current, null, 2), 'application/json;charset=utf-8', 'json');
      setStatus(format.toUpperCase() + ' downloaded. The download does not replace a saved session.');
    } catch (error) { setStatus(error.message, 'error'); }
  }

  template = offline ? window.__MEASUREMENT_TEMPLATE__ : await request('/api/template');
  if (!template || !Array.isArray(template.measurements) || template.measurements.length !== 20) throw new Error('The original 20-POM template could not be loaded.');
  byId('template-label').textContent = template.formId + ' · ' + template.measurements.length + ' points of measure';
  byId('storage-mode').textContent = offline ? 'Browser storage on this device' : 'Local SQLite on this machine';
  byId('save-help').textContent = offline
    ? 'Browser saves stay on this device and do not sync to SQLite. They can be lost when browser data is cleared, so download JSON for a portable copy. Each save creates a separate session.'
    : 'Saving creates a separate SQLite record. These sessions do not sync to the standalone browser copy. Opening and changing a saved session does not overwrite the earlier one.';
  newSheet();
  for (const id of ['new-sheet', 'download-csv', 'download-json', 'print-sheet']) byId(id).disabled = false;
  byId('session-details').addEventListener('submit', event => event.preventDefault());
  for (const id of ['session-name', 'measurement-date', 'notes']) byId(id).addEventListener('input', markDirty);
  byId('reference-mode').addEventListener('change', () => {
    const mode = byId('reference-mode').value;
    const preset = createMeasurementSession(template, { referenceMode: mode });
    session.referenceMode = mode;
    for (let index = 0; index < session.measurements.length; index++) session.measurements[index].reference = preset.measurements[index].reference;
    byId('reference-help').textContent = modeHelp[mode];
    renderRows();
    markDirty();
    updateButtons();
  });
  byId('save-session').addEventListener('click', saveSession);
  byId('new-sheet').addEventListener('click', () => {
    if (!dirty || window.confirm('This sheet has unsaved changes. Start a blank sheet and discard these changes? Save or download a copy first if you want to keep them.')) newSheet();
  });
  byId('saved-sessions').addEventListener('change', () => { byId('open-session').disabled = !byId('saved-sessions').value; });
  byId('open-session').addEventListener('click', openSession);
  byId('download-csv').addEventListener('click', () => exportSession('csv'));
  byId('download-json').addEventListener('click', () => exportSession('json'));
  byId('print-sheet').addEventListener('click', () => {
    synchronizeRows();
    for (const details of document.querySelectorAll('.measurement-method')) details.open = true;
    window.print();
  });
  window.addEventListener('beforeunload', event => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  try { await refreshSaved(); }
  catch (error) {
    if (offline) storageAvailable = false;
    setStatus(error.message, 'error');
    updateButtons();
  }
  document.documentElement.dataset.ready = 'true';
}

bootstrapGenerator().catch(error => {
  const status = document.getElementById('status');
  status.textContent = 'The generator could not start. ' + error.message;
  status.className = 'status-message error';
});
