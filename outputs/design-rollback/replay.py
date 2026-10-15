import json, pathlib, re, subprocess, difflib
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs/design-rollback'
SIM=OUT/'replay'
SIM.mkdir(exist_ok=True)
def relpath(p):
    return p.replace('D:/github-clone/suth-suthiecare/','').replace('\\','/')
tree={}
for line in subprocess.check_output(['git','ls-tree','-r','f387838'],cwd=ROOT,text=True).splitlines():
    info,path=line.split('\t',1)
    if path.startswith(('app/src/','app/e2e/','docs/','app/.impeccable/')) or path in ['app/DESIGN.md','app/PRODUCT.md','app/vite.config.mjs','app/playwright.config.mjs']:
        tree[path]=info.split()[2]
        dest=SIM/path;dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(subprocess.check_output(['git','cat-file','blob',tree[path]],cwd=ROOT))
events=[]
for row in json.loads((OUT/'previous-tool-calls.json').read_text(encoding='utf8')):
    s=row['input']
    for m in re.finditer(r'tools\.(apply_patch|exec_command)\(',s):
        pos=m.end();kind=m.group(1)
        if kind=='apply_patch':
            try:val,_=json.JSONDecoder().raw_decode(s[pos:])
            except:continue
            events.append((row['time'],'patch',val))
        else:
            cm=re.match(r'\{\s*cmd:\s*',s[pos:])
            if cm:
                try:val,_=json.JSONDecoder().raw_decode(s[pos+cm.end():])
                except:continue
                for script in re.findall(r'node (outputs/(?:component-unification|interface-consistency)/[\w-]+\.(?:cjs|mjs))',val):
                    events.append((row['time'],'script',script))
                if '$confirmBefore -replace' in val:events.append((row['time'],'colors',''))
changed=set();added=set();errors=[];scriptlogs=[]
def patch_apply(patch):
    lines=patch.splitlines();i=1;writes={};adds=[]
    while i<len(lines):
        line=lines[i]
        mt=re.match(r'\*\*\* (Update|Add|Delete) File: (.*)',line)
        if not mt:i+=1;continue
        kind,path=mt.groups();path=relpath(path);i+=1;chunks=[]
        while i<len(lines) and not lines[i].startswith(('*** Update File:','*** Add File:','*** Delete File:','*** End Patch')):
            chunks.append(lines[i]);i+=1
        if path.startswith(('C:/','/')):continue
        f=SIM/path
        if kind=='Add':
            writes[path]='\n'.join(x[1:] for x in chunks if x.startswith('+'))+'\n';adds.append(path);continue
        if kind=='Delete':writes[path]=None;continue
        if not f.exists():raise ValueError('missing '+path)
        content=f.read_text(encoding='utf8');parts=[];current=[];anchor=None
        for ln in chunks:
            if ln.startswith('@@'):
                if current:parts.append((anchor,current))
                current=[];anchor=ln[3:] if ln.startswith('@@ ') else None
            elif ln=='*** End of File':continue
            else:current.append(ln)
        if current:parts.append((anchor,current))
        cursor=0
        for anchor,chunk in parts:
            old='\n'.join(x[1:] for x in chunk if x[:1] in [' ','-'])
            new='\n'.join(x[1:] for x in chunk if x[:1] in [' ','+'])
            if anchor:
                a=content.find(anchor,cursor)
                if a>=0:cursor=a
            at=content.find(old,cursor)
            if at<0:at=content.find(old)
            if at<0:raise ValueError('context '+path+' '+repr(old[:100]))
            content=content[:at]+new+content[at+len(old):];cursor=at+len(new)
        writes[path]=content
    for path,value in writes.items():
        f=SIM/path;f.parent.mkdir(parents=True,exist_ok=True)
        if value is None:
            if f.exists():f.unlink()
        else:f.write_text(value,encoding='utf8',newline='\n')
        if path.startswith(('app/','docs/','.impeccable')):changed.add(path)
    added.update(adds)
for ts,kind,val in events:
    try:
        if kind=='patch':patch_apply(val)
        elif kind=='script':
            script=SIM/val
            if not script.exists():raise ValueError('script missing '+val)
            source=script.read_text(encoding='utf8')
            if script.name=='clean-button-overrides.cjs':
                source=source.replace("for(const file of files(path.join(root,'app/src'))){", "for(const file of files(path.join(root,'app/src'))){ if(file.includes(path.join('components','ui'))) continue;")
            source=source.replace('../../node_modules/',(ROOT.as_uri() if script.suffix=='.mjs' else ROOT.as_posix())+'/node_modules/')
            script.write_text(source,encoding='utf8')
            before={p.relative_to(SIM).as_posix():p.read_bytes() for p in (SIM/'app/src').rglob('*') if p.is_file()}
            r=subprocess.run(['node',str(script)],cwd=SIM,capture_output=True,text=True,encoding='utf8')
            scriptlogs.append([ts,val,r.returncode,r.stdout[-300:],r.stderr[-700:]])
            if r.returncode:
                scan="const fs=require('fs'),path=require('path'),{parse}=require('"+ROOT.as_posix()+"/node_modules/.pnpm/@babel+parser@7.29.8/node_modules/@babel/parser');function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){let f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(/\\.jsx?$/.test(f))try{parse(fs.readFileSync(f,'utf8'),{sourceType:'module',plugins:['jsx']})}catch(x){console.log(f,x.message)}}}walk('app/src')"
                check=subprocess.run(['node','-e',scan],cwd=SIM,capture_output=True,text=True,encoding='utf8')
                raise ValueError('script failed '+val+' '+r.stderr[-100:]+' '+check.stdout)
            for path,content in before.items():
                if (SIM/path).read_bytes()!=content:changed.add(path)
        elif kind=='colors':
            for f in (SIM/'app/src').rglob('*.jsx'):
                old=f.read_text(encoding='utf8');new=re.sub(r'(confirmButtonColor:\s*)"(?:#ef4444|#dc2626|#d33)"',r'\1"var(--suth-danger)"',old)
                new=re.sub(r'(cancelButtonColor:\s*)"#[0-9a-fA-F]{3,8}"',r'\1"var(--suth-muted)"',new)
                if new!=old:f.write_text(new,encoding='utf8');changed.add(f.relative_to(SIM).as_posix())
    except Exception as e:errors.append([ts,kind,str(e)])
(OUT/'replay-report.json').write_text(json.dumps({'errors':errors,'scripts':scriptlogs,'changed':sorted(changed),'added':sorted(added),'tree':tree},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'events':len(events),'errors':errors,'scripts':scriptlogs,'changed':len(changed)},ensure_ascii=False,indent=2))
