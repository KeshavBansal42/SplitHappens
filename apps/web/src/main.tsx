import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter } from "react-router-dom";
import { PrivyProvider } from "./privy/PrivyProvider";
import { ApiProvider } from "./api/ApiProvider";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrivyProvider>
      <ApiProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ApiProvider>
    </PrivyProvider>
  </StrictMode>,
);
