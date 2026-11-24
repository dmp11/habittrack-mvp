import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ForgotPassword } from './pages/ForgotPassword';
import { Habits } from './pages/Habits';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ResetPassword } from './pages/ResetPassword';
import { Settings } from './pages/Settings';
import { StatsPage } from './pages/Stats';

export function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Habits />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
