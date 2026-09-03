import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./HistorySearch.css";

export default function HistorySearch() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/history/result", { replace: true }); }, [navigate]);
  return <main className="history-search-container" aria-live="polite"><div className="history-container"><div className="history-card-premium">กำลังเปิดประวัติของคุณ...</div></div></main>;
}
