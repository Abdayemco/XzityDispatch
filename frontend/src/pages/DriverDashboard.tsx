import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHistory,
  FaDollarSign,
  FaUser,
  FaCar,
  FaMotorcycle,
  FaBox,
  FaTruck,
  FaTruckPickup,
  FaWheelchair
} from "react-icons/fa";
import AppMap from "../components/AppMap";
import RestChatWindow from "../components/RestChatWindow";
import markerLimo from "../assets/marker-limo.png";

// Extended vehicle types
const VEHICLE_TYPE_LABELS = {
  car: { label: "Car", icon: <FaCar /> },
  tuktuk: { label: "Tuktuk", icon: <FaMotorcycle /> },
  delivery: { label: "Delivery", icon: <FaBox /> },
  limo: {
    label: "Limo",
    icon: (
      <img
        src={markerLimo}
        alt="Limo"
        style={{
          height: 24,
          width: 48,
          objectFit: "contain",
          verticalAlign: "middle"
        }}
      />
    )
  },
  wheelchair: { label: "Wheelchair", icon: <FaWheelchair /> },
  truck: { label: "Truck", icon: <FaTruck /> },
  water_truck: { label: "Water Truck", icon: <FaTruckPickup /> },
  tow_truck: { label: "Tow Truck", icon: <FaTruckPickup /> }
};

type Job = {
  id: string | number;
  pickupLat: number;
  pickupLng: number;
  customerName: string;
  vehicleType: keyof typeof VEHICLE_TYPE_LABELS;
  status?:
    | "pending"
    | "accepted"
    | "scheduled"
    | "cancelled"
    | "done"
    | "arrived"
    | "in_progress"
    | "no_show";
  assignedDriverId?: string | number;
  scheduledAt?: string | null;
  lastKnownLat?: number;    // ADDED: for driver location
  lastKnownLng?: number;    // ADDED: for driver location
  acceptedAt?: string | null; // ADDED: for 15min logic
};

const IN_PROGRESS_TIMEOUT_MINUTES = 15;
const ACCEPTED_TIMEOUT_MINUTES = 15;
const NOSHOW_GRACE_MINUTES = 10;

function saveChatSession(rideId: number | null, jobStatus: string | null) {
  localStorage.setItem("currentDriverRideId", rideId ? String(rideId) : "");
  localStorage.setItem("currentDriverJobStatus", jobStatus || "");
}
function getSavedChatSession() {
  const rideId = Number(localStorage.getItem("currentDriverRideId"));
  const jobStatus = localStorage.getItem("currentDriverJobStatus");
  return { rideId: rideId || null, jobStatus: jobStatus || null };
}

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "";

export default function DriverDashboard() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token")
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [driverJobId, setDriverJobId] = useState<string | null>(null);
  const [acceptedJob, setAcceptedJob] = useState<Job | null>(null);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
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

  const [noShowEligible, setNoShowEligible] = useState(false);
  const [noShowMsg, setNoShowMsg] = useState<string | null>(null);

  const driverId = localStorage.getItem("driverId") || "";
  let driverVehicleType =
    (localStorage.getItem("vehicleType") || "car").toLowerCase();
  if (driverVehicleType === "toktok") driverVehicleType = "tuktuk";

  useEffect(() => {
    const onStorage = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    async function restoreCurrentJobFromBackend() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/rides/current`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (
            data &&
            data.rideId &&
            ["accepted", "in_progress", "pending", "scheduled"].includes(data.rideStatus)
          ) {
            setDriverJobId(String(data.rideId));
            setJobStatus(data.rideStatus);
            setAcceptedJob({
              id: data.rideId,
              pickupLat: data.originLat,
              pickupLng: data.originLng,
              customerName: data.customer?.name || "",
              vehicleType: (data.vehicleType || "").toLowerCase(),
              status: data.rideStatus,
              scheduledAt: data.scheduledAt || null,
              lastKnownLat: data.lastKnownLat || (data.driver && data.driver.lastKnownLat),
              lastKnownLng: data.lastKnownLng || (data.driver && data.driver.lastKnownLng),
              acceptedAt: data.acceptedAt || (data.driver && data.driver.acceptedAt)
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

  useEffect(() => {
    if (!driverJobId && !acceptedJob) {
      const { rideId: storedId, jobStatus: storedStatus } = getSavedChatSession();
      if (
        storedId &&
        (storedStatus === "accepted" ||
          storedStatus === "in_progress" ||
          storedStatus === "pending" ||
          storedStatus === "scheduled")
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

  // --- DRIVER PERIODIC LOCATION UPDATE ---
  const updateDriverLocationOnBackend = useCallback(
    async (lat: number, lng: number) => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        await fetch(`${API_URL}/api/driver/location`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ lat, lng, online: true })
        });
      } catch (e) {
        // Optionally: show error or log
      }
    },
    []
  );

  // --- Track location and update backend ---
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoaded(true);

        updateDriverLocationOnBackend(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setDriverLocation({ lat: 51.505, lng: -0.09 });
        setLocationLoaded(true);

        updateDriverLocationOnBackend(51.505, -0.09);
      }
    );
  }, []);

  useEffect(() => {
    if (driverLocation && locationLoaded) {
      updateDriverLocationOnBackend(driverLocation.lat, driverLocation.lng);
    }
  }, [driverLocation, locationLoaded, updateDriverLocationOnBackend]);

  // --- DRIVER FIELDS for mapping and NoShow logic ---
  const fetchJobs = useCallback(async () => {
    try {
      setErrorMsg(null);
      const url = `${API_URL}/api/rides/available?vehicleType=${driverVehicleType}&driverId=${driverId}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        const mapped = data.map((job: any) => ({
          ...job,
          pickupLat: job.pickupLat ?? job.originLat,
          pickupLng: job.pickupLng ?? job.originLng,
          customerName: job.customerName ?? job.customer?.name ?? "",
          vehicleType: (job.vehicleType || "").toLowerCase(),
          scheduledAt: job.scheduledAt || null,
          lastKnownLat: job.lastKnownLat ?? (job.driver && job.driver.lastKnownLat),
          lastKnownLng: job.lastKnownLng ?? (job.driver && job.driver.lastKnownLng),
          acceptedAt: job.acceptedAt ?? (job.driver && job.driver.acceptedAt)
        }));
        setJobs(mapped);
      }
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

  // --- Accept Ride: include acceptedAt for timer logic ---
  const handleAccept = useCallback(
    async (jobId: string) => {
      if (driverJobId) return;
      setStatusMsg(null);
      setErrorMsg(null);
      try {
        const now = Date.now();
        const res = await fetch(
          `${API_URL}/api/rides/${jobId}/accept?driverId=${driverId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
          }
        );
        const data = await res.json();
        if (res.ok) {
          const foundJob = jobs.find((j) => String(j.id) === String(jobId));
          setDriverJobId(jobId);
          setAcceptedJob({
            ...foundJob,
            status: data.status || foundJob?.status,
            scheduledAt: data.scheduledAt || foundJob?.scheduledAt || null,
            lastKnownLat: data.driver?.lastKnownLat ?? (foundJob && foundJob.lastKnownLat),
            lastKnownLng: data.driver?.lastKnownLng ?? (foundJob && foundJob.lastKnownLng),
            acceptedAt: data.acceptedAt || (foundJob && foundJob.acceptedAt) || new Date().toISOString(),
          });
          setStatusMsg(`You have accepted job ${jobId}`);
          setCancelled(false);
          setCompleted(false);
          setRideAcceptedAt(now);
          localStorage.setItem("rideAcceptedAt", String(now));
        } else setErrorMsg(data?.error || "Failed to accept job");
      } catch {
        setErrorMsg("Failed to accept job");
      }
    },
    [driverJobId, driverId, token, jobs]
  );

  // --- Start Ride ---
  async function handleStartRide() {
    if (!driverJobId) return;
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const now = Date.now();
      const res = await fetch(
        `${API_URL}/api/rides/${driverJobId}/start?driverId=${driverId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        }
      );
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

  // --- No Show Button Logic: always available for scheduled jobs after grace period ---
  useEffect(() => {
    if (
      acceptedJob &&
      acceptedJob.status === "scheduled" &&
      acceptedJob.scheduledAt
    ) {
      const schedTime = new Date(acceptedJob.scheduledAt).getTime();
      const now = Date.now();
      const eligible =
        now > schedTime + NOSHOW_GRACE_MINUTES * 60 * 1000;
      setNoShowEligible(eligible);
      if (!eligible) {
        setNoShowMsg(
          `You can mark as "No Show" after ${
            NOSHOW_GRACE_MINUTES
          } minutes past the scheduled pickup time.`
        );
      } else {
        setNoShowMsg(null);
      }
    } else {
      setNoShowEligible(false);
      setNoShowMsg(null);
    }
  }, [acceptedJob]);

  async function handleNoShow() {
    if (!acceptedJob || !driverJobId) return;
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${API_URL}/api/rides/${driverJobId}/no_show?driverId=${driverId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || "Failed to mark ride as No Show");
      } else {
        setStatusMsg("Ride marked as No Show.");
        setAcceptedJob(null);
        setDriverJobId(null);
        setJobStatus(null);
        setNoShowEligible(false);
        setNoShowMsg(null);
        setCompleted(false);
        setCancelled(false);
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
      }
    } catch {
      setErrorMsg("Failed to mark ride as No Show");
    }
  }

  useEffect(() => {
    if (!driverJobId || cancelled || completed) return;
    let isMounted = true;
    let localTimer: NodeJS.Timeout | null = null;
    const pollStatus = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/rides/${driverJobId}/status`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );
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

        if ((status === "done" || status === "arrived" || status === "no_show") && isMounted) {
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
    if (jobStatus !== "in_progress" || !rideStartedAt || cancelled || completed)
      return;

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
    return `${m}:${s.toString().padStart(2, "0")}`;
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

  useEffect(() => {
    const rideId = getRideId();
    if (!rideId) return;
    setChatId(String(rideId));

    let polling = true;
    async function fetchMessages() {
      if (!polling) return;
      try {
        const res = await fetch(
          `${API_URL}/api/rides/${rideId}/chat/messages`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );
        if (res.ok) {
          const msgs = await res.json();
          setChatMessages(
            Array.isArray(msgs)
              ? msgs.filter(Boolean).map((m, idx) => ({
                  ...m,
                  id:
                    m?.id || m?._id || m?.timestamp || `${Date.now()}_${idx}`,
                  sender: m?.sender ?? {
                    id: m?.senderId ?? "unknown",
                    name: m?.senderName ?? "",
                    role: m?.senderRole ?? "",
                    avatar: m?.senderAvatar ?? ""
                  }
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

  const handleSendMessage = async (text: string) => {
    if (!chatId || !getNumericDriverId()) return;
    await fetch(`${API_URL}/api/rides/${chatId}/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: {
          id: getNumericDriverId(),
          name: "Driver",
          role: "driver",
          avatar: ""
        },
        content: text
      })
    });
    // message will appear on next poll
  };

  return (
    <div>
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          marginBottom: 8
        }}
      >
        Available Rides By Xzity
      </h2>
      <audio
        ref={beepRef}
        src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYwAAAABAAgAZGF0YYwAAAAA"
        preload="auto"
      />

      {cancelled && (
        <div
          style={{
            color: "#d32f2f",
            textAlign: "center",
            fontWeight: "bold",
            marginTop: 60,
            background: "#fff3e0",
            padding: 32,
            borderRadius: 8,
            border: "1px solid #ffcdd2"
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 16 }}>
            Customer cancelled the ride.
          </div>
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
        <div
          style={{
            color: "#388e3c",
            textAlign: "center",
            fontWeight: "bold",
            marginTop: 60,
            background: "#e8f5e9",
            padding: 32,
            borderRadius: 8,
            border: "1px solid #c8e6c9"
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 16 }}>
            Ride completed. Good job!
          </div>
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
        ((jobStatus === "accepted" && countdown > 0) ||
          (jobStatus === "in_progress" && countdown > 0)) &&
        !completed &&
        !cancelled && (
          <div
            style={{
              color: jobStatus === "accepted" ? "#ff9800" : "#1976D2",
              textAlign: "center",
              fontWeight: "bold",
              marginTop: 24,
              background: "#fffde7",
              padding: 18,
              borderRadius: 8,
              border: "1px solid #ffe0b2"
            }}
          >
            <div>
              {jobStatus === "accepted" ? (
                <>
                  You must start the ride within{" "}
                  <span style={{ color: "#d32f2f" }}>
                    {formatCountdown(countdown)}
                  </span>{" "}
                  or you'll be able to accept new jobs automatically.
                </>
              ) : (
                <>
                  Waiting for customer to mark the ride as done...
                  <br />
                  If not completed in{" "}
                  <span style={{ color: "#d32f2f" }}>
                    {formatCountdown(countdown)}
                  </span>
                  , you'll be able to accept new rides automatically.
                </>
              )}
            </div>
          </div>
        )}

      {driverJobId &&
        jobStatus === "accepted" &&
        !cancelled &&
        !completed && (
          <div style={{ textAlign: "center", marginTop: 24, display: "flex", justifyContent: "center", gap: 24 }}>
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
            {/* --- No Show Button next to Start Ride --- */}
            {acceptedJob && acceptedJob.status === "scheduled" && (
              <button
                onClick={handleNoShow}
                disabled={!noShowEligible}
                style={{
                  background: noShowEligible ? "#f44336" : "#aaa",
                  color: "#fff",
                  border: "none",
                  padding: "0.7em 1.4em",
                  borderRadius: 6,
                  fontSize: 16,
                  margin: "0 10px",
                  opacity: noShowEligible ? 1 : 0.6,
                  cursor: noShowEligible ? "pointer" : "not-allowed"
                }}
              >
                Mark as No Show
              </button>
            )}
            {noShowMsg && (
              <div style={{ color: "#d32f2f", marginTop: 6 }}>{noShowMsg}</div>
            )}
            <div style={{ marginTop: 8, color: "#888" }}>
              Press "Start Ride" when you pick up the customer.
            </div>
          </div>
        )}

      {driverJobId &&
        (jobStatus === "accepted" || jobStatus === "in_progress") &&
        !completed &&
        !cancelled &&
        getRideId() && (
          <div
            style={{
              margin: "32px auto 0 auto",
              display: "flex",
              justifyContent: "center",
              height: "250px",
              maxHeight: "250px",
              minHeight: "120px",
              width: "100%",
              maxWidth: "500px"
            }}
          >
            <RestChatWindow
              rideId={String(getRideId())}
              sender={{
                id: getNumericDriverId(),
                name: "Driver",
                role: "driver",
                avatar: ""
              }}
              messages={chatMessages}
              onSend={handleSendMessage}
              style={{ height: "100%" }}
            />
          </div>
        )}

      {!cancelled && !completed && (
        <>
          {driverJobId ? (
            <h2 style={{ textAlign: "center" }}>Your Ride</h2>
          ) : null}
          {errorMsg && (
            <div style={{ color: "#d32f2f", textAlign: "center" }}>
              {errorMsg}
            </div>
          )}
          {statusMsg && (
            <div style={{ color: "#388e3c", textAlign: "center" }}>
              {statusMsg}
            </div>
          )}
          {!locationLoaded ? (
            <div
              style={{
                background: "#e0e0e0",
                borderRadius: 8,
                margin: "24px 0",
                height: 320,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <span
                style={{
                  color: "#1976D2",
                  fontWeight: "bold",
                  fontSize: 20
                }}
              >
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
              onAcceptRide={handleAccept}
            />
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              marginTop: 20
            }}
          >
            <FaHistory size={32} title="Ride History" />
            <FaDollarSign size={32} title="Earnings" />
            <FaUser size={32} title="Profile" />
          </div>
          {!driverJobId && jobsToShow.length > 0 && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <h4>Accept a Job</h4>
              {jobsToShow.map((job) => (
                <button
                  key={job.id}
                  onClick={() => handleAccept(String(job.id))}
                  style={{
                    margin: "0 8px",
                    padding: "0.5em 1em",
                    background: "#1976D2",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: "bold",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8
                  }}
                  disabled={!!driverJobId}
                >
                  {VEHICLE_TYPE_LABELS[job.vehicleType]?.icon}
                  Accept Ride ({job.customerName}){" "}
                  {VEHICLE_TYPE_LABELS[job.vehicleType]?.label && (
                    <>- {VEHICLE_TYPE_LABELS[job.vehicleType].label}</>
                  )}
                </button>
              ))}
            </div>
          )}
          {driverJobId &&
            !cancelled &&
            !completed &&
            jobStatus !== "accepted" &&
            jobStatus !== "in_progress" && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <span style={{ color: "#388e3c", fontWeight: "bold" }}>
                  Go to your customer and pick them up. You can't accept another
                  job until this one is completed or cancelled.
                </span>
              </div>
            )}
        </>
      )}
    </div>
  );
}