(() => {
  const search = document.getElementById('search');
  const rows = [...document.querySelectorAll('#measurements tr')];
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const chart = document.getElementById('measurement-chart');
  const count = document.getElementById('count');
  const empty = document.getElementById('empty-state');
  const unitSelect = document.getElementById('measurement-unit');
  const unitLabels = [...document.querySelectorAll('[data-unit-label]')];
  const numericValues = [...document.querySelectorAll('[data-value-inches]')].map(element => ({
    element,
    valueInches: Number(element.dataset.valueInches),
    signed: element.dataset.signed === 'true',
  }));
  let filter = 'all';

  function updateUnit() {
    const unit = unitSelect.value;
    for (const { element, valueInches, signed } of numericValues) {
      element.textContent = formatMeasurementInUnit(valueInches, unit, signed);
    }
    for (const label of unitLabels) label.textContent = unit === 'cm' ? '(CM)' : '(IN)';
    document.getElementById('unit-print').textContent = 'UNIT / ' + (unit === 'cm' ? 'CM' : 'INCHES');
    document.getElementById('unit-status').textContent = 'Measurements displayed in ' + (unit === 'cm' ? 'centimeters.' : 'inches.');
  }
  unitSelect.addEventListener('change', updateUnit);
  // Match native form restoration when returning to an already-open report.
  window.addEventListener('pageshow', updateUnit);

  function update() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const row of rows) {
      const show = (filter === 'all' || row.dataset.status === filter) && row.dataset.search.includes(query);
      row.hidden = !show;
      if (show) visible++;
    }
    count.textContent = 'Showing ' + visible + ' of ' + rows.length + ' measurements';
    empty.hidden = visible !== 0;
    chart.scrollTop = 0;
    if (visible === 0) chart.scrollLeft = 0;
  }

  search.addEventListener('input', update);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      filter = button.dataset.filter;
      for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
      update();
    });
  }
  document.getElementById('reset-view').addEventListener('click', () => {
    search.value = '';
    filter = 'all';
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === 'all'));
    update();
    chart.scrollLeft = 0;
    search.focus();
  });
  document.getElementById('print-sheet').addEventListener('click', () => window.print());

  // Inspect the original photographs without changing their source pixels.
  const photoDialog = document.getElementById('photo-dialog');
  const photoOpener = document.getElementById('enlarge-photos');
  const enlargedPhotos = document.getElementById('enlarged-photos');
  for (const figure of document.querySelectorAll('.form-panel .photo-pair figure')) {
    enlargedPhotos.append(figure.cloneNode(true));
  }
  photoOpener.addEventListener('click', () => photoDialog.showModal());
  document.getElementById('close-photos').addEventListener('click', () => photoDialog.close());
  photoDialog.addEventListener('close', () => photoOpener.focus({ preventScroll: true }));

  // Every paper copy contains all POMs in the selected unit, even after a search.
  // Returning from print restores the exact screen view.
  const notes = document.querySelector('.record-notes');
  let printState = null;
  window.addEventListener('beforeprint', () => {
    if (printState) return;
    printState = {
      hiddenRows: rows.map(row => row.hidden),
      countText: count.textContent,
      emptyHidden: empty.hidden,
      notesOpen: notes.open,
      scrollTop: chart.scrollTop,
      scrollLeft: chart.scrollLeft,
    };
    for (const row of rows) row.hidden = false;
    count.textContent = 'Showing ' + rows.length + ' of ' + rows.length + ' measurements';
    empty.hidden = true;
    notes.open = true;
  });
  window.addEventListener('afterprint', () => {
    if (!printState) return;
    const saved = printState;
    printState = null;
    rows.forEach((row, index) => { row.hidden = saved.hiddenRows[index]; });
    count.textContent = saved.countText;
    empty.hidden = saved.emptyHidden;
    notes.open = saved.notesOpen;
    chart.scrollTop = saved.scrollTop;
    chart.scrollLeft = saved.scrollLeft;
  });
})();
