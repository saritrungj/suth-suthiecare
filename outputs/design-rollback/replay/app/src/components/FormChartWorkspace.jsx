import { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";
import api from "../services/api";
import { usePermissions } from "../permissions/PermissionsProvider";
import { aggregateChart, chartQuestions } from "../utils/chartAggregation";
import { toDisplayText } from "../utils/textPresentation";
import AddChartModal from "./AddChartModal";
import FormChartView from "./FormChartView";
import "./FormChartWorkspace.css";
function SavedChart({
  chart,
  forms,
  startDate,
  endDate,
  onEdit,
  onRemove,
  onMove,
  index,
  count,
  busy,
}) {
  const [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const form = forms.find((f) => String(f.id) === String(chart.formId));
  const question = chartQuestions(form?.questions || []).find(
    (q) => String(q.id) === String(chart.question),
  );
  useEffect(() => {
    let alive = true;
    setRows([]);
    setError("");
    setLoading(true);
    api
      .get(
        `/charts/${encodeURIComponent(chart.formId)}/${encodeURIComponent(chart.question)}`,
        { params: { startDate, endDate } },
      )
      .then((r) => {
        if (alive) setRows(r.data);
      })
      .catch((e) => {
        if (alive)
          setError(e.response?.data?.message || "ไม่สามารถโหลดกราฟได้");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [chart.formId, chart.question, startDate, endDate, retry]);
  const data = useMemo(
    () => aggregateChart(rows, chart, question),
    [rows, chart, question],
  );
  return (
    <article className="fc-card">
      <header>
        <div>
          <h3>{toDisplayText(chart.title)}</h3>
          <p>
            {toDisplayText(form?.title) ||
              "แบบฟอร์มถูกลบหรืออยู่นอกขอบเขตสิทธิ์"}
          </p>
        </div>
        <div className="fc-tools">
          <button
            disabled={busy || index === 0}
            onClick={() => onMove(index, -1)}
            aria-label={`เลื่อน ${chart.title} ขึ้น`}
          >
            <FiArrowUp />
          </button>
          <button
            disabled={busy || index === count - 1}
            onClick={() => onMove(index, 1)}
            aria-label={`เลื่อน ${chart.title} ลง`}
          >
            <FiArrowDown />
          </button>
          <button
            disabled={busy}
            onClick={() => onEdit(chart)}
            aria-label={`แก้ไข ${chart.title}`}
          >
            <FiEdit2 />
          </button>
          <button
            disabled={busy}
            onClick={() => onRemove(chart)}
            aria-label={`ลบ ${chart.title}`}
          >
            <FiTrash2 />
          </button>
        </div>
      </header>
      {loading ? (
        <p role="status" className="fc-empty">
          กำลังโหลดกราฟ…
        </p>
      ) : error ? (
        <div className="fc-error" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>ลองอีกครั้ง</button>
        </div>
      ) : (
        <>
          <p className="fc-hint">
            {rows.length.toLocaleString("th-TH")} ชุดคำตอบ ·{" "}
            {chart.mode === "result"
              ? "ผลสรุปคะแนน"
              : chart.aggregation === "sum"
                ? "ผลรวมตัวเลข"
                : chart.aggregation === "average"
                  ? "ค่าเฉลี่ยตัวเลข"
                  : "จำนวนคำตอบ"}
          </p>
          <FormChartView
            data={data}
            type={chart.type}
            title={chart.title}
            aggregation={chart.aggregation || "count"}
          />
        </>
      )}
    </article>
  );
}
export default function FormChartWorkspace({ startDate, endDate, formId }) {
  const { activeOrganization } = usePermissions();
  const [forms, setForms] = useState([]),
    [charts, setCharts] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [editor, setEditor] = useState(null),
    [remove, setRemove] = useState(null),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setForms([]);
    setCharts([]);
    setEditor(null);
    setRemove(null);
    setLoading(true);
    setError("");
    if (!activeOrganization || activeOrganization === "all") {
      setLoading(false);
      return;
    }
    Promise.all([
      api.get("/dashboard/forms"),
      api.get("/dashboard-settings/settings"),
    ])
      .then(([f, s]) => {
        if (!alive) return;
        const stored =
          typeof s.data.active_charts === "string"
            ? JSON.parse(s.data.active_charts)
            : s.data.active_charts || {};
        setForms(f.data);
        setCharts(
          Object.entries(stored)
            .flatMap(([id, list]) =>
              Array.isArray(list)
                ? list.map((c) => ({ ...c, formId: String(c.formId || id) }))
                : [],
            )
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
        );
      })
      .catch(() => {
        if (alive) setError("โหลดเครื่องมือกราฟไม่สำเร็จ กรุณาลองอีกครั้ง");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeOrganization, retry]);
  const persist = async (next) => {
    setBusy(true);
    setError("");
    const grouped = next.reduce((acc, c, position) => {
      (acc[c.formId] ||= []).push({
        ...Object.fromEntries(
          Object.entries(c).filter(([key]) => key !== "data"),
        ),
        position,
      });
      return acc;
    }, {});
    try {
      await api.post("/dashboard-settings/settings", {
        formId: formId || next[0]?.formId || null,
        charts: grouped,
      });
      setCharts(next);
    } catch (e) {
      setError(e.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const save = (chart) =>
    persist(
      charts.some((c) => c.id === chart.id)
        ? charts.map((c) => (c.id === chart.id ? chart : c))
        : [...charts, chart],
    );
  const move = async (index, direction) => {
    const next = [...charts];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    try {
      await persist(next);
    } catch {}
  };
  return (
    <section className="fc-workspace" aria-labelledby="fc-title">
      <div className="fc-heading">
        <div>
          <h2 id="fc-title">กราฟและรายงานจากแบบฟอร์ม</h2>
          <p>
            เลือกข้อมูลจากทุกแบบฟอร์มในหน่วยงาน ·
            กราฟทั้งหมดใช้ช่วงวันที่ที่เลือก
          </p>
        </div>
        <button
          className="fc-primary"
          disabled={loading || busy || !forms.length}
          onClick={() => setEditor({})}
        >
          <FiPlus />
          สร้างกราฟ
        </button>
      </div>
      {error && (
        <p className="fc-error" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>ลองอีกครั้ง</button>
        </p>
      )}
      {loading ? (
        <p role="status">กำลังโหลดแบบฟอร์มและกราฟ…</p>
      ) : activeOrganization === "all" ? (
        <p className="fc-empty">เลือกหน่วยงานเพื่อจัดการกราฟ</p>
      ) : !charts.length && !error ? (
        <div className="fc-empty">
          <FiBarChart2 size={36} />
          <h3>เริ่มจากข้อมูลที่อยากติดตาม</h3>
          <p>
            {forms.length
              ? `มี ${forms.length} แบบฟอร์มให้เลือก สร้างกราฟและปรับวิธีสรุปได้ตามงานของหน่วยงาน`
              : "ยังไม่มีแบบฟอร์มในหน่วยงานนี้"}
          </p>
        </div>
      ) : (
        <div className="fc-grid">
          {charts.map((chart, index) => (
            <SavedChart
              key={`${activeOrganization}-${chart.id}`}
              chart={chart}
              forms={forms}
              startDate={startDate}
              endDate={endDate}
              index={index}
              count={charts.length}
              busy={busy}
              onEdit={setEditor}
              onRemove={setRemove}
              onMove={move}
            />
          ))}
        </div>
      )}
      <AddChartModal
        isOpen={editor !== null}
        initialChart={editor?.id ? editor : null}
        forms={forms}
        formId={formId}
        startDate={startDate}
        endDate={endDate}
        onSave={save}
        onClose={() => setEditor(null)}
      />
      {remove && (
        <div
          className="fc-confirm"
          role="alertdialog"
          aria-label="ยืนยันการลบกราฟ"
        >
          <p>ลบกราฟ “{toDisplayText(remove.title)}”?</p>
          <p>คำตอบแบบฟอร์มยังคงอยู่</p>
          <button disabled={busy} onClick={() => setRemove(null)}>
            ยกเลิก
          </button>
          <button
            className="fc-primary"
            disabled={busy}
            onClick={async () => {
              try {
                await persist(charts.filter((c) => c.id !== remove.id));
                setRemove(null);
              } catch {}
            }}
          >
            ยืนยันลบกราฟ
          </button>
        </div>
      )}
    </section>
  );
}
