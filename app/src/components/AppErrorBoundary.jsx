import React from "react";

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

    return (
      <main
        role="alert"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "Sarabun, system-ui, sans-serif",
        }}
      >
        <div>
          <h1>เกิดข้อผิดพลาดในการแสดงหน้านี้</h1>
          <p>กรุณาลองโหลดหน้าใหม่ หากยังพบปัญหาให้ติดต่อเจ้าหน้าที่</p>
          <button type="button" onClick={this.handleReload}>
            โหลดหน้าใหม่
          </button>
        </div>
      </main>
    );
  }
}
