import { useEffect, useMemo, useState } from "react";
import SearchableSelect from "../../../components/SearchableSelect";
import StudentTasks, { TASK_KIND_LABELS } from "./StudentTasks";
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiHome,
  FiSave,
  FiUser,
} from "react-icons/fi";
import api, { getForms } from "../../../services/api";
import MasterSelect from "../../../components/MasterSelect";
import { toDisplayText } from "../../../utils/textPresentation.js";
import { formatThaiDate, ThaiDateField } from "./schoolUi";

// Guardian details moved to the contacts on the general tab.
const fields = {
  living_with: "พักอาศัยกับ",
  family_status: "สภาพครอบครัว",
  living_conditions: "ความเป็นอยู่",
  support_needs: "ความช่วยเหลือที่ต้องการ",
};
const categories = ["living_with", "family_status", "support_needs"];
const emptyProfile = Object.fromEntries(
  Object.keys(fields).map((key) => [key, ""]),
);
const initialGuidance = () => ({
  recorded_at: new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Bangkok",
  }),
  follow_up_at: "",
  issue: "",
  support: "",
  record_type: "guidance",
});
const emptyTask = {
  create: true,
  target_form_id: "",
  assigned_user_id: "",
  due_on: "",
};
// Screening is done by rounds for a group of students; a record for one
// student is general guidance or a follow-up.
const RECORD_TYPE_LABELS = {
  guidance: "แนะแนวทั่วไป",
  follow_up: "ติดตาม",
};
const normalizeProfile = (profile = {}) => ({ ...emptyProfile, ...profile });

export default function StudentInsights({ studentId, assessments = [] }) {
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [savedProfile, setSavedProfile] = useState(emptyProfile);
  const [guidance, setGuidance] = useState(initialGuidance);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [task, setTask] = useState(emptyTask);
  const [forms, setForms] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [tasksKey, setTasksKey] = useState(0);
  const wantsTask = guidance.record_type !== "guidance";
  // Forms and assignees load only once a follow-up is chosen.
  useEffect(() => {
    if (!wantsTask || forms.length) return;
    getForms("latest")
      .then(({ data: list }) =>
        setForms(
          (Array.isArray(list) ? list : []).filter(
            (f) => f.health_domain === "mental",
          ),
        ),
      )
      .catch(() => setForms([]));
    api
      .get("/school/rescreen-assignees", { params: { student_id: studentId } })
      .then(({ data: list }) => setAssignees(Array.isArray(list) ? list : []))
      .catch(() => setAssignees([]));
  }, [wantsTask, forms.length, studentId]);

  const applyData = (nextData) => {
    const nextProfile = normalizeProfile(nextData.profile);
    setData(nextData);
    setProfile(nextProfile);
    setSavedProfile(nextProfile);
  };

  const load = async () => {
    const response = await api.get(`/school/students/${studentId}/insights`);
    applyData(response.data);
  };

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    setMessage("");
    api
      .get(`/school/students/${studentId}/insights`)
      .then(({ data: nextData }) => {
        if (alive) applyData(nextData);
      })
      .catch((requestError) => {
        if (alive)
          setError(
            requestError.response?.data?.message ||
              "โหลดข้อมูลเชิงลึกไม่สำเร็จ",
          );
      });
    return () => {
      alive = false;
    };
  }, [studentId]);

  const profileChanged = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(savedProfile),
    [profile, savedProfile],
  );

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving("profile");
    setError("");
    setMessage("");
    try {
      await api.put(`/school/students/${studentId}/insights`, profile);
      await load();
      setMessage("บันทึกข้อมูลครอบครัวและความเป็นอยู่แล้ว");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setSaving("");
    }
  };

  const saveGuidance = async (event) => {
    event.preventDefault();
    setSaving("guidance");
    setError("");
    setMessage("");
    try {
      const withTask = wantsTask && data.can_assign && task.create;
      await api.post(`/school/students/${studentId}/guidance`, {
        ...guidance,
        ...(withTask
          ? {
              task: {
                target_form_id: task.target_form_id,
                assigned_user_id: task.assigned_user_id,
                due_on: task.due_on,
              },
            }
          : {}),
      });
      setGuidance(initialGuidance());
      setTask(emptyTask);
      await load();
      if (withTask) setTasksKey((k) => k + 1);
      setMessage(
        withTask
          ? "เพิ่มบันทึกและสร้างงานติดตามแล้ว"
          : "เพิ่มบันทึกแนะแนวในประวัติแล้ว",
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "เพิ่มบันทึกแนะแนวไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setSaving("");
    }
  };

  if (!data) {
    return (
      <p
        role={error ? "alert" : "status"}
        className={error ? "sch-error" : "sch-muted"}
      >
        {error || "กำลังโหลดข้อมูลเชิงลึก…"}
      </p>
    );
  }

  return (
    <div className="sch-insights">
      {(error || message) && (
        <div
          className={
            error
              ? "sch-error sch-insights-notice"
              : "sch-success sch-insights-notice"
          }
          role={error ? "alert" : "status"}
        >
          {!error && <FiCheckCircle aria-hidden="true" />}
          {error || message}
        </div>
      )}

      <section
        className="sch-insights-section"
        aria-labelledby="insights-family-title"
      >
        <header className="sch-insights-section-head">
          <span className="sch-insights-section-icon" aria-hidden="true">
            <FiHome />
          </span>
          <div>
            <h2 id="insights-family-title">ครอบครัวและความเป็นอยู่</h2>
            <p>
              ข้อมูลสำหรับทำความเข้าใจบริบทและวางแผนช่วยเหลือนักเรียน
              ข้อมูลผู้ปกครองและเบอร์ติดต่ออยู่ที่แท็บข้อมูลทั่วไป
            </p>
          </div>
        </header>

        {!data.can_update ? (
          <dl className="sch-insights-readonly">
            {Object.entries(fields).map(([key, label]) => (
              <div
                className={
                  key === "living_conditions" ? "sch-insights-wide" : ""
                }
                key={key}
              >
                <dt>{label}</dt>
                <dd>{toDisplayText(profile[key]) || "ไม่ระบุ"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <form className="sch-insights-form" onSubmit={saveProfile}>
            {Object.entries(fields).map(([key, label]) => (
              <label
                className={`sch-field ${key === "living_conditions" ? "sch-insights-wide" : ""}`}
                key={key}
              >
                {toDisplayText(label)}
                {categories.includes(key) ? (
                  <MasterSelect
                    category={key}
                    value={profile[key]}
                    disabled={Boolean(saving)}
                    onChange={(event) =>
                      setProfile({ ...profile, [key]: event.target.value })
                    }
                  >
                    <option value="">ไม่ระบุ</option>
                  </MasterSelect>
                ) : key === "living_conditions" ? (
                  <textarea
                    rows="4"
                    maxLength="4000"
                    value={profile[key]}
                    disabled={Boolean(saving)}
                    onChange={(event) =>
                      setProfile({ ...profile, [key]: event.target.value })
                    }
                  />
                ) : (
                  <input
                    maxLength="4000"
                    type="text"
                    value={profile[key]}
                    disabled={Boolean(saving)}
                    onChange={(event) =>
                      setProfile({ ...profile, [key]: event.target.value })
                    }
                  />
                )}
              </label>
            ))}
            <div className="sch-insights-actions">
              <button
                type="button"
                className="sch-btn sch-btn-secondary"
                disabled={!profileChanged || Boolean(saving)}
                onClick={() => setProfile(savedProfile)}
              >
                คืนค่าที่บันทึกไว้
              </button>
              <button
                className="sch-btn sch-btn-primary"
                disabled={!profileChanged || Boolean(saving)}
              >
                <FiSave aria-hidden="true" />
                {saving === "profile" ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        )}
      </section>

      {(data.can_create ?? data.can_update) && (
        <section
          className="sch-insights-section"
          aria-labelledby="insights-guidance-title"
        >
          <header className="sch-insights-section-head">
            <span className="sch-insights-section-icon" aria-hidden="true">
              <FiCalendar />
            </span>
            <div>
              <h2 id="insights-guidance-title">เพิ่มบันทึกแนะแนว</h2>
              <p>บันทึกสิ่งที่พบ การช่วยเหลือ และวันที่ควรกลับมาติดตาม</p>
            </div>
          </header>
          <form
            className="sch-insights-form sch-guidance-form"
            onSubmit={saveGuidance}
          >
            <ThaiDateField
              label="วันที่บันทึก"
              required
              value={guidance.recorded_at}
              onChange={(value) =>
                setGuidance({ ...guidance, recorded_at: value })
              }
            />
            <ThaiDateField
              label="วันติดตาม"
              allowFuture
              value={guidance.follow_up_at}
              onChange={(value) =>
                setGuidance({ ...guidance, follow_up_at: value })
              }
            />
            <label className="sch-field">
              ประเภทบันทึก
              <SearchableSelect
                value={guidance.record_type}
                disabled={Boolean(saving)}
                onChange={(event) =>
                  setGuidance({ ...guidance, record_type: event.target.value })
                }
              >
                {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SearchableSelect>
            </label>
            {wantsTask && data.can_assign && (
              <fieldset className="sch-insights-wide sch-task-builder">
                <legend>
                  <label>
                    <input
                      type="checkbox"
                      checked={task.create}
                      onChange={(e) =>
                        setTask({ ...task, create: e.target.checked })
                      }
                    />{" "}
                    สร้างงาน{RECORD_TYPE_LABELS[guidance.record_type]}
                    พร้อมเลือกแบบประเมิน
                  </label>
                </legend>
                {task.create && (
                  <div className="sch-task-builder-grid">
                    <label className="sch-field">
                      <span>
                        แบบประเมินที่ต้องทำ
                        <span className="sch-required" aria-hidden="true">
                          *
                        </span>
                      </span>
                      <SearchableSelect
                        required
                        value={task.target_form_id}
                        onChange={(e) =>
                          setTask({ ...task, target_form_id: e.target.value })
                        }
                      >
                        <option value="">เลือกแบบประเมิน</option>
                        {forms.map((f) => (
                          <option key={f.id} value={f.id}>
                            {toDisplayText(f.title)}
                          </option>
                        ))}
                      </SearchableSelect>
                    </label>
                    <label className="sch-field">
                      <span>
                        ผู้รับผิดชอบ
                        <span className="sch-required" aria-hidden="true">
                          *
                        </span>
                      </span>
                      <SearchableSelect
                        required
                        value={task.assigned_user_id}
                        onChange={(e) =>
                          setTask({ ...task, assigned_user_id: e.target.value })
                        }
                      >
                        <option value="">เลือกผู้รับผิดชอบ</option>
                        {assignees.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </SearchableSelect>
                    </label>
                    <ThaiDateField
                      label="กำหนดเสร็จ"
                      required
                      allowFuture
                      value={task.due_on}
                      onChange={(value) => setTask({ ...task, due_on: value })}
                    />
                  </div>
                )}
              </fieldset>
            )}
            <label className="sch-field sch-insights-wide">
              <span>
                เรื่องที่พบ
                <span className="sch-required" aria-hidden="true">
                  *
                </span>
              </span>
              <textarea
                rows="4"
                required
                maxLength="4000"
                value={guidance.issue}
                disabled={Boolean(saving)}
                onChange={(event) =>
                  setGuidance({ ...guidance, issue: event.target.value })
                }
              />
            </label>
            <label className="sch-field sch-insights-wide">
              การช่วยเหลือ
              <textarea
                rows="4"
                maxLength="4000"
                value={guidance.support}
                disabled={Boolean(saving)}
                onChange={(event) =>
                  setGuidance({ ...guidance, support: event.target.value })
                }
              />
            </label>
            <div className="sch-insights-actions">
              <button
                className="sch-btn sch-btn-primary"
                disabled={Boolean(saving)}
              >
                <FiSave aria-hidden="true" />
                {saving === "guidance"
                  ? "กำลังเพิ่มบันทึก…"
                  : "เพิ่มบันทึกแนะแนว"}
              </button>
            </div>
          </form>
        </section>
      )}

      <StudentTasks
        studentId={studentId}
        assessments={assessments}
        canAssign={data.can_assign}
        refreshKey={tasksKey}
      />

      <section
        className="sch-insights-section"
        aria-labelledby="insights-history-title"
      >
        <header className="sch-insights-section-head sch-insights-history-head">
          <span className="sch-insights-section-icon" aria-hidden="true">
            <FiClock />
          </span>
          <div>
            <h2 id="insights-history-title">ประวัติการแนะแนว</h2>
            <p>
              {data.records.length
                ? `${data.records.length} บันทึก เรียงจากล่าสุด`
                : "บันทึกใหม่จะแสดงในส่วนนี้"}
            </p>
          </div>
        </header>
        {data.records.length ? (
          <ol className="sch-guidance-history">
            {data.records.map((record) => (
              <li key={record.id}>
                <article>
                  <header>
                    <time dateTime={String(record.recorded_at).slice(0, 10)}>
                      {formatThaiDate(record.recorded_at)}
                    </time>
                    {record.record_type &&
                      record.record_type !== "guidance" && (
                        <span
                          className={`sch-badge mental-task-${record.record_type}`}
                        >
                          {TASK_KIND_LABELS[record.record_type]}
                        </span>
                      )}
                    {record.follow_up_at && (
                      <span className="sch-follow-up">
                        <FiCalendar aria-hidden="true" /> ติดตาม{" "}
                        {formatThaiDate(record.follow_up_at)}
                      </span>
                    )}
                  </header>
                  <div className="sch-guidance-copy">
                    <div>
                      <h3>เรื่องที่พบ</h3>
                      <p>{toDisplayText(record.issue) || "ไม่ระบุ"}</p>
                    </div>
                    <div>
                      <h3>การช่วยเหลือ</h3>
                      <p>{toDisplayText(record.support) || "ยังไม่ได้ระบุ"}</p>
                    </div>
                  </div>
                  <footer>
                    <FiUser aria-hidden="true" /> ผู้บันทึก:{" "}
                    {toDisplayText(record.recorded_by_name) ||
                      "ไม่พบข้อมูลผู้บันทึก"}
                  </footer>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <p className="sch-insights-empty">ยังไม่มีประวัติการแนะแนว</p>
        )}
      </section>
    </div>
  );
}
