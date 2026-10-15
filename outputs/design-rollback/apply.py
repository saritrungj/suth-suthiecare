import pathlib,json,re,shutil,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'outputs/design-rollback'
m=json.loads((OUT/'prepared-manifest.json').read_text(encoding='utf8'))
# Reverse the two direct CSS transformations recorded outside apply_patch.
path='app/src/components/SearchableSelect.css';s=(ROOT/path).read_text(encoding='utf8').replace('z-index: var(--suth-layer-popover, 1600)','z-index: 2147483000');p=OUT/'prepared'/path;p.write_text(s,encoding='utf8',newline='\n');m['files'].append(path)
path='app/src/pages/result/AssessmentResult.css';p=OUT/'prepared'/path;s=p.read_text(encoding='utf8').replace('.suth-evaluation-dialog.swal2-popup','.swal2-popup').replace('.suth-evaluation-dialog ', '').replace('.suth-evaluation-dialog {','.swal2-popup {');p.write_text(s,encoding='utf8',newline='\n')
# Restore the proposal that existed before the component work.
rollout=pathlib.Path('C:/Users/suth-admin/.codex/sessions/2026/10/15/rollout-2026-10-15T11-44-05-01a13ddf-e26f-7f33-8e52-dd209bca5213.jsonl')
for line in rollout.open(encoding='utf8'):
    o=json.loads(line)
    if o.get('timestamp','')>='2026-10-15T04:52:59':break
    s=o.get('payload',{}).get('input','')
    if not isinstance(s,str):continue
    for mt in re.finditer(r'tools\.apply_patch\(',s):
        try:v,_=json.JSONDecoder().raw_decode(s[mt.end():])
        except ValueError:continue
        key='*** Add File: D:/github-clone/suth-suthiecare/docs/design-unification-proposal.md\n'
        if key in v:
            txt=v.split(key)[1].split('*** ')[0];txt='\n'.join(x[1:] for x in txt.splitlines() if x.startswith('+'))+'\n';path='docs/design-unification-proposal.md';p=OUT/'prepared'/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(txt,encoding='utf8',newline='\n');m['files'].append(path)
remove=['app/src/components/ui/index.jsx','app/src/styles/component-system.css','app/src/styles/layout-system.css','app/src/styles/interaction-system.css','app/src/styles/theme.js','app/e2e/component-system.spec.js','app/e2e/interface-consistency.spec.js','app/e2e/responsive-layout.spec.js','app/playwright.interface.config.mjs','app/playwright.interface-regression.config.mjs','app/playwright.responsive.config.mjs','docs/shared-ui-components.md','docs/interface-consistency.md','docs/responsive-layout.md']
# The responsive fixture is now also used by another task's regression suite.
# Keep that dependency, together with the independent changes in the same files.
files=sorted(set(m['files']));changed=[]
for path in files+remove:
    target=(ROOT/path).resolve()
    if not target.is_relative_to(ROOT):raise ValueError('outside workspace '+path)
    if target.exists():
        backup=OUT/'before-rollback'/path;backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,backup)
for path in files:
    target=ROOT/path;prepared=OUT/'prepared'/path
    data=prepared.read_bytes()
    if b'<<<<<<<' in data or b'>>>>>>>' in data:raise ValueError('unresolved '+path)
    if target.read_bytes().replace(b'\r\n',b'\n')!=data.replace(b'\r\n',b'\n'):
        shutil.copy2(prepared,target);changed.append(path)
for path in remove:
    target=ROOT/path
    if target.exists():target.unlink()
(OUT/'applied.json').write_text(json.dumps({'checkpoint':'f387838','changed':changed,'removed':remove,'preservedFixture':'app/e2e/helpers/responsive-fixtures.js'},ensure_ascii=False,indent=2),encoding='utf8')
print('Restored',len(changed),'files; removed',len(remove),'design additions; recovery copy:',OUT/'before-rollback')
