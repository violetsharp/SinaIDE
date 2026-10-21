import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-mono/latin-400.css";
import "@fontsource/fraunces/latin-500.css";
import "./workspace.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
