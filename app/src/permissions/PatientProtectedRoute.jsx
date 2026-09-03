import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getPatientSession } from "../utils/patientSession";

export default function PatientProtectedRoute({ children }) {
  const location = useLocation();
  const { token, user } = getPatientSession();
  if (!token || !user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/account/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return children;
}
