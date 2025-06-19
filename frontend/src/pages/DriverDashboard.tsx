import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaHistory, FaDollarSign, FaUser } from "react-icons/fa";
import AppMap from "../components/AppMap";

type Job = {
  id: string;
  pickupLat: number;
  pickupLng: number;
  customerName: string;
  status: "pending" | "accepted" | "cancelled" | "done";
  vehicleType: "car" | "bike" | "toktok" | "tuktuk" | "truck";
  assignedDriverId?: string | number;
};

export default function DriverDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [driverJobId, setDriverJobId] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  // Get driver info from localStorage
  const driverId = localStorage.getItem("driverId") || "";
  let driverVehicleType = (localStorage.getItem("vehicleType") || "car").toLowerCase();
  if (driverVehicleType === "toktok") driverVehicleType = "tuktuk";
  const token = localStorage.getItem("token");

  // Auth guard: redirect to login if no token
  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
    }
  }, [navigate, token]);

  // Get driver's location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setDriverLocation({ lat: 51.505, lng: -0.09 }) // fallback to London
    );
  }, []);

  // Fetch jobs from backend
  const fetchJobs = useCallback(async () => {
    try {
      setErrorMsg(null);
      const url = `/api/rides/available?vehicleType=${driverVehicleType}`;
      const res = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setJobs(Array.isArray(data) ? data : []);
      } else {
        setErrorMsg(data?.error || "Server returned an error fetching jobs.");
        setJobs([]);
      }
    } catch (err) {
      setErrorMsg("Network error fetching jobs.");
      setJobs([]);
    }
  }, [driverVehicleType, token]);

  // Poll jobs every 10 seconds
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Accept a job
  async function handleAccept(jobId: string) {
    if (driverJobId) return;
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/rides/${jobId}/accept`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok) {
        setDriverJobId(jobId);
        await fetchJobs();
        setStatusMsg(`You have accepted job ${jobId}`);
      } else {
        setErrorMsg(data?.error || "Failed to accept job");
      }
    } catch (err) {
      setErrorMsg("Failed to accept job");
    }
  }

  // Only show jobs matching driver's vehicle type (or accepted by this driver)
  const visibleJobs = jobs.filter(
    (job) =>
      (job.status === "pending" &&
        (job.vehicleType === driverVehicleType ||
          (driverVehicleType === "tuktuk" && job.vehicleType === "toktok"))) ||
      (job.status === "accepted" && String(job.assignedDriverId) === String(driverId))
  );

  // Job in progress: accepted but not yet marked as done
  const jobInProgress = jobs.find(
    (job) => job.status === "accepted" && String(job.assignedDriverId) === String(driverId)
  );

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>Available Rides</h2>
      {errorMsg && <div style={{ color: "#d32f2f", textAlign: "center" }}>{errorMsg}</div>}
      {statusMsg && <div style={{ color: "#388e3c", textAlign: "center" }}>{statusMsg}</div>}
      {!jobInProgress ? (
        <AppMap
          jobs={visibleJobs}
          driverLocation={driverLocation || undefined}
          driverVehicleType={driverVehicleType}
          showDriverMarker={true}
        />
      ) : (
        <div style={{
          background: "#e0e0e0", borderRadius: 8, margin: "24px 0", height: 320,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <span style={{ color: "#388e3c", fontWeight: "bold", fontSize: 20 }}>
            Ride in progress...
          </span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-around", marginTop: 20 }}>
        <FaHistory size={32} title="Ride History" />
        <FaDollarSign size={32} title="Earnings" />
        <FaUser size={32} title="Profile" />
      </div>
      {driverJobId && !jobInProgress && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <span style={{ color: "#388e3c", fontWeight: "bold" }}>
            You have accepted a job. You can't accept another until it is completed or cancelled.
          </span>
        </div>
      )}
      {/* Accept button for jobs */}
      {!driverJobId && !jobInProgress && visibleJobs.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <h4>Accept a Job</h4>
          {visibleJobs.map(job => (
            <button
              key={job.id}
              onClick={() => handleAccept(job.id)}
              style={{
                margin: "0 8px", padding: "0.5em 1em", background: "#1976D2", color: "#fff",
                border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold"
              }}
              disabled={!!driverJobId}
            >
              Accept Ride ({job.customerName})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}