import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerCustomer from "../assets/marker-customer.png";
import carIcon from "../assets/marker-car.png";
import deliveryIcon from "../assets/marker-delivery.png";
import waterTruckIcon from "../assets/marker-water-truck.png";
import tuktukIcon from "../assets/marker-toktok.png";
import truckIcon from "../assets/marker-truck.png";
import towTruckIcon from "../assets/marker-towtruck.png";
import wheelchairIcon from "../assets/marker-wheelchair.png";
import limoIcon from "../assets/marker-limo.png";
import shoppingIcon from "../assets/marker-shopping.png";
import hairIcon from "../assets/marker-hair.png";
import cleaningIcon from "../assets/marker-cleaning.png";
import instituteIcon from "../assets/marker-institute.png";

// Updated getVehicleIcon to support all job types (matches backend/frontend)
function getVehicleIcon(vehicleType: string) {
  switch (vehicleType.toUpperCase()) {
    case "CAR":
      return carIcon;
    case "DELIVERY":
      return deliveryIcon;
    case "TUKTUK":
    case "TOKTOK":
      return tuktukIcon;
    case "TRUCK":
      return truckIcon;
    case "WATER_TRUCK":
      return waterTruckIcon;
    case "TOW_TRUCK":
      return towTruckIcon;
    case "WHEELCHAIR":
      return wheelchairIcon;
    case "LIMO":
      return limoIcon;
    case "SHOPPING":
      return shoppingIcon;
    case "HAIR_DRESSER":
      return hairIcon;
    case "CLEANING":
      return cleaningIcon;
    case "INSTITUTE":
      return instituteIcon;
    default:
      return carIcon;
  }
}

function createLeafletIcon(url: string, w = 32, h = 41) {
  return L.icon({
    iconUrl: url,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 10],
    shadowUrl: undefined,
  });
}

type Job = {
  id: string;
  pickupLat: number;
  pickupLng: number;
  customerName?: string;
  vehicleType: string;
};

type AppMapProps = {
  jobs?: Job[];
  pickupLocation?: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number };
  driverLocation?: { lat: number; lng: number };
  driverVehicleType?: string;
  showCustomerMarker?: boolean;
  showDriverMarker?: boolean;
  onAcceptRide?: (jobId: string) => void;
};

const DEFAULT_CENTER: [number, number] = [51.505, -0.09];

const AppMap: React.FC<AppMapProps> = ({
  jobs = [],
  pickupLocation,
  userLocation,
  driverLocation,
  driverVehicleType = "car",
  showCustomerMarker = false,
  showDriverMarker = false,
  onAcceptRide,
}) => {
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Compute map center
  let center: [number, number] = DEFAULT_CENTER;
  if (pickupLocation) center = [pickupLocation.lat, pickupLocation.lng];
  else if (driverLocation) center = [driverLocation.lat, driverLocation.lng];
  else if (userLocation) center = [userLocation.lat, userLocation.lng];

  // Handler for accepting a ride
  const handleAcceptRide = async (jobId: string) => {
    if (onAcceptRide) {
      onAcceptRide(jobId);
      return;
    }
    try {
      const driverId = localStorage.getItem("driverId");
      const res = await fetch(`/api/rides/${jobId}/accept?driverId=${driverId}`, {
        method: "PUT",
      });
      const data = await res.json();
      if (!res.ok) {
        setAcceptError(data.error || "Could not accept ride.");
        return;
      }
      alert("Ride accepted!");
    } catch (err) {
      setAcceptError("Network error accepting ride.");
    }
  };

  const ErrorPopup = () =>
    acceptError ? (
      <div
        style={{
          position: "fixed",
          top: 80,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.8)",
          color: "#fff",
          padding: 16,
          borderRadius: 8,
          zIndex: 2000,
          minWidth: 250,
          textAlign: "center",
        }}
        onClick={() => setAcceptError(null)}
      >
        <b>Error</b>
        <div style={{ margin: "8px 0" }}>{acceptError}</div>
        <button
          style={{
            padding: "6px 18px",
            borderRadius: 4,
            background: "#fff",
            color: "#333",
            border: "none",
            cursor: "pointer",
            marginTop: 8,
          }}
          onClick={() => setAcceptError(null)}
        >
          Close
        </button>
      </div>
    ) : null;

  return (
    <div style={{ width: "100%", height: 340, position: "relative" }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ width: "100%", height: "100%", borderRadius: 10 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Driver marker */}
        {showDriverMarker && driverLocation && (
          <Marker
            position={[driverLocation.lat, driverLocation.lng]}
            icon={createLeafletIcon(getVehicleIcon(driverVehicleType), 40, 51)}
          >
            <Popup>Your location</Popup>
          </Marker>
        )}

        {/* Customer marker */}
        {showCustomerMarker && pickupLocation && (
          <Marker
            position={[pickupLocation.lat, pickupLocation.lng]}
            icon={createLeafletIcon(markerCustomer, 32, 41)}
          >
            <Popup>Your pickup location</Popup>
          </Marker>
        )}

        {/* Jobs for drivers */}
        {jobs.map(job => (
          <Marker
            key={job.id}
            position={[job.pickupLat, job.pickupLng]}
            icon={createLeafletIcon(getVehicleIcon(job.vehicleType), 32, 41)}
          >
            <Popup>
              {job.customerName
                ? `${job.customerName}'s Pickup`
                : "Pickup"}
              <br />
              Vehicle: {job.vehicleType}
              <br />
              <button
                style={{
                  padding: "4px 12px",
                  marginTop: 6,
                  borderRadius: 4,
                  background: "#007bff",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => handleAcceptRide(job.id)}
              >
                Accept Ride
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <ErrorPopup />
    </div>
  );
};

export default AppMap;
