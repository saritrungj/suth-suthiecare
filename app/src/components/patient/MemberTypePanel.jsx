import React, { useEffect, useId, useState } from "react";
import { FiBookOpen, FiEdit2, FiHelpCircle, FiUser } from "react-icons/fi";
import SearchableSelect from "../SearchableSelect";
import { updatePatientMemberType } from "../../services/api";
import { FACULTY_OPTIONS, memberTypeLabel } from "../../utils/memberTypes";
import "./MemberTypePanel.css";

const SCHOOL_STATUS = {
  active: { th: "กำลังศึกษา", en: "Studying" },
  graduated: { th: "จบการศึกษาแล้ว", en: "Graduated" },
  transferred: { th: "ย้ายโรงเรียนแล้ว", en: "Transferred" },
  inactive: { th: "ไม่ได้ศึกษาอยู่", en: "Not enrolled" },
  archived: { th: "ไม่ได้ศึกษาอยู่", en: "Not enrolled" },
};

const SOURCE_NOTE = {
  case_answer: {
    th: "จากคำตอบในแบบประเมินล่าสุดของคุณ",
    en: "From your latest assessment answer",
  },
  declared: { th: "คุณระบุไว้เอง", en: "You set this yourself" },
  school_roster: {
    th: "จากรายชื่อนักเรียนของโรงเรียน หากข้อมูลไม่ถูกต้อง โปรดแจ้งครูประจำชั้น",
    en: "From your school's student list. Ask your homeroom teacher to fix anything wrong.",
  },
  former_student: {
    th: "จากรายชื่อนักเรียนเดิมของโรงเรียน",
    en: "From your former school's student list",
  },
};

const ICONS = {
  school_student: FiBookOpen,
  university_student: FiBookOpen,
  general: FiUser,
  unknown: FiHelpCircle,
};

// The service-recipient panel on the member's own page. The type comes from
// the server; a member can state it when it is unknown, change a stated or
// answered type, and say they moved on after leaving school. An active school
// roster always wins, so current school students cannot change it here.
export default function MemberTypePanel({ memberType, language = "th", onChange }) {
  const en = language === "en";
  const tr = (pair) => (pair ? pair[en ? "en" : "th"] : "");
  const type = memberType?.type || "unknown";
  const school = memberType?.school || null;
  const formerStudent = type === "school_student" && school && school.status !== "active";
  const canChange = type !== "school_student" || formerStudent;

  const [editing, setEditing] = useState(type === "unknown");
  const [choice, setChoice] = useState(
    type === "general" ? "general" : "university_student",
  );
  const [faculty, setFaculty] = useState(memberType?.faculty || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const groupName = useId();

  useEffect(() => {
    setEditing(type === "unknown");
    setFaculty(memberType?.faculty || "");
  }, [type, memberType?.faculty]);

  const save = async (event) => {
    event.preventDefault();
    if (choice === "university_student" && !faculty) {
      setError(en ? "Choose your faculty." : "กรุณาเลือกสำนักวิชา");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await updatePatientMemberType({
        type: choice,
        faculty: choice === "university_student" ? faculty : "",
      });
      onChange?.(data.member_type);
      setEditing(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (en ? "Could not save. Please try again." : "บันทึกไม่สำเร็จ กรุณาลองใหม่"),
      );
    } finally {
      setSaving(false);
    }
  };

  const Icon = ICONS[type] || FiUser;
  const facts =
    type === "school_student" && school
      ? [
          [en ? "School" : "โรงเรียน", school.school_name],
          [
            en ? "Class" : "ชั้น / ห้อง",
            [school.grade_name, school.classroom_name].filter(Boolean).join(" / "),
          ],
          [en ? "Academic year" : "ปีการศึกษา", school.academic_year],
          [en ? "Student code" : "รหัสนักเรียน", school.student_code],
          [en ? "Status" : "สถานะ", tr(SCHOOL_STATUS[school.status])],
        ]
      : type === "university_student"
        ? [
            [
              en ? "Faculty" : "สำนักวิชา",
              memberType?.faculty || (en ? "Not known yet" : "ยังไม่ทราบสำนักวิชา"),
            ],
          ]
        : [];

  return (
    <section className={`mt-panel mt-panel--${type}`} aria-labelledby={titleId}>
      <header className="mt-panel__head">
        <span className="mt-panel__icon" aria-hidden="true">
          <Icon />
        </span>
        <div className="mt-panel__heading">
          <p className="mt-panel__eyebrow">
            {en ? "Service recipient type" : "ประเภทผู้มารับบริการ"}
          </p>
          <h2 id={titleId} className="mt-panel__title">
            {memberTypeLabel(type, language)}
          </h2>
        </div>
        {canChange && !editing && type !== "unknown" && (
          <button
            type="button"
            className="mt-panel__edit"
            onClick={() => setEditing(true)}
          >
            <FiEdit2 aria-hidden="true" />
            {formerStudent
              ? en
                ? "Now a university student?"
                : "ตอนนี้เป็นนักศึกษา?"
              : en
                ? "Change"
                : "แก้ไข"}
          </button>
        )}
      </header>

      {facts.length > 0 && (
        <dl className="mt-panel__facts">
          {facts
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      )}

      {type === "general" && !editing && (
        <p className="mt-panel__text">
          {en
            ? "You use the service as a member of the public."
            : "คุณใช้บริการในฐานะบุคคลทั่วไป"}
        </p>
      )}

      {type === "unknown" && (
        <p className="mt-panel__text">
          {en
            ? "Tell us who you are so the right clinic can look after you."
            : "บอกเราว่าคุณเป็นใคร เพื่อให้คลินิกที่เหมาะสมดูแลคุณได้ถูกต้อง"}
        </p>
      )}

      {SOURCE_NOTE[memberType?.source] && !editing && (
        <p className="mt-panel__note">{tr(SOURCE_NOTE[memberType.source])}</p>
      )}

      {editing && canChange && (
        <form className="mt-panel__form" onSubmit={save} noValidate>
          <fieldset>
            <legend>{en ? "I am" : "ฉันเป็น"}</legend>
            <div className="mt-panel__choices">
              {[
                ["university_student", en ? "University student" : "นักศึกษา"],
                ["general", en ? "General public" : "บุคคลทั่วไป"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className={`mt-panel__choice${choice === value ? " is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={value}
                    checked={choice === value}
                    onChange={() => setChoice(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {choice === "university_student" && (
            <label className="mt-panel__field">
              <span>{en ? "Faculty" : "สำนักวิชา"}</span>
              <SearchableSelect
                value={faculty}
                onChange={(event) => setFaculty(event.target.value)}
              >
                <option value="">{en ? "Choose your faculty" : "เลือกสำนักวิชา"}</option>
                {FACULTY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SearchableSelect>
            </label>
          )}
          {error && (
            <p className="mt-panel__error" role="alert">
              {error}
            </p>
          )}
          <div className="mt-panel__actions">
            {type !== "unknown" && (
              <button
                type="button"
                className="mt-panel__secondary"
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
              >
                {en ? "Cancel" : "ยกเลิก"}
              </button>
            )}
            <button type="submit" className="mt-panel__primary" disabled={saving}>
              {saving ? (en ? "Saving..." : "กำลังบันทึก...") : en ? "Save" : "บันทึก"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}