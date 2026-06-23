import "./AppointmentDetailModal.css";
import AppointmentFormModal from "./AppointmentFormModal";

export default function AppointmentDetailModal({
  user,
  appointments,
  onClose,
  onAdd,
  onEdit,
}) {
  const statusConfig = {
    urgent: { label: "เร่งด่วน", icon: "🔔" },
    warning: { label: "เฝ้าระวัง", icon: "🔔" },
    normal: { label: "ปกติ", icon: "🔔" },
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="detail-modal">
          <div className="modal-header">
            <div>
              <h3>{user?.name}</h3>
              <p>Case ID: {user?.caseId}</p>
            </div>

            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="appointment-list">
            {appointments.map((a, index) => {
              const status = statusConfig[a.status];

              return (
                <div key={a.id} className={`appointment-card ${a.status}`}>
                  <div className="appoint-number">{index + 1}</div>

                  <div className="appoint-info">
                    <h4>นัดหมายครั้งที่</h4>
                    <p>บริการ : {a.service}</p>
                    <p>{a.date}</p>

                    <div className="note">📄 ({a.note})</div>
                  </div>

                  <div className={`appoint-status ${a.status}`}>
                    <div className="status-icon">{status.icon}</div>

                    <span className="status-text">{status.label}</span>
                  </div>

                  <button className="edit-btn" onClick={() => onEdit(a)}>
                    ✎
                  </button>
                </div>
              );
            })}
          </div>

          <button className="add-btn" onClick={onAdd}>
            + เพิ่มนัดหมาย
          </button>
        </div>
      </div>
    </>
  );
}
