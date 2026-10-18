import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./App";
import "./styles/tokens.css";
import "./styles/case-workspace.css";
import "./styles/modal-system.css";
import "./styles/button-system.css";
import "./styles/filter-system.css";
import "./styles/data-table-system.css";
import "./styles/kit-system.css";
import "./styles/public-theme.css";
import { registerServiceWorker } from "./pwa/registerServiceWorker.js";

registerServiceWorker();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
