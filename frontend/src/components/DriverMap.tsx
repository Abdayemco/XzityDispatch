import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaHistory, FaDollarSign, FaUser } from "react-icons/fa";
import DriverMap from "../components/DriverMap";

type Job = {
  id: string;
  pickupLat: number;
  pickupLng: number;
  customerName: string;
  status: "pending" | "accepted" | "cancelled" | "done";
  vehicleType: "car" | "bike" | "toktok" | "truck";
  assignedDriverId?: string;
};

export default function DriverDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [driverJobId, setDriverJobId] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const navigate = useNavigate();

  // Get driver info from localStorage (or context if you use one)
  const driverId = localStorage.getItem("driverId") || "";
  const driverVehicleType = localStorage.getItem("vehicleType") || "car";

  // Auth guard: redirect to login if no token
  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

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
      const url = `/api/rides/available?vehicleType=${driverVehicleType}`;
      const res = await fetch(url);
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching jobs", err);
      setJobs([]);
    }
  }, [driverVehicleType]);

  // Poll jobs every 10 seconds
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Accept a job
  async function handleAccept(jobId: string) {
    if (driverJobId) return;
    try {
      const res = await fetch(`/api/rides/${jobId}/accept`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // No body needed if driverId comes from auth middleware on backend
      });
      if (res.ok) {
        setDriverJobId(jobId);
        await fetchJobs();
        alert(`You have accepted job ${jobId}`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to accept job");
      }
    } catch (err) {
      alert("Failed to accept job");
    }
  }

  // Only show jobs matching driver's vehicle type or accepted by this driver
  const visibleJobs = jobs.filter(
    (job) =>
      (job.status === "pending" && job.vehicleType === driverVehicleType) ||
      (job.status === "accepted" && job.assignedDriverId === driverId)
  );

  // Job in progress: accepted but not yet marked as done
  const jobInProgress = jobs.find(
    (job) => job.status === "accepted" && job.assignedDriverId === driverId
  );

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>Available Rides</h2>
      {!jobInProgress ? (
        <DriverMap
          jobs={visibleJobs}
          driverLocation={driverLocation}
          driverVehicleType={driverVehicleType}
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
      {/* Job completion/cancel would go here, implement once backend supports */}
    </div>
  );
}