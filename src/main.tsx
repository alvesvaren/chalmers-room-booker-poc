import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n/i18n";
import { Root } from "./Root.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
