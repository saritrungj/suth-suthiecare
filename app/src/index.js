import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./App";
import "./styles/modal-system.css";
import "./styles/button-system.css";
import "./styles/filter-system.css";
import { registerServiceWorker } from "./pwa/registerServiceWorker.js";

registerServiceWorker();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
