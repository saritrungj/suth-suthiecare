import { useEffect, useState } from "react";
import {
  getAgencyMastersAdmin,
  updateAgencyCheckupMaster,
} from "../../services/api";
import { usePermissions } from "../../permissions/PermissionsProvider";
import "./AgencyEntry.css";
import "./AgencyCheckupForms.css";

const fieldTypes = [
  ["text", "ข้อความสั้น"],
  ["textarea", "ข้อความยาว"],
  ["number", "ตัวเลข"],
  ["date", "วันที่"],
  ["phone", "เบอร์โทรศัพท์"],
  ["email", "อีเมล"],
  ["select", "เลือก 1 ค่า"],
  ["multiselect", "เลือกได้หลายค่า"],
];
const parseSchema = (value) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return {
      formType: parsed?.form_type || (Array.isArray(parsed) ? "custom" : ""),
      fields: Array.isArray(parsed?.fields)
        ? parsed.fields
        : Array.isArray(parsed)
          ? parsed
          : [],
    };
  } catch {
    return { formType: "", fields: [] };
  }
};
const blankField = () => ({
  id: `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
  label: "",
  type: "text",
  required: false,
  options: [],
});

export default function AgencyCheckupForms() {
  const { activeAgency, authorization } = usePermissions();
  const [masters, setMasters] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [fields, setFields] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const company = authorization?.agencies?.find(
    (item) => String(item.id) === String(activeAgency),
  );
  const checkupMasters = masters.filter(
    (master) => parseSchema(master.field_schema).formType === "health_checkup",
  );
  const selectMaster = (id, source = masters) => {
    const master = source.find((item) => String(item.id) === String(id));
    if (!master) {
      setSelectedId("");
      setName("");
      setFields([]);
      return;
    }
    setSelectedId(String(master.id));
    setName(master.name);
    setFields(parseSchema(master.field_schema).fields);
  };
  const load = async () => {
    if (!activeAgency) return;
    try {
      const { data } = await getAgencyMastersAdmin(activeAgency);
      setMasters(data || []);
      const current =
        data?.find((item) => String(item.id) === String(selectedId)) ||
        data?.find(
          (item) =>
            parseSchema(item.field_schema).formType === "health_checkup",
        );
      selectMaster(current?.id || "", data || []);
    } catch {
      setMessage("โหลดแบบฟอร์มตรวจสุขภาพไม่สำเร็จ");
    }
  };
  useEffect(() => {
    load();
  }, [activeAgency]);
  const changeField = (index, patch) =>
    setFields((current) =>
      current.map((field, position) =>
        position === index ? { ...field, ...patch } : field,
      ),
    );
  const removeField = (index) =>
    setFields((current) =>
      current.length > 1
        ? current.filter((_, position) => position !== index)
        : current,
    );
  const save = async (event) => {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setMessage("");
    try {
      await updateAgencyCheckupMaster(activeAgency, selectedId, {
        name,
        field_schema: fields,
      });
      await load();
      setMessage(
        "บันทึกแบบฟอร์มแล้ว หน้า Agency Entry และ Template จะใช้ฟิลด์ชุดใหม่นี้ทันที",
      );
    } catch (error) {
      setMessage(error.response?.data?.message || "บันทึกแบบฟอร์มไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="agency-page agency-checkup-forms-page">
      <header className="agency-page-header">
        <div>
          <h1>จัดการแบบฟอร์ม Check up</h1>
          <p>
            กำหนดข้อมูลที่ Agency ต้องบันทึกได้ในแต่ละรอบตรวจ
            การเปลี่ยนแปลงจะถูกใช้กับหน้า Agency Entry และ Template ใหม่เสมอ
          </p>
        </div>
      </header>
      {message && (
        <p className="agency-notice" role="status">
          {message}
        </p>
      )}
      <section className="agency-workspace checkup-forms-workspace">
        <div className="checkup-form-context">
          <span>บริษัทที่กำลังจัดการ</span>
          <strong>{company?.name || "ยังไม่ได้เลือก Agency"}</strong>
          <label>
            เลือกรอบตรวจสุขภาพ
            <select
              value={selectedId}
              onChange={(event) => selectMaster(event.target.value)}
            >
              <option value="">เลือกแบบฟอร์ม</option>
              {checkupMasters.map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!checkupMasters.length ? (
          <div className="agency-empty">
            <strong>ยังไม่มีแบบฟอร์ม Check up</strong>
            <span>
              สร้างรอบตรวจสุขภาพจากเมนูจัดการ Agency ก่อน
              แล้วจึงกำหนดฟิลด์ที่ต้องการเก็บข้อมูล
            </span>
          </div>
        ) : (
          <form className="checkup-form-editor" onSubmit={save}>
            <div className="checkup-editor-heading">
              <div>
                <h2>ข้อมูลที่ต้องบันทึก</h2>
                <p>
                  เปิดหรือปิดฟิลด์ ปรับชื่อที่แสดง
                  และกำหนดรายการที่จำเป็นต้องกรอก
                </p>
              </div>
              <button
                type="button"
                className="agency-secondary"
                onClick={() =>
                  setFields((current) => [...current, blankField()])
                }
              >
                เพิ่มข้อมูล
              </button>
            </div>
            <label className="checkup-form-name">
              ชื่อแบบฟอร์ม / รอบตรวจ
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={255}
              />
            </label>
            <div className="checkup-field-list">
              <div className="checkup-field-columns" aria-hidden="true">
                <span />
                <span>ข้อมูลที่ต้องเก็บ</span>
                <span>ประเภทข้อมูล</span>
                <span>การตั้งค่า</span>
              </div>
              {fields.map((field, index) => (
                <section className="checkup-field-row" key={field.id}>
                  <div className="checkup-field-order">{index + 1}</div>
                  <label>
                    ชื่อข้อมูล
                    <input
                      aria-label={`ชื่อข้อมูล ${index + 1}`}
                      value={field.label}
                      placeholder="เช่น น้ำหนักตัว"
                      onChange={(event) =>
                        changeField(index, { label: event.target.value })
                      }
                      required
                      maxLength={255}
                    />
                  </label>
                  <label>
                    ประเภทข้อมูล
                    <select
                      aria-label={`ประเภทข้อมูล ${index + 1}`}
                      value={field.type}
                      onChange={(event) =>
                        changeField(index, {
                          type: event.target.value,
                          options: ["select", "multiselect"].includes(
                            event.target.value,
                          )
                            ? field.options
                            : [],
                        })
                      }
                    >
                      {fieldTypes.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {["select", "multiselect"].includes(field.type) && (
                    <label className="checkup-options">
                      ตัวเลือก
                      <input
                        aria-label={`ตัวเลือก ${index + 1}`}
                        value={(field.options || []).join("|")}
                        placeholder="เช่น ชาย|หญิง"
                        onChange={(event) =>
                          changeField(index, {
                            options: event.target.value
                              .split("|")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                  )}
                  <div className="checkup-field-actions">
                    <label className="checkup-required">
                      <input
                        type="checkbox"
                        checked={Boolean(field.required)}
                        onChange={(event) =>
                          changeField(index, { required: event.target.checked })
                        }
                      />
                      จำเป็นต้องกรอก
                    </label>
                    <button
                      type="button"
                      className="checkup-remove"
                      disabled={fields.length === 1}
                      onClick={() => removeField(index)}
                    >
                      ลบ
                    </button>
                  </div>
                </section>
              ))}
            </div>
            <p className="checkup-form-hint">
              ชื่อข้อมูลนี้จะแสดงในหน้า Agency Entry, หน้าตรวจสอบข้อมูล และชีต
              Instructions ของ Template ที่ดาวน์โหลดหลังบันทึก
            </p>
            <div className="agency-form-actions">
              <button className="agency-primary" disabled={saving}>
                {saving ? "กำลังบันทึก…" : "บันทึกแบบฟอร์ม"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
