"""Check local component workflows; optional private workbook stays outside Git.

Default fixtures are invented ZIP/XML workbooks. Reports contain counts and
outcomes only. Browser profiles, exports and filled previews are temporary.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from zipfile import ZipFile, ZIP_DEFLATED
from io import BytesIO
from xml.etree import ElementTree as ET
import argparse, base64, csv, hashlib, json, subprocess
from PIL import Image
from pypdf import PdfReader
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--workbook', type=Path)
parser.add_argument('--output', type=Path, default=Path('/tmp/component-workbook-review'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
checks = []
def require(value, message):
    if not value: raise AssertionError(message)
def checked(name):
    checks.append(name); print(name, flush=True)
def synthetic_workbook():
    stream = BytesIO()
    with ZipFile(stream, 'w', ZIP_DEFLATED) as archive:
        sheets=[]; relations=[]
        for index,count in enumerate([32,11,11,6],1):
            sheets.append(f'<sheet name="EXAMPLE {index}-SPEC" sheetId="{index}" r:id="rId{index}"/>')
            relations.append(f'<Relationship Id="rId{index}" Type="{REL}/worksheet" Target="worksheets/sheet{index}.xml"/>')
            rows=[]
            for row in range(11,11+count):
                cells=''.join(f'<c r="{column}{row}" t="inlineStr"><is><t>{value}</t></is></c>' for column,value in [('A',f'X{index}{row-10:02d}'),('B',f'Invented component {index} POM {row-10}'),('D',f'Invented method {index} point {row-10}: measure the marked seam.')])
                rows.append(f'<row r="{row}">{cells}</row>')
            archive.writestr(f'xl/worksheets/sheet{index}.xml',f'<worksheet xmlns="{NS}"><sheetData>{"".join(rows)}</sheetData></worksheet>')
        archive.writestr('xl/workbook.xml',f'<workbook xmlns="{NS}" xmlns:r="{REL}"><sheets>{"".join(sheets)}</sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels',f'<Relationships xmlns="{PKG}">{"".join(relations)}</Relationships>')
        archive.writestr('_rels/.rels',f'<Relationships xmlns="{PKG}"><Relationship Id="root" Type="{REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        archive.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
    return stream.getvalue()
def workbook_rows(data):
    result=[]
    with ZipFile(BytesIO(data)) as archive:
        shared=[]
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared=[''.join(e.itertext()) for e in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall(f'{{{NS}}}si')]
        relationships={e.get('Id'):e.get('Target') for e in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        for sheet in ET.fromstring(archive.read('xl/workbook.xml')).findall(f'{{{NS}}}sheets/{{{NS}}}sheet'):
            if not sheet.get('name').upper().endswith('-SPEC'): continue
            target=relationships[sheet.get(f'{{{REL}}}id')]
            path=target.lstrip('/') if target.startswith('/') else 'xl/'+target
            xml=ET.fromstring(archive.read(path));cells={}
            for cell in xml.findall(f'.//{{{NS}}}c'):
                value=cell.find(f'{{{NS}}}v'); kind=cell.get('t')
                if kind=='inlineStr': value=''.join(cell.find(f'{{{NS}}}is').itertext())
                elif value is not None: value=shared[int(value.text)] if kind=='s' else value.text
                else: value=None
                cells[cell.get('r')]=value
            rows=[]
            import re
            for address,value in cells.items():
                if address.startswith('A') and re.fullmatch(r'[A-Za-z]+\d+',value or ''):
                    number=address[1:];rows.append({'code':value,'description':cells.get('B'+number) or '', 'method':cells.get('D'+number) or '', 'sourceRow':int(number)})
            if rows: result.append({'name':sheet.get('name'),'path':path,'rows':rows})
    return result
def revise(data, first):
    stream=BytesIO()
    with ZipFile(BytesIO(data)) as original,ZipFile(stream,'w',ZIP_DEFLATED) as changed:
        for member in original.infolist():
            content=original.read(member.filename)
            if member.filename==first['path']:
                root=ET.fromstring(content)
                cell=root.find(f'.//{{{NS}}}c[@r="D{first["rows"][0]["sourceRow"]}"]')
                cell.clear();cell.set('r','D'+str(first['rows'][0]['sourceRow']));cell.set('t','inlineStr')
                ET.SubElement(ET.SubElement(cell,f'{{{NS}}}is'),f'{{{NS}}}t').text='Revised synthetic measuring method for recovery checks.'
                grid=root.find(f'{{{NS}}}sheetData')
                removed=grid.find(f'{{{NS}}}row[@r="{first["rows"][-1]["sourceRow"]}"]')
                grid.remove(removed);content=ET.tostring(root,encoding='utf-8',xml_declaration=True)
            changed.writestr(member.filename,content)
    return stream.getvalue()
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body=(ROOT/'tech-pack.html').read_bytes()
        self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(body)
    def log_message(self,*args): pass
def ready(page,url):
    page.on('dialog',lambda dialog:dialog.accept())
    page.goto(url);page.wait_for_function("()=>document.body.dataset.workroomReady==='true'")
def exported(page,selector='#export-json'):
    if not page.locator('#export-dialog').is_visible(): page.locator('#export-menu-toggle').click()
    with page.expect_download() as pending: page.locator(selector).click()
    data=Path(pending.value.path()).read_bytes();page.locator('#close-export').click();return data
def preview(page,data,name='synthetic-components.xlsx'):
    page.locator('#export-menu-toggle').click()
    page.locator('#workbook-file').set_input_files({'name':name,'mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':data})
    page.wait_for_function("()=>document.querySelector('#workbook-dialog').open||document.querySelector('#status').textContent.startsWith('Workbook import refused:')")
    require(page.locator('#workbook-dialog').is_visible(),page.locator('#status').inner_text())
def apply(page):
    page.locator('#apply-workbook').click();page.locator('#workbook-dialog').wait_for(state='hidden')
def firstrow(page): return page.locator('#sheet-content tr[data-development-row]').first
def fill(page,key,value): firstrow(page).locator(f'input[data-dev-field="{key}"]').fill(str(value))
def add_sample(page,label):
    page.locator('#development-sample-name').fill(label)
    page.locator('#development-sample-round').fill('Synthetic round')
    page.locator('#development-sample-notes').fill('Synthetic independent measurement context')
    page.locator('#add-development-sample').click()
def save(page):
    page.locator('#save-pack').click();page.wait_for_function("()=>document.querySelector('#footer-save-state').textContent.startsWith('Saved locally')")

data=args.workbook.read_bytes() if args.workbook else synthetic_workbook()
expected=workbook_rows(data); total=sum(len(c['rows']) for c in expected)
changed_data=revise(data,expected[0])
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
report={'passed':False,'checks':checks,'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'componentCounts':[len(c['rows']) for c in expected],'sourceWorkbookProvided':bool(args.workbook),'privacy':'Only counts/outcomes are recorded. Imported cells, measurements, files and browser profiles remain local and temporary.'}
try:
    with TemporaryDirectory(prefix='component-browser-') as temporary, sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000})
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        ready(page,url);page.screenshot(path=str(args.output/'blank-workroom.png'))
        preview(page,data);require(page.locator('#workbook-preview .workbook-preview-list li').count()==total,'Import preview omitted POMs.')
        require(not page.evaluate('()=>window.WORKROOM_UPDATES.prepare()').get('ready'),'PWA update accepted an unfinished import review.')
        apply(page)
        imported=json.loads(exported(page));development=imported['development']
        require(imported['unit'] is None and not development['samples'],'Import invented units or samples.')
        require(all(all(row[k] is None for k in ['targetCm','toleranceMinusCm','tolerancePlusCm','proposedDeltaCm']) for component in development['components'] for row in component['rows']),'Import invented working specifications.')
        for component,source in zip(development['components'],expected):
            require(component['name']==source['name'],'Component identity changed.')
            for row,original in zip(component['rows'],source['rows']):
                require(all(row[k]==original[k] for k in ['code','description','method','sourceRow']),'Authored source definition changed.')
        checked('Exact source definitions imported with blank working values and unassigned units')
        page.locator('#pack-unit').select_option('cm');add_sample(page,'Synthetic sample A')
        sample_a=page.locator('#development-sample').input_value()
        fill(page,'targetCm',20);fill(page,'toleranceMinusCm',0.25);fill(page,'tolerancePlusCm',0.5);fill(page,'proposedDeltaCm',-0.25)
        page.locator('#development-side').select_option('front');fill(page,'actualCm',20.5)
        require(firstrow(page).locator('[data-dev-result="deltaCm"]').inner_text()=='+0.5','Actual-minus-target delta is wrong.')
        require('Within' in firstrow(page).locator('[data-dev-result="toleranceStatus"]').inner_text(),'Tolerance boundary is wrong.')
        page.locator('#development-side').select_option('back');fill(page,'actualCm',21)
        require('Outside' in firstrow(page).locator('[data-dev-result="toleranceStatus"]').inner_text(),'Outside tolerance not identified.')
        page.locator('#development-side').select_option('left');fill(page,'actualCm',0)
        add_sample(page,'Synthetic sample B');fill(page,'actualCm',19)
        sample_b=page.locator('#development-sample').input_value()
        page.locator('#development-sample').select_option(sample_a);page.locator('#development-side').select_option('front')
        require(firstrow(page).locator('[data-dev-field="actualCm"]').input_value()=='20.5','Sample/side observations overwrote each other.')
        require(firstrow(page).locator('[data-dev-field="targetCm"]').input_value()=='20','Proposal overwrote working target.')
        checked('Independent sample and side values, explicit tolerances, zero and separate proposals')
        page.locator('#pack-unit').select_option('in');page.locator('#pack-unit').select_option('cm')
        require(firstrow(page).locator('[data-dev-field="targetCm"]').input_value()=='20','Unit round trip changed canonical target.')
        page.locator('#style-unit').select_option('')
        require(page.locator('#pack-unit').input_value()=='cm','Unit could be cleared while measurements exist.')
        save(page);snapshot=json.loads(exported(page));row=snapshot['development']['components'][0]['rows'][0]
        require(row['targetCm']==20 and row['observations'][sample_a]=={'general':None,'front':20.5,'back':21,'left':0,'right':None},'Canonical JSON values changed.')
        page.reload();page.wait_for_function("()=>document.body.dataset.workroomReady==='true'");page.locator('#tab-components').click()
        require(json.loads(exported(page))['development']==snapshot['development'],'Saved component data did not reopen.')
        checked('Save, reload, JSON retention and lossless CM/IN switching')
        # Current gallery remains usable in a component/schema-3 pack.
        photos=[]
        for index,color in enumerate([(16,40,65),(100,30,40)]):
            image=BytesIO();Image.new('RGB',(2,2),color).save(image,format='PNG');photos.append({'name':f'synthetic-{index}.png','mimeType':'image/png','buffer':image.getvalue()})
        page.locator('#pinned-pattern-content input[data-attachment="reference"]').set_input_files(photos)
        page.wait_for_function("()=>document.querySelector('#style-reference-images [data-style-gallery-count]')?.textContent==='1 of 2'")
        page.locator('#style-reference-images [data-gallery-next]').click();gallery=json.loads(exported(page))['attachments']['pattern']['reference']
        require(len(gallery['images'])==2 and gallery['selectedIndex']==1,'Current photo gallery regressed in component packs.')
        require(all(base64.b64decode(item['dataUrl'].split(',')[1])==photos[i]['buffer'] for i,item in enumerate(gallery['images'])),'Original image bytes changed.')
        checked('Pinned style and original gallery images retained in component packs')
        # Reimport exact source then changed source: preserve working values and history.
        preview(page,data);apply(page);require(json.loads(exported(page))['development']['components'][0]['rows'][0]['targetCm']==20,'Same-file reimport lost target.')
        preview(page,changed_data,'synthetic-revised.xlsx');apply(page)
        revised=json.loads(exported(page));rows=revised['development']['components'][0]['rows'];first=rows[0]
        require(first['targetCm']==20 and first['observations'][sample_a]['front']==20.5,'Changed source lost observations.')
        require(first['definitionHistory'][0]['method']==expected[0]['rows'][0]['method'],'Earlier method was not retained.')
        require(rows[-1]['retired'] and rows[-1]['code']==expected[0]['rows'][-1]['code'],'Removed POM was discarded.')
        require(any('Before workbook reimport' in s for s in page.locator('#revision-list option').all_text_contents()),'Complete earlier source recovery revision missing.')
        checked('Same-file and changed-source reimport preserve values, method history, retired rows and recovery revision')
        # JSON reimport creates another copy where needed and retains all data/images.
        page.locator('#export-menu-toggle').click()
        page.locator('#json-file').set_input_files({'name':'synthetic-backup.json','mimeType':'application/json','buffer':json.dumps(revised).encode()})
        page.wait_for_function("()=>document.querySelector('#status').textContent.includes('Imported')")
        page.locator('#tab-components').click()
        restored=json.loads(exported(page));require(restored['development']==revised['development'],'JSON import changed component data.')
        page.locator('#sheet-search').fill('unlikely-search-no-match')
        csv_rows=list(csv.reader(BytesIO(exported(page,'#export-csv')).read().decode().splitlines()))
        start=next(i for i,r in enumerate(csv_rows) if r and r[0]=='Component');head=csv_rows[start];body=csv_rows[start+1:]
        require(len({(r[0],r[1]) for r in body})==total,'CSV omitted filtered or retired POMs.')
        require(any(r[head.index('Side')]=='left' and r[head.index('Actual')]=='0' for r in body),'CSV lost explicit zero observation.')
        page.evaluate('window.print=()=>{}');page.locator('#export-menu-toggle').click();page.locator('#print-scope').select_option('current');page.locator('#print-pack').click()
        require(page.locator('#print-view [data-development-row]').count()==total,'Print omitted component POMs under search.')
        pdf=page.pdf(print_background=True,prefer_css_page_size=True);pdf_text='\n'.join(p.extract_text() or '' for p in PdfReader(BytesIO(pdf)).pages)
        require(all(original['code'] in pdf_text for component in expected for original in component['rows']),'PDF omitted source POMs.')
        checked('JSON import, complete CSV and PDF include every component and all entered observations')
        page.locator('#sheet-search').fill('');page.set_viewport_size({'width':390,'height':844});page.locator('#context-panel').evaluate('(el)=>el.open=false')
        require(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile document overflows.')
        require(page.locator('#save-pack').is_visible() and page.locator('#export-menu-toggle').is_visible(),'Phone save/export controls disappeared.')
        checked('Phone layout keeps save/export reachable without document overflow')
        # Failed storage requires a downloaded acknowledged backup before source replacement.
        no_store=browser.new_context(accept_downloads=True)
        no_store.add_init_script("Object.defineProperty(window,'indexedDB',{get(){throw new Error('Synthetic unavailable storage')}})")
        bp=no_store.new_page();ready(bp,url);preview(bp,data);apply(bp);preview(bp,changed_data)
        bp.locator('#apply-workbook').click();require(bp.locator('#workbook-dialog').is_visible(),'Unavailable recovery storage allowed source replacement.')
        with bp.expect_download() as backup: bp.locator('#download-workbook-backup').click()
        old=json.loads(Path(backup.value.path()).read_text());require(old['development']['source']['sha256']==hashlib.sha256(data).hexdigest(),'Backup lacks the earlier complete raw source.')
        bp.locator('#confirm-workbook-backup').check();apply(bp)
        checked('Unavailable storage reimport requires a complete downloaded backup and explicit acknowledgement')
        # A newer write from another window must not be replaced by this stale draft.
        conflict=context.new_page();ready(conflict,url);conflict.locator('#tab-components').click()
        page.set_viewport_size({'width':1440,'height':1000});page.locator('#tab-components').click()
        fill(page,'targetCm',22);save(page)
        fill(conflict,'targetCm',23);conflict.locator('#save-pack').click()
        conflict.wait_for_function("()=>document.querySelector('#footer-save-state').textContent.startsWith('Conflict')")
        preview(conflict,data);conflict.locator('#apply-workbook').click()
        require('storage conflict' in conflict.locator('#workbook-error').inner_text(),'Conflicted draft replaced workbook source.')
        require(conflict.locator('#workbook-dialog').is_visible(),'Conflicted workbook review closed unexpectedly.')
        conflict.locator('#cancel-workbook').click()
        require(json.loads(exported(conflict))['development']['source']['sha256']==hashlib.sha256(changed_data).hexdigest(),'Conflicted draft lost its earlier raw source.')
        checked('Conflicted drafts refuse replacement of their workbook source')
        require(not errors,'Browser JavaScript errors occurred.')
        report['passed']=True;report['browserErrors']=len(errors);report['totalPOMs']=total;report['pdfPages']=len(PdfReader(BytesIO(pdf)).pages)
        browser.close()
finally:
    server.shutdown();(args.output/'component-workbook.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'checks':len(checks),'POMs':total,'componentCounts':report['componentCounts']}))
