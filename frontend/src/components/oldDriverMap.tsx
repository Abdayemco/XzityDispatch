import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import carIcon from "../assets/marker-car.png";
import bikeIcon from "../assets/marker-bike.png";
import tuktukIcon from "../assets/marker-toktok.png";
import truckIcon from "../assets/marker-truck.png";

// Utility: Get icon URL for a given vehicleType (enum values)
function getVehicleIcon(vehicleType: string) {
  switch (vehicleType.toUpperCase()) {
    case "CAR": return carIcon;
    case "BIKE": return bikeIcon;
    case "TUKTUK":
    case "TOKTOK": return tuktukIcon;
    case "TRUCK": return truckIcon;
    default: return carIcon;
  }
}

// Create a Leaflet icon
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
  customerName: string;
  status: string;
  vehicleType: string;
};

type Props = {
  jobs: Job[];
  driverLocation: { lat: number; lng: number } | null;
  driverVehicleType: string;
};

const DriverMap: React.FC<Props> = ({ jobs, driverLocation, driverVehicleType }) => {
  // Default to some center if driver's location is unknown
  const mapCenter = driverLocation ? [driverLocation.lat, driverLocation.lng] : [51.505, -0.09];

  return (
    <div style={{ width: "100%", height: 340 }}>
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ width: "100%", height: "100%", borderRadius: 10 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Driver location marker */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={createLeafletIcon(getVehicleIcon(driverVehicleType), 40, 51)}>
            <Popup>Your location</Popup>
          </Marker>
        )}
        {/* Job pickup location markers */}
        {jobs.map(job => (
          <Marker
            key={job.id}
            position={[job.pickupLat, job.pickupLng]}
            icon={createLeafletIcon(getVehicleIcon(job.vehicleType), 32, 41)}
          >
            <Popup>
              {job.customerName ? `${job.customerName}'s Pickup` : "Pickup"}<br />
              Vehicle: {job.vehicleType}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default DriverMap;