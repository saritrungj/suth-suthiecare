import { useCallback, useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiCalendar,
  FiClock,
  FiList,
  FiPlus,
  FiTag,
} from "react-icons/fi";
import {
  actOnSchoolAppointment,
  closeAppointmentSlot,
  createAppointmentSlots,
  getAppointmentTopics,
  getMyAppointmentSlots,
  getSchoolAppointment,
  getSchoolAppointments,
  saveAppointmentTopics,
} from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import { confirmAlert, showSuccessToast } from "../../../utils/alerts";
import SearchableSelect from "../../../components/SearchableSelect";
import DataPanel from "../../../components/table/DataPanel";
import ResultSummary from "../../../components/table/ResultSummary";
import { DEFAULT_PAGE_SIZE } from "../../../components/table/TablePagination";
import {
  BarSelect,
  EmptyRow,
  LoadingRows,
  PageHeader,
  Pagination,
  SchoolModal,
  SearchField,
  TableScroll,
  ThaiDateField,
  useSchools,
} from "./schoolUi";
import "./school.css";
import "./behavior.css";
import ExportCsvButton from "../../../components/ExportCsvButton";
import AppointmentSchedule from "./AppointmentSchedule";

// Counseling appointments students book with school staff: the bookings
// (own, or the whole school for mental-health admins), the caller's open
// slots and the school's topic list.

const TONES = {
  requested: "waiting",
  confirmed: "active",
  rescheduled: "active",
  completed: "success",
  cancelled: "neutral",
  no_show: "danger",
};
const STATUS_FALLBACK = {
  requested: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  rescheduled: "เลื่อนเวลา",
  cancelled: "ยกเลิก",
  completed: "พบแล้ว",
  no_show: "ไม่มาตามนัด",
};
function AppointmentStatus({ status, labels }) {
  return (
    <span className={`sch-workflow-status is-${TONES[status] || "neutral"}`}>
      <span aria-hidden="true" />
      {(labels || STATUS_FALLBACK)[status] || status}
    </span>
  );
}
// "2026-10-20T09:00" → "20 ต.ค. 2569 09:00"
export function formatSlot(local, end) {
  if (!local) return "-";
  const [date, time] = local.split("T");
  const d = new Date(`${date}T00:00:00`);
  const day = Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        weekday: "short",
      });
  return `${day} ${time}${end ? `–${end.split("T")[1]}` : ""} น.`;
}

function AppointmentDetail({ id, onClose, onChanged }) {
  const [item, setItem] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [slotId, setSlotId] = useState(""),
    [transferSlot, setTransferSlot] = useState(""),
    [record, setRecord] = useState(false),
    [outcome, setOutcome] = useState({
      issue: "",
      support: "",
      follow_up_at: "",
    });
  const { schoolAccess } = usePermissions();
  const rights = schoolAccess?.appointment_actions || {};
  useEffect(() => {
    getSchoolAppointment(id)
      .then(({ data }) => setItem(data))
      .catch((e) =>
        setError(e.response?.data?.message || "โหลดนัดหมายไม่สำเร็จ"),
      );
  }, [id]);
  const act = async (action, extra = {}, done = "บันทึกแล้ว") => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await actOnSchoolAppointment(id, { action, ...extra });
      await showSuccessToast(done);
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };
  const active =
    item && ["requested", "confirmed", "rescheduled"].includes(item.status);
  return (
    <SchoolModal
      title="นัดหมายรับคำปรึกษา"
      subtitle={
        item &&
        `${item.student_code} ${item.student_name || ""} · ${[item.grade_name, item.classroom_name].filter(Boolean).join("/") || "-"}`
      }
      onClose={onClose}
    >
      {!item && !error && <p role="status">กำลังโหลด…</p>}
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {item && (
        <div className="behavior-detail">
          <dl className="behavior-facts">
            <div>
              <dt>เวลา</dt>
              <dd>{formatSlot(item.starts_at, item.ends_at)}</dd>
            </div>
            <div>
              <dt>เรื่อง</dt>
              <dd>{item.topic_label || "-"}</dd>
            </div>
            <div>
              <dt>ผู้ให้คำปรึกษา</dt>
              <dd>{item.staff_name || "-"}</dd>
            </div>
            <div>
              <dt>สถานะ</dt>
              <dd>
                <AppointmentStatus status={item.status} />
              </dd>
            </div>
          </dl>
          <section className="behavior-block">
            <h3>สิ่งที่นักเรียนเล่าไว้</h3>
            <p className="behavior-text">
              {item.note || "นักเรียนไม่ได้เขียนรายละเอียด"}
            </p>
          </section>
          {active && rights.update && (
            <div className="sch-form-actions behavior-block">
              {item.status !== "confirmed" && (
                <button
                  type="button"
                  className="sch-btn"
                  disabled={saving}
                  onClick={() => act("confirm", {}, "ยืนยันนัดแล้ว")}
                >
                  ยืนยันนัด
                </button>
              )}
              <button
                type="button"
                className="sch-btn-secondary"
                disabled={saving}
                onClick={() => act("no_show", {}, "บันทึกว่าไม่มาตามนัดแล้ว")}
              >
                ไม่มาตามนัด
              </button>
            </div>
          )}
          {active && rights.update && item.reschedule_slots?.length > 0 && (
            <div className="sch-form-grid behavior-block">
              <label className="sch-field">
                <span>เลื่อนไปเวลาอื่นของคุณ</span>
                <SearchableSelect
                  aria-label="เลื่อนไปเวลาอื่น"
                  value={slotId}
                  disabled={saving}
                  onChange={(e) => setSlotId(e.target.value)}
                >
                  <option value="">เลือกเวลา</option>
                  {item.reschedule_slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSlot(s.starts_at, s.ends_at)}
                    </option>
                  ))}
                </SearchableSelect>
              </label>
              <div className="sch-form-actions">
                <button
                  type="button"
                  className="sch-btn-secondary"
                  disabled={saving || !slotId}
                  onClick={() =>
                    act(
                      "reschedule",
                      { slot_id: Number(slotId) },
                      "เลื่อนนัดแล้ว",
                    )
                  }
                >
                  เลื่อนนัด
                </button>
              </div>
            </div>
          )}
          {active && rights.assign && item.transfer_options?.length > 0 && (
            <div className="sch-form-grid behavior-block">
              <label className="sch-field">
                <span>โอนให้ผู้ดูแลคนอื่นของนักเรียน</span>
                <SearchableSelect
                  aria-label="โอนนัดหมาย"
                  value={transferSlot}
                  disabled={saving}
                  onChange={(e) => setTransferSlot(e.target.value)}
                >
                  <option value="">เลือกผู้ดูแลและเวลา</option>
                  {item.transfer_options.flatMap((staff) =>
                    staff.slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {staff.name} ({staff.duty}) ·{" "}
                        {formatSlot(s.starts_at, s.ends_at)}
                      </option>
                    )),
                  )}
                </SearchableSelect>
              </label>
              <div className="sch-form-actions">
                <button
                  type="button"
                  className="sch-btn-secondary"
                  disabled={saving || !transferSlot}
                  onClick={() =>
                    act(
                      "transfer",
                      { slot_id: Number(transferSlot) },
                      "โอนนัดแล้ว",
                    )
                  }
                >
                  โอนนัด
                </button>
              </div>
            </div>
          )}
          {active && rights.update && (
            <form
              className="sch-form-grid behavior-block"
              onSubmit={(e) => {
                e.preventDefault();
                act(
                  "complete",
                  record
                    ? {
                        outcome: {
                          issue: outcome.issue,
                          support: outcome.support,
                          follow_up_at: outcome.follow_up_at || null,
                        },
                      }
                    : {},
                  "บันทึกว่าพบแล้ว",
                );
              }}
            >
              <h3 className="sch-full">หลังพบนักเรียน</h3>
              {item.can_record_guidance && (
                <label className="sch-full care-approve">
                  <input
                    type="checkbox"
                    checked={record}
                    onChange={(e) => setRecord(e.target.checked)}
                  />
                  บันทึกการให้คำปรึกษาไว้ในแฟ้มนักเรียน
                </label>
              )}
              {record && (
                <>
                  <label className="sch-field sch-full">
                    <span>เรื่องที่พูดคุย</span>
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={outcome.issue}
                      onChange={(e) =>
                        setOutcome({ ...outcome, issue: e.target.value })
                      }
                    />
                  </label>
                  <label className="sch-field sch-full">
                    <span>การช่วยเหลือ</span>
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={outcome.support}
                      onChange={(e) =>
                        setOutcome({ ...outcome, support: e.target.value })
                      }
                    />
                  </label>
                  <ThaiDateField
                    label="นัดติดตาม"
                    value={outcome.follow_up_at}
                    allowFuture
                    onChange={(follow_up_at) =>
                      setOutcome({ ...outcome, follow_up_at })
                    }
                  />
                </>
              )}
              <p className="sch-muted sch-full">
                ถ้าต้องส่งต่อ เปิดแฟ้มนักเรียนแล้วใช้แท็บส่งต่อ
              </p>
              <div className="sch-form-actions sch-full">
                <button
                  className="sch-btn"
                  disabled={saving || (record && !outcome.issue.trim())}
                >
                  บันทึกว่าพบแล้ว
                </button>
              </div>
            </form>
          )}
          {active && rights.delete && (
            <div className="sch-form-actions behavior-block">
              <button
                type="button"
                className="sch-btn-ghost behavior-cancel"
                disabled={saving}
                onClick={async () => {
                  if (
                    await confirmAlert({
                      title: "ยกเลิกนัดหมายนี้?",
                      text: "นักเรียนจะเห็นว่านัดถูกยกเลิก",
                      confirmText: "ยกเลิกนัด",
                      danger: true,
                    })
                  )
                    act("cancel", {}, "ยกเลิกนัดแล้ว");
                }}
              >
                ยกเลิกนัด
              </button>
            </div>
          )}
        </div>
      )}
    </SchoolModal>
  );
}

function AppointmentList() {
  const [filters, setFilters] = useState({
      q: "",
      status: "active",
      scope: "",
    }),
    [page, setPage] = useState(1),
    [limit, setLimit] = useState(DEFAULT_PAGE_SIZE),
    [result, setResult] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [openId, setOpenId] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSchoolAppointments({
        ...filters,
        scope: filters.scope || undefined,
        page,
        limit,
      });
      setResult(data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "โหลดนัดหมายไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);
  useEffect(() => {
    const t = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);
  const update = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const labels = result?.statuses;
  const { schoolAccess } = usePermissions();
  const canExport = Boolean(schoolAccess?.appointment_actions?.export);
  return (
    <DataPanel className="sch-card">
      <div className="sch-filter-bar">
        <SearchField
          label="ค้นหา"
          placeholder="รหัสหรือชื่อนักเรียน ผู้ให้คำปรึกษา หรือเรื่อง"
          value={filters.q}
          onChange={update("q")}
        />
        <BarSelect
          label="สถานะ"
          value={filters.status}
          onChange={update("status")}
        >
          <option value="">ทุกสถานะ</option>
          <option value="active">ยังไม่ถึงนัด / รอดำเนินการ</option>
          {Object.entries(labels || STATUS_FALLBACK).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </BarSelect>
        {result?.oversees && (
          <BarSelect
            label="ผู้ให้คำปรึกษา"
            value={filters.scope}
            onChange={update("scope")}
          >
            <option value="">ทุกคนในโรงเรียน</option>
            <option value="mine">เฉพาะของฉัน</option>
          </BarSelect>
        )}
        {canExport && (
          <ExportCsvButton
            path="/school/appointments"
            params={{ ...filters, scope: filters.scope || undefined }}
            fileName="นัดหมายรับคำปรึกษา.csv"
          />
        )}
      </div>
      <ResultSummary
        pagination={result?.pagination}
        loading={loading}
        onClearAll={() => {
          setFilters({ q: "", status: "", scope: "" });
          setPage(1);
        }}
        chips={[
          {
            key: "q",
            label: "ค้นหา",
            value: filters.q,
            onRemove: () => update("q")(""),
          },
          {
            key: "status",
            label: "สถานะ",
            value:
              filters.status === "active"
                ? "รอดำเนินการ"
                : (labels || STATUS_FALLBACK)[filters.status] || "",
            onRemove: () => update("status")(""),
          },
          {
            key: "scope",
            label: "ผู้ให้คำปรึกษา",
            value: filters.scope ? "ของฉัน" : "",
            onRemove: () => update("scope")(""),
          },
        ]}
      />
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      <TableScroll label="นัดหมายรับคำปรึกษา">
        <table className="sch-table admin-data-table">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>นักเรียน</th>
              <th>เรื่อง</th>
              <th>ผู้ให้คำปรึกษา</th>
              <th>สถานะ</th>
              <th className="is-actions">ดู</th>
            </tr>
          </thead>
          <tbody>
            {loading && !result && <LoadingRows columns={6} />}
            {result && !result.data.length && (
              <EmptyRow
                columns={6}
                title="ยังไม่มีนัดหมาย"
                hint="นักเรียนขอนัดได้เมื่อคุณเปิดช่วงเวลาว่าง"
              />
            )}
            {result?.data.map((a) => (
              <tr key={a.id}>
                <td>{formatSlot(a.starts_at, a.ends_at)}</td>
                <td>
                  <strong>{a.student_code}</strong>
                  <span className="sch-muted behavior-sub">
                    {a.student_name || ""}
                    {a.classroom_name
                      ? ` · ${[a.grade_name, a.classroom_name].filter(Boolean).join("/")}`
                      : ""}
                  </span>
                </td>
                <td>{a.topic_label || "-"}</td>
                <td>{a.staff_name || "-"}</td>
                <td>
                  <AppointmentStatus status={a.status} labels={labels} />
                </td>
                <td className="is-actions">
                  <button
                    type="button"
                    className="sch-btn-secondary"
                    aria-label={`เปิดนัดหมายของ ${a.student_code}`}
                    onClick={() => setOpenId(a.id)}
                  >
                    เปิด
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Pagination
        pagination={result?.pagination}
        onPage={setPage}
        onLimit={(v) => {
          setLimit(v);
          setPage(1);
        }}
      />
      {openId && (
        <AppointmentDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </DataPanel>
  );
}

const todayIso = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

function MySlots({ schoolId, canCreate }) {
  const [slots, setSlots] = useState(null),
    [bookable, setBookable] = useState(null),
    [error, setError] = useState(""),
    [form, setForm] = useState({
      date: todayIso(),
      start: "09:00",
      end: "09:30",
      capacity: "1",
      repeat_weeks: "1",
    }),
    [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    getMyAppointmentSlots({ school_id: schoolId || undefined })
      .then(({ data }) => {
        setSlots(data.slots);
        setBookable(data.bookable ?? null);
      })
      .catch((e) =>
        setError(e.response?.data?.message || "โหลดช่วงเวลาไม่สำเร็จ"),
      );
  }, [schoolId]);
  useEffect(() => {
    load();
  }, [load]);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const create = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await createAppointmentSlots({
        school_id: Number(schoolId),
        starts_at: `${form.date}T${form.start}`,
        ends_at: `${form.date}T${form.end}`,
        capacity: Number(form.capacity),
        repeat_weeks: Number(form.repeat_weeks),
      });
      await showSuccessToast(`เปิดช่วงเวลาแล้ว ${data.ids.length} ช่วง`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "เปิดช่วงเวลาไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="sch-card" aria-labelledby="my-slots-title">
      <h2 id="my-slots-title" className="dz-section__title">
        ช่วงเวลาว่างของฉัน
      </h2>
      <p className="sch-muted">
        นักเรียนที่คุณดูแลจะเลือกเวลาเหล่านี้เพื่อขอรับคำปรึกษาได้ภายใน 30
        วันข้างหน้า
      </p>
      {bookable === false && (
        <p className="sch-notice sch-notice--warning" role="note">
          <FiAlertTriangle aria-hidden="true" />
          <span>
            นักเรียนจะไม่เห็นช่วงเวลาของบัญชีนี้ เพราะยังไม่ได้เป็นครูประจำชั้น
            ครูแนะแนว หรือแอดมินสุขภาพจิตของโรงเรียน
            กำหนดหน้าที่ได้ที่หน้าบุคลากรและผู้ปกครอง แล้วจึงเปิดช่วงเวลา
          </span>
        </p>
      )}
      {canCreate && bookable !== false && (
        <form className="sch-form-grid" onSubmit={create}>
          <ThaiDateField
            label="วันที่"
            value={form.date}
            allowFuture
            required
            onChange={(date) => setForm({ ...form, date })}
          />
          <label className="sch-field">
            <span>เริ่ม</span>
            <input
              type="time"
              value={form.start}
              onChange={set("start")}
              required
            />
          </label>
          <label className="sch-field">
            <span>สิ้นสุด</span>
            <input
              type="time"
              value={form.end}
              onChange={set("end")}
              required
            />
          </label>
          <label className="sch-field">
            <span>รับได้ (คน)</span>
            <input
              type="number"
              min="1"
              max="10"
              value={form.capacity}
              onChange={set("capacity")}
            />
          </label>
          <label className="sch-field">
            <span>ทำซ้ำทุกสัปดาห์ (ครั้ง)</span>
            <input
              type="number"
              min="1"
              max="8"
              value={form.repeat_weeks}
              onChange={set("repeat_weeks")}
            />
          </label>
          <div className="sch-form-actions sch-full">
            <button className="sch-btn" disabled={saving}>
              <FiPlus aria-hidden="true" />
              {saving ? "กำลังเปิด…" : "เปิดช่วงเวลา"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      <TableScroll label="ช่วงเวลาว่างของฉัน">
        <table className="sch-table admin-data-table">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>จองแล้ว</th>
              <th>สถานะ</th>
              <th className="is-actions">ปิด</th>
            </tr>
          </thead>
          <tbody>
            {slots && !slots.length && (
              <EmptyRow columns={4} title="ยังไม่ได้เปิดช่วงเวลา" />
            )}
            {slots?.map((s) => (
              <tr key={s.id}>
                <td>{formatSlot(s.starts_at, s.ends_at)}</td>
                <td>
                  {s.booked}/{s.capacity}
                </td>
                <td>
                  {s.status === "open" ? "เปิดรับ" : "ปิดแล้ว"}
                  {s.from_schedule && (
                    <span className="sch-sub">จากตารางกลาง</span>
                  )}
                </td>
                <td className="is-actions">
                  {s.status === "open" && canCreate && (
                    <button
                      type="button"
                      className="sch-btn-secondary"
                      disabled={s.booked > 0}
                      title={s.booked > 0 ? "มีนักเรียนจองอยู่" : undefined}
                      aria-label={`ปิดช่วงเวลา ${formatSlot(s.starts_at, s.ends_at)}`}
                      onClick={async () => {
                        try {
                          await closeAppointmentSlot(s.id);
                          load();
                        } catch (err) {
                          setError(
                            err.response?.data?.message ||
                              "ปิดช่วงเวลาไม่สำเร็จ",
                          );
                        }
                      }}
                    >
                      ปิด
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </section>
  );
}

function Topics({ schoolId }) {
  const [topics, setTopics] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    getAppointmentTopics(schoolId)
      .then(({ data }) => setTopics(data.topics))
      .catch((e) =>
        setError(e.response?.data?.message || "โหลดหัวข้อไม่สำเร็จ"),
      );
  }, [schoolId]);
  const update = (i, patch) =>
    setTopics(topics.map((t, j) => (i === j ? { ...t, ...patch } : t)));
  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await saveAppointmentTopics({
        school_id: Number(schoolId),
        topics: topics.filter((t) => t.id || t.label.trim()),
      });
      await showSuccessToast("บันทึกหัวข้อแล้ว");
      const { data } = await getAppointmentTopics(schoolId);
      setTopics(data.topics);
    } catch (err) {
      setError(err.response?.data?.message || "บันทึกหัวข้อไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="sch-card" aria-labelledby="topics-title">
      <h2 id="topics-title" className="dz-section__title">
        หัวข้อให้นักเรียนเลือก
      </h2>
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {topics && (
        <form className="sch-form-grid" onSubmit={save}>
          {topics.map((t, i) => (
            <div
              className="sch-full appointment-topic"
              key={t.id || `new-${i}`}
            >
              <label className="sch-field">
                <span>หัวข้อที่ {i + 1}</span>
                <input
                  maxLength={120}
                  value={t.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </label>
              <label className="care-approve">
                <input
                  type="checkbox"
                  checked={t.status !== "inactive"}
                  onChange={(e) =>
                    update(i, {
                      status: e.target.checked ? "active" : "inactive",
                    })
                  }
                />
                เปิดใช้
              </label>
            </div>
          ))}
          <div className="sch-form-actions sch-full">
            <button
              type="button"
              className="sch-btn-secondary"
              onClick={() =>
                setTopics([...topics, { label: "", status: "active" }])
              }
            >
              <FiPlus aria-hidden="true" />
              เพิ่มหัวข้อ
            </button>
            <button className="sch-btn" disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึกหัวข้อ"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function SchoolAppointments() {
  const { schoolAccess } = usePermissions();
  const rights = schoolAccess?.appointment_actions || {};
  const { schools, schoolId, setSchoolId } = useSchools();
  const tabs = [
    ...(rights.view ? [{ key: "list", label: "นัดหมาย", icon: FiList }] : []),
    ...(rights.create || rights.view
      ? [{ key: "slots", label: "ช่วงเวลาว่างของฉัน", icon: FiClock }]
      : []),
    ...(rights.update || rights.view
      ? [{ key: "schedule", label: "ตารางกลาง", icon: FiCalendar }]
      : []),
    ...(rights.update ? [{ key: "topics", label: "หัวข้อ", icon: FiTag }] : []),
  ];
  const [tab, setTab] = useState(tabs[0]?.key || "slots");
  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="นัดหมายรับคำปรึกษา"
          description="นักเรียนเลือกเรื่อง ผู้ให้คำปรึกษา และเวลาได้เอง ครูยืนยัน เลื่อน หรือโอนนัด และบันทึกผลหลังพบนักเรียน"
        >
          {schools.length > 1 && (
            <BarSelect label="โรงเรียน" value={schoolId} onChange={setSchoolId}>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </BarSelect>
          )}
        </PageHeader>
        <nav className="sch-workflow-nav" aria-label="งานนัดหมาย">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              key={key}
              className={tab === key ? "is-active" : ""}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        {tab === "list" && <AppointmentList />}
        {tab === "slots" && schoolId && (
          <MySlots schoolId={schoolId} canCreate={rights.create} />
        )}
        {tab === "schedule" && schoolId && (
          <AppointmentSchedule schoolId={schoolId} />
        )}
        {tab === "topics" && schoolId && <Topics schoolId={schoolId} />}
        {!schoolId && tab !== "list" && (
          <p role="status">
            <FiCalendar aria-hidden="true" /> กำลังโหลดโรงเรียน…
          </p>
        )}
      </main>
    </div>
  );
}
