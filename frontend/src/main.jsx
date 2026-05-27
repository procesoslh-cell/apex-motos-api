import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// =====================================================
// SERVICE WORKER / PWA
// =====================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("PWA lista");
      })
      .catch((error) => {
        console.error(
          "Error registrando service worker:",
          error
        );
      });
  });
}