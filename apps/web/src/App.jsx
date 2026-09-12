import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout';
import Snackbar from './components/Snackbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateSplit from './pages/CreateSplit';
import SplitDetail from './pages/SplitDetail';
import ProfilePage from './pages/ProfilePage';

function RequireAuth() {
  const { ready, authenticated, tokenReady } = useAuth();

  if (!ready || (authenticated && !tokenReady)) {
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
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Snackbar />
    </BrowserRouter>
  );
}
