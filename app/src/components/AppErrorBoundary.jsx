import React from "react";
import { FiAlertTriangle, FiHome, FiRefreshCw } from "react-icons/fi";
import { StatusLayout } from "../pages/errors/StatusPage";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Application render error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // The boundary may sit outside the router, so it uses plain links only.
    return (
      <div role="alert">
        <StatusLayout
          icon={FiAlertTriangle}
          tone="danger"
          label="แสดงผลไม่สำเร็จ"
          title="เกิดข้อผิดพลาดในการแสดงหน้านี้"
          detail="กรุณาลองโหลดหน้าใหม่ หากยังพบปัญหาให้ติดต่อเจ้าหน้าที่"
          hints={[
            "ข้อมูลที่บันทึกไว้แล้วยังอยู่ครบ",
            "หากแจ้งเจ้าหน้าที่ โปรดระบุหน้าและเวลาที่เกิดเหตุ",
          ]}
          reference={`หน้า: ${window.location.pathname}`}
          actions={
            <>
              <button
                type="button"
                className="status-btn status-btn--primary"
                onClick={this.handleReload}
              >
                <FiRefreshCw aria-hidden="true" /> โหลดหน้าใหม่
              </button>
              <a className="status-btn" href="/">
                <FiHome aria-hidden="true" /> ไปหน้าแรก
              </a>
            </>
          }
        />
      </div>
    );
  }
}
