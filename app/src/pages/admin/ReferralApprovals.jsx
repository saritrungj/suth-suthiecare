// Requests to refer a student to a hospital, waiting for approval inside the
// school. Approving sends the referral as the requester asked; declining needs
// a reason the requester sees in the student file.
import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { usePermissions } from "../../permissions/PermissionsProvider";
import {
  approveReferralRequest,
  declineReferralRequest,
  getReferralRequests,
} from "../../services/api";
import DataPanel from "../../components/table/DataPanel";
import ResultSummary from "../../components/table/ResultSummary";
import TablePagination from "../../components/table/TablePagination";
import usePagedRows from "../../components/table/usePagedRows";
import { PageHero } from "../../components/dashboard/DashboardKit";
import { REQUEST_STATUSES } from "../../components/case/CaseReferralPanel";
import {
  confirmAlert,
  showErrorAlert,
  showSuccessToast,
} from "../../utils/alerts";
import { toDisplayText } from "../../utils/textPresentation.js";
import {
  BarSelect,
  EmptyRow,
  LoadingRows,
  SchoolModal,
  TableScroll,
  formatThaiDate,
} from "./school/schoolUi";
import "./school/school.css";
import "./CaseReferrals.css";

export default function ReferralApprovals() {
  const { activeOrganization } = usePermissions();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [hidden, setHidden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [declining, setDeclining] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getReferralRequests(
        status ? { status } : undefined,
      );
      setRows(data?.data || []);
      setHidden(data?.hidden || null);
    } catch (err) {
      setError(err.response?.data?.message || "โหลดคำขอส่งต่อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => {
    load();
  }, [load, activeOrganization]);
  const paged = usePagedRows(rows, { resetKeys: [status] });

  const approve = async (item) => {
    if (
      !(await confirmAlert({
        title: `อนุมัติส่งต่อไป ${item.destination_name}?`,
        text: "ระบบจะส่งต่อทันที ปลายทางจะเห็นเหตุผลส่งต่อและรับเรื่องได้",
        confirmText: "อนุมัติและส่งต่อ",
      }))
    )
      return;
    try {
      await approveReferralRequest(item.id);
      await showSuccessToast("อนุมัติและส่งต่อแล้ว");
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "อนุมัติไม่สำเร็จ" });
    }
  };
  const decline = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await declineReferralRequest(declining.id, note.trim());
      setDeclining(null);
      setNote("");
      await showSuccessToast("บันทึกว่าไม่อนุมัติแล้ว");
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="sch-page">
      <PageHero
        title="อนุมัติการส่งต่อโรงพยาบาล"
        description="การส่งต่อนักเรียนไปหน่วยงานโรงพยาบาลจะถูกส่งจริงเมื่อได้รับการอนุมัติจากหน้านี้"
      />
      <DataPanel className="sch-card">
        <div className="sch-filter-bar">
          <BarSelect label="สถานะคำขอ" value={status} onChange={setStatus}>
            <option value="">ทุกสถานะ</option>
            {Object.entries(REQUEST_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </BarSelect>
        </div>
        <ResultSummary
          loading={loading}
          pagination={paged.pagination}
          chips={[
            {
              key: "status",
              label: "สถานะ",
              value: REQUEST_STATUSES[status],
              onRemove: () => setStatus(""),
            },
          ]}
          onClearAll={() => setStatus("")}
        />
        {hidden?.count > 0 && (
          <p className="sch-notice sch-notice--warning" role="note">
            มีคำขออีก {hidden.count.toLocaleString("th-TH")} รายการที่ไม่แสดง
            เพราะคุณดูผลสุขภาพจิตของนักเรียนคนนั้นไม่ได้
            {hidden.missing_permissions?.length
              ? ` (ต้องมีสิทธิ์ ${hidden.missing_permissions.join(", ")} ที่หน้าบทบาทและสิทธิ์)`
              : " (นักเรียนอยู่นอกขอบเขตที่คุณดูแล)"}
          </p>
        )}
        {error && (
          <p className="sch-error" role="alert">
            {error}
          </p>
        )}
        <TableScroll label="ตารางคำขอส่งต่อโรงพยาบาล">
          <table className="sch-table admin-data-table">
            <thead>
              <tr>
                <th>นักเรียน</th>
                <th>ส่งต่อไป</th>
                <th>เหตุผล</th>
                <th>ผู้ขอ</th>
                <th>สถานะ</th>
                <th className="sch-actions-col">พิจารณา</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows columns={6} />
              ) : !rows.length ? (
                <EmptyRow
                  columns={6}
                  title={
                    hidden?.count > 0
                      ? "ไม่มีคำขอส่งต่อที่คุณดูได้"
                      : "ไม่มีคำขอส่งต่อ"
                  }
                  hint="คำขอใหม่จะแสดงเมื่อครูส่งต่อนักเรียนไปหน่วยงานโรงพยาบาล"
                />
              ) : (
                paged.pageRows.map((item) => (
                  <tr key={item.id}>
                    <td data-label="นักเรียน">
                      <span className="sch-name">
                        {item.student?.name || "-"}
                      </span>
                      <span className="sch-sub">
                        {item.student?.student_code || ""}
                        {item.form_title
                          ? ` · ${toDisplayText(item.form_title)}`
                          : ""}
                      </span>
                    </td>
                    <td data-label="ส่งต่อไป">{item.destination_name}</td>
                    <td data-label="เหตุผล" className="sch-reason-cell">
                      {toDisplayText(item.reason)}
                      {item.decision_note && (
                        <span className="sch-sub">
                          เหตุผลที่ไม่อนุมัติ: {item.decision_note}
                        </span>
                      )}
                    </td>
                    <td data-label="ผู้ขอ">
                      {item.requested_by_name || "-"}
                      <span className="sch-sub">
                        {formatThaiDate(item.created_at)}
                      </span>
                    </td>
                    <td data-label="สถานะ">
                      <span
                        className={`ref-status ref-status--request-${item.status}`}
                      >
                        {REQUEST_STATUSES[item.status]}
                      </span>
                      {item.decided_by_name && (
                        <span className="sch-sub">
                          โดย {item.decided_by_name}
                        </span>
                      )}
                    </td>
                    <td className="is-actions">
                      {item.can_decide ? (
                        <div className="sch-row-actions">
                          <button
                            type="button"
                            className="sch-btn"
                            onClick={() => approve(item)}
                          >
                            <FiCheck aria-hidden="true" /> อนุมัติ
                          </button>
                          <button
                            type="button"
                            className="sch-btn-secondary"
                            onClick={() => setDeclining(item)}
                          >
                            <FiX aria-hidden="true" /> ไม่อนุมัติ
                          </button>
                        </div>
                      ) : (
                        <span className="sch-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
        <TablePagination
          page={paged.pagination.page}
          totalPages={paged.pagination.total_pages}
          total={paged.pagination.total}
          limit={paged.pagination.limit}
          onPage={paged.setPage}
          onLimit={paged.setLimit}
        />
      </DataPanel>
      {declining && (
        <SchoolModal
          title="ไม่อนุมัติการส่งต่อ"
          subtitle={`${declining.student?.name || ""} → ${declining.destination_name}`}
          onClose={() => setDeclining(null)}
          footer={
            <>
              <button
                type="button"
                className="sch-btn-secondary"
                onClick={() => setDeclining(null)}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="referral-decline-form"
                className="sch-btn"
                disabled={busy || !note.trim()}
              >
                บันทึกไม่อนุมัติ
              </button>
            </>
          }
        >
          <form id="referral-decline-form" onSubmit={decline}>
            <label className="sch-field">
              เหตุผลที่ไม่อนุมัติ (ผู้ขอจะเห็นข้อความนี้)
              <textarea
                rows={4}
                maxLength={1000}
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </form>
        </SchoolModal>
      )}
    </main>
  );
}
