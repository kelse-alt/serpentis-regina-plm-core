(() => {
  const search = document.getElementById('search');
  const rows = [...document.querySelectorAll('#measurements tr')];
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const chart = document.getElementById('measurement-chart');
  const count = document.getElementById('count');
  const empty = document.getElementById('empty-state');
  let filter = 'all';

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
  }

  search.addEventListener('input', update);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      filter = button.dataset.filter;
      for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
      update();
    });
  }
  document.getElementById('print-sheet').addEventListener('click', () => window.print());

  // Paper copies include the approval trail and the meaning of missing values.
  const notes = document.querySelector('.record-notes');
  let notesWereOpen = false;
  window.addEventListener('beforeprint', () => {
    notesWereOpen = notes.open;
    notes.open = true;
  });
  window.addEventListener('afterprint', () => {
    notes.open = notesWereOpen;
  });
})();
