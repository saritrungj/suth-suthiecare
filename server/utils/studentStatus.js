const labels = {
  active: "กำลังศึกษา",
  graduated: "จบการศึกษา",
  on_leave: "ลาพัก",
  withdrawn: "ลาออก",
  waived: "สละสิทธิ์",
  transferred: "ย้ายโรงเรียน",
  inactive: "ปิดใช้งาน (ข้อมูลเดิม)",
};
const current = ["active", "graduated", "on_leave", "withdrawn", "waived"];
function normalizeStudentStatus(value) {
  if (value == null || value === "") return "active";
  return current.find((code) => value === code || value === labels[code]);
}
module.exports = { labels, current, normalizeStudentStatus };
