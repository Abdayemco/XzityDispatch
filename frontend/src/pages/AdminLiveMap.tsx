import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import carIcon from "../assets/marker-car.png";
import markerCustomer from "../assets/marker-customer.png";
import { useNavigate } from "react-router-dom";

type Driver = {
  id: string | number;
  name?: string;
  phone?: string;
  vehicleType?: string;
  lat: number;
  lng: number;
};
type Ride = {
  id: string | number;
  customer?: { name?: string; id?: string | number };
  customerId?: string | number;
  status?: string;
  originLat: number;
  originLng: number;
  destLat?: number;
  destLng?: number;
};

const driverIcon = new L.Icon({
  iconUrl: carIcon,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const rideIcon = new L.Icon({
  iconUrl: markerCustomer,
  iconSize: [32, 41],
  iconAnchor: [16, 41],
  popupAnchor: [0, -41],
});

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "";

export default function AdminLiveMap() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Admin location state
  const [mapCenter, setMapCenter] = useState<LatLngExpression | null>(null);
  const mapZoom = 12;
  const navigate = useNavigate();

  // Get admin's current location on mount
  useEffect(() => {
    let didCancel = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!didCancel) setMapCenter([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        if (!didCancel) setMapCenter([30.0444, 31.2357]); // Cairo fallback
      }
    );
    // Fallback if geolocation is very slow
    setTimeout(() => {
      if (!didCancel && mapCenter === null) setMapCenter([30.0444, 31.2357]);
    }, 3000);
    return () => { didCancel = true; };
    // eslint-disable-next-line
  }, []);

  // Fetch online drivers and active rides
  async function fetchData() {
    setError("");
    setLoading(true);
    try {
      const [driversRes, ridesRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/drivers?online=true`, { credentials: "include" }),
        fetch(`${API_URL}/api/admin/rides?status=active`, { credentials: "include" }),
      ]);
      if (!driversRes.ok || !ridesRes.ok) {
        // Show backend error messages if available
        let msg = "Failed to fetch map data.";
        if (!driversRes.ok) {
          try { const data = await driversRes.json(); msg = data.error || msg; } catch {}
        }
        if (!ridesRes.ok) {
          try { const data = await ridesRes.json(); msg = data.error || msg; } catch {}
        }
        throw new Error(msg);
      }
      const driversData = await driversRes.json();
      const ridesData = await ridesRes.json();
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setRides(Array.isArray(ridesData) ? ridesData : []);
    } catch (e: any) {
      setError(e.message || "Failed to fetch map data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ textAlign: "center" }}>
        Admin - Live Map
        <button
          onClick={() => navigate("/admin")}
          style={{
            float: "right",
            margin: 4,
            padding: "7px 16px",
            background: "#1976D2",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 15
          }}
        >
          Back to Admin
        </button>
      </h2>
      {error && (
        <div style={{ color: "red", textAlign: "center", marginBottom: 10 }}>{error}</div>
      )}
      {!mapCenter ? (
        <div style={{ textAlign: "center", marginTop: 40 }}>Getting your location...</div>
      ) : (
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: 520, width: "100%", borderRadius: 10, boxShadow: "0 2px 10px #0001", margin: "0 auto", maxWidth: 900 }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {/* Drivers */}
          {drivers.map(driver => (
            driver.lat && driver.lng && (
              <Marker
                key={driver.id}
                position={[driver.lat, driver.lng]}
                icon={driverIcon}
              >
                <Popup>
                  <b>Driver:</b> {driver.name || driver.phone || driver.id}
                  <br />
                  <b>Vehicle:</b> {driver.vehicleType || "Unknown"}
                  <br />
                  <b>Status:</b> Online
                </Popup>
              </Marker>
            )
          ))}
          {/* Active rides (show origin and destination) */}
          {rides.map(ride => (
            ride.originLat && ride.originLng && (
              <Marker
                key={`ride-${ride.id}`}
                position={[ride.originLat, ride.originLng]}
                icon={rideIcon}
              >
                <Popup>
                  <b>Ride:</b> {ride.id}
                  <br />
                  <b>Customer:</b> {ride.customer?.name || ride.customerId}
                  <br />
                  <b>Status:</b> {ride.status}
                  <br />
                  <b>Origin:</b> {ride.originLat.toFixed(4)}, {ride.originLng.toFixed(4)}
                  <br />
                  <b>Destination:</b> {ride.destLat?.toFixed(4)}, {ride.destLng?.toFixed(4)}
                </Popup>
              </Marker>
            )
          ))}
          {/* Polylines for rides */}
          {rides.map(ride => (
            ride.originLat && ride.originLng && ride.destLat && ride.destLng ? (
              <Polyline
                key={`poly-${ride.id}`}
                positions={[
                  [ride.originLat, ride.originLng],
                  [ride.destLat, ride.destLng]
                ]}
                pathOptions={{ color: "#388e3c", weight: 3, dashArray: "5,10" }}
              />
            ) : null
          ))}
        </MapContainer>
      )}
      <div style={{ textAlign: "center", marginTop: 16, color: "#555" }}>
        Showing <b>{drivers.length}</b> online drivers and <b>{rides.length}</b> active rides.
      </div>
    </div>
  );
}