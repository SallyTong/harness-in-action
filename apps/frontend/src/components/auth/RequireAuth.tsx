import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "../../lib/auth";

/** Route guard: redirects unauthenticated visitors to /login. */
export default function RequireAuth() {
  return isAuthenticated() ? <Outlet /> : <Navigate to="/login" replace />;
}
