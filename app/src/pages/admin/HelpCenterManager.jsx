import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllClinics,
  getFaqCategories,
  createFaqCategory,
  updateFaqCategory,
  deleteFaqCategory,
  getFaqsAdmin,
  createFaq,
  updateFaq,
  deleteFaq,
  toggleClinicHelpCenter
} from '../../services/api';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFolderPlus, FaCheckCircle, FaTimesCircle, FaSave, FaTimes, FaSlidersH, FaChevronLeft, FaChevronRight, FaGripVertical } from 'react-icons/fa';
import './HelpCenterManager.css';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const MySwal = withReactContent(Swal);

const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub' }, { 'script': 'super' }],
    [{ 'header': [1, 2, 3, false] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link', 'image']
  ],
};

export default function HelpCenterManager() {
  const [faqs, setFaqs] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isClinicModalOpen, setIsClinicModalOpen] = useState(false);
  const [clinicSearchQuery, setClinicSearchQuery] = useState("");

  const [filterClinic, setFilterClinic] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);

  const [catSelectedClinic, setCatSelectedClinic] = useState('');
  const [catNameInput, setCatNameInput] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);

  const [faqForm, setFaqForm] = useState({
    clinic_id: '', category_id: '', question: '', answer: '', is_homepage: 0, status: 'published', display_order: 0
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [draggedFaqIndex, setDraggedFaqIndex] = useState(null);
  const [draggedCatIndex, setDraggedCatIndex] = useState(null);
  const [homepageFaqCount, setHomepageFaqCount] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [filterClinic, filterStatus, searchQuery]);

  useEffect(() => {
    if (catSelectedClinic) {
      fetchCategoriesForForm(catSelectedClinic);
    } else {
      setCategories([]);
    }
    setCatNameInput('');
    setEditingCatId(null);
  }, [catSelectedClinic]);

  useEffect(() => {
    setCurrentPage(1);
  }, [faqs]);

 
  const fetchFaqs = async () => {
    try {
      const res = await getFaqsAdmin({ clinic_id: filterClinic, status: filterStatus, search: searchQuery });
      const faqData = res.data?.data || [];
      setFaqs(faqData);
      const resAll = await getFaqsAdmin({});
      const allData = resAll.data?.data || [];
      setHomepageFaqCount(allData.filter(faq => faq.is_homepage === 1 || faq.is_homepage === true || String(faq.is_homepage) === "1").length);

    } catch (err) {
      console.error("Error fetching FAQs and homepage count:", err);
    }
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const cachedClinics = localStorage.getItem('suth_all_clinics_admin');
      if (cachedClinics) {
        setClinics(JSON.parse(cachedClinics));
      }

      const [resClinic, resFaq] = await Promise.all([
        getAllClinics(),
        getFaqsAdmin({ clinic_id: filterClinic, status: filterStatus, search: searchQuery })
      ]);

      const freshClinics = resClinic.data?.data || [];
      const faqData = resFaq.data?.data || [];

      setClinics(freshClinics);
      localStorage.setItem('suth_all_clinics_admin', JSON.stringify(freshClinics));
      setFaqs(faqData);
      setHomepageFaqCount(faqData.filter(faq => faq.is_homepage === 1).length);
    } catch (err) {
      console.error("Error loading initial data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategoriesForForm = async (clinicId) => {
    try {
      const res = await getFaqCategories(clinicId);
      setCategories(res.data?.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const formatThaiDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleOpenCatModal = () => {
    setCatSelectedClinic('');
    setCatNameInput('');
    setEditingCatId(null);
    setCategories([]);
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catSelectedClinic || !catNameInput.trim()) return;

    try {
      if (editingCatId) {
        const currentCat = categories.find(c => c.id === editingCatId);
        await updateFaqCategory(editingCatId, {
          category_name: catNameInput,
          clinic_id: catSelectedClinic,
          display_order: currentCat ? (currentCat.display_order || 0) : 0,
          status: currentCat ? (currentCat.status || 'published') : 'published'
        });
        MySwal.fire({ icon: 'success', title: 'สำเร็จ', text: 'อัปเดตชื่อหมวดหมู่เรียบร้อย', timer: 1200, showConfirmButton: false });
        setEditingCatId(null);
      } else {
        await createFaqCategory({
          clinic_id: catSelectedClinic,
          category_name: catNameInput,
          display_order: categories.length,
          status: 'published'
        });
        MySwal.fire({ icon: 'success', title: 'สำเร็จ', text: 'เพิ่มหมวดหมู่ย่อยเรียบร้อย', timer: 1200, showConfirmButton: false });
      }
      setCatNameInput('');
      fetchCategoriesForForm(catSelectedClinic);
    } catch (err) {
      MySwal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลหมวดหมู่ได้', 'error');
    }
  };

  const handleStartEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setCatNameInput(cat.category_name);
  };

  const handleCancelEditCategory = () => {
    setEditingCatId(null);
    setCatNameInput('');
  };

  const handleDeleteCategory = async (id, name) => {
    const result = await MySwal.fire({
      title: 'ยืนยันการลบหมวดหมู่ย่อย?',
      text: `คุณต้องการลบหมวดหมู่ "${name}" ใช่หรือไม่? (คำถามที่ผูกกับหมวดหมู่นี้อาจได้รับผลกระทบ)`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        await deleteFaqCategory(id);
        MySwal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1200, showConfirmButton: false });
        fetchCategoriesForForm(catSelectedClinic);
        fetchFaqs();
      } catch (err) {
        MySwal.fire('ข้อผิดพลาด', 'ไม่สามารถลบหมวดหมู่ย่อยนี้ได้เนื่องจากมีคำถามใช้งานอยู่', 'error');
      }
    }
  };

  const handleCatDropReorder = async (dropIndex) => {
    if (draggedCatIndex === null || draggedCatIndex === dropIndex) return;

    const updatedCategories = [...categories];
    const [draggedItem] = updatedCategories.splice(draggedCatIndex, 1);
    updatedCategories.splice(dropIndex, 0, draggedItem);

    setCategories(updatedCategories);

    try {
      for (let i = 0; i < updatedCategories.length; i++) {
        const cat = updatedCategories[i];
        const correctOrder = i;

        if (cat.display_order !== correctOrder) {
          await updateFaqCategory(cat.id, {
            category_name: cat.category_name,
            clinic_id: catSelectedClinic,
            display_order: correctOrder,
            status: cat.status || 'published'
          });
        }
      }
      fetchCategoriesForForm(catSelectedClinic);
      fetchFaqs();
    } catch (err) {
      console.error(err);
      MySwal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกลำดับหมวดหมู่ได้', 'error');
      fetchCategoriesForForm(catSelectedClinic);
    }
    setDraggedCatIndex(null);
  };

  const handleCatStatusChange = async (cat, newStatus) => {
    const updatedCategories = categories.map(c => c.id === cat.id ? { ...c, status: newStatus } : c);
    setCategories(updatedCategories);
    try {
      await updateFaqCategory(cat.id, {
        category_name: cat.category_name,
        clinic_id: parseInt(catSelectedClinic),
        display_order: cat.display_order !== undefined ? cat.display_order : 0,
        status: newStatus
      });
      MySwal.fire({ icon: 'success', title: 'อัปเดตสถานะหมวดหมู่เรียบร้อย', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
      fetchCategoriesForForm(catSelectedClinic);
      fetchFaqs();
    } catch (err) {
      MySwal.fire('ข้อผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะหมวดหมู่ในฐานข้อมูลได้', 'error');
      fetchCategoriesForForm(catSelectedClinic);
    }
  };

  // 🟢 2. ปรับปรุงปุ่มแก้ไขให้อ่านค่าเป็น ID สตริง เข้าคู่กับกล่องดีไซน์ <select> หน้าบ้าน
  const handleOpenFaqModal = useCallback(async (faq = null) => {
    if (faq) {
      const actualClinicId = faq.clinic_id ? String(faq.clinic_id) : "";
      const actualCategoryId = faq.category_id ? String(faq.category_id) : "";

      setEditingFaq(faq);
      setFaqForm({
        question: faq.question || "",
        answer: faq.answer || "",
        clinic_id: actualClinicId,
        category_id: actualCategoryId,
        is_homepage: faq.is_homepage === 1,
        status: faq.status || "published",
        display_order: faq.display_order || 0
      });

      if (actualClinicId) {
        try {
          const res = await getFaqCategories(actualClinicId);
          setCategories(res.data?.data || []);
        } catch (err) {
          console.error("เกิดข้อผิดพลาดในการดึงหมวดหมู่ย่อยสำหรับฟอร์มแก้ไข:", err);
          setCategories([]);
        }
      } else {
        setCategories([]);
      }
    } else {
      setEditingFaq(null);
      setFaqForm({
        question: "", answer: "", clinic_id: "", category_id: "", is_homepage: false, status: "published", display_order: 0
      });
      setCategories([]);
    }
    setIsFaqModalOpen(true);
  }, []);

  // 🟢 3. ปรับฟังก์ชันบันทึกข้อมูลคำถาม แตกเปย์โหลดแปลงประเภทข้อมูลให้ถูกต้อง ไร้เอเรอร์
  const handleSaveFaq = async (e) => {
    e.preventDefault();
    const currentClinicId = faqForm.clinic_id ? parseInt(faqForm.clinic_id) : null;
    const currentCategoryId = faqForm.category_id ? parseInt(faqForm.category_id) : null;

    if (!faqForm.question.trim() || !faqForm.answer.trim() || !currentClinicId) {
      MySwal.fire('แจ้งเตือน', 'กรุณากรอกข้อมูลคำถาม คำตอบ และเลือกคลินิกหลักให้ครบถ้วน', 'warning');
      return;
    }

    if (faqForm.is_homepage === 1) {
      const isTurningOn = !editingFaq || (editingFaq && editingFaq.is_homepage !== 1);
      if (isTurningOn && homepageFaqCount >= 6) {
        MySwal.fire('โควตาเต็ม', 'ขณะนี้มีคำถามแสดงบนหน้าแรกครบ 6 ข้อแล้ว (รวมทุกคลินิก) กรุณาปิดข้ออื่นก่อนเปิดข้อนี้ค่ะ', 'warning');
        return;
      }
    }

    try {
      const payload = {
        question: faqForm.question.trim(),
        answer: faqForm.answer,
        is_homepage: faqForm.is_homepage ? 1 : 0,
        status: faqForm.status,
        display_order: parseInt(faqForm.display_order) || 0,
        clinic_id: currentClinicId,
        category_id: currentCategoryId || null
      };

      if (editingFaq) {
        await updateFaq(editingFaq.faq_id, payload);
        await MySwal.fire({ icon: 'success', title: 'อัปเดตคำถามเรียบร้อย', timer: 1200, showConfirmButton: false });
      } else {
        await createFaq(payload);
        await MySwal.fire({ icon: 'success', title: 'เพิ่มคำถามใหม่เรียบร้อย', timer: 1200, showConfirmButton: false });
      }

      setIsFaqModalOpen(false);
      fetchFaqs();
    } catch (err) {
      console.error(err);
      MySwal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลคำถามได้', 'error');
    }
  };

  const handleDeleteFaq = async (id, title) => {
    const result = await MySwal.fire({
      title: 'ยืนยันการลบคำถาม?', text: `คุณต้องการลบคำถาม "${title}" ใช่หรือไม่?`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
    });
    if (result.isConfirmed) {
      try {
        await deleteFaq(id);
        MySwal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
        fetchFaqs();
      } catch (err) {
        MySwal.fire('ข้อผิดพลาด', 'ไม่สามารถลบข้อมูลได้', 'error');
      }
    }
  };

  const handleToggleClinicHelpStatus = async (clinicId, currentStatus) => {
    try {
      const nextStatus = currentStatus === 1 ? 0 : 1;
      MySwal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => { MySwal.showLoading(); } });
      await toggleClinicHelpCenter(clinicId, nextStatus);
      const clinicsRes = await getAllClinics();
      if (clinicsRes && clinicsRes.data) {
        setClinics(clinicsRes.data?.data || []);
      }
      MySwal.fire({ icon: 'success', title: 'อัปเดตการแสดงผลสำเร็จ!', timer: 1500, showConfirmButton: false });
    } catch (error) {
      MySwal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถอัปเดตสถานะคลินิกได้' });
    }
  };

  const sortedFaqs = Array.isArray(faqs) ? [...faqs].sort((a, b) => {
    const orderA = parseInt(a.display_order) || 0;
    const orderB = parseInt(b.display_order) || 0;
    if (orderA !== orderB) return orderA - orderB;
    return (b.faq_id || 0) - (a.faq_id || 0);
  }) : [];

  const totalItems = sortedFaqs.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentFaqs = sortedFaqs.slice(startIndex, startIndex + rowsPerPage);

  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleDropReorder = async (dropIndex) => {
    if (draggedFaqIndex === null || draggedFaqIndex === dropIndex) return;
    const realDragIndex = startIndex + draggedFaqIndex;
    const realDropIndex = startIndex + dropIndex;
    const updatedFaqs = [...sortedFaqs];
    const [draggedItem] = updatedFaqs.splice(realDragIndex, 1);
    updatedFaqs.splice(realDropIndex, 0, draggedItem);

    setFaqs(updatedFaqs);

    try {
      for (let i = 0; i < updatedFaqs.length; i++) {
        const item = updatedFaqs[i];
        const correctOrder = i;
        if (item.display_order !== correctOrder) {
          let actualCategoryId = item.category_id ? parseInt(item.category_id) : null;
          const payload = {
            category_id: actualCategoryId,
            clinic_id: item.clinic_id ? parseInt(item.clinic_id) : null,
            question: item.question,
            answer: item.answer,
            is_homepage: item.is_homepage === 1 ? 1 : 0,
            status: item.status,
            display_order: correctOrder
          };
          await updateFaq(item.faq_id, payload);
        }
      }
      fetchFaqs();
    } catch (err) {
      MySwal.fire('ข้อผิดพลาด', 'การเชื่อมต่อขัดข้อง ไม่สามารถบันทึกลำดับได้', 'error');
      fetchFaqs();
    }
    setDraggedFaqIndex(null);
  };

  return (
    <div className="hc-admin-page">
      <main className="hc-main">
        <header className="hc-header">
          <div className="hc-header-info">
            <h1>จัดการศูนย์ช่วยเหลือ (FAQ)</h1>
            <p className="hc-header-hint">ตั้งค่าหมวดหมู่ย่อยและข้อคำถามที่พบบ่อยแยกตามแต่ละคลินิกบริการ</p>
          </div>
          <div className="hc-header-actions-group">
            <button className="hc-btn-outline-custom" onClick={() => { setClinicSearchQuery(""); setIsClinicModalOpen(true); }}><FaSlidersH /> ตั้งค่าคลินิกหน้าช่วยเหลือ</button>
            <button className="hc-btn-outline-custom" onClick={handleOpenCatModal}><FaFolderPlus /> จัดการหมวดหมู่ย่อย</button>
            <button className="hc-btn-add" onClick={() => handleOpenFaqModal()}><FaPlus /> เพิ่มคำถามใหม่</button>
          </div>
        </header>

        <div className="hc-filter-panel">
          <div className="hc-form-group" style={{ margin: 0, flex: 1.2 }}>
            <label style={{ fontSize: '13px', color: '#64748b' }}>กรองตามคลินิก</label>
            <select value={filterClinic} onChange={(e) => setFilterClinic(e.target.value)}>
              <option value="">เลือกคลินิกทั้งหมด</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="hc-form-group" style={{ margin: 0, flex: 3.5 }}>
            <label style={{ fontSize: '13px', color: '#64748b' }}>ค้นหาข้อคำถาม</label>
            <div style={{ position: 'relative' }}>
              <input type="text" placeholder="พิมพ์เพื่อค้นหาข้อคำถามได้ทันที..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: '35px', width: '100%', boxSizing: 'border-box' }} />
              <FaSearch style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} />
            </div>
          </div>

          <div className="hc-form-group" style={{ margin: 0, flex: 1.2 }}>
            <label style={{ fontSize: '13px', color: '#64748b' }}>สถานะ</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">สถานะทั้งหมด</option>
              <option value="published">เผยแพร่</option>
              <option value="draft">ร่าง</option>
              <option value="hidden">ซ่อน</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="hc-loading-state"><div className="hc-loading-spinner"></div><p>กำลังโหลดข้อมูล</p></div>
        ) : (
          <div className="hc-table-container" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="table-scroll-wrapper table-scroll-with-footer">
              <table className="hc-table">
                <thead>
                  <tr>
                    <th style={{ width: '4%', textAlign: 'center' }}></th>
                    <th className="hc-col-question" style={{ width: '25%' }}>คำถาม</th>
                    <th className="hc-col-clinic" style={{ width: '15%' }}>คลินิกหลัก</th>
                    <th className="hc-col-category" style={{ width: '15%' }}>หมวดหมู่ย่อย</th>
                    <th className="hc-col-homepage" style={{ width: '12%', textAlign: 'center' }}>แสดงหน้าแรก</th>
                    <th style={{ width: '13%', textAlign: 'center' }}>สถานะ</th>
                    <th style={{ width: '12%' }}>อัปเดตล่าสุด</th>
                    <th className="hc-col-actions" style={{ width: '8%' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {currentFaqs && currentFaqs.length > 0 ? (
                    currentFaqs.map((faq, index) => {
                      return (
                        <tr
                          key={faq.faq_id || index}
                          draggable
                          onDragStart={() => setDraggedFaqIndex(index)}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                          onDrop={() => handleDropReorder(index)}
                          onDragEnd={() => setDraggedFaqIndex(null)}
                          style={{
                            cursor: draggedFaqIndex === index ? 'grabbing' : 'grab',
                            opacity: draggedFaqIndex === index ? 0.4 : 1,
                            backgroundColor: draggedFaqIndex === index ? '#f8fafc' : 'inherit',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <td style={{ textAlign: 'center', color: '#94a3b8' }}>
                            <FaGripVertical title="คลิกค้างเพื่อลากจัดเรียง" size={16} />
                          </td>
                          <td className="hc-col-question" title={faq.question}>
                            {faq.question && faq.question.length > 60 ? faq.question.substring(0, 60) + '...' : faq.question}
                          </td>
                          {/* 🟢 แสดงชื่อคลินิกหลักตรงๆ ดึงจาก left join สลัดช่องว่างทิ้ง */}
                          <td className="hc-col-clinic">{faq.clinic_name || '-'}</td>
                          <td className="hc-col-category">
                            <span className="hc-badge-category">
                              {faq.category_name && faq.category_name.trim() !== '' ? faq.category_name : 'คำถามทั่วไปประจำคลินิก'}
                            </span>
                          </td>
                          <td className="hc-col-homepage">
                            {faq.is_homepage === 1 ? <span className="hc-status-badge active">หน้าแรก</span> : <span className="hc-status-badge inactive">ทั่วไป</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {faq.status === 'published' && <span className="hc-status active" style={{ fontSize: '12px', padding: '4px 10px' }}><FaCheckCircle /> เผยแพร่</span>}
                            {faq.status === 'draft' && <span className="hc-status inactive" style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#64748b' }}><FaTimesCircle /> ร่าง</span>}
                            {faq.status === 'hidden' && <span className="hc-status inactive" style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#fee2e2', color: '#ef4444' }}><FaTimesCircle /> ซ่อน</span>}
                          </td>
                          <td style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>{formatThaiDate(faq.updated_at || faq.created_at)}</td>
                          <td className="hc-col-actions">
                            <div className="hc-actions-wrapper">
                              <button type="button" className="hc-btn-action-edit" onClick={() => handleOpenFaqModal(faq)} title="แก้ไขคำถาม"><FaEdit /></button>
                              <button type="button" className="hc-btn-action-delete" onClick={() => handleDeleteFaq(faq.faq_id, faq.question)} title="ลบคำถาม"><FaTrash /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="8" className="hc-empty-state">ไม่พบข้อมูลคำถามในศูนย์ช่วยเหลือ</td></tr>
                  )}
                </tbody>
              </table>
              <div className="table-pagination-footer">
                <div className="pagination-info">
                  <span>แสดง</span>
                  <select value={rowsPerPage} onChange={handleRowsPerPageChange} className="pagination-select">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>รายการ (รวมทั้งหมด {totalItems} รายการ)</span>
                </div>
                <div className="pagination-controls">
                  <button className="page-btn" onClick={goToPrevPage} disabled={currentPage === 1} title="หน้าก่อนหน้า"><FaChevronLeft size={16} className="page-icon" /></button>
                  <span className="page-indicator">หน้า <strong className="page-highlight">{currentPage}</strong> จาก {totalPages || 1}</span>
                  <button className="page-btn" onClick={goToNextPage} disabled={currentPage === totalPages || totalPages === 0} title="หน้าถัดไป"><FaChevronRight size={16} className="page-icon" /></button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isCatModalOpen && (
          <div className="hc-modal-overlay">
            <div className="hc-modal-content" style={{ maxWidth: '700px' }}>
              <button className="hc-close-btn-custom" onClick={() => setIsCatModalOpen(false)}><span className="hc-close-cross"></span></button>
              <h2>จัดการหมวดหมู่คำถามย่อย</h2>
              <div className="hc-form-group">
                <label>เลือกคลินิกที่ต้องการจัดการ <span className="hc-required">*</span></label>
                <select required value={catSelectedClinic} onChange={e => setCatSelectedClinic(e.target.value)} disabled={!!editingCatId} style={{ backgroundColor: editingCatId ? '#f1f5f9' : '#ffffff', cursor: editingCatId ? 'not-allowed' : 'pointer' }}>
                  <option value="">-- เลือกคลินิกเพื่อดูข้อมูล --</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {catSelectedClinic && (
                <>
                  <hr style={{ margin: '20px 0', border: '0.5px solid #e2e8f0' }} />
                  <form onSubmit={handleSaveCategory} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
                    <div className="hc-form-group" style={{ margin: 0, flex: 1 }}>
                      <label>{editingCatId ? 'กำลังแก้ไขชื่อหมวดหมู่' : 'ชื่อหมวดหมู่ย่อยใหม่'} <span className="hc-required">*</span></label>
                      <input type="text" placeholder="เช่น การนัดหมาย, ขั้นตอนบริการ" required value={catNameInput} onChange={e => setCatNameInput(e.target.value)} />
                    </div>
                    <button type="submit" className="hc-btn-save" style={{ height: '45px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {editingCatId ? <><FaSave /> บันทึก</> : <><FaPlus /> เพิ่มหมวดหมู่</>}
                    </button>
                    {editingCatId && <button type="button" className="hc-btn-cancel" onClick={handleCancelEditCategory} style={{ height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 15px' }}><FaTimes /></button>}
                  </form>

                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '10px', color: '#334155', fontSize: '14.5px' }}>รายการหมวดหมู่ทั้งหมดในคลินิกนี้</label>
                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table className="hc-table" style={{ minWidth: '100%', boxShadow: 'none' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '10px 15px', fontSize: '13px', width: '40px', textAlign: 'center' }}></th>
                          <th style={{ padding: '10px 15px', fontSize: '13px' }}>ชื่อหมวดหมู่</th>
                          <th style={{ padding: '10px 15px', fontSize: '13px', width: '150px', textAlign: 'center' }}>สถานะ</th>
                          <th style={{ padding: '10px 15px', fontSize: '13px', width: '100px', textAlign: 'center' }}>จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.length > 0 ? categories.map((cat, idx) => (
                          <tr key={cat.id} draggable onDragStart={() => setDraggedCatIndex(idx)} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={() => handleCatDropReorder(idx)} onDragEnd={() => setDraggedCatIndex(null)} style={{ cursor: draggedCatIndex === idx ? 'grabbing' : 'grab', opacity: draggedCatIndex === idx ? 0.4 : 1, backgroundColor: draggedCatIndex === idx ? '#f8fafc' : 'inherit', transition: 'all 0.2s ease' }}>
                            <td style={{ padding: '10px 5px', textAlign: 'center', color: '#94a3b8' }}><FaGripVertical size={14} /></td>
                            <td style={{ padding: '10px 15px', fontSize: '14px', fontWeight: editingCatId === cat.id ? '700' : 'normal', color: editingCatId === cat.id ? '#F47932' : '#475569' }}>{cat.category_name}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                              <select value={cat.status || 'published'} onChange={(e) => handleCatStatusChange(cat, e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: cat.status === 'published' ? '#f0fdf4' : cat.status === 'draft' ? '#f1f5f9' : '#fdf2f2', color: cat.status === 'published' ? '#16a34a' : cat.status === 'draft' ? '#475569' : '#dc2626', fontWeight: '600' }}>
                                <option value="published">เผยแพร่</option>
                                <option value="draft">ร่าง</option>
                                <option value="hidden">ซ่อน</option>
                              </select>
                            </td>
                            <td style={{ padding: '5px 15px', textAlign: 'center' }}>
                              <div className="hc-actions-wrapper" style={{ gap: '4px' }}>
                                <button type="button" className="hc-btn-action-edit" style={{ height: '30px', borderRadius: '6px' }} onClick={() => handleStartEditCategory(cat)} title="แก้ไขชื่อหมวดหมู่"><FaEdit size={12} /></button>
                                <button type="button" className="hc-btn-action-delete" style={{ height: '30px', borderRadius: '6px' }} onClick={() => handleDeleteCategory(cat.id, cat.category_name)} title="ลบหมวดหมู่"><FaTrash size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>ยังไม่มีหมวดหมู่ย่อยในคลินิกนี้</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── 🌟 MODAL 2 (โฉมแก้ไขใหม่): หน้าต่างกรอกฟอร์มเพิ่ม/แก้ไขข้อคำถาม Hybrid ── */}
        {isFaqModalOpen && (
          <div className="hc-modal-overlay">
            <div className="hc-modal-content">
              <button className="hc-close-btn-custom" onClick={() => setIsFaqModalOpen(false)}><span className="hc-close-cross"></span></button>
              <h2>{editingFaq ? 'แก้ไขข้อมูลคำถาม' : 'เพิ่มข้อคำถามใหม่'}</h2>
              <form onSubmit={handleSaveFaq}>
                <div className="hc-form-row">

                  {/* 🟢 ปลดล็อกกล่องเลือกคลินิกหลักให้สอดรับสเตท Value ท่องจำค่าดั้งเดิมได้ตลอดเวลา */}
                  <div className="hc-form-group">
                    <label>เลือกคลินิกหลัก <span className="hc-required">*</span></label>
                    <select
                      name="clinic_id"
                      value={faqForm.clinic_id || ""}
                      onChange={(e) => {
                        const val = e.target.value ? String(e.target.value) : '';
                        setFaqForm({ ...faqForm, clinic_id: val, category_id: '' });
                        if (val) fetchCategoriesForForm(val);
                      }}
                      required
                    >
                      <option value="">-- เลือกคลินิก --</option>
                      {clinics.map((clinic) => (
                        <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 🟢 ปลดล็อกกล่องเลือกหมวดหมู่ย่อย ปล่อยว่างสำหรับคำถาม Hybrid ทั่วไปได้ */}
                  <div className="hc-form-group">
                    <label>เลือกหมวดหมู่ย่อย</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        name="category_id"
                        value={faqForm.category_id || ""}
                        onChange={(e) => {
                          const val = e.target.value ? String(e.target.value) : '';
                          setFaqForm({ ...faqForm, category_id: val });
                        }}
                      >
                        <option value="">-- ไม่มีหมวดหมู่ย่อย (คำถามทั่วไปประจำคลินิก) --</option>
                        {categories && categories.length > 0 && categories
                          .map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                          ))}
                      </select>
                    </div>
                    {!faqForm.clinic_id && <small style={{ color: '#ef4444' }}>* กรุณาเลือกคลินิกหลักก่อนเพื่อโหลดหมวดหมู่ย่อย</small>}
                  </div>
                </div>

                <div className="hc-form-row">
                  <div className="hc-form-group">
                    <label>สถานะการแสดงผล <span className="hc-required">*</span></label>
                    <select required value={faqForm.status} onChange={e => setFaqForm({ ...faqForm, status: e.target.value })}>
                      <option value="published">เผยแพร่</option>
                      <option value="draft">ร่าง</option>
                      <option value="hidden">ซ่อน</option>
                    </select>
                  </div>
                </div>
                <div className="hc-form-group">
                  <label>ข้อคำถาม (Question) <span className="hc-required">*</span></label>
                  <input type="text" placeholder="เช่น ต้องเตรียมบัตรอะไรมาบ้างในวันนัดครั้งแรก?" required value={faqForm.question} onChange={e => setFaqForm({ ...faqForm, question: e.target.value })} />
                </div>
                <div className="hc-form-group">
                  <label>คำตอบ (Answer) <span className="hc-required">*</span></label>
                  <div style={{ background: '#ffffff', borderRadius: '6.5px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                    <ReactQuill
                      theme="snow"
                      modules={quillModules}
                      placeholder="พิมพ์เนื้อหาคำตอบ"
                      value={faqForm.answer}
                      onChange={(content) => setFaqForm({ ...faqForm, answer: content })}
                    />
                  </div>
                </div>
                <div className="hc-form-group" style={{ display: 'block', width: '100%' }}>
                  <div className="hc-homepage-toggle-card">
                    <div className="hc-toggle-row">
                      <label className="hc-switch">
                        <input
                          type="checkbox"
                          checked={faqForm.is_homepage === 1}
                          disabled={homepageFaqCount >= 6 && faqForm.is_homepage !== 1}
                          onChange={e => setFaqForm({ ...faqForm, is_homepage: e.target.checked ? 1 : 0 })}
                        />
                        <span className="hc-slider" style={{ opacity: (homepageFaqCount >= 6 && faqForm.is_homepage !== 1) ? 0.4 : 1 }}></span>
                      </label>
                      <span className={`hc-toggle-label ${homepageFaqCount >= 6 && faqForm.is_homepage !== 1 ? 'disabled' : ''}`}>แสดงในคำถามที่พบบ่อยหน้าแรก</span>
                    </div>
                    <div className="hc-toggle-quota-info">
                      <small>ปัจจุบันแสดงบนหน้าแรกแล้ว {homepageFaqCount}/6 คำถาม</small>
                      {homepageFaqCount >= 6 && <span className="hc-toggle-error-msg"><FaTimesCircle style={{ fontSize: '14px', flexShrink: 0 }} /> โควตาเต็มแล้ว</span>}
                    </div>
                  </div>
                </div>
                <div className="hc-modal-actions">
                  <button type="button" className="hc-btn-cancel" onClick={() => setIsFaqModalOpen(false)}>ยกเลิก</button>
                  <button type="submit" className="hc-btn-save">บันทึกข้อมูล</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isClinicModalOpen && (
          <div className="hc-modal-overlay">
            <div className="hc-clinic-modal-content" style={{ position: 'relative' }}>
              <button className="hc-close-btn-custom" onClick={() => setIsClinicModalOpen(false)} aria-label="Close"><span className="hc-close-cross"></span></button>
              <div className="hc-modal-header" style={{ paddingRight: '40px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>ตั้งค่าการแสดงผลคลินิกบนหน้าช่วยเหลือ</h3>
              </div>
              <div className="hc-clinic-search-wrapper" style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><FaSearch /></span>
                <input type="text" placeholder="ค้นหาชื่อคลินิก..." value={clinicSearchQuery} onChange={(e) => setClinicSearchQuery(e.target.value)} className="hc-clinic-search-input" style={{ paddingLeft: '40px' }} />
              </div>
              <div className="hc-clinic-table-container">
                <table className="hc-mini-clinic-table">
                  <thead>
                    <tr>
                      <th style={{ width: '90px' }}>โลโก้</th>
                      <th>ชื่อคลินิก</th>
                      <th style={{ width: '180px', textAlign: 'center' }}>แสดงบนหน้าช่วยเหลือ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinics
                      .filter(c => c.name.toLowerCase().includes(clinicSearchQuery.toLowerCase()))
                      .map((clinic) => (
                        <tr key={clinic.id}>
                          <td>
                            <div className="hc-mini-logo-container">
                              <img src={clinic.image || 'https://via.placeholder.com/40'} alt={clinic.name} className="hc-mini-clinic-logo" />
                            </div>
                          </td>
                          <td className="hc-clinic-name-text">{clinic.name}</td>
                          <td style={{ textAlign: 'center' }}>
                            <label className="hc-switch">
                              <input type="checkbox" checked={clinic.show_in_help_center === 1} onChange={() => handleToggleClinicHelpStatus(clinic.id, clinic.show_in_help_center)} />
                              <span className="hc-slider round"></span>
                            </label>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="hc-modal-actions" style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                <button type="button" className="hc-btn-cancel" onClick={() => setIsClinicModalOpen(false)}>ยกเลิก</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}