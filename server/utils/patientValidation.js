function validatePersonName(value, label) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (normalized.length < 1 || normalized.length > 100) {
    return { error: `${label}ต้องมีความยาว 1-100 ตัวอักษร` };
  }
  if (!/^[\p{L}\p{M} .'-]+$/u.test(normalized)) {
    return { error: `${label}มีอักขระที่ไม่รองรับ` };
  }
  return { value: normalized };
}

module.exports = { validatePersonName };
