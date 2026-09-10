import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateSplit from './pages/CreateSplit';
import SplitDetail from './pages/SplitDetail';

function RequireAuth() {
  const { ready, authenticated } = useAuth();

  if (!ready) {
    return (
      <div className="login-page">
        <p className="login-footer">Loading…</p>
      </div>
    );
  }
  if (!authenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateSplit />} />
            <Route path="/splits/:id" element={<SplitDetail />} />
            <Route path="/splits" element={<Dashboard />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
