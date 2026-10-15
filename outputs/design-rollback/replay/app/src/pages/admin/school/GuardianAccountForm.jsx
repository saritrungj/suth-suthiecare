import { Button as UiButton, TextInput as UiTextInput } from '../../../components/ui/index.jsx';
import SearchableSelect from '../../../components/SearchableSelect';
import { useState } from 'react';
import api from '../../../services/api';
import { SchoolModal } from './schoolUi';

export default function GuardianAccountForm({ data, onClose, onCreated }) {
  const [form, setForm] = useState({ school_id: String(data.schools[0]?.id || ''), username: '', name: '', email: '', password: '', student_ids: [] });
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setForm({ ...form, [key]: event.target.value });
  const save = async event => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError('');
    try {
      const { data: result } = await api.post('/school/guardian-accounts', { ...form, school_id: Number(form.school_id) });
      setForm(old => ({ ...old, password: '' }));
      await onCreated(result); onClose();
    } catch (e) { setError(e.response?.data?.message || 'สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่'); }
    finally { setSaving(false); }
  };
  const students = (data.students || []).filter(s => String(s.school_id) === form.school_id);
  return <SchoolModal title="สร้างบัญชีผู้ปกครอง" subtitle="บัญชีนี้ดูได้เฉพาะนักเรียนในความดูแล และไม่สามารถแก้ไขข้อมูลได้" onClose={() => { if (!saving) onClose(); }} footer={<div className="sch-form-actions"><UiButton variant="secondary" type="button" className="sch-btn sch-btn-secondary" disabled={saving} onClick={onClose}>ยกเลิก</UiButton><UiButton variant="primary" type="submit" form="guardian-account-form" className="sch-btn" disabled={saving || !form.student_ids.length}>{saving ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี'}</UiButton></div>}>
    <form id="guardian-account-form" className="sch-form-grid" onSubmit={save} aria-busy={saving}>
      {error && <p className="sch-error sch-full" role="alert">{error}</p>}
      <label className="sch-field sch-full">โรงเรียน<SearchableSelect required disabled={saving} value={form.school_id} onChange={e => setForm({ ...form, school_id: e.target.value, student_ids: [] })}>{data.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</SearchableSelect></label>
      <label className="sch-field">ชื่อผู้ใช้<UiTextInput required autoComplete="off" minLength={3} maxLength={50} disabled={saving} value={form.username} onChange={set('username')} /></label>
      <label className="sch-field">ชื่อ–นามสกุล<UiTextInput required minLength={2} maxLength={255} disabled={saving} value={form.name} onChange={set('name')} /></label>
      <label className="sch-field">อีเมล<UiTextInput aria-label="อีเมล" aria-describedby="guardian-email-hint" required type="email" maxLength={100} disabled={saving} value={form.email} onChange={set('email')} /><small id="guardian-email-hint" className="sch-field-hint">ใช้ยืนยันตัวตนเมื่อเข้าสู่ระบบ</small></label>
      <label className="sch-field">รหัสผ่าน<UiTextInput aria-label="รหัสผ่าน" aria-describedby="guardian-password-hint" required type="password" autoComplete="new-password" minLength={8} maxLength={200} disabled={saving} value={form.password} onChange={set('password')} /><small id="guardian-password-hint" className="sch-field-hint">อย่างน้อย 8 ตัวอักษร</small></label>
      <fieldset className="sch-full guardian-students-fieldset" disabled={saving}><legend>นักเรียนในความดูแล ({form.student_ids.length} คน)</legend>
        <label className="sch-field">ค้นหารหัสนักเรียน<UiTextInput type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
        {students.filter(s => String(s.student_code).includes(search.trim())).map(s => <label key={s.id} className="guardian-student-option"><input type="checkbox" checked={form.student_ids.includes(s.id)} onChange={e => setForm({ ...form, student_ids: e.target.checked ? [...form.student_ids, s.id] : form.student_ids.filter(id => id !== s.id) })} />รหัสนักเรียน {s.student_code}</label>)}
        {!students.length && <p className="sch-muted">เพิ่มนักเรียนในโรงเรียนก่อนสร้างบัญชีผู้ปกครอง</p>}
      </fieldset>
    </form>
  </SchoolModal>;
}
