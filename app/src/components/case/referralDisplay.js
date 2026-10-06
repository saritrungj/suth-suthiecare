export const REFERRAL_STATUSES = {
  pending: "รอรับเรื่อง",
  accepted: "รับเรื่องแล้ว",
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  rejected: "ไม่รับเรื่อง",
  cancelled: "ยกเลิกการส่งต่อ",
};
export const REFERRAL_ACTIONS = {
  accepted: "รับเรื่อง",
  in_progress: "เริ่มดำเนินการ",
  completed: "บันทึกผลและเสร็จสิ้น",
  rejected: "ไม่รับเรื่อง",
  cancelled: "ยกเลิกการส่งต่อ",
};
export const referralDate = (value) =>
  new Date(value).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const referralError = (error) =>
  error?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่";
