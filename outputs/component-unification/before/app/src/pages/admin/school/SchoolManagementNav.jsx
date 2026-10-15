import { NavLink } from 'react-router-dom';
import { usePermissions } from '../../../permissions/PermissionsProvider';

export default function SchoolManagementNav() {
  const { schoolAccess: access } = usePermissions();
  return <nav className="sch-management-nav" aria-label="จัดการโรงเรียน">
    {access?.can_view_school && <NavLink to="/admin/school" end>ชั้นปีและห้องเรียน</NavLink>}
    {access?.can_view_school && <NavLink to="/admin/school/teachers">รายชื่อครู</NavLink>}
    {access?.can_view_school && <NavLink to="/admin/school/types">ประเภทครูและนักเรียน</NavLink>}
    {access?.can_manage_staff && <NavLink to="/admin/school/roles">บทบาทและสิทธิ์</NavLink>}
  </nav>;
}
