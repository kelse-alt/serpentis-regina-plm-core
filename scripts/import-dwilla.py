#!/usr/bin/env python3
"""Read-only DWILLA OOXML importer. Python standard library; no Excel execution.

All extracted content is private, including labels, values and fit attendees.
Use a new revision for any changed source; output files are exclusive-created.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
GROUPS = [
    ('main', 'MESH-SPEC', [f'M{i:02}' for i in range(1, 33)]),
    ('cutout', 'CUT-OUT MESH-SPEC', [f'CF{i:02}' for i in range(1, 6)] + [f'CB{i:02}' for i in range(1, 6)] + ['C11']),
    ('silkShell', 'SILK-SPEC', [f'S{i:02}' for i in range(1, 12)]),
    ('skirt', 'SILK SKIRT-SPEC', [f'K{i:02}' for i in range(1, 7)]),
]


def read_workbook(path):
    with zipfile.ZipFile(path) as z:
        if len(z.infolist()) > 2000 or sum(i.file_size for i in z.infolist()) > 50_000_000:
            raise ValueError('Workbook exceeds safe import limits')
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(e.text or '' for e in si.iterfind('.//m:t', NS))
                       for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        rels = {r.get('Id'): r for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets = {}
        for s in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS):
            rel = rels[s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            if rel.get('TargetMode') == 'External':
                raise ValueError('External worksheet refused')
            target = rel.get('Target')
            member = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            if '..' in PurePosixPath(member).parts:
                raise ValueError('Unsafe worksheet path')
            cells = {}
            shared_formulas = {}
            for c in ET.fromstring(z.read(member)).findall('.//m:sheetData/m:row/m:c', NS):
                value = c.find('m:v', NS)
                kind = c.get('t', 'n')
                raw = value.text if value is not None else None
                if kind == 's' and raw is not None:
                    raw = strings[int(raw)]
                elif kind == 'inlineStr':
                    raw = ''.join(t.text or '' for t in c.findall('.//m:t', NS))
                formula = c.find('m:f', NS)
                if formula is not None and formula.get('t') == 'shared' and formula.text:
                    shared_formulas[formula.get('si')] = {'originCell': c.get('r'), 'expression': formula.text}
                cells[c.get('r')] = {'raw': raw, 'type': kind, 'style': c.get('s'),
                                     'formula': formula.text if formula is not None else None,
                                     'formulaAttributes': dict(formula.attrib) if formula is not None else None}
            for c in cells.values():
                attributes = c['formulaAttributes']
                if attributes is not None and attributes.get('t') == 'shared':
                    if attributes.get('si') not in shared_formulas:
                        raise ValueError('Shared formula has no origin')
                    c['sharedFormula'] = shared_formulas[attributes['si']]
            sheets[s.get('name')] = cells
        return sheets


def extract(path, revision):
    sheets = read_workbook(path)
    def cell(sheet, address):
        return {'sheet': sheet, 'cell': address, **sheets[sheet].get(address, {'raw': None, 'type': None, 'style': None, 'formula': None, 'formulaAttributes': None})}
    def text(sheet, address):
        c = cell(sheet, address)
        if not isinstance(c['raw'], str) or not c['raw'].strip() or c['formulaAttributes'] is not None:
            raise ValueError(f'Missing literal definition: {sheet}!{address}')
        return c['raw']
    definitions = []
    for group, sheet, codes in GROUPS:
        if text(sheet, 'C3') != 'SR-001':
            raise ValueError('Style identity mismatch')
        actual = [v['raw'] for a, v in sheets[sheet].items()
                  if re.fullmatch(r'A\d+', a) and isinstance(v['raw'], str)
                  and re.fullmatch(r'[A-Z]+\d+', v['raw'])]
        if actual != codes:
            raise ValueError(f'Code order/count mismatch: {sheet}')
        for row, code in enumerate(codes, 11):
            if text(sheet, f'A{row}') != code:
                raise ValueError(f'Unexpected code at {sheet}!A{row}')
            label, method = text(sheet, f'B{row}'), text(sheet, f'D{row}')
            definitions.append({
                'pomCode': code, 'group': group, 'description': label, 'howToMeasure': method,
                'source': {'sheet': sheet, 'row': row, 'codeCell': f'A{row}', 'descriptionCell': f'B{row}', 'methodCell': f'D{row}'},
                'unit': None, 'target': None, 'tolerance': None,
                'landmarkReferences': [], 'landmarkStatus': 'requires-review',
                'sourceFields': {col: cell(sheet, f'{col}{row}') for col in 'EFGHIJKLMNO'},
                'reviewRequired': True,
            })
    ref = 'BODY REF-MANNEQUIN-SIZE 8-V1'
    reference = []
    for row in range(32, 52):
        code = text(ref, f'A{row}')
        if code != f'BF-{row-31:02}':
            raise ValueError('Fit-form sequence mismatch')
        reference.append({'pomCode': code, 'description': text(ref, f'C{row}'),
                          'howToMeasure': text(ref, f'D{row}'),
                          'sourceFields': {col: cell(ref, f'{col}{row}') for col in 'EFGHIJKL'}})
    return {'schemaVersion': 1, 'dictionaryVersion': revision, 'styleId': 'SR-001',
            'sourceSha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(),
            'approval': 'unapproved-source-import', 'definitions': definitions,
            'fitFormReference': {'referenceId': 'SR-FORM-001', 'approval': 'source-pending-verification', 'measurements': reference},
            # Preserve every existing cell, including unassigned master examples and fit notes.
            # These cells are NOT automatically promoted to garment targets or approvals.
            'sourceSheets': sheets,
            'warnings': ['Garment units require confirmation; inch landmarks do not establish a unit.',
                         'E/ F/ G and K:O source headings are ambiguous; no tolerance or actual mapping inferred.',
                         'Literal None remains text; formulas retain expressions and cached values without execution.',
                         'Master-sheet example values have no POM codes and are not garment specifications.',
                         'Source fit notes do not prove a fitting occurred or approve sample progression.']}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('workbook', type=Path)
    p.add_argument('--revision', required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', a.revision):
        p.error('Use a short revision identifier')
    root = Path(__file__).resolve().parents[1]
    out = a.output.resolve()
    # Only the ignored private import directory is supported inside the repository.
    if root in out.parents and root / 'private' not in out.parents:
        p.error('Within the checkout, output must be under private/')
    if out == a.workbook.resolve():
        p.error('Never overwrite source')
    data = extract(a.workbook, a.revision)
    out.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write('\n')
    print(json.dumps({'garmentDefinitions': len(data['definitions']), 'fitFormReferences': len(data['fitFormReference']['measurements']), 'revision': a.revision}))


if __name__ == '__main__':
    main()
