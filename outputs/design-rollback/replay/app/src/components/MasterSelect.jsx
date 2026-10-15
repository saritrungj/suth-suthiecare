import SearchableSelect from './SearchableSelect';
import { toDisplayText } from '../utils/textPresentation.js';
import {useEffect,useState} from 'react';
import api from '../services/api';
import {usePermissions} from '../permissions/PermissionsProvider';
const requests=new Map();
export function invalidateMasterOptions(category,organization){
 requests.delete(`${organization}:${category}`);
 window.dispatchEvent(new CustomEvent('master-data:changed',{detail:{category,organization}}));
}
export function useMasterOptions(category,fallback=[]){
 const {activeOrganization}=usePermissions();const [options,setOptions]=useState(null),[revision,setRevision]=useState(0);
 useEffect(()=>{const changed=e=>{if(e.detail?.category===category&&(!e.detail.organization||String(e.detail.organization)===String(activeOrganization))){requests.delete(`${activeOrganization}:${category}`);setRevision(r=>r+1);}};window.addEventListener('master-data:changed',changed);return()=>window.removeEventListener('master-data:changed',changed);},[category,activeOrganization]);
 useEffect(()=>{let alive=true;setOptions(null);if(activeOrganization==='all')return;const key=`${activeOrganization}:${category}`;if(!requests.has(key))requests.set(key,api.get(`/master-data/${category}`,{params:{active:1}}).catch(e=>{requests.delete(key);throw e;}));requests.get(key).then(({data})=>alive&&setOptions(Array.isArray(data)?data:null)).catch(()=>alive&&setOptions(null));return()=>{alive=false;};},[category,activeOrganization,revision]);
 return options||fallback;
}
export default function MasterSelect({category,value,onChange,fallback=[],labelValues=false,allowedCodes,children,...props}){
 const allOptions=useMasterOptions(category,fallback);
 const options=allowedCodes?allOptions.filter(o=>allowedCodes.includes(o.code)):allOptions;
 const values=options.map(o=>labelValues?o.label:o.code);
 return <SearchableSelect {...props} value={value||''} onChange={onChange}>{children}{value&&!values.includes(value)&&<option value={value}>{fallback.find(o=>o.code===value)?.label||value} (ข้อมูลเดิม)</option>}{options.map(o=><option key={o.code} value={labelValues?o.label:o.code}>{toDisplayText(o.label)}</option>)}</SearchableSelect>;
}
