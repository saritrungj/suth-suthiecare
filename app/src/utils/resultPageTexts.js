// Wording of the assessment result page that an organization can replace in
// the back office. Empty fields keep the app text (`i18nKey`), which also
// follows the visitor's language.
export const RESULT_PAGE_TEXTS = [
  {
    key: "hero_saved_title",
    i18nKey: "assessment_result.hero_saved_title",
    label: "หัวข้อเมื่อส่งข้อมูลให้เจ้าหน้าที่แล้ว",
  },
  {
    key: "hero_saved_desc",
    i18nKey: "assessment_result.hero_saved_desc",
    label: "คำอธิบายเมื่อส่งข้อมูลให้เจ้าหน้าที่แล้ว",
    multiline: true,
  },
  {
    key: "hero_done_title",
    i18nKey: "assessment_result.hero_done_title",
    label: "หัวข้อเมื่อประเมินเสร็จ (ยังไม่ได้ส่งข้อมูล)",
  },
  {
    key: "hero_done_desc",
    i18nKey: "assessment_result.hero_done_desc1",
    label: "คำอธิบายเมื่อประเมินเสร็จ (ยังไม่ได้ส่งข้อมูล)",
    multiline: true,
  },
  {
    key: "advice_title",
    i18nKey: "assessment_result.advice",
    label: "หัวข้อกล่องคำแนะนำ",
  },
  {
    key: "score_label",
    i18nKey: "assessment_result.score",
    label: "คำหน้าคะแนน",
  },
  {
    key: "back_home",
    i18nKey: "assessment_result.back_home",
    label: "ปุ่มกลับหน้าหลัก",
  },
  {
    key: "btn_history",
    i18nKey: "assessment_result.btn_history",
    label: "ปุ่มตรวจสอบประวัติ",
  },
  {
    key: "btn_eval",
    i18nKey: "assessment_result.btn_eval",
    label: "ปุ่มประเมินการใช้งานระบบ",
  },
];

export const RESULT_PAGE_TEXT_MAX = 500;

// App text without the markup some translations carry, for placeholders.
export const plainAppText = (value) =>
  String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
