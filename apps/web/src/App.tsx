import { Routes, Route, Navigate } from "react-router-dom";
import { useApi } from "./api/ApiProvider";
import { useEmbeddedWallet } from "./privy/useEmbeddedWallet";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { SplitPage } from "./pages/SplitPage";

export function App() {
  const { ready, authenticated } = useApi();
  const { ready: walletReady } = useEmbeddedWallet();

  if (!ready || !walletReady) {
    return <p>Loading…</p>;
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/splits/:id" element={<SplitPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
