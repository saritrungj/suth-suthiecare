import React, { useState, useEffect, useRef } from 'react';
import { getAllClinics, createClinic, updateClinic, deleteClinic, reorderClinics} from '../../../services/api';
import { FaPlus, FaEdit, FaTrash, FaImage, FaCheckCircle, FaTimesCircle, FaGripVertical } from 'react-icons/fa';
import './ClinicManager.css';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MySwal = withReactContent(Swal);

// ============================================================
// ErrorBoundary (เหมือนเดิม)
// ============================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { this.setState({ errorInfo }); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#fee2e2', color: '#991b1b' }}>
          <h2>💥 เกิดข้อผิดพลาด</h2>
          <p>{this.state.error?.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// SortableRow — แถวในตารางที่ลากได้
// ============================================================
function SortableRow({ clinic, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clinic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#f0f9ff' : 'white',
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.12)' : 'none',
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative',
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {/* ปุ่ม Drag Handle */}
      <td className="cm-col-drag">
        <span
          className="cm-drag-handle"
          {...attributes}
          {...listeners}
          title="ลากเพื่อเรียงลำดับ"
        >
          <FaGripVertical />
        </span>
      </td>

      <td className="cm-col-logo">
        {clinic.image
          ? <img src={clinic.image} alt={clinic.name} className="cm-clinic-logo" />
          : <div className="cm-no-logo">ไม่มีรูป</div>
        }
      </td>
      <td className="cm-col-slug"><span className="cm-slug">{clinic.slug}</span></td>
      <td className="cm-col-name cm-name">{clinic.name}</td>
      <td className="cm-col-status">
        {clinic.is_active
          ? <span className="cm-status active"><FaCheckCircle /> เปิดใช้งาน</span>
          : <span className="cm-status inactive"><FaTimesCircle /> ปิดใช้งาน</span>
        }
      </td>
      <td className="cm-col-actions">
        <div className="cm-actions">
          <button className="cm-btn-edit" onClick={() => onEdit(clinic)} title="แก้ไข"><FaEdit /></button>
          <button className="cm-btn-delete" onClick={() => onDelete(clinic.id, clinic.name)} title="ลบ"><FaTrash /></button>
        </div>
      </td>
    </tr>
  );
}

// ============================================================
// ClinicManagerContent — Main Component
// ============================================================
function ClinicManagerContent() {
  const [clinics, setClinics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState(null);

  const [formData, setFormData] = useState({
    slug: '', name: '', name_en: '', description: '',
    image: '', bg: '', is_active: 1, show_icon: 1
  });

  const logoInputRef = useRef(null);
  const bgInputRef = useRef(null);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // ต้องลากอย่างน้อย 5px ถึงจะ activate
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchClinics = async () => {
    setIsLoading(true);
    try {
      const res = await getAllClinics();
      // sort ตาม sort_order ถ้ามี
      const data = (res.data?.data || []).sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id));
      setClinics(data);
    } catch (err) {
      console.error('Error fetching clinics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchClinics(); }, []);

  // ============ Drag End Handler ============
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = clinics.findIndex(c => c.id === active.id);
    const newIndex = clinics.findIndex(c => c.id === over.id);
    const newOrder = arrayMove(clinics, oldIndex, newIndex);

    // Optimistic update UI ก่อน
    setClinics(newOrder);

    // บันทึกลง DB
    setIsReordering(true);
    try {
      const orderPayload = newOrder.map((c, index) => ({
        id: c.id,
        sort_order: index,
      }));
      await reorderClinics(orderPayload);

      MySwal.fire({
        icon: 'success',
        title: 'บันทึกลำดับแล้ว',
        timer: 1200,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } catch (err) {
      console.error('Reorder failed:', err);
      // Rollback
      fetchClinics();
      MySwal.fire({ icon: 'error', title: 'ไม่สามารถบันทึกลำดับได้' });
    } finally {
      setIsReordering(false);
    }
  };

  // ============ Modal Handlers (เหมือนเดิม) ============
  const handleOpenModal = (clinic = null) => {
    if (clinic) {
      setEditingClinic(clinic);
      setFormData({
        slug: clinic.slug || '', name: clinic.name || '', name_en: clinic.name_en || '',
        description: clinic.description || '', image: clinic.image || '',
        bg: clinic.bg || '', is_active: clinic.is_active ?? 1, show_icon: clinic.show_icon ?? 1
      });
    } else {
      setEditingClinic(null);
      setFormData({ slug: '', name: '', name_en: '', description: '', image: '', bg: '', is_active: 1, show_icon: 1 });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setEditingClinic(null); };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 1 : 0) : value }));
  };

  const compressImage = (file, maxWidth = 1024, quality = 0.8) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
      };
    });
  };

  const handleFileChange = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    MySwal.fire({ title: 'กำลังเตรียมรูปภาพ...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });
    try {
      const maxWidth = field === 'bg' ? 1920 : 500;
      const quality = field === 'bg' ? 0.8 : 0.9;
      const compressed = await compressImage(file, maxWidth, quality);
      setFormData(prev => ({ ...prev, [field]: compressed }));
      MySwal.close();
    } catch (err) {
      MySwal.fire('ข้อผิดพลาด', 'ไม่สามารถประมวลผลรูปภาพได้', 'error');
    }
    if (e.target) e.target.value = null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.slug || !formData.name) {
      MySwal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'กรุณากรอกรหัสอ้างอิงและชื่อคลินิก' });
      return;
    }
    setIsSaving(true);
    try {
      if (editingClinic) {
        await updateClinic(editingClinic.id, formData);
        setClinics(prev => prev.map(c => c.id === editingClinic.id ? { ...c, ...formData } : c));
        MySwal.fire({ icon: 'success', title: 'สำเร็จ', text: 'อัปเดตข้อมูลคลินิกเรียบร้อย', timer: 1500, showConfirmButton: false });
      } else {
        const res = await createClinic(formData);
        setClinics(prev => [...prev, { ...formData, id: res.data?.id || Date.now(), sort_order: prev.length }]);
        MySwal.fire({ icon: 'success', title: 'สำเร็จ', text: 'เพิ่มคลินิกเรียบร้อย', timer: 1500, showConfirmButton: false });
      }
      handleCloseModal();
      fetchClinics();
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: err?.response?.data?.error || 'ไม่สามารถบันทึกข้อมูลได้' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const result = await MySwal.fire({
      title: 'ยืนยันการลบ?', text: `คุณต้องการลบคลินิก "${name}" ใช่หรือไม่?`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
    });
    if (result.isConfirmed) {
      MySwal.fire({ title: 'กำลังลบข้อมูล...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });
      try {
        await deleteClinic(id);
        setClinics(prev => prev.filter(c => c.id !== id));
        MySwal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
        fetchClinics();
      } catch (err) {
        MySwal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'ไม่สามารถลบคลินิกได้' });
      }
    }
  };
  
  return (
    <div className="cm-admin-page">
<main className="cm-main">
        <header className="cm-header">
          <div className="cm-header-info">
            <h1>จัดการคลินิก</h1>
            {/* hint text */}
            <p className="cm-header-hint">
              ลากแถวเพื่อเรียงลำดับคลินิก — ลำดับจะแสดงผลบนหน้าเว็บทันที
            </p>
          </div>
          <button className="cm-btn-add" onClick={() => handleOpenModal()}>
            <FaPlus /> เพิ่มคลินิกใหม่
          </button>
        </header>

        {isLoading ? (
          <div className="cm-loading-state">
            <div className="cm-loading-spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="cm-table-container">
            {isReordering && (
              <div className="cm-reorder-saving">
                <span>💾 กำลังบันทึกลำดับ...</span>
              </div>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="cm-table">
                <thead>
                  <tr>
                    <th className="cm-col-drag"></th>
                    <th className="cm-col-logo">โลโก้</th>
                    <th className="cm-col-slug">รหัสอ้างอิง (Slug)</th>
                    <th className="cm-col-name">ชื่อคลินิก</th>
                    <th className="cm-col-status">สถานะ</th>
                    <th className="cm-col-actions">จัดการ</th>
                  </tr>
                </thead>
                <SortableContext
                  items={clinics.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody>
                    {clinics.length > 0 ? clinics.map(clinic => (
                      <SortableRow
                        key={clinic.id}
                        clinic={clinic}
                        onEdit={handleOpenModal}
                        onDelete={handleDelete}
                      />
                    )) : (
                      <tr>
                        <td colSpan="6" className="cm-empty">ไม่พบข้อมูลคลินิก</td>
                      </tr>
                    )}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </div>
        )}

        {/* Modal (เหมือนเดิมทุกอย่าง) */}
        {isModalOpen && (
          <div className="cm-modal-overlay">
            <div className="cm-modal-content">
              <button className="cm-close-btn-custom" onClick={handleCloseModal} aria-label="Close">
                <span className="cm-close-cross"></span>
              </button>
              <h2>{editingClinic ? 'แก้ไขคลินิก' : 'เพิ่มคลินิกใหม่'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="cm-form-group">
                  <label>รหัสอ้างอิง (Slug) <span className="cm-required">*</span></label>
                  <input type="text" name="slug" value={formData.slug} onChange={handleChange} placeholder="เช่น teenager, general" required disabled={!!editingClinic} />
                  <small>ใช้เชื่อมโยงกับฟอร์มและระบบ (ห้ามซ้ำและแก้ไขไม่ได้หลังจากสร้าง)</small>
                </div>
                <div className="cm-form-group">
                  <label>ชื่อคลินิก (ภาษาไทย) <span className="cm-required">*</span></label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="เช่น คลินิกวัยรุ่น" required />
                </div>
                <div className="cm-form-group">
                  <label>ชื่อคลินิก (English)</label>
                  <input type="text" name="name_en" value={formData.name_en} onChange={handleChange} placeholder="e.g. Teenager Clinic" />
                </div>
                <div className="cm-form-group">
                  <label>รายละเอียด</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} rows="3"></textarea>
                </div>
                <div className="cm-form-row">
                  <div className="cm-form-group">
                    <label>รูปภาพโลโก้ (ไอคอน)</label>
                    <div className="cm-img-preview-box" onClick={() => logoInputRef.current?.click()}>
                      {formData.image ? <img src={formData.image} alt="Logo" /> : <><FaImage size={24} /><span>อัปโหลดโลโก้</span></>}
                    </div>
                    <input type="file" ref={logoInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileChange(e, 'image')} />
                  </div>
                  <div className="cm-form-group">
                    <label>รูปภาพพื้นหลัง (หน้าเว็บ)</label>
                    <div className="cm-img-preview-box cm-bg-premium" onClick={() => bgInputRef.current?.click()}>
                      {formData.bg ? <img src={formData.bg} alt="BG" /> : <><FaImage size={24} /><span>อัปโหลดพื้นหลัง</span></>}
                    </div>
                    <input type="file" ref={bgInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileChange(e, 'bg')} />
                  </div>
                </div>
                <div className="cm-form-group cm-toggle-group">
                  <label className="cm-toggle">
                    <input type="checkbox" name="show_icon" checked={formData.show_icon === 1} onChange={handleChange} />
                    <span className="cm-slider"></span>
                  </label>
                  <span>แสดงไอคอนบนการ์ด</span>
                </div>
                <div className="cm-form-group cm-toggle-group">
                  <label className="cm-toggle">
                    <input type="checkbox" name="is_active" checked={formData.is_active === 1} onChange={handleChange} />
                    <span className="cm-slider"></span>
                  </label>
                  <span>เปิดใช้งานคลินิกนี้</span>
                </div>
                <div className="cm-modal-actions">
                  <button type="button" className="cm-btn-cancel" onClick={handleCloseModal} disabled={isSaving}>ยกเลิก</button>
                  <button type="submit" className="cm-btn-save" disabled={isSaving}>
                    {isSaving ? (editingClinic ? 'กำลังแก้ไข...' : 'กำลังเพิ่ม...') : 'บันทึกข้อมูล'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const ClinicManager = () => <ErrorBoundary><ClinicManagerContent /></ErrorBoundary>;
export default ClinicManager;