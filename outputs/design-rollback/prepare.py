import pathlib,json,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'outputs/design-rollback'
m=json.loads((OUT/'prepared-manifest.json').read_text(encoding='utf8'))
for p in m['conflicts']:
    f=OUT/'prepared'/p;s=f.read_text(encoding='utf8')
    def resolve(match):
        current,restore=match.groups()
        if p in ['app/DESIGN.md','app/PRODUCT.md','app/src/styles/tokens.css']:return current
        if p=='app/src/styles/admin-theme.css':
            keep=re.sub(r'^  --suth-admin-nav(?:-hover|-ink)?:[^\n]*\n','',restore,flags=re.M)
            return keep+current
        if p.endswith('.css'):
            # Keep independently updated brand colors while restoring selectors
            # and declarations removed by the component migration.
            colors={name:val for name,val in re.findall(r'^\s*([\w-]+):\s*([^;\n]+);',current,re.M) if name in ['color','background','background-color','border-color']}
            for name,value in colors.items():
                restore=re.sub(r'(^\s*'+re.escape(name)+r':\s*)[^;\n]+;',lambda a:a[1]+value+';',restore,flags=re.M)
        return restore
    s=re.sub(r'^<<<<<<<[^\n]*\n(.*?)^=======[^\n]*\n(.*?)^>>>>>>>[^\n]*\n',resolve,s,flags=re.M|re.S)
    if p.endswith('alerts.js'):s=s.replace("import {themeToken as tokenColor} from '../styles/theme.js';\n",'')
    f.write_text(s,encoding='utf8',newline='\n')
# Keep the selected warm colors, which precede component standardization.
p=OUT/'prepared/app/src/styles/tokens.css';s=p.read_text(encoding='utf8');current=(ROOT/'app/src/styles/tokens.css').read_text(encoding='utf8')
for name in ['action','action-hover','action-ink','accent','focus','canvas']:
    v=re.search(r'--suth-'+name+r':\s*([^;]+);',current)
    if v:s=re.sub(r'(--suth-'+name+r':\s*)[^;]+;',lambda m:m[1]+v[1]+';',s)
p.write_text(s,encoding='utf8',newline='\n')
# Generated metadata has no runtime behavior; remove only the component-era tokens.
cfg='app/.impeccable/design.json';baseline=subprocess.check_output(['git','show','f387838:'+cfg]);p=OUT/'prepared'/cfg;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(baseline);m['files'].append(cfg)
(OUT/'prepared-manifest.json').write_text(json.dumps(m,indent=2),encoding='utf8')
print('Resolved',len(m['conflicts']),'files')
