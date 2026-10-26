import { useCallback, useEffect, useId, useState } from "react";
import { FiCalendar, FiCheck, FiX } from "react-icons/fi";
import {
  cancelStudentAppointment,
  getStudentAppointmentOptions,
  getStudentAppointments,
  requestStudentAppointment,
} from "../../services/api";
import "./AssessmentTasksPanel.css";
import "./CounselingPanel.css";

const TEXT = {
  th: {
    eyebrow: "จากโรงเรียนของคุณ",
    title: "นัดหมายรับคำปรึกษา",
    intro:
      "เลือกเรื่องที่อยากคุย ครูที่อยากคุยด้วย และเวลาที่สะดวก ครูจะยืนยันนัดให้",
    request: "ขอนัดหมาย",
    topic: "1. อยากคุยเรื่อง",
    staff: "2. อยากคุยกับ",
    time: "3. เวลาที่สะดวก",
    note: "เล่าเพิ่มเติม (ไม่บังคับ)",
    notePlaceholder: "เล่าสั้น ๆ ว่าอยากให้ครูช่วยเรื่องอะไร",
    send: "ส่งคำขอนัด",
    sending: "กำลังส่ง…",
    close: "ปิด",
    none: "ตอนนี้ครูที่ดูแลคุณยังไม่ได้เปิดเวลาว่าง ลองใหม่ภายหลัง หรือแจ้งครูที่ปรึกษาโดยตรง",
    empty: "ยังไม่มีนัดหมาย",
    cancel: "ยกเลิกนัด",
    sent: "ส่งคำขอนัดแล้ว รอครูยืนยัน",
    urgent:
      "ถ้าต้องการความช่วยเหลือเร่งด่วน โทรสายด่วนสุขภาพจิต 1323 ได้ตลอด 24 ชั่วโมง",
  },
  en: {
    eyebrow: "From your school",
    title: "Counseling appointments",
    intro:
      "Choose a topic, who you would like to talk to and a time. Your teacher will confirm it.",
    request: "Request an appointment",
    topic: "1. I'd like to talk about",
    staff: "2. With",
    time: "3. A time that suits me",
    note: "Anything else (optional)",
    notePlaceholder: "A few words about what you'd like help with",
    send: "Send request",
    sending: "Sending…",
    close: "Close",
    none: "The staff who look after you have no open times yet. Try again later or talk to your homeroom teacher.",
    empty: "No appointments yet",
    cancel: "Cancel",
    sent: "Request sent. Your teacher will confirm it.",
    urgent:
      "If you need help urgently, call the mental health hotline 1323 (24 hours).",
  },
};
const STATUS = {
  th: {
    requested: "รอครูยืนยัน",
    confirmed: "ยืนยันแล้ว",
    rescheduled: "ครูเลื่อนเวลา",
    cancelled: "ยกเลิก",
    completed: "พบแล้ว",
    no_show: "ไม่ได้มาตามนัด",
  },
  en: {
    requested: "Waiting for confirmation",
    confirmed: "Confirmed",
    rescheduled: "Time changed",
    cancelled: "Cancelled",
    completed: "Done",
    no_show: "Missed",
  },
};
const formatTime = (local, end, en) => {
  if (!local) return "-";
  const [date, time] = local.split("T");
  const d = new Date(`${date}T00:00:00`);
  const day = d.toLocaleDateString(en ? "en-GB" : "th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${day} ${time}${end ? `–${end.split("T")[1]}` : ""}`;
};

// A school student books counseling with the staff who look after them.
// Hidden for accounts that are not on a school roster.
export default function CounselingPanel({ language = "th" }) {
  const en = language === "en";
  const t = TEXT[en ? "en" : "th"];
  const titleId = useId();
  const [state, setState] = useState(null),
    [options, setOptions] = useState(null),
    [form, setForm] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    getStudentAppointments()
      .then(({ data }) => setState(data))
      .catch(() => setState(null));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (!state?.eligible) return null;

  const open = async () => {
    setError("");
    setNotice("");
    try {
      const { data } = await getStudentAppointmentOptions();
      const first = data.students?.[0] || null;
      setOptions(first);
      setForm({ topic_id: "", staff_id: "", slot_id: "", note: "" });
    } catch {
      setError(
        en
          ? "Could not load the options."
          : "โหลดตัวเลือกไม่สำเร็จ ลองใหม่อีกครั้ง",
      );
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (saving || !form.topic_id || !form.slot_id) return;
    setSaving(true);
    setError("");
    try {
      await requestStudentAppointment({
        student_id: options.student_id,
        topic_id: Number(form.topic_id),
        slot_id: Number(form.slot_id),
        note: form.note,
      });
      setForm(null);
      setNotice(t.sent);
      load();
    } catch (e) {
      setError(
        e.response?.data?.message ||
          (en ? "Could not send the request." : "ส่งคำขอไม่สำเร็จ"),
      );
    } finally {
      setSaving(false);
    }
  };
  const staff = options?.staff || [];
  const chosen = staff.find((s) => String(s.id) === String(form?.staff_id));
  const statuses = STATUS[en ? "en" : "th"];

  return (
    <section className="at-panel cp-panel" aria-labelledby={titleId}>
      <header className="at-head">
        <span className="at-icon cp-icon" aria-hidden="true">
          <FiCalendar />
        </span>
        <div className="at-heading">
          <p className="at-eyebrow">{t.eyebrow}</p>
          <h2 id={titleId} className="at-title">
            {t.title}
          </h2>
        </div>
        {!form && (
          <button type="button" className="cp-primary" onClick={open}>
            {t.request}
          </button>
        )}
      </header>
      {notice && (
        <p className="cp-notice" role="status">
          <FiCheck aria-hidden="true" /> {notice}
        </p>
      )}
      {error && (
        <p className="cp-error" role="alert">
          {error}
        </p>
      )}
      {form && options && (
        <form className="cp-form" onSubmit={submit}>
          <p className="cp-intro">{t.intro}</p>
          {!staff.length ? (
            <p className="cp-intro">{t.none}</p>
          ) : (
            <>
              <fieldset>
                <legend>{t.topic}</legend>
                <div className="cp-choices">
                  {options.topics.map((topic) => (
                    <label
                      key={topic.id}
                      className={
                        String(form.topic_id) === String(topic.id)
                          ? "is-on"
                          : ""
                      }
                    >
                      <input
                        type="radio"
                        name="topic"
                        value={topic.id}
                        checked={String(form.topic_id) === String(topic.id)}
                        onChange={(e) =>
                          setForm({ ...form, topic_id: e.target.value })
                        }
                      />
                      {topic.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>{t.staff}</legend>
                <div className="cp-choices">
                  {staff.map((s) => (
                    <label
                      key={s.id}
                      className={
                        String(form.staff_id) === String(s.id) ? "is-on" : ""
                      }
                    >
                      <input
                        type="radio"
                        name="staff"
                        value={s.id}
                        checked={String(form.staff_id) === String(s.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            staff_id: e.target.value,
                            slot_id: "",
                          })
                        }
                      />
                      <span>
                        {s.name}
                        {s.duty && <small> · {s.duty}</small>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {chosen && (
                <fieldset>
                  <legend>{t.time}</legend>
                  <div className="cp-choices">
                    {chosen.slots.map((slot) => (
                      <label
                        key={slot.id}
                        className={
                          String(form.slot_id) === String(slot.id)
                            ? "is-on"
                            : ""
                        }
                      >
                        <input
                          type="radio"
                          name="slot"
                          value={slot.id}
                          checked={String(form.slot_id) === String(slot.id)}
                          onChange={(e) =>
                            setForm({ ...form, slot_id: e.target.value })
                          }
                        />
                        {formatTime(slot.starts_at, slot.ends_at, en)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <label className="cp-note">
                <span>{t.note}</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={form.note}
                  placeholder={t.notePlaceholder}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
            </>
          )}
          <p className="cp-urgent">{t.urgent}</p>
          <div className="cp-actions">
            <button
              type="button"
              className="cp-secondary"
              onClick={() => setForm(null)}
            >
              {t.close}
            </button>
            {staff.length > 0 && (
              <button
                className="cp-primary"
                disabled={saving || !form.topic_id || !form.slot_id}
              >
                {saving ? t.sending : t.send}
              </button>
            )}
          </div>
        </form>
      )}
      {!form && (
        <ul className="at-list">
          {!state.appointments.length && (
            <li className="cp-empty">{t.empty}</li>
          )}
          {state.appointments.map((a) => (
            <li key={a.id} className="at-item">
              <div className="at-item__text">
                <strong>{formatTime(a.starts_at, a.ends_at, en)}</strong>
                <span className="at-due">
                  {a.staff_name || "-"} · {a.topic_label || "-"}
                </span>
              </div>
              <span className={`cp-status is-${a.status}`}>
                {statuses[a.status] || a.status}
              </span>
              {a.can_cancel && (
                <button
                  type="button"
                  className="cp-secondary"
                  onClick={async () => {
                    try {
                      await cancelStudentAppointment(a.id);
                      load();
                    } catch (e) {
                      setError(
                        e.response?.data?.message ||
                          (en ? "Could not cancel." : "ยกเลิกไม่สำเร็จ"),
                      );
                    }
                  }}
                >
                  <FiX aria-hidden="true" /> {t.cancel}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
