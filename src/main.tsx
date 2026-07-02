import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { captureUtmParams } from "./hooks/useUtmParams";

// Capture UTM params from landing URL before React renders
captureUtmParams();

// Startup recovery and service worker registration are handled in index.html
// before React hydration.

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
