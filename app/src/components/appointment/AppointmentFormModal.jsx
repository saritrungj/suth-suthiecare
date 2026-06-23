import "./AppointmentFormModal.css";
import { useState, useEffect } from "react";

export default function AppointmentFormModal({
  user,
  appointment,
  onClose,
  onSave,
}) {
  const [services, setServices] = useState([
    "ตรวจสุขภาพ",
    "กายภาพบำบัด",
    "ให้คำปรึกษา",
    "ติดตามอาการ",
  ]);

  const [risk, setRisk] = useState(appointment?.status || "warning");

  const [appointmentNo, setAppointmentNo] = useState(appointment?.id || "");

  const [selectedServices, setSelectedServices] = useState(
    appointment?.service ? [appointment.service] : [],
  );

  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [staff, setStaff] = useState("");

  useEffect(() => {
    if (appointment) {
      setRisk(appointment.status);
      setAppointmentNo(appointment.id);
      setSelectedServices([appointment.service]);
      setNote(appointment.note || "");
      setStaff(appointment.staff || "");

      if (appointment.date) {
        const d = new Date(appointment.date);

        const local =
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0") +
          "T" +
          String(d.getHours()).padStart(2, "0") +
          ":" +
          String(d.getMinutes()).padStart(2, "0");

        setDate(local);
      }
    }
  }, [appointment]);

  const toggleService = (s) => {
    setSelectedServices(
      (prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [s]), // เลือกได้ 1 อย่าง
    );
  };
  const addService = () => {
    if (!newService.trim()) return;

    setServices((prev) => [...prev, newService]);
    setNewService("");
  };

  const removeService = (service) => {
    setServices((prev) => prev.filter((s) => s !== service));
  };

  const handleSave = () => {
    const payload = {
      id: appointmentNo || Date.now(),
      service: selectedServices[0],
      date,
      staff,
      note,
      status: risk,
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="form-modal">
        <div className="modal-header">
          <div>
            <h3>{appointment ? "แก้ไขนัดหมาย" : "เพิ่มนัดหมาย"}</h3>
            <p>Case ID: {user?.caseId}</p>
          </div>

          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-body">
          <div className="form-row">
            <label>นัดหมายครั้งที่:</label>

            <input
              className="short-input"
              list="appointment-list"
              value={appointmentNo}
              onChange={(e) => setAppointmentNo(e.target.value)}
              placeholder="เลือกหรือพิมพ์"
            />

            <datalist id="appointment-list">
              <option value="1" />
              <option value="2" />
              <option value="3" />
              <option value="4" />
              <option value="5" />
            </datalist>
          </div>

          <input
            type="datetime-local"
            className="date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <input
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
            placeholder="เจ้าหน้าที่"
          />

          <div className="form-section">
            <label>ประเภทบริการ</label>

            <div className="service-tags">
              {services.map((s) => (
                <button
                  key={s}
                  className={
                    selectedServices.includes(s) ? "tag active" : "tag"
                  }
                  onClick={() => toggleService(s)}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label>ความเสี่ยง</label>

            <div className="risk-group">
              <button
                type="button"
                className={`risk urgent ${risk === "urgent" ? "active" : ""}`}
                onClick={() => setRisk("urgent")}
              >
                เร่งด่วน
              </button>

              <button
                type="button"
                className={`risk warning ${risk === "warning" ? "active" : ""}`}
                onClick={() => setRisk("warning")}
              >
                เฝ้าระวัง
              </button>

              <button
                type="button"
                className={`risk normal ${risk === "normal" ? "active" : ""}`}
                onClick={() => setRisk("normal")}
              >
                ปกติ
              </button>
            </div>
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="xxxx"
          />
        </div>

        <div className="form-actions">
          <button onClick={onClose}>ยกเลิก</button>

          <button type="button" className="save" onClick={handleSave}>
            บันทึกการนัดหมาย
          </button>
        </div>
      </div>
    </div>
  );
}
