import { Navigate } from "react-router-dom";

// Redirect to unified Schedule page
export default function CRMAppointments() {
  return <Navigate to="/crm/schedule" replace />;
}
