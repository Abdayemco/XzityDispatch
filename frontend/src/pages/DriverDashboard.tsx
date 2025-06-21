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
  status?: "pending" | "accepted" | "cancelled" | "done" | "arrived";
  assignedDriverId?: string | number;
};

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
      } else setErrorMsg(data?.error || "Failed to accept job");
    } catch {
      setErrorMsg("Failed to accept job");
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

        if (status === "cancelled" && isMounted) {
          setCancelled(true);
          setStatusMsg(null);
          setAcceptedJob(null);
          setDriverJobId(null);
          if (beepRef.current) {
            beepRef.current.currentTime = 0;
            beepRef.current.play();
          }
        }

        if ((status === "done" || status === "arrived") && isMounted) {
          setCompleted(true);
          setAcceptedJob(null);
          setDriverJobId(null);
          setStatusMsg(null);
          if (autoReleaseTimer) {
            clearInterval(autoReleaseTimer);
            setAutoReleaseTimer(null);
            setCountdown(0);
          }
        }

        if (status === "accepted" && isMounted) {
          if (!autoReleaseTimer) {
            let seconds = 15 * 60;
            setCountdown(seconds);
            localTimer = setInterval(() => {
              seconds -= 1;
              setCountdown(s => s - 1);
              if (seconds <= 0) {
                setAcceptedJob(null);
                setDriverJobId(null);
                setJobStatus(null);
                setStatusMsg(null);
                setCompleted(false);
                setCancelled(false);
                setCountdown(0);
                clearInterval(localTimer!);
                setAutoReleaseTimer(null);
              }
            }, 1000);
            setAutoReleaseTimer(localTimer);
          }
        } else {
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

  async function handleFindAnother() {
    setDriverJobId(null);
    setJobStatus(null);
    setCancelled(false);
    setCompleted(false);
    setStatusMsg(null);
    setAcceptedJob(null);
    setCountdown(0);
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

      {driverJobId && jobStatus === "accepted" && countdown > 0 && !completed && !cancelled && (
        <div style={{
          color: "#ff9800",
          textAlign: "center",
          fontWeight: "bold",
          marginTop: 24,
          background: "#fffde7",
          padding: 18,
          borderRadius: 8,
          border: "1px solid #ffe0b2"
        }}>
          <div>
            Waiting for customer to complete the ride...
            <br />
            If not completed in <span style={{ color: "#d32f2f" }}>{formatCountdown(countdown)}</span>, you'll be able to accept new rides automatically.
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
          {driverJobId && !cancelled && !completed && (
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