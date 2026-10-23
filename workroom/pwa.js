(() => {
  'use strict';
  const version = document.querySelector('meta[name="workroom-app-version"]')?.content || '';
  const isClientIntake = document.body.dataset.pwaPage === 'client';
  const installed = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  let registration;
  let updateInFlight = false;
  let updateTimer;
  let lastUpdateCheck = 0;

  const dialog = document.createElement('dialog');
  dialog.id = 'pwa-info-dialog';
  dialog.setAttribute('aria-labelledby', 'pwa-info-title');
  dialog.innerHTML = `<div class="pwa-heading"><h2 id="pwa-info-title">Workroom app</h2><button id="pwa-close" type="button" autofocus>Close</button></div>
    <p id="pwa-version"></p><p id="pwa-offline-state" role="status" aria-live="polite">Preparing offline use…</p>
    <div id="pwa-install-steps"><p>Install on iPhone:</p><ol><li>Open this Workroom link in Safari.</li><li>Tap Share, then Add to Home Screen.</li><li>Keep Open as Web App enabled if shown, then tap Add.</li><li>Open the Home Screen icon online once and wait for “Offline ready on this device.”</li></ol></div>
    <p id="pwa-installed-state"></p>
    <p>Drafts and revisions stay in this browser or app on this device. Safari and the Home Screen app may use separate storage. Export pack JSON to transfer the current pack, including images; named revision history stays in its original store.</p>
    <p id="pwa-update-state" role="status" aria-live="polite">The app checks for updates when you are online.</p>
    <button id="pwa-apply-update" type="button" hidden>Save &amp; update app</button>
    ${isClientIntake ? '<p><a href="./">Back to Workroom</a> — save or export your intake before leaving.</p>' : ''}`;
  document.body.append(dialog);
  const byId = id => document.getElementById(id);
  const offlineState = byId('pwa-offline-state');
  const updateState = byId('pwa-update-state');
  const updateButton = byId('pwa-apply-update');
  byId('pwa-version').textContent = `Workroom v${version}`;
  byId('pwa-installed-state').textContent = installed()
    ? 'Opened as an installed app.' : 'After the first successful online preparation, the installed app can open offline.';
  byId('pwa-close').addEventListener('click', () => dialog.close());

  const openButton = document.createElement('button');
  openButton.id = 'pwa-info-open';
  openButton.type = 'button';
  openButton.textContent = 'Install & app info';
  openButton.setAttribute('aria-haspopup', 'dialog');
  (document.querySelector('#export-dialog .export-grid') || document.querySelector('#context-drafts .actions'))?.append(openButton);
  openButton.addEventListener('click', () => {
    byId('export-dialog')?.close();
    dialog.showModal();
    refreshOfflineState();
    checkForUpdate();
  });

  // Match the visible viewport while the iPhone keyboard is open so Save and
  // Export stay reachable. Print and the standalone source HTML are unchanged.
  if (window.visualViewport) {
    let fullHeight = window.innerHeight;
    const fitViewport = () => {
      const viewport = window.visualViewport;
      const editable = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]), textarea, select');
      if (!editable) fullHeight = window.innerHeight;
      const keyboard = Boolean(editable && fullHeight - viewport.height > 120 && viewport.scale <= 1.05);
      document.body.classList.toggle('pwa-keyboard-open', keyboard);
      document.documentElement.style.setProperty('--pwa-viewport-height', `${Math.round(viewport.height)}px`);
    };
    window.visualViewport.addEventListener('resize', fitViewport);
    window.addEventListener('resize', fitViewport);
    document.addEventListener('focusin', fitViewport);
    document.addEventListener('focusout', () => requestAnimationFrame(fitViewport));
    fitViewport();
  }

  function workerInfo(worker) {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('App preparation status is unavailable.')); }, 6000);
      channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
      worker.postMessage({ type:'GET_VERSION' }, [channel.port2]);
    });
  }

  async function refreshOfflineState() {
    const worker = registration?.active || navigator.serviceWorker?.controller;
    if (!worker) return;
    try {
      const info = await workerInfo(worker);
      offlineState.textContent = info.offlineReady ? 'Offline ready on this device'
        : 'Offline files are incomplete. Reconnect and reopen the Workroom link to prepare this device again.';
      if (info.version) byId('pwa-version').textContent = `Workroom v${version} · offline files v${info.version}`;
      offlineState.dataset.ready = String(Boolean(info.offlineReady));
      if (info.buildId) offlineState.dataset.build = info.buildId;
    } catch {
      offlineState.textContent = 'Offline preparation status is unavailable. Keep this app online and reopen App info.';
      offlineState.dataset.ready = 'false';
    }
  }

  function showWaitingUpdate() {
    if (!registration?.waiting || updateInFlight) return;
    updateButton.hidden = false;
    updateState.textContent = isClientIntake
      ? 'An app update is ready. Save or export this intake, then return to Workroom to apply it.'
      : 'An app update is ready. Save & update app saves this pack before reopening the new version.';
    updateButton.disabled = isClientIntake;
  }

  function cancelUpdate(message) {
    clearTimeout(updateTimer);
    updateInFlight = false;
    window.WORKROOM_UPDATES?.cancel?.();
    updateButton.disabled = false;
    updateState.textContent = message;
  }

  updateButton.addEventListener('click', async () => {
    const waiting = registration?.waiting;
    if (!waiting || updateInFlight) return;
    if (!window.WORKROOM_UPDATES?.prepare || isClientIntake) {
      updateState.textContent = 'Save or export this page, then return to Workroom to apply the update.';
      return;
    }
    updateButton.disabled = true;
    updateState.textContent = 'Saving this pack before updating…';
    try {
      const result = await window.WORKROOM_UPDATES.prepare();
      if (!result?.ready) {
        cancelUpdate(result?.message || 'The pack could not be saved. Keep editing and try again.');
        return;
      }
      // Recheck after saving: another window may already have applied it.
      if (registration.waiting !== waiting) {
        cancelUpdate('The available update changed. Keep editing, then check App info again.');
        return;
      }
      updateInFlight = true;
      updateState.textContent = 'Pack saved. Opening the updated app…';
      updateTimer = setTimeout(() => cancelUpdate('The update did not finish. Your saved pack is safe; try again when online.'), 15000);
      waiting.postMessage({ type:'ACTIVATE_UPDATE' });
    } catch {
      cancelUpdate('The pack could not be saved or the update could not start. Keep editing and try again.');
    }
  });

  async function checkForUpdate() {
    if (!registration || !navigator.onLine || Date.now() - lastUpdateCheck < 60000) return;
    lastUpdateCheck = Date.now();
    try { await registration.update(); showWaitingUpdate(); }
    catch { /* Existing verified offline files continue to work. */ }
  }

  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    offlineState.textContent = 'Open the HTTPS Workroom link in Safari to prepare offline use and install the app.';
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateInFlight) {
      clearTimeout(updateTimer);
      location.reload();
    } else refreshOfflineState();
  });
  navigator.serviceWorker.register('./sw.js', { scope:'./', updateViaCache:'none' }).then(async result => {
    registration = result;
    showWaitingUpdate();
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed') { showWaitingUpdate(); refreshOfflineState(); }
        if (installing.state === 'redundant' && !registration.active) {
          offlineState.textContent = 'Offline preparation could not finish. Stay online and reopen this Workroom link to retry.';
          offlineState.dataset.ready = 'false';
        }
      });
    });
    await navigator.serviceWorker.ready;
    await refreshOfflineState();
  }).catch(() => {
    offlineState.textContent = 'Offline preparation could not finish. Check your connection and reopen the HTTPS Workroom link in Safari.';
    offlineState.dataset.ready = 'false';
  });
  window.addEventListener('online', () => { refreshOfflineState(); checkForUpdate(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshOfflineState(); checkForUpdate(); } });
})();
