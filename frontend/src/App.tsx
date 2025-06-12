import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DriverDashboard from "./pages/DriverDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyCodePage from "./pages/VerifyCodePage";
import Logo from "./components/Logo";

// Redirect to dashboard if token/role is present
function AutoRedirect() {
  const token = localStorage.getItem("token");
  const role = (localStorage.getItem("role") || "").toLowerCase();
  if (token) {
    if (role === "driver") return <Navigate to="/driver" replace />;
    if (role === "customer") return <Navigate to="/customer" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/login" replace />;
}

// Protect a route, redirect to login if no token
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div>
      <Logo />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyCodePage />} />
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
        <Route path="/" element={<AutoRedirect />} />
      </Routes>
    </div>
  );
}