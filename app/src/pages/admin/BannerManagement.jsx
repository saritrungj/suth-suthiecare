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

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      setBanners((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        reorderBanners(newItems);
        return newItems;
      });
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "ยืนยันการลบแบนเนอร์?",
      text: "หากลบแล้วจะไม่สามารถกู้คืนข้อมูลได้!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
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
    } catch (err) {
      alert("อัปเดตแบนเนอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
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
        <div className="bm-header">
          <h2 className="bm-title">จัดการภาพแบนเนอร์</h2>
          <button
            className="bm-add-btn"
            onClick={() => {
              if (isLimitReached) {
                alert(
                  "คุณมีแบนเนอร์ครบ 5 รูปแล้ว กรุณาลบแบนเนอร์เก่าออกก่อนเพิ่มรูปใหม่",
                );
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
        </div>

        {isLoading ? (
          <div className="bm-loading-state">
            <div className="bm-loading-spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="bm-content-grid">
            {/* --- คอลัมน์ซ้าย: ตารางจัดการแบนเนอร์ --- */}
            <div className="bm-table-container">
              <div className="bm-table-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "25px",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontWeight: "800",
                      color: "#334155",
                      fontSize: "20px",
                    }}
                  >
                    รายการภาพ Banner ทั้งหมด
                  </h3>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      color: "#ea580c",
                      background: "#fffcf9",
                      border: "1.5px dashed #fed7aa",
                      padding: "8px 18px",
                      borderRadius: "100px",
                      fontWeight: "700",
                      boxShadow: "0 4px 12px rgba(244, 121, 50, 0.08)",
                    }}
                  >
                    <FiInfo size={16} strokeWidth={2.5} />
                    สามารถเพิ่มรูปได้สูงสุด 5 รูป ({banners.length}/5)
                  </span>
                  <p className="bm-header-hint">
                    ลากแถวเพื่อเรียงลำดับคลินิก — ลำดับจะแสดงผลบนหน้าเว็บทันที
                  </p>
                </div>
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={banners.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <table>
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
              </div>
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
            await createBanner(banner);
            loadBanners();
            setShowModal(false);
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
