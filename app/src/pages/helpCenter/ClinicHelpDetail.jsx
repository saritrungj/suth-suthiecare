import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    FiSearch, FiChevronDown, FiMessageCircle, FiHeart, FiFileText
} from 'react-icons/fi';
import { getFaqCategories, getActiveClinics, getFaqsAdmin } from '../../services/api';
import './ClinicHelpDetail.css';
import Navbar from '../../components/Navbar';

export default function ClinicHelpDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation()

    const [selectedClinic, setSelectedClinic] = useState(null);
    const [clinicCategories, setClinicCategories] = useState([]);
    const [allFaqs, setAllFaqs] = useState([]);
    const [clinicSearchQuery, setClinicSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const [openCategoryIds, setOpenCategoryIds] = useState([]);
    const [selectedFaq, setSelectedFaq] = useState(null);

    const answerRef = useRef(null);

    useEffect(() => {
        const fetchClinicAndFaqs = async () => {
            if (!id) return;

            const cachedDetailClinic = localStorage.getItem(`suth_clinic_detail_${id}`);
            const cachedDetailCats = localStorage.getItem(`suth_clinic_cats_${id}`);
            const cachedAllFaqs = localStorage.getItem('suth_all_faqs');

            if (cachedDetailClinic && cachedDetailCats && cachedAllFaqs) {
                const parsedClinic = JSON.parse(cachedDetailClinic);
                const parsedCats = JSON.parse(cachedDetailCats);
                const parsedFaqs = JSON.parse(cachedAllFaqs);

                setSelectedClinic(parsedClinic);
                setClinicCategories(parsedCats);
                setAllFaqs(parsedFaqs);

                setDefaultSelection(parsedCats, parsedFaqs, parsedClinic.name);
                setLoading(false);
            } else {
                setLoading(true);
            }

            try {
                const [resClinic, resFaq] = await Promise.all([
                    getActiveClinics(),
                    getFaqsAdmin()
                ]);

                const clinicList = resClinic.data?.data || [];
                const currentClinic = clinicList.find(c => String(c.id) === String(id));

                if (currentClinic) {
                    setSelectedClinic(currentClinic);
                    localStorage.setItem(`suth_clinic_detail_${id}`, JSON.stringify(currentClinic));

                    const resCat = await getFaqCategories(currentClinic.id);
                    const catData = resCat.data?.data || [];
                    const publishedCats = catData.filter(c => c.status === 'published');

                    setClinicCategories(publishedCats);
                    localStorage.setItem(`suth_clinic_cats_${id}`, JSON.stringify(publishedCats));

                    const freshAllFaqs = resFaq.data?.data || [];
                    setAllFaqs(freshAllFaqs);
                    localStorage.setItem('suth_all_faqs', JSON.stringify(freshAllFaqs));

                    setDefaultSelection(publishedCats, freshAllFaqs, currentClinic.name);
                }

            } catch (err) {
                console.error("Error fetching clinic and faq details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchClinicAndFaqs();
        setClinicSearchQuery('');
    }, [id]);

    // 🟢  เมื่อคำถาม (selectedFaq) เปลี่ยนแปลง ให้หน้าจอเลื่อนดิ่งลงไปหาคำตอบทันที
    useEffect(() => {
        if (selectedFaq && answerRef.current) {
            answerRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }, [selectedFaq]);

    // ฟังก์ชันช่วยเลือกคำถามแรกมาโชว์ที่หน้าจอฝั่งขวาอัตโนมัติ 
    const setDefaultSelection = (cats, faqs, clinicName) => {
        if (!faqs || faqs.length === 0) return;

        const clinicQuestions = faqs.filter(faq =>
            faq.status === 'published' &&
            (faq.clinic_name || '').trim() === (clinicName || '').trim()
        ).sort((a, b) => (parseInt(a.display_order) || 0) - (parseInt(b.display_order) || 0));

        if (clinicQuestions.length > 0) {

            const shortcutFaqId = location.state?.autoSelectFaqId;
            const matchedShortcutFaq = clinicQuestions.find(f => Number(f.faq_id) === Number(shortcutFaqId));

            if (matchedShortcutFaq) {

                setSelectedFaq(matchedShortcutFaq);

                if (matchedShortcutFaq.category_id && cats.length > 0) {
                    const matchedCat = cats.find(c => Number(c.id) === Number(matchedShortcutFaq.category_id));
                    if (matchedCat) setOpenCategoryIds([matchedCat.id]);
                }
            } else if (!selectedFaq) {

                setSelectedFaq(clinicQuestions[0]);
                if (clinicQuestions[0].category_id && cats.length > 0) {
                    const matchedCat = cats.find(c => Number(c.id) === Number(clinicQuestions[0].category_id));
                    if (matchedCat) setOpenCategoryIds([matchedCat.id]);
                }
            }
        }
    };

    const toggleCategoryMenu = (catId) => {
        if (openCategoryIds.includes(catId)) {
            setOpenCategoryIds(openCategoryIds.filter(id => id !== catId));
        } else {
            setOpenCategoryIds([...openCategoryIds, catId]);
        }
    };

    const handleBack = () => {
        navigate('/help-center');
    };

    if (loading) {
        return (
            <div className="hc-clinic-loading-container">
                <div className="hc-clinic-loading-spinner"></div>
                <p>กำลังโหลดข้อมูล</p>
            </div>
        );
    }

    if (!selectedClinic) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0', color: '#64748b' }}>
                <p style={{ fontSize: '16px' }}>ไม่พบข้อมูลคลินิกที่คุณต้องการ</p>
                <button onClick={handleBack} style={{ marginTop: '15px', color: '#f47932', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>
                    กลับสู่ศูนย์ช่วยเหลือ
                </button>
            </div>
        );
    }

    return (
        <div className="hc-clinic-detail-wrapper">
            <Navbar showBack={true} backText="กลับ" />

            {/* ── HERO BANNER ── */}
            <header className="hc-clinic-detail-hero">
                <div className="hc-user-container hc-clinic-hero-inner">

                    {/* กรอบโลโก้คลินิกขนาดลงตัว */}
                    <div className="hc-clinic-logo-frame">
                        <img src={selectedClinic.image} alt={selectedClinic.name} />
                    </div>

                    {/* บล็อกข้อความชิดซ้ายพร้อมป้ายส้มระบบ */}
                    <div className="hc-clinic-text-block">
                        <div className="hc-clinic-badge-label">
                            <FiHeart className="mini-heart" /> ศูนย์ช่วยเหลือ
                        </div>
                        <h1>{selectedClinic.name}</h1>
                        <p>คำแนะนำและคำถามที่พบบ่อยเกี่ยวกับ{selectedClinic.name}</p>
                    </div>

                </div>
            </header>

            {/* ── MAIN CONTENT ZONE (SPLIT LAYOUT) ── */}
            <div className="hc-user-container hc-split-layout-container">

                {/* 🎯 [ฝั่งซ้าย]: Sidebar จัดการโครงสร้างแบบผสม (Hybrid) */}
                <aside className="hc-clinic-sidebar-menu">
                    <div className="hc-clinic-internal-search-box">
                        <FiSearch className="internal-search-icon" />
                        <input
                            type="text"
                            placeholder="ค้นหาข้อคำถามย่อย..."
                            value={clinicSearchQuery}
                            onChange={(e) => setClinicSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="hc-sidebar-title">เลือกคำถามที่ต้องการดู</div>
                    <ul className="hc-sidebar-nested-menu">

                        {/* กลุ่มที่ 1: คำถามที่ "ไม่มีหมวดหมู่ย่อยอยู่จริงๆ" (ไม่มีทั้ง ID และไม่มีทั้งชื่อหมวดหมู่) */}
                        {allFaqs
                            .filter(faq => {
                                const isMatchClinic = (faq.clinic_name || '').trim() === (selectedClinic.name || '').trim();
                                const hasNoCategory = !faq.category_id && (!faq.category_name || faq.category_name.trim() === '');
                                const isMatchSearch = clinicSearchQuery === '' || faq.question.toLowerCase().includes(clinicSearchQuery.toLowerCase());
                                return faq.status === 'published' && isMatchClinic && hasNoCategory && isMatchSearch;
                            })
                            .sort((a, b) => (parseInt(a.display_order) || 0) - (parseInt(b.display_order) || 0))
                            .map((faq) => (
                                <li
                                    key={faq.faq_id}
                                    className={`hc-sub-question-item ${selectedFaq?.faq_id === faq.faq_id ? 'active' : ''}`}
                                    onClick={() => setSelectedFaq(faq)}
                                    style={{ border: '1px solid #f1f5f9', borderRadius: '10px', marginBottom: '6px' }}
                                >
                                    <FiFileText className="sub-q-icon" />
                                    <span className="sub-q-text">{faq.question}</span>
                                </li>
                            ))}

                        {/* เส้นปะคั่นแบบ Dynamic ระหว่างข้อคำถามเดี่ยว กับกลุ่มที่เป็นโฟลเดอร์หมวดหมู่ */}
                        {allFaqs.some(f => (!f.category_id && (!f.category_name || f.category_name.trim() === '')) && (f.clinic_name || '').trim() === (selectedClinic.name || '').trim() && f.status === 'published') && clinicCategories.length > 0 && (
                            <hr style={{ border: '0', borderTop: '1px dashed #e2e8f0', margin: '12px 0' }} />
                        )}

                        {/* กลุ่มที่ 2: กลุ่มที่มีหมวดหมู่ย่อย (จะถูกดึงเข้ามาอยู่ในโฟลเดอร์อย่างถูกต้อง) */}
                        {clinicCategories.map((cat) => {
                            const catQuestions = allFaqs.filter(faq => {
                                const isMatchClinic = (faq.clinic_name || '').trim() === (selectedClinic.name || '').trim();

                                // 🟢 ลอจิกแบบรัดกุม: เช็กจับคู่จาก ID หรือถ้า ID พลาด ให้เช็กจากชื่อหมวดหมู่ที่ตรงกัน
                                const isMatchCategory =
                                    (faq.category_id && Number(faq.category_id) === Number(cat.id)) ||
                                    (faq.category_name && faq.category_name.trim() === cat.category_name.trim());

                                const isMatchSearch = clinicSearchQuery === '' || faq.question.toLowerCase().includes(clinicSearchQuery.toLowerCase());

                                return faq.status === 'published' && isMatchClinic && isMatchCategory && isMatchSearch;
                            }).sort((a, b) => (parseInt(a.display_order) || 0) - (parseInt(b.display_order) || 0));

                            if (clinicSearchQuery !== '' && catQuestions.length === 0) return null;

                            const isCategoryOpen = openCategoryIds.includes(cat.id) || clinicSearchQuery !== '';

                            return (
                                <li key={cat.id} className={`hc-nested-menu-item ${isCategoryOpen ? 'expanded' : ''}`}>
                                    <div className="hc-nested-cat-header" onClick={() => toggleCategoryMenu(cat.id)}>
                                        <span>{cat.category_name}</span>
                                        <FiChevronDown className="arrow-toggle-icon" />
                                    </div>

                                    {isCategoryOpen && (
                                        <ul className="hc-sidebar-sub-question-list">
                                            {catQuestions.map((faq) => (
                                                <li
                                                    key={faq.faq_id}
                                                    className={`hc-sub-question-item ${selectedFaq?.faq_id === faq.faq_id ? 'active' : ''}`}
                                                    onClick={() => setSelectedFaq(faq)}
                                                >
                                                    <FiFileText className="sub-q-icon" />
                                                    <span className="sub-q-text">{faq.question}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </aside>

                {/* 🎯 [ฝั่งขวา]: แผงกระดานคอนเทนต์ */}
                <div className="hc-clinic-main-content-pane">
                    {selectedFaq ? (
                        <div className="hc-answer-display-card" ref={answerRef}>
                            <div className="hc-answer-header-zone">
                                <span className="hc-answer-tag-category">
                                    {(() => {
                                        const matchedCat = clinicCategories.find(cat => Number(cat.id) === Number(selectedFaq.category_id));
                                        return matchedCat ? matchedCat.category_name : 'ข้อมูลทั่วไป';
                                    })()}
                                </span>
                                <h3>{selectedFaq.question}</h3>
                            </div>
                            <div className="hc-answer-body-content">
                                <div className="hc-faq-answer suth-rich-content" dangerouslySetInnerHTML={{ __html: selectedFaq.answer }} />
                            </div>
                        </div>
                    ) : (
                        <div className="hc-answer-placeholder-card">
                            <FiMessageCircle size={54} className="placeholder-icon" />
                            <h4>ศูนย์ช่วยเหลือ SUTHieCare</h4>
                            <p>กรุณาคลิกเลือกข้อคำถามย่อยจากเมนูทางด้านซ้ายมือ <br />เพื่อเปิดอ่านรายละเอียดแนวทางการช่วยเหลือและคำตอบค่ะ</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}