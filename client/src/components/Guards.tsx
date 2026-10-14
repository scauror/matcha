import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IncompleteGate } from "./IncompleteGate";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-lead">Chargement…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) return <p className="page-lead">Chargement…</p>;
  if (user) return <Navigate to={user.profileComplete ? "/browse" : "/profile"} replace />;
  return <Outlet />;
}

export function CompleteProfileRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-lead">Chargement…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!user.profileComplete) return <IncompleteGate />;
  return <Outlet />;
}
