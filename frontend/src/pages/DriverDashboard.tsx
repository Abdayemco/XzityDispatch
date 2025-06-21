import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaHistory, FaDollarSign, FaUser } from "react-icons/fa";
import AppMap from "../components/AppMap";

type Job = {
  id: string | number;
  pickupLat: number;
  pickupLng: number;
  customerName: string;
  vehicleType: "car" | "bike" | "toktok" | "tuktuk" | "truck";
  status?: "pending" | "accepted" | "cancelled" | "done" | "arrived" | "in_progress";
  assignedDriverId?: string | number;
};

const IN_PROGRESS_TIMEOUT_MINUTES = 15;
const ACCEPTED_TIMEOUT_MINUTES = 15;

export default function DriverDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [driverJobId, setDriverJobId] = useState<string | null>(null);
  const [acceptedJob, setAcceptedJob] = useState<Job | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [autoReleaseTimer, setAutoReleaseTimer] = useState<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState(0);
  const beepRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();

  // Track when driver starts the ride (for auto-release after 15min if customer forgets)
  const [rideStartedAt, setRideStartedAt] = useState<number | null>(
    () => {
      const saved = localStorage.getItem("rideStartedAt");
      return saved ? Number(saved) : null;
    }
  );

  // Track when driver accepts the ride (for auto-release after 15min if driver doesn't start)
  const [rideAcceptedAt, setRideAcceptedAt] = useState<number | null>(
    () => {
      const saved = localStorage.getItem("rideAcceptedAt");
      return saved ? Number(saved) : null;
    }
  );

  // Get driver info from localStorage
  const driverId = localStorage.getItem("driverId") || "";
  let driverVehicleType = (localStorage.getItem("vehicleType") || "car").toLowerCase();
  if (driverVehicleType === "toktok") driverVehicleType = "tuktuk";
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
  }, [navigate, token]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoaded(true);
      },
      () => {
        setDriverLocation({ lat: 51.505, lng: -0.09 });
        setLocationLoaded(true);
      }
    );
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      setErrorMsg(null);
      const url = `/api/rides/available?vehicleType=${driverVehicleType}&driverId=${driverId}`;
      const res = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setJobs(data);
      else {
        setErrorMsg(data?.error || "Server returned an error fetching jobs.");
        setJobs([]);
      }
    } catch {
      setErrorMsg("Network error fetching jobs.");
      setJobs([]);
    }
  }, [driverVehicleType, token, driverId]);

  // Poll for jobs if not on completed/cancelled screen or on a job
  useEffect(() => {
    if (!locationLoaded || driverJobId || cancelled || completed) return;
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs, locationLoaded, driverJobId, cancelled, completed]);

  async function handleAccept(jobId: string) {
    if (driverJobId) return;
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const now = Date.now();
      const res = await fetch(`/api/rides/${jobId}/accept?driverId=${driverId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok) {
        setDriverJobId(jobId);
        setAcceptedJob(jobs.find(j => String(j.id) === String(jobId)) || null);
        setStatusMsg(`You have accepted job ${jobId}`);
        setCancelled(false);
        setCompleted(false);
        setRideAcceptedAt(now);
        localStorage.setItem("rideAcceptedAt", String(now));
      } else setErrorMsg(data?.error || "Failed to accept job");
    } catch {
      setErrorMsg("Failed to accept job");
    }
  }

  // Start Ride handler, records "rideStartedAt" and clears "rideAcceptedAt"
  async function handleStartRide() {
    if (!driverJobId) return;
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const now = Date.now();
      const res = await fetch(`/api/rides/${driverJobId}/start?driverId=${driverId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || "Failed to start ride");
      } else {
        setStatusMsg("Ride started! Take your customer to their destination.");
        setJobStatus("in_progress"); // Optional, will be corrected by polling soon
        setRideStartedAt(now);
        localStorage.setItem("rideStartedAt", String(now));
        setRideAcceptedAt(null);
        localStorage.removeItem("rideAcceptedAt");
      }
    } catch {
      setErrorMsg("Failed to start ride");
    }
  }

  // Poll accepted job status -- handles done, arrived, cancelled, and 15min timeout
  useEffect(() => {
    if (!driverJobId || cancelled || completed) return;
    let isMounted = true;
    let localTimer: NodeJS.Timeout | null = null;
    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/rides/${driverJobId}/status`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
        });
        const data = await res.json();
        const status = (data.status || "").toLowerCase();
        setJobStatus(status);

        // If customer cancels
        if (status === "cancelled" && isMounted) {
          setCancelled(true);
          setStatusMsg(null);
          setAcceptedJob(null);
          setDriverJobId(null);
          setRideStartedAt(null);
          setRideAcceptedAt(null);
          localStorage.removeItem("rideStartedAt");
          localStorage.removeItem("rideAcceptedAt");
          if (beepRef.current) {
            beepRef.current.currentTime = 0;
            beepRef.current.play();
          }
        }

        // If ride is done
        if ((status === "done" || status === "arrived") && isMounted) {
          setCompleted(true);
          setAcceptedJob(null);
          setDriverJobId(null);
          setStatusMsg(null);
          setRideStartedAt(null);
          setRideAcceptedAt(null);
          localStorage.removeItem("rideStartedAt");
          localStorage.removeItem("rideAcceptedAt");
          if (autoReleaseTimer) {
            clearInterval(autoReleaseTimer);
            setAutoReleaseTimer(null);
            setCountdown(0);
          }
        }
      } catch {}
    };
    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (localTimer) clearInterval(localTimer);
    };
  }, [driverJobId, token, cancelled, completed, autoReleaseTimer]);

  // Timer logic for accepted rides (auto-release after 15min if driver doesn't start)
  useEffect(() => {
    if (jobStatus !== "accepted" || !rideAcceptedAt || cancelled || completed) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rideAcceptedAt) / 1000);
      const remaining = ACCEPTED_TIMEOUT_MINUTES * 60 - elapsed;
      setCountdown(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
        // Auto-release: allow driver to accept new jobs
        setAcceptedJob(null);
        setDriverJobId(null);
        setJobStatus(null);
        setStatusMsg(
          "You can now accept new jobs! (You didn't start the ride in time)"
        );
        setCompleted(false);
        setCancelled(false);
        setCountdown(0);
        setRideStartedAt(null);
        setRideAcceptedAt(null);
        localStorage.removeItem("rideStartedAt");
        localStorage.removeItem("rideAcceptedAt");
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [jobStatus, rideAcceptedAt, cancelled, completed]);

  // Timer logic for in_progress rides (driver auto-release after 15min)
  useEffect(() => {
    if (jobStatus !== "in_progress" || !rideStartedAt || cancelled || completed) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rideStartedAt) / 1000);
      const remaining = IN_PROGRESS_TIMEOUT_MINUTES * 60 - elapsed;
      setCountdown(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
        // Auto-release: allow driver to accept new jobs
        setAcceptedJob(null);
        setDriverJobId(null);
        setJobStatus(null);
        setStatusMsg(
          "You can now accept new jobs! (Customer did not mark as done in time)"
        );
        setCompleted(false);
        setCancelled(false);
        setCountdown(0);
        setRideStartedAt(null);
        setRideAcceptedAt(null);
        localStorage.removeItem("rideStartedAt");
        localStorage.removeItem("rideAcceptedAt");
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [jobStatus, rideStartedAt, cancelled, completed]);

  async function handleFindAnother() {
    setDriverJobId(null);
    setJobStatus(null);
    setCancelled(false);
    setCompleted(false);
    setStatusMsg(null);
    setAcceptedJob(null);
    setCountdown(0);
    setRideStartedAt(null);
    setRideAcceptedAt(null);
    localStorage.removeItem("rideStartedAt");
    localStorage.removeItem("rideAcceptedAt");
    if (autoReleaseTimer) {
      clearInterval(autoReleaseTimer);
      setAutoReleaseTimer(null);
    }
    await fetchJobs();
  }

  let jobsToShow: Job[] = [];
  if (driverJobId && acceptedJob) jobsToShow = [acceptedJob];
  else if (!driverJobId && !cancelled && !completed) jobsToShow = jobs;

  function formatCountdown(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div>
      <audio
        ref={beepRef}
        src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYwAAAABAAgAZGF0YYwAAAAA"
        preload="auto"
      />

      {cancelled && (
        <div style={{
          color: "#d32f2f",
          textAlign: "center",
          fontWeight: "bold",
          marginTop: 60,
          background: "#fff3e0",
          padding: 32,
          borderRadius: 8,
          border: "1px solid #ffcdd2"
        }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>Customer cancelled the ride.</div>
          <button
            onClick={handleFindAnother}
            style={{
              padding: "0.8em 2em",
              background: "#1976D2",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: 18
            }}
          >
            Find Another Job
          </button>
        </div>
      )}

      {completed && (
        <div style={{
          color: "#388e3c",
          textAlign: "center",
          fontWeight: "bold",
          marginTop: 60,
          background: "#e8f5e9",
          padding: 32,
          borderRadius: 8,
          border: "1px solid #c8e6c9"
        }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>Ride completed. Good job!</div>
          <button
            onClick={handleFindAnother}
            style={{
              padding: "0.8em 2em",
              background: "#1976D2",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: 18
            }}
          >
            Find Another Job
          </button>
        </div>
      )}

      {/* Show countdown for both accepted and in_progress jobs */}
      {driverJobId &&
        ((jobStatus === "accepted" && countdown > 0) || (jobStatus === "in_progress" && countdown > 0)) &&
        !completed && !cancelled && (
        <div style={{
          color: jobStatus === "accepted" ? "#ff9800" : "#1976D2",
          textAlign: "center",
          fontWeight: "bold",
          marginTop: 24,
          background: "#fffde7",
          padding: 18,
          borderRadius: 8,
          border: "1px solid #ffe0b2"
        }}>
          <div>
            {jobStatus === "accepted"
              ? <>You must start the ride within <span style={{ color: "#d32f2f" }}>{formatCountdown(countdown)}</span> or you'll be able to accept new jobs automatically.</>
              : <>Waiting for customer to mark the ride as done...<br />If not completed in <span style={{ color: "#d32f2f" }}>{formatCountdown(countdown)}</span>, you'll be able to accept new rides automatically.</>
            }
          </div>
        </div>
      )}

      {/* Start Ride Button for Driver */}
      {driverJobId && jobStatus === "accepted" && !cancelled && !completed && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={handleStartRide}
            style={{
              padding: "0.7em 1.4em",
              borderRadius: 6,
              background: "#388e3c",
              color: "#fff",
              border: "none",
              fontSize: 18,
              fontWeight: "bold",
              margin: "0 12px"
            }}
          >
            Start Ride
          </button>
          <div style={{ marginTop: 8, color: "#888" }}>
            Press "Start Ride" when you pick up the customer.
          </div>
        </div>
      )}

      {!cancelled && !completed && (
        <>
          <h2 style={{ textAlign: "center" }}>
            {driverJobId ? "Your Ride" : "Available Rides"}
          </h2>
          {errorMsg && <div style={{ color: "#d32f2f", textAlign: "center" }}>{errorMsg}</div>}
          {statusMsg && <div style={{ color: "#388e3c", textAlign: "center" }}>{statusMsg}</div>}
          {!locationLoaded ? (
            <div style={{
              background: "#e0e0e0", borderRadius: 8, margin: "24px 0", height: 320,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <span style={{ color: "#1976D2", fontWeight: "bold", fontSize: 20 }}>
                Loading your location...
              </span>
            </div>
          ) : (
            <AppMap
              jobs={jobsToShow}
              driverLocation={driverLocation || undefined}
              driverVehicleType={driverVehicleType}
              showDriverMarker={true}
            />
          )}
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 20 }}>
            <FaHistory size={32} title="Ride History" />
            <FaDollarSign size={32} title="Earnings" />
            <FaUser size={32} title="Profile" />
          </div>
          {!driverJobId && jobsToShow.length > 0 && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <h4>Accept a Job</h4>
              {jobsToShow.map(job => (
                <button
                  key={job.id}
                  onClick={() => handleAccept(String(job.id))}
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
          {driverJobId && !cancelled && !completed && jobStatus !== "accepted" && jobStatus !== "in_progress" && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <span style={{ color: "#388e3c", fontWeight: "bold" }}>
                Go to your customer and pick them up. You can't accept another job until this one is completed or cancelled.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}