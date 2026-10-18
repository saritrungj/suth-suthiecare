import { useState, useEffect } from "react";
import "./BannerManagement.css";
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiInfo,
  FiImage,
} from "react-icons/fi";
import AddBannerModal from "../../components/AddBannerModal";
import EditBannerModal from "../../components/EditBannerModal";
import SortableBannerRow from "../../components/SortableBannerRow";
import {
  getBanners,
  createBanner,
  deleteBanner,
  reorderBanners,
  updateBannerImage,
} from "../../services/api";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import Swal from "sweetalert2";
import {
  showErrorAlert,
  showInfoAlert,
  showSuccessAlert,
  showSuccessToast,
} from "../../utils/alerts";
import { PageHero } from "../../components/dashboard/DashboardKit";
import DataPanel from "../../components/table/DataPanel";

export default function BannerManagement() {
  const [showModal, setShowModal] = useState(false);
  const [banners, setBanners] = useState([]);
  const [editingBanner, setEditingBanner] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    setIsLoading(true);
    try {
      const res = await getBanners();
      setBanners(res.data);
    } catch (error) {
      console.error("Error loading banners:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      const previousItems = banners;
      const oldIndex = banners.findIndex((i) => i.id === active.id);
      const newIndex = banners.findIndex((i) => i.id === over.id);
      const newItems = arrayMove(banners, oldIndex, newIndex);
      setBanners(newItems);
      try {
        await reorderBanners(newItems);
        await showSuccessToast("บันทึกลำดับแบนเนอร์แล้ว");
      } catch (error) {
        setBanners(previousItems);
        await showErrorAlert({ error, title: "บันทึกลำดับแบนเนอร์ไม่สำเร็จ" });
      }
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "ยืนยันการลบแบนเนอร์?",
      text: "หากลบแล้วจะไม่สามารถกู้คืนข้อมูลได้!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "var(--suth-risk-dot-high)",
      cancelButtonColor: "var(--suth-control-line)",
      confirmButtonText: "ใช่, ลบเลย!",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
    });

    // ถ้าแอดมินกดยืนยันการลบ
    if (result.isConfirmed) {
      try {
        await deleteBanner(id);
        await loadBanners();
        Swal.fire({
          title: "ลบสำเร็จ!",
          text: "แบนเนอร์ถูกลบออกจากระบบแล้ว",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error) {
        Swal.fire(
          "เกิดข้อผิดพลาด!",
          "ไม่สามารถลบแบนเนอร์ได้ กรุณาลองใหม่",
          "error",
        );
      }
    }
  };

  /// EDIT — บันทึกลง DB ให้เสร็จก่อน แล้วค่อยดึงข้อมูลใหม่มาแสดงผล
  const handleEditBanner = async (updatedBanner) => {
    try {
      await updateBannerImage(updatedBanner.id, {
        image: updatedBanner.image,
        filename: updatedBanner.filename,
        link: updatedBanner.link || "",
      });
      setEditingBanner(null);
      await loadBanners();
      await showSuccessAlert({ title: "แก้ไขแบนเนอร์เรียบร้อยแล้ว" });
    } catch (err) {
      await showErrorAlert({ error: err, title: "แก้ไขแบนเนอร์ไม่สำเร็จ" });
    }
  };

  const nextSlide = () =>
    setCurrentSlide((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
  const prevSlide = () =>
    setCurrentSlide((prev) => (prev === 0 ? banners.length - 1 : prev - 1));

  //  ตัวแปรเช็คว่าแบนเนอร์ครบ 5 รูปหรือยัง
  const isLimitReached = banners.length >= 5;

  return (
    <div className="bm-wrapper">
      <div className="bm-page">
        <PageHero
          title="จัดการภาพแบนเนอร์"
          description="ภาพแบนเนอร์ที่หมุนเวียนบนหน้าแรกของเว็บไซต์"
          actions={
            <button
              className="bm-add-btn"
              onClick={() => {
                if (isLimitReached) {
                  showInfoAlert({
                    title: "เพิ่มแบนเนอร์ไม่ได้",
                    text: "คุณมีแบนเนอร์ครบ 5 รูปแล้ว กรุณาลบแบนเนอร์เก่าออกก่อนเพิ่มรูปใหม่",
                  });
                  return;
                }
                setShowModal(true);
              }}
              style={{
                opacity: isLimitReached ? 0.5 : 1,
                cursor: isLimitReached ? "not-allowed" : "pointer",
              }}
            >
              <FiPlus /> เพิ่มแบนเนอร์ใหม่
            </button>
          }
        />

        {isLoading ? (
          <div className="bm-loading-state">
            <div className="bm-loading-spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="bm-content-grid">
            {/* --- คอลัมน์ซ้าย: ตารางจัดการแบนเนอร์ --- */}
            <div className="bm-table-container">
              <DataPanel
                as="div"
                className="bm-table-card"
                tabIndex={0}
                role="region"
                aria-label="ตารางจัดการภาพแบนเนอร์"
              >
                <div className="dz-section__head bm-list-head">
                  <div>
                    <h2 className="dz-section__title">
                      รายการภาพ Banner ทั้งหมด
                    </h2>
                    <p className="dz-section__desc">
                      ลากแถวเพื่อเรียงลำดับแบนเนอร์ —
                      ลำดับจะแสดงผลบนหน้าเว็บทันที
                    </p>
                  </div>
                  <span className="bm-limit-chip">
                    <FiInfo aria-hidden="true" />
                    เพิ่มได้สูงสุด 5 รูป ({banners.length}/5)
                  </span>
                </div>
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={banners.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <table
                      className="admin-data-table"
                      aria-label="รายการภาพแบนเนอร์"
                    >
                      <thead>
                        <tr>
                          <th className="bm-col-image">ภาพ</th>
                          <th className="bm-col-name">ชื่อไฟล์</th>
                          <th className="bm-col-action">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {banners.length === 0 ? (
                          <tr>
                            <td colSpan="3">
                              <div className="bm-empty-state">
                                <div className="bm-empty-icon">
                                  <FiImage size={48} strokeWidth={1.5} />
                                </div>
                                <h3 className="bm-empty-text">
                                  ยังไม่มีข้อมูล Banner
                                </h3>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          banners.map((banner) => (
                            <SortableBannerRow
                              key={banner.id}
                              banner={banner}
                              onDelete={handleDelete}
                              onEdit={() => setEditingBanner(banner)}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
              </DataPanel>
            </div>

            {/* --- คอลัมน์ขวา: พรีวิวแบนเนอร์ --- */}
            <div className="bm-preview-container">
              <div className="bm-preview-card">
                <h3 className="bm-preview-title">ตัวอย่างบนหน้าจอ</h3>
                <div className="bm-slider">
                  {banners.length === 0 ? (
                    <div className="bm-empty">ไม่มีแบนเนอร์</div>
                  ) : (
                    <>
                      <img src={banners[currentSlide]?.image} alt="" />
                      <button
                        onClick={prevSlide}
                        className="bm-slide-btn bm-left"
                      >
                        <FiChevronLeft />
                      </button>
                      <button
                        onClick={nextSlide}
                        className="bm-slide-btn bm-right"
                      >
                        <FiChevronRight />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddBannerModal
          onClose={() => setShowModal(false)}
          onSave={async (banner) => {
            try {
              await createBanner(banner);
              await loadBanners();
              setShowModal(false);
              await showSuccessAlert({ title: "เพิ่มแบนเนอร์เรียบร้อยแล้ว" });
            } catch (error) {
              await showErrorAlert({ error, title: "เพิ่มแบนเนอร์ไม่สำเร็จ" });
            }
          }}
        />
      )}

      {editingBanner && (
        <EditBannerModal
          banner={editingBanner}
          onClose={() => setEditingBanner(null)}
          onSave={handleEditBanner}
        />
      )}
    </div>
  );
}
