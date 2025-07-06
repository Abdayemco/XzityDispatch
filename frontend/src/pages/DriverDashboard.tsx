import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaHistory, FaDollarSign, FaUser, FaCar, FaMotorcycle, FaBox, FaTruck, FaTruckPickup, FaWheelchair } from "react-icons/fa";
import AppMap from "../components/AppMap";
import RestChatWindow from "../components/RestChatWindow"; // REST polling chat

// Extended vehicle types
const VEHICLE_TYPE_LABELS = {
  car: { label: "Car", icon: <FaCar /> },
  tuktuk: { label: "Tuktuk", icon: <FaMotorcycle /> },
  delivery: { label: "Delivery", icon: <FaBox /> },
  truck: { label: "Truck", icon: <FaTruck /> },
  water_truck: { label: "Water Truck", icon: <FaTruckPickup /> },
  tow_truck: { label: "Tow Truck", icon: <FaTruckPickup /> },
  wheelchair: { label: "Wheelchair", icon: <FaWheelchair /> },
};

type Job = {
  id: string | number;
  pickupLat: number;
  pickupLng: number;
  customerName: string;
  vehicleType: keyof typeof VEHICLE_TYPE_LABELS;
  status?: "pending" | "accepted" | "cancelled" | "done" | "arrived" | "in_progress";
  assignedDriverId?: string | number;
};

const IN_PROGRESS_TIMEOUT_MINUTES = 15;
const ACCEPTED_TIMEOUT_MINUTES = 15;

function saveChatSession(rideId: number | null, jobStatus: string | null) {
  localStorage.setItem("currentDriverRideId", rideId ? String(rideId) : "");
  localStorage.setItem("currentDriverJobStatus", jobStatus || "");
}
function getSavedChatSession() {
  const rideId = Number(localStorage.getItem("currentDriverRideId"));
  const jobStatus = localStorage.getItem("currentDriverJobStatus");
  return { rideId: rideId || null, jobStatus: jobStatus || null };
}

export default function DriverDashboard() {
  // ---- ALL useState hooks FIRST ----
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
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

  const [rideStartedAt, setRideStartedAt] = useState<number | null>(() => {
    const saved = localStorage.getItem("rideStartedAt");
    return saved ? Number(saved) : null;
  });
  const [rideAcceptedAt, setRideAcceptedAt] = useState<number | null>(() => {
    const saved = localStorage.getItem("rideAcceptedAt");
    return saved ? Number(saved) : null;
  });

  const driverId = localStorage.getItem("driverId") || "";
  let driverVehicleType = (localStorage.getItem("vehicleType") || "car").toLowerCase();
  if (driverVehicleType === "toktok") driverVehicleType = "tuktuk";

  // --- Auth token for socket, reactive ---
  useEffect(() => {
    const onStorage = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // --- Restore job/chat session from backend on mount ---
  useEffect(() => {
    async function restoreCurrentJobFromBackend() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch("/api/rides/current", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.rideId && ["accepted", "in_progress", "pending"].includes(data.rideStatus)) {
            setDriverJobId(String(data.rideId));
            setJobStatus(data.rideStatus);
            setAcceptedJob({
              id: data.rideId,
              pickupLat: data.originLat,
              pickupLng: data.originLng,
              customerName: data.customer?.name || "",
              vehicleType: (data.vehicleType || "").toLowerCase(),
              status: data.rideStatus
            });
          }
        }
      } catch (e) {
        // ignore
      }
    }
    if (!driverJobId && !acceptedJob) {
      restoreCurrentJobFromBackend();
    }
  }, [driverJobId, acceptedJob]);

  // --- Also restore from localStorage for backwards compatibility (optional) ---
  useEffect(() => {
    if (!driverJobId && !acceptedJob) {
      const { rideId: storedId, jobStatus: storedStatus } = getSavedChatSession();
      if (
        storedId &&
        (storedStatus === "accepted" ||
          storedStatus === "in_progress" ||
          storedStatus === "pending")
      ) {
        setDriverJobId(String(storedId));
        setJobStatus(storedStatus);
      }
    }
  }, [driverJobId, acceptedJob]);

  useEffect(() => {
    if (getRideId() && jobStatus) saveChatSession(Number(getRideId()), jobStatus);
  }, [driverJobId, jobStatus, acceptedJob]);

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

  useEffect(() => {
    if (!locationLoaded || driverJobId || cancelled || completed) return;
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs, locationLoaded, driverJobId, cancelled, completed]);

  // ---- Ensure all accept logic (including from map marker) uses this handler ----
  const handleAccept = useCallback(async (jobId: string) => {
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
  // eslint-disable-next-line
  }, [driverJobId, driverId, token, jobs]);

  // --- Pass handleAccept to AppMap so accepting from map marker opens chat etc ---
  // ^^^ This is the core fix for your issue
  // Ensure AppMap calls handleAccept and not its own accept logic

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
        setJobStatus("in_progress");
        setRideStartedAt(now);
        localStorage.setItem("rideStartedAt", String(now));
        setRideAcceptedAt(null);
        localStorage.removeItem("rideAcceptedAt");
      }
    } catch {
      setErrorMsg("Failed to start ride");
    }
  }

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
          setRideStartedAt(null);
          setRideAcceptedAt(null);
          localStorage.removeItem("rideStartedAt");
          localStorage.removeItem("rideAcceptedAt");
          saveChatSession(null, null);
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
          setRideStartedAt(null);
          setRideAcceptedAt(null);
          localStorage.removeItem("rideStartedAt");
          localStorage.removeItem("rideAcceptedAt");
          saveChatSession(null, null);
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

  useEffect(() => {
    if (jobStatus !== "accepted" || !rideAcceptedAt || cancelled || completed) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rideAcceptedAt) / 1000);
      const remaining = ACCEPTED_TIMEOUT_MINUTES * 60 - elapsed;
      setCountdown(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
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
        saveChatSession(null, null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobStatus, rideAcceptedAt, cancelled, completed]);

  useEffect(() => {
    if (jobStatus !== "in_progress" || !rideStartedAt || cancelled || completed) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rideStartedAt) / 1000);
      const remaining = IN_PROGRESS_TIMEOUT_MINUTES * 60 - elapsed;
      setCountdown(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
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
        saveChatSession(null, null);
      }
    }, 1000);

    return () => clearInterval(interval);
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
    saveChatSession(null, null);
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

  // ------------------- CHAT STATE ---------------------
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);

  function getNumericDriverId() {
    if (!driverId) return null;
    const idNum = Number(driverId);
    return Number.isInteger(idNum) ? idNum : driverId;
  }

  function getRideId() {
    if (acceptedJob && acceptedJob.id) return acceptedJob.id;
    if (driverJobId) return driverJobId;
    return null;
  }

  // ------------------- POLLING CHAT LOGIC --------------------
  useEffect(() => {
    const rideId = getRideId();
    if (!rideId) return;
    setChatId(String(rideId));

    let polling = true;
    async function fetchMessages() {
      if (!polling) return;
      try {
        const res = await fetch(`/api/rides/${rideId}/chat/messages`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const msgs = await res.json();
          setChatMessages(
            Array.isArray(msgs)
              ? msgs.filter(Boolean).map((m, idx) => ({
                  ...m,
                  id: m?.id || m?._id || m?.timestamp || `${Date.now()}_${idx}`,
                  sender: m?.sender ?? {
                    id: m?.senderId ?? "unknown",
                    name: m?.senderName ?? "",
                    role: m?.senderRole ?? "",
                    avatar: m?.senderAvatar ?? "",
                  },
                }))
              : []
          );
        } else {
          setChatMessages([]);
        }
      } catch {
        setChatMessages([]);
      }
    }
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => {
      polling = false;
      clearInterval(interval);
      setChatMessages([]);
    };
  }, [driverJobId, acceptedJob, token]);

  // The following sends the correct role and structure!
  const handleSendMessage = async (text: string) => {
    if (!chatId || !getNumericDriverId()) return;
    await fetch(`/api/rides/${chatId}/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: {
          id: getNumericDriverId(),
          name: "Driver",
          role: "driver",
          avatar: "",
        },
        content: text,
      }),
    });
    // message will appear on next poll
  };

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

      {driverJobId &&
        (jobStatus === "accepted" || jobStatus === "in_progress") &&
        !completed && !cancelled &&
        getRideId() && (
        <div style={{
          margin: "32px auto 0 auto",
          display: "flex",
          justifyContent: "center",
          height: "250px",
          maxHeight: "250px",
          minHeight: "120px",
          width: "100%",
          maxWidth: "500px"
        }}>
          <RestChatWindow
            rideId={String(getRideId())}
            sender={{ id: getNumericDriverId(), name: "Driver", role: "driver", avatar: "" }}
            messages={chatMessages}
            onSend={handleSendMessage}
            style={{ height: "100%" }}
          />
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
              vehicleTypeLabels={VEHICLE_TYPE_LABELS}
              onAcceptRide={handleAccept} // <-- This enables accepting from marker to open chat
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
                    border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold",
                    display: "inline-flex", alignItems: "center", gap: 8
                  }}
                  disabled={!!driverJobId}
                >
                  {VEHICLE_TYPE_LABELS[job.vehicleType]?.icon}
                  Accept Ride ({job.customerName}) {VEHICLE_TYPE_LABELS[job.vehicleType]?.label && <>- {VEHICLE_TYPE_LABELS[job.vehicleType].label}</>}
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