import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('OOXML importer preserves exact cells, all groups, formulas, blanks and fit reference; rejects unsafe revisions', () => {
  const result = spawnSync('python3', ['-c', `
import importlib.util, tempfile, zipfile, json
from pathlib import Path
from xml.sax.saxutils import escape
s=importlib.util.spec_from_file_location('dwilla','scripts/import-dwilla.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
names=[g[1] for g in m.GROUPS]+['BODY REF-MANNEQUIN-SIZE 8-V1']
def cell(a,v): return '<c r="'+a+'" t="inlineStr"><is><t xml:space="preserve">'+escape(v)+'</t></is></c>'
with tempfile.TemporaryDirectory() as td:
 p=Path(td)/'synthetic.xlsx'
 with zipfile.ZipFile(p,'w') as z:
  z.writestr('xl/workbook.xml','<workbook xmlns="'+m.NS['m']+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+''.join('<sheet name="'+escape(n)+'" r:id="r'+str(i)+'"/>' for i,n in enumerate(names))+'</sheets></workbook>')
  z.writestr('xl/_rels/workbook.xml.rels','<Relationships>'+''.join('<Relationship Id="r'+str(i)+'" Target="worksheets/sheet'+str(i)+'.xml"/>' for i in range(5))+'</Relationships>')
  for i,n in enumerate(names):
   rows=[]
   if i<4:
    rows.append('<row>'+cell('C3','SR-001')+'</row>')
    for r,code in enumerate(m.GROUPS[i][2],11):
     rows.append('<row>'+cell('A'+str(r),code)+cell('B'+str(r),' Synthetic label ')+cell('D'+str(r),' Exact method  ')+cell('H'+str(r),'None')+'<c r="E'+str(r)+'"><v>0</v></c><c r="F'+str(r)+'"><f>E'+str(r)+'+1</f><v>1</v></c><c r="I'+str(r)+'"><f t="shared" si="'+str(r)+'" ref="I'+str(r)+':J'+str(r)+'">E'+str(r)+'+1</f></c><c r="J'+str(r)+'"><f t="shared" si="'+str(r)+'"/></c></row>')
   else:
    for r in range(32,52): rows.append('<row>'+cell('A'+str(r),'BF-'+str(r-31).zfill(2))+cell('C'+str(r),'Synthetic reference')+cell('D'+str(r),'Synthetic method')+'</row>')
   z.writestr('xl/worksheets/sheet'+str(i)+'.xml','<worksheet xmlns="'+m.NS['m']+'"><sheetData>'+''.join(rows)+'</sheetData></worksheet>')
 before=p.read_bytes(); d=m.extract(p,'v1'); assert p.read_bytes()==before
 assert len(d['definitions'])==60 and len(d['fitFormReference']['measurements'])==20
 for v in d['definitions']:
  assert v['description']==' Synthetic label ' and v['howToMeasure']==' Exact method  '
  assert v['sourceFields']['E']['raw']=='0' and v['sourceFields']['H']['raw']=='None'
  assert v['sourceFields']['F']['formula'].endswith('+1') and v['sourceFields']['K']['raw'] is None
  assert v['sourceFields']['J']['sharedFormula']['expression'].endswith('+1')
  assert v['sourceFields']['J']['formulaAttributes']['t']=='shared'
  assert v['unit'] is None and v['tolerance'] is None and v['target'] is None
 import subprocess,sys
 out=Path(td)/'private.json'; cmd=[sys.executable,'scripts/import-dwilla.py',str(p),'--revision','v1','--output',str(out)]
 assert subprocess.run(cmd,capture_output=True).returncode==0
 assert subprocess.run(cmd,capture_output=True).returncode!=0
 assert subprocess.run([sys.executable,'scripts/import-dwilla.py',str(p),'--revision','../bad','--output',str(out)],capture_output=True).returncode!=0
 assert p.read_bytes()==before
 print('Synthetic 60+20 exact-cell round-trip passed')
`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /passed/);
});
