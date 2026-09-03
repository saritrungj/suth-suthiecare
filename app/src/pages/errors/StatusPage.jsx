import { Link, useNavigate } from "react-router-dom";
import "./StatusPage.css";

const copy = {
  403: ["403", "คุณไม่มีสิทธิ์เข้าถึงหน้านี้", "สิทธิ์ของบัญชีหรือหน่วยงานที่เลือกไม่อนุญาตให้ทำรายการนี้"],
  404: ["404", "ไม่พบหน้าที่ต้องการ", "ที่อยู่อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายไปแล้ว"],
  500: ["500", "ระบบขัดข้องชั่วคราว", "กรุณาลองใหม่อีกครั้ง หากยังพบปัญหา โปรดติดต่อผู้ดูแลระบบ"],
};

export default function StatusPage({ status }) {
  const navigate = useNavigate();
  const [code, title, detail] = copy[status] || copy[500];
  return <main className="status-page"><section><p className="status-code">{code}</p><h1>{title}</h1><p>{detail}</p><div className="status-actions"><button type="button" onClick={() => status === 500 ? window.location.reload() : navigate(-1)}>ย้อนกลับ</button><Link to="/admin/dashboard">ไปหน้าแดชบอร์ด</Link></div></section></main>;
}
