import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AppProviders, useAuth, hasRole } from './lib/auth.jsx';
import { ToastProvider, PageLoader } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register } from './pages/Auth.jsx';
import { CustomerLayout, Dashboard, CardPage, Marketplace, TiersPage, MilestonesPage, ExclusivePage, HistoryPage, AccountPage } from './pages/Customer.jsx';

const Program = lazy(() => import('./pages/Program.jsx'));
const Poster = lazy(() => import('./pages/Poster.jsx'));
const StaffApp = lazy(() => import('./pages/Staff.jsx'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'));

function RequireCustomer({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'customer') return <Navigate to={hasRole(user, 'manager') ? '/admin' : '/staff'} replace />;
  return children;
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/program" element={<Program />} />
        <Route path="/poster" element={<Poster />} />
        <Route
          path="/app"
          element={
            <RequireCustomer>
              <CustomerLayout />
            </RequireCustomer>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="card" element={<CardPage />} />
          <Route path="rewards" element={<Marketplace />} />
          <Route path="tiers" element={<TiersPage />} />
          <Route path="milestones" element={<MilestonesPage />} />
          <Route path="exclusive" element={<ExclusivePage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
        <Route path="/staff/*" element={<StaffApp />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>
);
