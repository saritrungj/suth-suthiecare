// The school's shared counseling schedule: on the chosen weekdays and times
// every counselor of the school offers slots, so students can book without
// each teacher opening times by hand. A counselor closes a single day (a
// holiday or a meeting) in "ช่วงเวลาว่างของฉัน".
import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";
import {
  getAppointmentSchedule,
  saveAppointmentSchedule,
} from "../../../services/api";
import { showErrorAlert, showSuccessToast } from "../../../utils/alerts";

const WEEKDAYS = [
  [1, "จันทร์"],
  [2, "อังคาร"],
  [3, "พุธ"],
  [4, "พฤหัสบดี"],
  [5, "ศุกร์"],
  [6, "เสาร์"],
  [7, "อาทิตย์"],
];

export default function AppointmentSchedule({ schoolId }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    getAppointmentSchedule(schoolId)
      .then(({ data: result }) => {
        setData(result);
        setForm({
          ...result.schedule,
          // A school without a schedule starts from the suggested one, on.
          status: result.schedule.exists ? result.schedule.status : "active",
        });
      })
      .catch((e) =>
        setError(e.response?.data?.message || "โหลดตารางนัดหมายไม่สำเร็จ"),
      );
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  if (!form)
    return error ? (
      <p className="sch-error" role="alert">
        {error}
      </p>
    ) : (
      <p role="status">กำลังโหลดตารางนัดหมาย…</p>
    );
  const editable = data.can_update;
  const toggleDay = (day) =>
    setForm({
      ...form,
      weekdays: form.weekdays.includes(day)
        ? form.weekdays.filter((d) => d !== day)
        : [...form.weekdays, day].sort(),
    });
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { data: result } = await saveAppointmentSchedule({
        school_id: Number(schoolId),
        weekdays: form.weekdays,
        start_time: form.start_time,
        end_time: form.end_time,
        slot_minutes: Number(form.slot_minutes),
        capacity: Number(form.capacity),
        status: form.status,
      });
      await showSuccessToast(
        form.status === "active"
          ? `บันทึกตารางกลางแล้ว เปิดช่วงเวลาใหม่ ${result.slots_made} ช่วง`
          : "ปิดตารางกลางแล้ว",
      );
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "บันทึกตารางไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sch-card" aria-labelledby="schedule-title">
      <h2 id="schedule-title" className="dz-section__title">
        ตารางนัดหมายกลางของครูแนะแนว
      </h2>
      <p className="sch-muted">
        ใช้ร่วมกันทุกคนที่มีหน้าที่ครูแนะแนวในโรงเรียน
        ระบบเปิดช่วงเวลาให้ล่วงหน้า {data.booking_days} วัน
        นักเรียนจองได้เองจากหน้าบัญชีของตน
        ครูปิดบางวันได้ที่แท็บช่วงเวลาว่างของฉัน (เช่น วันหยุด) เมื่อแก้ตาราง
        ช่วงเวลาที่ยังไม่มีคนจองจะถูกเปลี่ยนตามตารางใหม่
        ส่วนที่จองแล้วยังอยู่เหมือนเดิม
      </p>
      <form className="sch-form-grid" onSubmit={save}>
        <fieldset className="sch-full sch-schedule-days" disabled={!editable}>
          <legend>วันที่เปิดให้จอง</legend>
          <div className="sch-round-grade-list">
            {WEEKDAYS.map(([day, label]) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={form.weekdays.includes(day)}
                  onChange={() => toggleDay(day)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="sch-field">
          <span>เริ่ม</span>
          <input
            type="time"
            required
            disabled={!editable}
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
        </label>
        <label className="sch-field">
          <span>สิ้นสุด</span>
          <input
            type="time"
            required
            disabled={!editable}
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
        </label>
        <label className="sch-field">
          <span>นัดละ (นาที)</span>
          <input
            type="number"
            min="10"
            max="240"
            required
            disabled={!editable}
            value={form.slot_minutes}
            onChange={(e) => setForm({ ...form, slot_minutes: e.target.value })}
          />
        </label>
        <label className="sch-field">
          <span>รับต่อช่วง (คน)</span>
          <input
            type="number"
            min="1"
            max="10"
            required
            disabled={!editable}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />
        </label>
        <label className="care-approve sch-full">
          <input
            type="checkbox"
            disabled={!editable}
            checked={form.status === "active"}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.checked ? "active" : "inactive",
              })
            }
          />
          เปิดใช้ตารางกลาง
        </label>
        <div className="sch-full">
          <strong>ครูแนะแนวที่ใช้ตารางนี้</strong>{" "}
          {data.counselors.length ? (
            <span>{data.counselors.map((c) => c.name).join(", ")}</span>
          ) : (
            <span className="sch-error">
              ยังไม่มีครูแนะแนวในโรงเรียน
              กำหนดหน้าที่ได้ที่หน้าบุคลากรและผู้ปกครอง
            </span>
          )}
        </div>
        {editable && (
          <div className="sch-form-actions sch-full">
            <button className="sch-btn" disabled={saving}>
              <FiSave aria-hidden="true" />
              {saving ? "กำลังบันทึก…" : "บันทึกตารางกลาง"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
