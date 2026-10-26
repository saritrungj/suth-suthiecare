// Contacts on the general tab of the student file: guardian, emergency
// contact and the student's own phone, plus the note on how to work with this
// student. Counselors and above edit; homeroom teachers and physical-health
// staff of the student read. The server decides who sees what.
import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPhone, FiSave, FiShield } from "react-icons/fi";
import MasterSelect, {
  useMasterOptions,
} from "../../../components/MasterSelect";
import api from "../../../services/api";
import { showErrorAlert, showSuccessToast } from "../../../utils/alerts";
import { toDisplayText } from "../../../utils/textPresentation.js";

const CONTACT_LABELS = {
  guardian_name: "ชื่อผู้ปกครอง",
  guardian_relationship: "ความสัมพันธ์กับนักเรียน",
  guardian_phone: "โทรศัพท์ผู้ปกครอง",
  emergency_contact_name: "ผู้ติดต่อฉุกเฉิน",
  emergency_contact_phone: "โทรศัพท์ผู้ติดต่อฉุกเฉิน",
  student_phone: "โทรศัพท์นักเรียน",
};
const PHONES = ["guardian_phone", "emergency_contact_phone", "student_phone"];
const empty = {
  ...Object.fromEntries(Object.keys(CONTACT_LABELS).map((k) => [k, ""])),
  care_instructions: "",
};

export default function StudentContactsSection({ studentId }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const relationships = useMasterOptions("guardian_relationship");

  const load = useCallback(async () => {
    try {
      const { data: result } = await api.get(
        `/school/students/${studentId}/contacts`,
      );
      setData(
        result && !Array.isArray(result) && "can_edit" in result
          ? result
          : null,
      );
    } catch {
      // Out of the caller's health scope: the section is not shown.
      setData(null);
    }
  }, [studentId]);
  useEffect(() => {
    setForm(null);
    load();
  }, [load]);

  if (!data) return null;
  const value = (key) =>
    key === "guardian_relationship"
      ? relationships.find((o) => o.code === data[key])?.label || data[key]
      : data[key];

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body = Object.fromEntries(
        Object.keys(empty).map((k) => [k, form[k] || ""]),
      );
      await api.put(`/school/students/${studentId}/contacts`, body);
      setForm(null);
      await load();
      await showSuccessToast("บันทึกข้อมูลติดต่อแล้ว");
    } catch (err) {
      await showErrorAlert({
        error: err,
        title: "บันทึกข้อมูลติดต่อไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  };
  const input = (key) => ({
    value: form[key] || "",
    disabled: saving,
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  if (form)
    return (
      <section className="sch-section cw-fact-group sch-contacts">
        <h3>
          <FiPhone aria-hidden="true" /> ผู้ปกครองและการติดต่อ
        </h3>
        <form className="sch-insights-form" onSubmit={save}>
          {Object.entries(CONTACT_LABELS).map(([key, label]) => (
            <label className="sch-field" key={key}>
              {label}
              {key === "guardian_relationship" ? (
                <MasterSelect category={key} {...input(key)}>
                  <option value="">ไม่ระบุ</option>
                </MasterSelect>
              ) : (
                <input
                  type={PHONES.includes(key) ? "tel" : "text"}
                  inputMode={PHONES.includes(key) ? "tel" : undefined}
                  maxLength={PHONES.includes(key) ? 20 : 255}
                  pattern={PHONES.includes(key) ? "[0-9+\\- ]*" : undefined}
                  {...input(key)}
                />
              )}
            </label>
          ))}
          {data.can_view_care_note && (
            <label className="sch-field sch-insights-wide">
              คำแนะนำการปฏิบัติกับนักเรียนคนนี้
              <textarea
                rows="4"
                maxLength="2000"
                placeholder="เช่น ควรพูดคุยแบบตัวต่อตัว หลีกเลี่ยงการเรียกชื่อหน้าชั้น"
                {...input("care_instructions")}
              />
            </label>
          )}
          <div className="sch-insights-actions">
            <button
              type="button"
              className="sch-btn sch-btn-secondary"
              disabled={saving}
              onClick={() => setForm(null)}
            >
              ยกเลิก
            </button>
            <button className="sch-btn sch-btn-primary" disabled={saving}>
              <FiSave aria-hidden="true" />
              {saving ? "กำลังบันทึก…" : "บันทึกข้อมูลติดต่อ"}
            </button>
          </div>
        </form>
      </section>
    );

  return (
    <>
      {data.can_view_care_note && (
        <section className="sch-section cw-fact-group sch-care-note">
          <h3>
            <FiShield aria-hidden="true" /> คำแนะนำการปฏิบัติกับนักเรียนคนนี้
          </h3>
          <p className={data.care_instructions ? "" : "sch-muted"}>
            {toDisplayText(data.care_instructions) ||
              (data.can_edit
                ? "ยังไม่มีคำแนะนำ กดแก้ไขเพื่อเพิ่ม"
                : "ยังไม่มีคำแนะนำจากครูแนะแนว")}
          </p>
        </section>
      )}
      <section className="sch-section cw-fact-group sch-contacts">
        <h3>
          <FiPhone aria-hidden="true" /> ผู้ปกครองและการติดต่อ
          {data.can_edit && (
            <button
              type="button"
              className="sch-btn-secondary sch-contacts-edit"
              onClick={() => setForm({ ...empty, ...data })}
            >
              <FiEdit2 aria-hidden="true" /> แก้ไข
            </button>
          )}
        </h3>
        <dl className="cw-facts">
          {Object.entries(CONTACT_LABELS).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {PHONES.includes(key) && data[key] ? (
                  <a href={`tel:${data[key].replace(/\s/g, "")}`}>
                    {data[key]}
                  </a>
                ) : (
                  toDisplayText(value(key)) || "-"
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
