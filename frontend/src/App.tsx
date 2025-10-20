import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DriverDashboard from "./pages/DriverDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLiveMap from "./pages/AdminLiveMap";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyCodePage from "./pages/VerifyCodePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage"; // <-- Import your privacy policy page
import ContactAdminButton from "./components/ContactAdminButton";
import ShareButton from "./components/ShareButton";
import logo from "./assets/logo.png"; // <-- import your logo

// Protect a route, redirect to login if no token
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// After login, redirect by role
function DashboardRedirect() {
  const token = localStorage.getItem("token");
  const role = (localStorage.getItem("role") || "").toLowerCase();
  if (!token) return <Navigate to="/login" replace />;
  if (role === "driver") return <Navigate to="/driver" replace />;
  if (role === "customer") return <Navigate to="/customer" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      {/* Logo at top-left floating */}
      <img
        src={logo}
        alt="Site Logo"
        style={{
          position: "absolute",
          top: 3,
          left: 18,
          height: 67,
          zIndex: 101,
          objectFit: "contain"
        }}
      />
      <ShareButton /> {/* Top-right floating share button */}
      <Routes>
        {/* Login page is now also the root page */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyCodePage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} /> {/* <-- Privacy Policy page */}

        <Route
          path="/driver"
          element={
            <ProtectedRoute>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer"
          element={
            <ProtectedRoute>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/live-map"
          element={
            <ProtectedRoute>
              <AdminLiveMap />
            </ProtectedRoute>
          }
        />

        {/* Helper route to go to dashboard based on role */}
        <Route path="/dashboard" element={<DashboardRedirect />} />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Contact button always at the bottom right */}
      <ContactAdminButton />
    </>
  );
}