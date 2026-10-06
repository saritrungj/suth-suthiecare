import { useId, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import "./StaffCheckboxPicker.css";

// Multi-select list of staff accounts with search and "select all shown".
// `people`: [{ id, name, username, hint? }]. `selected`: Set of ids.
export default function StaffCheckboxPicker({
  people,
  selected,
  onChange,
  emptyText = "ไม่มีรายชื่อให้เลือก",
  label = "เลือกเจ้าหน้าที่",
  required = false,
  error = "",
}) {
  const searchId = useId();
  const errorId = `${searchId}-error`;
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((person) =>
      [person.name, person.username, person.hint]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [people, query]);
  const allShownSelected =
    shown.length > 0 && shown.every((person) => selected.has(person.id));

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const toggleShown = () => {
    const next = new Set(selected);
    shown.forEach((person) =>
      allShownSelected ? next.delete(person.id) : next.add(person.id),
    );
    onChange(next);
  };

  return (
    <fieldset
      className={`scp ${error ? "has-error" : ""}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend>
        {label}
        {required && (
          <span className="scp-sr-only"> (ต้องเลือกอย่างน้อย 1 คน)</span>
        )}
      </legend>
      <div className="scp-toolbar">
        <label className="scp-search" htmlFor={searchId}>
          <FiSearch aria-hidden="true" />
          <span className="scp-sr-only">ค้นหาเจ้าหน้าที่</span>
          <input
            id={searchId}
            type="search"
            placeholder="ค้นหาชื่อหรือชื่อผู้ใช้"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="scp-toggle-all"
          onClick={toggleShown}
          disabled={!shown.length}
        >
          {allShownSelected ? "ยกเลิกที่แสดงทั้งหมด" : "เลือกที่แสดงทั้งหมด"}
        </button>
      </div>
      {!people.length ? (
        <p className="scp-empty">{emptyText}</p>
      ) : !shown.length ? (
        <p className="scp-empty">ไม่พบรายชื่อที่ค้นหา</p>
      ) : (
        <ul className="scp-list">
          {shown.map((person) => (
            <li key={person.id}>
              <label className={selected.has(person.id) ? "is-checked" : ""}>
                <input
                  type="checkbox"
                  checked={selected.has(person.id)}
                  aria-required={
                    required && !selected.size && person === shown[0]
                      ? true
                      : undefined
                  }
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={() => toggle(person.id)}
                />
                <span>
                  <strong>{person.name || person.username}</strong>
                  <small>
                    @{person.username}
                    {person.hint ? ` · ${person.hint}` : ""}
                  </small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="scp-error" id={errorId} role="alert">
          {error}
        </p>
      )}
      <p className="scp-count" aria-live="polite">
        เลือกแล้ว {selected.size} คน
      </p>
    </fieldset>
  );
}
