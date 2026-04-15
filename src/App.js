import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider, useDataContext } from './contexts/DataContext';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import WelcomePage from './pages/WelcomePage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import PlanningPage from './pages/PlanningPage';
import PsfTrackingPage from './pages/PsfTrackingPage';
import MaterialsCalcPage from './pages/MaterialsCalcPage';
import AIAgentPage from './pages/AIAgentPage';
import AdminPage from './pages/AdminPage';
import MaterialePage from './pages/MaterialePage';
import ComenziPage from './pages/ComenziPage';
import ComenziProductiePage from './pages/ComenziProductiePage';

function ProtectedRoute({ children }) {
  const { loading } = useDataContext();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-8 h-8 rounded-sm bg-orange-600 animate-pulse flex items-center justify-center">
        <span className="text-white font-bold text-sm">P</span>
      </div>
    </div>
  );
  return <Layout>{children}</Layout>;
}

function DefaultRedirect() {
  // Always go to dashboard — WelcomePage is accessible from sidebar
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome"        element={<WelcomePage />} />
      <Route path="/dashboard"      element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/comenzi"        element={<ProtectedRoute><ComenziPage /></ProtectedRoute>} />
      <Route path="/planning"       element={<ProtectedRoute><PlanningPage /></ProtectedRoute>} />
      <Route path="/materiale"      element={<ProtectedRoute><MaterialePage /></ProtectedRoute>} />
      <Route path="/cp"             element={<ProtectedRoute><ComenziProductiePage /></ProtectedRoute>} />
      <Route path="/orders"         element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
      <Route path="/psf-tracking"   element={<ProtectedRoute><PsfTrackingPage /></ProtectedRoute>} />
      <Route path="/materials-calc" element={<ProtectedRoute><MaterialsCalcPage /></ProtectedRoute>} />
      <Route path="/ai-agent"       element={<ProtectedRoute><AIAgentPage /></ProtectedRoute>} />
      <Route path="/admin"          element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="*"               element={<DefaultRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </DataProvider>
    </BrowserRouter>
  );
}

export default App;
