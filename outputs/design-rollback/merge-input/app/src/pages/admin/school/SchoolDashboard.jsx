import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {FiUsers,FiGrid,FiBookOpen,FiArrowRight} from 'react-icons/fi';
import api from '../../../services/api';
import {usePermissions} from '../../../permissions/PermissionsProvider';
import {usePageExport} from '../../../components/ExcelExport';
import FormChartWorkspace from '../../../components/FormChartWorkspace';
import {getCurrentMonthDateRange} from '../../../utils/caseDateFilter';
import {PageHeader,TableScroll} from './schoolUi';
import './school.css';
import './schoolDashboard.css';
export default function SchoolDashboard(){
 const {schoolAccess,activeOrganization,can}=usePermissions();
 const [data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [range,setRange]=useState(getCurrentMonthDateRange);
 usePageExport({title:'ภาพรวมโรงเรียน',sources:[{resource:'schools'},{resource:'students'}]});
 useEffect(()=>{let alive=true;setData(null);setError('');Promise.all([api.get('/school/schools'),api.get('/school/students',{params:{limit:1}})]).then(([schools,students])=>{if(alive)setData({schools:schools.data,students:students.data});}).catch(e=>{if(alive)setError(e.response?.data?.message||'โหลดภาพรวมไม่สำเร็จ');});return()=>{alive=false;};},[activeOrganization,retry]);
 const total=key=>data?.schools.reduce((n,s)=>n+Number(s[key]||0),0)||0;
 return <div className="sch-wrapper"><main className="sch-page school-dashboard"><PageHeader title="ภาพรวมโรงเรียน" description="ติดตามข้อมูลนักเรียนและสร้างรายงานจากแบบฟอร์มในขอบเขตที่รับผิดชอบ"/>
 {error&&<div className="sch-error" role="alert">{error} <button className="sch-btn" onClick={()=>setRetry(n=>n+1)}>ลองอีกครั้ง</button></div>}
 {!data&&!error&&<p role="status">กำลังโหลดภาพรวมโรงเรียน…</p>}
 {data&&<><section className="school-overview" aria-label="สรุปข้อมูลโรงเรียน"><div><FiUsers/><span>นักเรียนในขอบเขตสิทธิ์</span><strong>{Number(data.students.pagination?.total||0).toLocaleString('th-TH')} <small>คน</small></strong></div><div><FiGrid/><span>ห้องเรียน</span><strong>{total('classroom_count').toLocaleString('th-TH')} <small>ห้อง</small></strong></div><div><FiBookOpen/><span>ครู</span><strong>{total('teacher_count').toLocaleString('th-TH')} <small>คน</small></strong></div></section>
 <nav className="school-dashboard-links" aria-label="งานในโรงเรียน"><Link to="/admin/school/students">รายชื่อนักเรียน <FiArrowRight/></Link>{schoolAccess?.can_view_health&&<Link to="/admin/cases">ผลประเมินและประวัติการดูแล <FiArrowRight/></Link>}</nav></>}
 {can('dashboard.view')&&<><section className="school-report-filters" aria-label="ช่วงเวลารายงาน"><div><h2>รายงานแบบฟอร์ม</h2><p>ปรับช่วงเวลาเพื่ออัปเดตทุกกราฟพร้อมกัน</p></div><label>ตั้งแต่วันที่<input type="date" value={range.startDate} max={range.endDate||undefined} onChange={e=>setRange({...range,startDate:e.target.value})}/></label><label>ถึงวันที่<input type="date" value={range.endDate} min={range.startDate||undefined} onChange={e=>setRange({...range,endDate:e.target.value})}/></label><button className="sch-btn sch-btn-secondary" onClick={()=>setRange({startDate:'',endDate:''})}>ทุกช่วงเวลา</button></section><FormChartWorkspace key={activeOrganization} startDate={range.startDate} endDate={range.endDate}/></>}
 {data&&<section className="school-directory"><h2>โรงเรียนในความรับผิดชอบ <span>{data.schools.length} แห่ง</span></h2><TableScroll label="ข้อมูลโรงเรียน"><table className="sch-table"><thead><tr><th>โรงเรียน</th><th>ห้องเรียน</th><th>ครู</th></tr></thead><tbody>{data.schools.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.classroom_count}</td><td>{s.teacher_count}</td></tr>)}{!data.schools.length&&<tr><td colSpan={3}>ยังไม่มีโรงเรียนในขอบเขตสิทธิ์</td></tr>}</tbody></table></TableScroll></section>}
 </main></div>;
}
