"""Exercise the hosted workroom with real service workers in isolated browsers.

Build reports/workroom-pwa first. Screenshots contain pristine templates only;
synthetic working records live exclusively in temporary browser profiles.
Chromium/WebKit touch and viewport checks are not physical iPhone testing.
"""
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from threading import Thread
from urllib.parse import unquote, urlsplit
import argparse
import hashlib
import json
import mimetypes
import os
import shutil
import socket
import subprocess
import tempfile
import traceback

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCOPE = '/serpentis-regina-plm-core/workroom/'
DATABASE = 'serpentis-regina.workroom.v2'
parser = argparse.ArgumentParser()
parser.add_argument('--build', type=Path, default=ROOT / 'reports/workroom-pwa')
parser.add_argument('--output', type=Path, default=Path('/tmp/workroom-pwa-review'))
parser.add_argument('--engines', default='chromium,webkit')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {
    'capturedAtUtc': datetime.now(timezone.utc).isoformat(),
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'uncommittedChanges': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip()),
    'scope': SCOPE, 'engines': {}, 'issues': [],
    'publicationBoundary': 'Only blank-template screenshots and non-identifying evidence are written. Synthetic records remain in temporary isolated browser profiles.',
    'limits': ['Browser touch/viewport emulation is not physical iPhone testing.',
               'Native Safari Share, Add to Home Screen, iOS keyboard and Home Screen storage separation require device verification.'],
}
deployment = args.build.resolve()
BASE_URL = ''
server_unavailable = False
profile_root = None


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def isolated_context(browser, name, **options):
    if name == 'webkit':
        # Playwright WPE's ephemeral store rejects even a bare IDB Blob put.
        # An isolated on-disk profile supports real original-image persistence.
        directory=tempfile.mkdtemp(prefix='webkit-profile-',dir=profile_root)
        return browser.browser_type.launch_persistent_context(directory,headless=True,**options)
    return browser.new_context(**options)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if server_unavailable:
            self.connection.shutdown(socket.SHUT_RDWR)
            self.connection.close()
            return
        path = unquote(urlsplit(self.path).path)
        if path == '/serpentis-regina-plm-core/':
            body, content_type = b'<!doctype html><title>Portal sentinel</title><h1>Portal sentinel</h1>', 'text/html'
        elif path.startswith(SCOPE):
            relative = path[len(SCOPE):] or 'index.html'
            target = (deployment / relative).resolve()
            if not target.is_relative_to(deployment) or not target.is_file():
                self.send_error(404)
                return
            body = target.read_bytes()
            content_type = 'application/manifest+json' if target.suffix == '.webmanifest' else mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def wait_ready(page):
    page.wait_for_function("() => document.body.dataset.workroomReady === 'true'", timeout=20000)


def poll(page, expression, message, argument=None, attempts=150):
    # Evaluate/await each promise explicitly: this runtime does not await async
    # wait_for_function predicates before testing their truthiness.
    for _ in range(attempts):
        value = page.evaluate(expression, argument)
        if value:
            return value
        page.wait_for_timeout(100)
    raise AssertionError(message)


def registration_state(page):
    return page.evaluate('''async () => {
      const r=await navigator.serviceWorker.getRegistration();
      return r ? {scope:r.scope,active:r.active?.state,waiting:r.waiting?.state,
        installing:r.installing?.state,controller:!!navigator.serviceWorker.controller} : null;
    }''')


def wait_controller(page):
    try:
        return poll(page, '''async () => {
          const r=await navigator.serviceWorker.getRegistration();
          return r?.active?.state==='activated' && !!navigator.serviceWorker.controller;
        }''', 'The scoped service worker did not activate/control the workroom.')
    except AssertionError:
        raise AssertionError('The scoped worker did not control workroom: '+repr(registration_state(page))+
                             '; lifecycle='+str(page.evaluate("sessionStorage.getItem('pwa-audit-worker-events')")))


def worker_version(page):
    return page.evaluate('''async () => {
      const worker=navigator.serviceWorker.controller;
      if(!worker)throw Error('No active worker');
      const channel=new MessageChannel();
      return await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(Error('GET_VERSION timed out')),5000);
        channel.port1.onmessage=event=>{clearTimeout(timeout);resolve(event.data);};
        worker.postMessage({type:'GET_VERSION'},[channel.port2]);
      });
    }''')


def records(page):
    return page.evaluate('''async database => {
      const db=await new Promise((resolve,reject)=>{
        const request=indexedDB.open(database);
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
      try{return await new Promise((resolve,reject)=>{
        const request=db.transaction('drafts','readonly').objectStore('drafts').getAll();
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });}finally{db.close();}
    }''', DATABASE)


def wait_record(page, description):
    for _ in range(150):
        found = next((record for record in records(page) if record['snapshot']['style']['description'] == description), None)
        if found:
            return found
        page.wait_for_timeout(100)
    raise AssertionError('Valid edit was not autosaved into IndexedDB.')


def open_context(page):
    page.locator('#context-panel').evaluate('(el)=>el.open=true')


def close_context(page):
    page.locator('#context-panel').evaluate('(el)=>el.open=false')


def open_info(page):
    if page.locator('#pwa-info-dialog').is_visible():
        return
    page.locator('#export-menu-toggle').click()
    page.locator('#pwa-info-open').click()
    page.wait_for_selector('#pwa-info-dialog[open]')


def close_info(page):
    if page.locator('#pwa-info-dialog').is_visible():
        page.locator('#pwa-close').click()


def pristine(page):
    require(page.locator('#pack-title').input_value() == 'Untitled tech pack', 'Refusing to capture filled pack title.')
    require(page.locator('#saved-packs option').count() == 1, 'Refusing to capture saved pack names.')
    require(page.locator('[data-style-key]').evaluate_all('(els)=>els.every(el=>el.value==="")'), 'Refusing to capture filled style metadata.')
    require(page.locator('#sheet-content [data-field]').evaluate_all('(els)=>els.every(el=>el.value==="")'), 'Refusing to capture filled sheet metadata.')
    require(page.locator('#sheet-content input,#sheet-content textarea').evaluate_all('(els)=>els.every(el=>!el.value)'), 'Refusing to capture filled cells.')
    require(page.locator('#sheet-content .attachment-card img').count() == 0, 'Refusing to capture project images.')


def check_metadata(page):
    metadata = page.evaluate('''async () => {
      const manifestLink=document.querySelector('link[rel=manifest]');
      return {viewport:document.querySelector('meta[name=viewport]')?.content,
        capable:document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content,
        status:document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]')?.content,
        appleIcon:document.querySelector('link[rel=apple-touch-icon]')?.href,
        manifestUrl:manifestLink?.href,
        manifest:manifestLink ? await (await fetch(manifestLink.href)).json() : null};
    }''')
    require(metadata['manifest'], 'No valid linked manifest.')
    require('viewport-fit=cover' in metadata['viewport'], 'Missing safe-area viewport-fit setting.')
    require(metadata['capable'] == 'yes', 'Missing Apple Home Screen capability metadata.')
    require(metadata['status'], 'Missing Apple status bar metadata.')
    manifest = metadata['manifest']
    require(manifest['display'] == 'standalone', 'Manifest must request standalone display.')
    from urllib.parse import urljoin
    require(urljoin(metadata['manifestUrl'], manifest['start_url']) == BASE_URL, 'Manifest start URL escaped canonical workroom path.')
    require(urljoin(metadata['manifestUrl'], manifest['scope']) == BASE_URL, 'Manifest scope escaped workroom path.')
    require(manifest['background_color'].lower() == '#101820', 'Home Screen background changed house Obsidian.')
    icons = []
    for icon in manifest['icons']:
        icon_url = urljoin(metadata['manifestUrl'], icon['src'])
        require(icon_url.startswith(BASE_URL), 'Manifest icon escaped workroom scope.')
        path = deployment / urlsplit(icon_url).path[len(SCOPE):]
        with Image.open(path) as image:
            actual = f'{image.width}x{image.height}'
        require(actual in icon['sizes'].split(), 'Manifest icon declared dimensions differ from PNG.')
        icons.append(actual)
    require({'192x192', '512x512'}.issubset(icons), 'Missing installable 192/512 icons.')
    require(metadata['appleIcon'].startswith(BASE_URL), 'Apple touch icon escaped scope.')
    with Image.open(deployment / urlsplit(metadata['appleIcon']).path[len(SCOPE):]) as icon:
        require(icon.size == (180, 180), 'Apple touch icon is not 180×180.')
    return {'standalone': True, 'scope': SCOPE, 'iconDimensions': icons, 'appleTouchIcon': '180x180'}


def check_layout(page):
    results = []
    for name, width, height in [('iphone',390,844),('narrow-phone',320,568),('landscape',844,390)]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate('''() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))''')
        close_context(page)
        result = page.evaluate('''() => {
          const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
          return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,
            save:rect(document.getElementById('save-pack')),export:rect(document.getElementById('export-menu-toggle')),
            working:rect(document.getElementById('sheet-content')),
            visualViewport:!!window.visualViewport};
        }''')
        require(result['documentWidth'] <= width+1, 'Workroom causes horizontal page overflow at '+name)
        for control in ['save','export']:
            r = result[control]
            require(r['x'] >= -1 and r['right'] <= width+1 and r['y'] >= -1 and r['bottom'] <= height+1,
                    control+' is outside viewport at '+name+': '+repr(result))
            require(r['height'] >= 40 and r['width'] >= 42, control+' target too small at '+name+': '+repr(r))
        require(result['working']['height'] >= 50, 'No usable working-sheet space at '+name)
        results.append({'viewport':name,'width':width,'height':height,'pageOverflow':False,'saveExportReachable':True})
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('''() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))''')
    return results


def fixture_builds(destination):
    """Use the actual distribution builder, leaving repository sources untouched."""
    tree = destination / 'source'
    tree.mkdir()
    for relative in ['package.json','tech-pack.html','client-intake.html']:
        shutil.copy2(ROOT / relative, tree / relative)
    shutil.copytree(ROOT / 'pwa', tree / 'pwa')
    (tree / 'scripts').mkdir()
    shutil.copy2(ROOT / 'scripts/build-workroom-pwa.mjs', tree / 'scripts/build-workroom-pwa.mjs')
    source = tree / 'tech-pack.html'
    source.write_text(source.read_text()+'\n<!-- synthetic update audit shell B -->\n')
    package = json.loads((tree / 'package.json').read_text())
    package['version'] = package['version']+'-audit-b'
    (tree / 'package.json').write_text(json.dumps(package))
    subprocess.run(['node','scripts/build-workroom-pwa.mjs'], cwd=tree, check=True, capture_output=True, text=True)
    return tree / 'reports/workroom-pwa'


def check_keyboard_response(page):
    """Simulate a VisualViewport resize; this does not invoke an iOS keyboard."""
    page.locator('[data-table=specs][data-row="1"][data-col=base]').focus()
    page.evaluate('''() => {
      Object.defineProperty(visualViewport,'height',{configurable:true,value:420});
      visualViewport.dispatchEvent(new Event('resize'));
    }''')
    page.wait_for_function("()=>document.body.classList.contains('pwa-keyboard-open')")
    rects=page.evaluate('''() => Object.fromEntries(['save-pack','export-menu-toggle','sheet-content'].map(id=>{
      const r=document.getElementById(id).getBoundingClientRect();return [id,{top:r.top,bottom:r.bottom,height:r.height}];
    }))''')
    for control in ['save-pack','export-menu-toggle']:
        require(rects[control]['top'] >= 0 and rects[control]['bottom'] <= 421,
                'Simulated keyboard viewport hides '+control+': '+repr(rects))
    require(rects['sheet-content']['height'] >= 40,'Simulated keyboard viewport leaves no working sheet area.')
    page.evaluate('''() => {delete visualViewport.height;document.activeElement.blur();visualViewport.dispatchEvent(new Event('resize'));}''')
    page.wait_for_function("()=>!document.body.classList.contains('pwa-keyboard-open')")
    return {'simulatedVisualViewportHeight':420,'saveExportReachable':True,'nativeKeyboardTested':False}


def check_save_review_race(page):
    # Delay acknowledgement of one real committed IndexedDB transaction. The
    # user changes review details while prepare() awaits durable save completion.
    page.evaluate('''() => {
      const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
      Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...descriptor,set(handler){
        if(this.mode==='readwrite' && this.objectStoreNames.contains('drafts')){
          descriptor.set.call(this,event=>{window.__pwaAuditReleaseCommit=()=>{
            Object.defineProperty(IDBTransaction.prototype,'oncomplete',descriptor);
            handler.call(this,event);
          };});
        }else descriptor.set.call(this,handler);
      }});
      window.WORKROOM_UPDATES.prepare().then(result=>window.__pwaAuditRaceResult=result);
    }''')
    try:
        poll(page,"()=>typeof window.__pwaAuditReleaseCommit==='function'",'Could not hold update save completion for race verification.')
    except AssertionError:
        details=page.evaluate('''()=>({result:window.__pwaAuditRaceResult,
          invalid:document.querySelectorAll('[aria-invalid=true]').length,
          status:document.getElementById('footer-save-state').textContent,
          descriptor:!!Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete')?.set})''')
        raise AssertionError('Could not hold update save completion: '+repr(details))
    page.locator('#revision-name').evaluate("el=>{el.value='Unfinished temporary revision';el.dispatchEvent(new Event('input',{bubbles:true}));}")
    page.evaluate('window.__pwaAuditReleaseCommit()')
    result=poll(page,"()=>window.__pwaAuditRaceResult",'Update prepare did not settle after commit released.')
    require(not result['ready'] and result.get('message'),'Post-save review race allowed reload with unfinished changes.')
    require(not page.locator('.app-shell').evaluate('(el)=>el.inert'),'Rejected post-save review race left UI locked.')
    page.locator('#revision-name').evaluate("el=>{el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));}")


def check_denied_write(page):
    page.evaluate('''() => {
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(...args){
        if(this.name==='drafts')throw new DOMException('Synthetic audit quota denial','QuotaExceededError');
        return original.apply(this,args);
      };
      window.__pwaAuditRestoreWrites=()=>{IDBObjectStore.prototype.put=original;};
    }''')
    open_context(page)
    page.locator('[data-style-key=description]').fill('Temporary unsaved quota audit')
    close_context(page)
    try:
        result=page.evaluate('async()=>await window.WORKROOM_UPDATES.prepare()')
        require(not result['ready'] and result.get('message'),'Failed IndexedDB write permitted update.')
        require(not page.locator('.app-shell').evaluate('(el)=>el.inert'),'Failed write locked workroom.')
        require(page.locator('[data-style-key=description]').input_value() == 'Temporary unsaved quota audit','Failed write discarded on-screen edits.')
        require('Not saved' in page.locator('#footer-save-state').inner_text(),'Failed write falsely displayed saved status.')
    finally:
        page.evaluate('window.__pwaAuditRestoreWrites()')


def exercise_engine(browser, name, second_build):
    global deployment, server_unavailable
    deployment = args.build.resolve()
    evidence = {'browserVersion': browser.version, 'device': '390×844 CSS px; touch emulation; not iPhone hardware', 'checks': {}}
    report['engines'][name] = {'available':True,**evidence}
    context = isolated_context(browser,name,viewport={'width':390,'height':844}, device_scale_factor=3,
                               is_mobile=True, has_touch=True, accept_downloads=True)
    context.add_init_script('''navigator.serviceWorker.addEventListener('controllerchange',()=>{
      const events=JSON.parse(sessionStorage.getItem('pwa-audit-worker-events')||'[]');
      events.push({event:'controllerchange',state:navigator.serviceWorker.controller?.state});
      sessionStorage.setItem('pwa-audit-worker-events',JSON.stringify(events));
    });''')
    errors, external = [], []
    context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
    context.on('request', lambda request: external.append(request.url) if request.url.startswith(('http:','https:')) and not request.url.startswith(BASE_URL.split(SCOPE)[0]) else None)
    page = context.new_page()
    page.goto(BASE_URL,wait_until='load')
    wait_ready(page)
    wait_controller(page)
    first_version = worker_version(page)
    require(first_version.get('offlineReady') is True, 'Active worker did not confirm verified offline shell.')
    evidence['initialVersion'] = first_version
    evidence['checks']['installAndVerifiedPrecache'] = True
    evidence['metadata'] = check_metadata(page)
    evidence['layouts'] = check_layout(page)
    if name == 'chromium':
        pristine(page)
        page.screenshot(path=str(args.output/'workroom-pwa-iphone.png'))
        open_info(page)
        pristine(page)
        page.screenshot(path=str(args.output/'workroom-pwa-install.png'))
        close_info(page)
    # A root/portal page must stay outside the worker's control. Seed an unrelated
    # cache and verify activation/update never purges another site's caches.
    portal = context.new_page()
    portal.goto(BASE_URL.split(SCOPE)[0]+'/serpentis-regina-plm-core/')
    require(portal.locator('h1').inner_text() == 'Portal sentinel', 'Portal root content was replaced.')
    require(not portal.evaluate('!!navigator.serviceWorker.controller'), 'Worker controls portal root outside scope.')
    portal.evaluate("async()=>{const c=await caches.open('portal-unrelated-cache');await c.put('/serpentis-regina-plm-core/sentinel',new Response('preserve'));}")
    portal.close()
    evidence['checks']['portalOutsideWorkerScope'] = True
    cached = page.evaluate('''async () => {
      const result=[];for(const name of await caches.keys()){
        if(name==='portal-unrelated-cache')continue;
        const cache=await caches.open(name);result.push({name,urls:(await cache.keys()).map(r=>r.url)});
      }return result;
    }''')
    require(cached and all(entry['urls'] for entry in cached), 'No precached workroom resources.')
    require(all(url.startswith(BASE_URL) for entry in cached for url in entry['urls']), 'Worker cached resources outside workroom.')
    evidence['cachedShellPaths'] = sorted({urlsplit(url).path for entry in cached for url in entry['urls']})
    require(SCOPE+'client-intake.html' in evidence['cachedShellPaths'], 'Client intake not precached.')
    require(not any('export' in path or 'blob:' in path for path in evidence['cachedShellPaths']), 'User data entered shell cache.')
    evidence['checks']['scopedStaticShellCacheOnly'] = True
    page.evaluate('''async () => {
      for(const name of await caches.keys())if(name.startsWith('serpentis-regina-workroom:')){
        const cache=await caches.open(name);await cache.delete(new URL('./icons/icon-192.png',location.href).href);
      }
    }''')
    require(worker_version(page).get('offlineReady') is True,'Online readiness check did not repair an evicted public icon.')
    evidence['checks']['onlineReadinessRepairsEvictedStaticAsset'] = True
    # Real edits via the UI, then reopen the same persisted pack without network.
    open_context(page)
    page.locator('[data-style-key=number]').fill('AUDIT-ONLY')
    page.locator('[data-style-key=description]').fill('Temporary browser offline audit')
    page.locator('#style-unit').select_option('in')
    saved = wait_record(page,'Temporary browser offline audit')
    pack_id = saved['id']
    close_context(page)
    page.locator('#export-menu-toggle').click()
    page.locator('#new-pack').click()
    open_context(page)
    page.locator('[data-style-key=description]').fill('Temporary second draft')
    wait_record(page,'Temporary second draft')
    page.locator('#saved-packs').select_option(pack_id)
    page.locator('#open-pack').click()
    poll(page,"()=>document.querySelector('[data-style-key=description]').value==='Temporary browser offline audit'",'Could not reopen selected older pack.')
    close_context(page)
    page.locator('#tab-master').click()
    measure = page.locator('[data-table=specs][data-row="1"][data-col=base]')
    evidence['keyboardResponse'] = check_keyboard_response(page)
    measure.fill('24 3/8')
    page.locator('#sheet-search').focus()
    poll(page,'''async ({database,id}) => {
      const db=await new Promise((r,j)=>{const q=indexedDB.open(database);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});
      try{return await new Promise((r,j)=>{const q=db.transaction('drafts').objectStore('drafts').get(id);q.onsuccess=()=>r(q.result?.snapshot.tables.master.specs['1'].base===61.9125);q.onerror=()=>j(q.error)});}finally{db.close();}
    }''','Fractional-inch measurement was not autosaved canonically.',{'database':DATABASE,'id':pack_id})
    def offline(enabled):
        global server_unavailable
        if name == 'webkit':
            # WPE's Playwright offline transport rejects all main-resource
            # navigations internally before consulting the active worker.
            # Closing server connections exercises a genuine network outage.
            server_unavailable=enabled
        else:
            context.set_offline(enabled)
    evidence['networkOutageMethod'] = ('HTTP server refuses all connections; uncached fetch must fail' if name=='webkit' else 'Playwright browser context offline')
    if name=='webkit':
        evidence['engineLimitations']=['Playwright WebKit context.set_offline(true) made navigation fail with an internal browser error; service-worker outage checks instead refuse all HTTP server connections.',
                                      'Playwright WPE ephemeral profiles reject bare IndexedDB Blob writes; this check uses isolated temporary persistent WebKit profiles, where Blob commits succeed.']
    offline(True)
    outage_probe=page.evaluate("async()=>{try{await fetch('./uncached-network-probe.json');return false}catch{return true}}")
    require(outage_probe,'Offline verification did not actually prevent uncached network requests.')
    page.reload(wait_until='load')
    wait_ready(page)
    require(page.locator('[data-style-key=number]').input_value() == 'AUDIT-ONLY', 'Offline reload lost shared style edit.')
    require(page.locator('#saved-packs').input_value() == pack_id, 'Offline reload selected wrong pack.')
    evidence['checks']['selectedOlderPackRetainedOnOfflineReopen'] = True
    close_context(page)
    page.locator('#tab-master').click()
    require(page.locator('[data-table=specs][data-row="1"][data-col=base]').input_value() == '24.375','Offline reopen lost fractional measurement.')
    evidence['checks']['offlineWorkroomReopenWithIndexedDbAutosave'] = True
    intake = context.new_page()
    intake.goto(BASE_URL+'client-intake.html',wait_until='load')
    intake.wait_for_selector('[data-pom="RC-01"]',timeout=20000)
    require(intake.locator('[data-pom]').count() == 34, 'Offline client intake lost original34POM rows.')
    require(intake.locator('input[data-field=measurement]').count() == 34,'Offline intake inputs unavailable.')
    intake.close()
    evidence['checks']['offlineClientIntake34Poms'] = True
    # No catch-all fallback may turn a missing file or portal URL into workroom.
    offline_unknown = page.evaluate("async()=>{try{const r=await fetch('./unknown-file.json');return {ok:r.ok,text:(await r.text()).slice(0,100)}}catch{return {networkFailure:true}}}")
    require(offline_unknown.get('networkFailure') or not offline_unknown.get('ok'), 'Unknown offline path received shell fallback.')
    offline(False)
    evidence['checks']['unknownPathsHaveNoAppFallback'] = True
    # Install an actual separately built shell. It must wait, preserving dirty UI.
    deployment = second_build
    page.evaluate("window.__pwaAuditPageToken='unchanged';window.__pwaAuditReloads=0")
    page.evaluate('async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();}')
    poll(page,'''async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.waiting?.state==='installed';}''', 'Updated worker never reached waiting state.')
    require(page.evaluate('window.__pwaAuditPageToken') == 'unchanged', 'Worker update reloaded an active page automatically.')
    require(worker_version(page)['buildId'] == first_version['buildId'],'Waiting update replaced active worker before user action.')
    evidence['checks']['newShellWaitsWithoutAutomaticReload'] = True
    # Pause a real attachment read to exercise the pending-operation guard.
    page.evaluate('''() => {
      const original=FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL=function(file){
        window.__pwaAuditFinishUpload=()=>{FileReader.prototype.readAsDataURL=original;original.call(this,file);};
      };
    }''')
    image_bytes=BytesIO()
    Image.new('RGB',(2,2),(16,24,32)).save(image_bytes,format='PNG')
    page.locator('#sheet-content input[type=file]').first.set_input_files({'name':'synthetic-audit.png','mimeType':'image/png','buffer':image_bytes.getvalue()})
    poll(page,"()=>typeof window.__pwaAuditFinishUpload==='function'",'Synthetic pending upload did not start.')
    open_info(page)
    page.locator('#pwa-apply-update').click()
    poll(page,"()=>document.getElementById('pwa-update-state').textContent.includes('operation')",'Pending file operation did not explain blocked update.')
    require(registration_state(page).get('waiting') == 'installed','Pending file update activated waiting worker.')
    require(page.evaluate('window.__pwaAuditPageToken') == 'unchanged','Pending file update caused reload.')
    close_info(page)
    page.evaluate('window.__pwaAuditFinishUpload()')
    page.wait_for_selector('#sheet-content .attachment-card img',state='attached')
    evidence['checks']['pendingFileOperationBlocksUpdate'] = True
    invalid = page.locator('[data-table=specs][data-row="1"][data-col=base]')
    invalid.fill('invalid value')
    open_info(page)
    poll(page,"()=>!document.getElementById('pwa-apply-update').hidden",'Waiting update not exposed for explicit application.')
    page.locator('#pwa-apply-update').click()
    require(page.evaluate('window.__pwaAuditPageToken') == 'unchanged','Invalid input was discarded by update reload.')
    require(registration_state(page).get('waiting') == 'installed','Invalid update activated waiting worker.')
    require(worker_version(page)['buildId'] == first_version['buildId'],'Invalid entry did not protect old worker.')
    require(page.locator('#pwa-update-state').inner_text().strip(),'Invalid update block offered no explanation.')
    evidence['checks']['explicitUpdateRejectsInvalidEntry'] = True
    close_info(page)
    invalid.fill('25 1/2')
    check_save_review_race(page)
    evidence['checks']['reviewChangedDuringSaveBlocksUpdate'] = True
    check_denied_write(page)
    require(registration_state(page).get('waiting') == 'installed','Failed save activated waiting update.')
    evidence['checks']['failedIndexedDbWriteBlocksUpdateWithoutLosingEdits'] = True
    sibling=context.new_page()
    sibling.goto(BASE_URL,wait_until='load')
    wait_ready(sibling)
    sibling.evaluate("window.__pwaAuditSiblingToken='retained'")
    close_context(sibling)
    sibling.locator('#tab-master').click()
    sibling.locator('[data-table=specs][data-row="1"][data-col=base]').fill('uncommitted invalid sibling edit')
    open_context(page)
    page.locator('[data-style-key=description]').fill('Temporary update guard audit')
    close_context(page)
    open_info(page)
    # Do not wait for autosave: explicit update must flush the current valid edit.
    with page.expect_navigation(wait_until='load',timeout=30000):
        page.locator('#pwa-apply-update').click()
    wait_ready(page)
    wait_controller(page)
    second_version = worker_version(page)
    require(second_version['buildId'] != first_version['buildId'],'Explicit update did not activate new build.')
    require(page.locator('[data-style-key=description]').input_value() == 'Temporary update guard audit','Explicit update lost an unsaved valid edit.')
    close_context(page)
    page.locator('#tab-master').click()
    require(page.locator('[data-table=specs][data-row="1"][data-col=base]').input_value() == '25.5','Explicit update lost latest measurement edit.')
    require(page.locator('#saved-packs').input_value() == pack_id,'Update changed the chosen pack.')
    require(sibling.evaluate('window.__pwaAuditSiblingToken') == 'retained','Updating one window reloaded another window.')
    require(sibling.locator('[data-table=specs][data-row="1"][data-col=base]').input_value() == 'uncommitted invalid sibling edit','Update discarded another window’s active input.')
    sibling.close()
    evidence['checks']['otherOpenWindowIsNeverAutomaticallyReloaded'] = True
    require(page.evaluate("async()=>{const c=await caches.open('portal-unrelated-cache');return (await c.match('/serpentis-regina-plm-core/sentinel'))?.text();}") == 'preserve','Update deleted unrelated portal cache.')
    evidence['checks']['explicitUpdateSavesValidEditsBeforeReload'] = True
    evidence['checks']['unrelatedPortalCachePreservedAfterUpdate'] = True
    evidence['updatedVersion'] = second_version
    offline(True)
    page.reload(wait_until='load')
    wait_ready(page)
    require(page.locator('[data-style-key=description]').input_value() == 'Temporary update guard audit','New shell offline reopen lost stored work.')
    evidence['checks']['updatedShellReopensOffline'] = True
    offline(False)
    require(not errors,'Runtime errors: '+repr(errors))
    require(not external,'Unexpected cross-origin requests: '+repr(external))
    evidence['checks']['noRuntimeErrorsOrExternalFetches'] = True
    context.close()
    deployment = args.build.resolve()
    # Separately verify unavailable IndexedDB blocks prepare rather than falsely
    # treating on-screen work as saved. No waiting worker is required here.
    failure_context = isolated_context(browser,name,viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    failure_context.add_init_script("Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});")
    failure_page = failure_context.new_page()
    failure_page.goto(BASE_URL,wait_until='load')
    wait_ready(failure_page)
    open_context(failure_page)
    failure_page.locator('[data-style-key=number]').fill('UNSAVED-AUDIT')
    bridge = failure_page.evaluate('async()=>await window.WORKROOM_UPDATES.prepare()')
    require(not bridge['ready'] and bridge.get('message'),'Unavailable storage did not block update with guidance.')
    require(failure_page.locator('[data-style-key=number]').input_value() == 'UNSAVED-AUDIT','Unavailable storage discarded on-screen work.')
    require(not failure_page.locator('.app-shell').evaluate('(el)=>el.inert'),'Blocked update left workroom locked.')
    evidence['checks']['unavailableStorageBlocksUpdateWithoutLosingEdits'] = True
    failure_context.close()
    return evidence


def main():
    global BASE_URL, profile_root
    require((args.build/'sw.js').is_file(),'Build reports/workroom-pwa before this check.')
    report['buildFiles'] = {str(path.relative_to(args.build)):hashlib.sha256(path.read_bytes()).hexdigest()
                            for path in sorted(args.build.rglob('*')) if path.is_file()}
    with tempfile.TemporaryDirectory(prefix='serpentis-pwa-browser-') as temporary:
        profile_root=temporary
        second = fixture_builds(Path(temporary))
        server = ThreadingHTTPServer(('127.0.0.1',0),Handler)
        Thread(target=server.serve_forever,daemon=True).start()
        BASE_URL = f'http://127.0.0.1:{server.server_port}'+SCOPE
        try:
            with sync_playwright() as playwright:
                for name in args.engines.split(','):
                    try:
                        engine = getattr(playwright,name)
                        options = {'headless':True}
                        if name == 'chromium':
                            options.update(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
                        browser = engine.launch(**options)
                    except Exception as error:
                        report['engines'][name] = {'available':False,'reason':str(error)}
                        report['issues'].append(name+' browser engine unavailable.')
                        continue
                    try:
                        report['engines'][name] = {'available':True,**exercise_engine(browser,name,second)}
                        print(name+': passed',flush=True)
                    except Exception:
                        report['engines'][name] = {**report['engines'].get(name,{}),'available':True,'failure':traceback.format_exc()}
                        report['issues'].append(name+' browser check failed.')
                        print(report['engines'][name]['failure'],flush=True)
                    finally:
                        browser.close()
        finally:
            server.shutdown()
    report['passed'] = not report['issues'] and bool(report['engines'])
    (args.output/'workroom-pwa.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':report['passed'],'engines':list(report['engines']),'issues':report['issues'],'output':str(args.output)},indent=2))
    if not report['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
