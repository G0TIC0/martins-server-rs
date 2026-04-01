import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SupabaseProvider, useSupabase } from './context/SupabaseContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Items } from './pages/Items';
import { Quotes } from './pages/Quotes';
import { QuoteDetail } from './pages/QuoteDetail';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useSupabase();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#111827] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <SupabaseProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items"
            element={
              <ProtectedRoute>
                <Items />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotes"
            element={
              <ProtectedRoute>
                <Quotes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotes/:id"
            element={
              <ProtectedRoute>
                <QuoteDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SupabaseProvider>
  );
}
