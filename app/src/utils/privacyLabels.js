export const PRIVACY_REQUEST_TYPES = {
  access: ["ขอเข้าถึงข้อมูล", "Access my data"],
  rectification: ["ขอแก้ไขข้อมูล", "Correct my data"],
  erasure: ["ขอลบข้อมูล", "Erase my data"],
  restriction: ["ขอจำกัดการใช้ข้อมูล", "Restrict processing"],
  objection: ["คัดค้านการใช้ข้อมูล", "Object to processing"],
  portability: ["ขอรับหรือโอนข้อมูล", "Receive or transfer my data"],
  withdrawal: ["ถอนความยินยอม", "Withdraw consent"],
};
export const PRIVACY_REQUEST_STATUSES = {
  submitted: ["รอตรวจสอบตัวตน", "Awaiting identity verification"],
  identity_verified: ["ยืนยันตัวตนแล้ว", "Identity verified"],
  under_review: ["อยู่ระหว่างพิจารณา", "Under review"],
  fulfilled: ["ดำเนินการครบแล้ว", "Completed"],
  rejected: ["ปฏิเสธหลังพิจารณา", "Rejected after review"],
  withdrawn: ["ถอนคำขอแล้ว", "Withdrawn"],
};
export const requestTypeLabel = (type, language = "th") =>
  PRIVACY_REQUEST_TYPES[type]?.[language.startsWith("en") ? 1 : 0] ||
  (language.startsWith("en") ? "Privacy request" : "คำขอใช้สิทธิ");
export const requestStatusLabel = (status, language = "th") =>
  PRIVACY_REQUEST_STATUSES[status]?.[language.startsWith("en") ? 1 : 0] ||
  (language.startsWith("en") ? "Checking status" : "รอตรวจสอบสถานะ");
