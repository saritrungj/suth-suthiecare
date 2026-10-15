const fs=require('node:fs'),path=require('node:path');
const {parse}=require('../../node_modules/.pnpm/@babel+parser@7.29.8/node_modules/@babel/parser');
const root=path.resolve(__dirname,'../..');
const paint=new Set('background backgroundColor backgroundImage color border borderColor borderRadius boxShadow fontSize fontWeight fontFamily lineHeight padding paddingTop paddingBottom paddingLeft paddingRight minHeight height transform'.split(' '));
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.jsx?$/.test(e.name)?[path.join(dir,e.name)]:[]);}
const changed=[];
for(const file of files(path.join(root,'app/src'))){
  let s=fs.readFileSync(file,'utf8'),ast=parse(s,{sourceType:'module',plugins:['jsx']}),edits=[];
  function visit(n){if(!n||typeof n!=='object')return;
    if(n.type==='JSXOpeningElement'&&n.name?.name==='UiButton'){
      const a=n.attributes.find(a=>a.name?.name==='style'),obj=a?.value?.expression;
      if(obj?.type==='ObjectExpression'){
        const keep=obj.properties.filter(p=>!(paint.has(p.key?.name||p.key?.value)&&['StringLiteral','NumericLiteral'].includes(p.value?.type)));
        if(keep.length!==obj.properties.length)edits.push({start:a.start,end:a.end,text:keep.length?'style={{'+keep.map(p=>s.slice(p.start,p.end)).join(', ')+'}}':''});
      }
    }
    for(const[k,v]of Object.entries(n))if(!['loc','comments'].includes(k)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}
  }
  visit(ast);if(!edits.length)continue;
  edits.sort((a,b)=>b.start-a.start).forEach(e=>s=s.slice(0,e.start)+e.text+s.slice(e.end));
  fs.writeFileSync(file,s);changed.push({file:path.relative(root,file),overrides:edits.length});
}
fs.writeFileSync(path.join(__dirname,'inline-cleanup.json'),JSON.stringify(changed,null,2));console.log(JSON.stringify(changed));
