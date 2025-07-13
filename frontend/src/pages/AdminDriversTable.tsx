import React, { useEffect, useState } from "react";

type Driver = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  vehicleType?: string;
  online?: boolean;
  disabled?: boolean;
  lat?: number;
  lng?: number;
  country?: string;
  area?: string;
};

const DEFAULT_PAGE_SIZE = 20;

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  CAR: "Car",
  DELIVERY: "Delivery",
  TUKTUK: "Tuktuk",
  TRUCK: "Truck",
  WATER_TRUCK: "Water Truck",
  TOW_TRUCK: "Tow Truck",
  WHEELCHAIR: "Wheelchair",
  LIMO: "Limo", // <-- Added Limo here
};

export default function AdminDriversTable() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Driver>("id");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [online, setOnline] = useState<"" | "true" | "false">("");
  const [vehicleType, setVehicleType] = useState<string>("");
  const [disabled, setDisabled] = useState<"" | "true" | "false">("");
  const [country, setCountry] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Fetch drivers from API
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.append("limit", String(DEFAULT_PAGE_SIZE));
    params.append("offset", String((page - 1) * DEFAULT_PAGE_SIZE));
    params.append("sortBy", sortBy);
    params.append("order", order);
    if (search) params.append("search", search);
    if (online) params.append("online", online);
    if (vehicleType) params.append("vehicleType", vehicleType);
    if (disabled) params.append("disabled", disabled);
    if (country) params.append("country", country);
    if (area) params.append("area", area);

    fetch(`/api/admin/drivers?${params.toString()}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch drivers");
        const data = await res.json();
        setDrivers(data);
        setTotal(data.length < DEFAULT_PAGE_SIZE ? (page - 1) * DEFAULT_PAGE_SIZE + data.length : page * DEFAULT_PAGE_SIZE + 1);
      })
      .catch(() => setDrivers([]))
      .finally(() => setLoading(false));
  }, [page, sortBy, order, search, online, vehicleType, disabled, country, area]);

  // Table column headers
  const columns: { label: string; key: keyof Driver }[] = [
    { label: "ID", key: "id" },
    { label: "Name", key: "name" },
    { label: "Phone", key: "phone" },
    { label: "Email", key: "email" },
    { label: "Vehicle", key: "vehicleType" },
    { label: "Online", key: "online" },
    { label: "Disabled", key: "disabled" },
    { label: "Country", key: "country" },
    { label: "Area", key: "area" },
    { label: "Lat", key: "lat" },
    { label: "Lng", key: "lng" },
  ];

  // Change sorting
  function handleSort(key: keyof Driver) {
    if (sortBy === key) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setOrder("asc");
    }
    setPage(1);
  }

  // Filter options (build from current driver data or static list)
  const vehicleTypes = Object.entries(VEHICLE_TYPE_LABELS);
  const countries = Array.from(new Set(drivers.map(d => d.country).filter(Boolean))) as string[];
  const areas = Array.from(new Set(drivers.map(d => d.area).filter(Boolean))) as string[];

  // Pagination logic
  function nextPage() { setPage(page + 1); }
  function prevPage() { if (page > 1) setPage(page - 1); }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h2>Admin - Driver List</h2>
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
        <input
          type="text"
          value={search}
          placeholder="Search name, phone, email..."
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: 8, minWidth: 220 }}
        />
        <select value={online} onChange={e => { setOnline(e.target.value as any); setPage(1); }}>
          <option value="">Online (All)</option>
          <option value="true">Online</option>
          <option value="false">Offline</option>
        </select>
        <select value={vehicleType} onChange={e => { setVehicleType(e.target.value); setPage(1); }}>
          <option value="">Vehicle (All)</option>
          {vehicleTypes.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select value={disabled} onChange={e => { setDisabled(e.target.value as any); setPage(1); }}>
          <option value="">Disabled (All)</option>
          <option value="true">Disabled</option>
          <option value="false">Active</option>
        </select>
        <select value={country} onChange={e => { setCountry(e.target.value); setPage(1); }}>
          <option value="">Country (All)</option>
          {countries.map(c => (<option key={c} value={c}>{c}</option>))}
        </select>
        <select value={area} onChange={e => { setArea(e.target.value); setPage(1); }}>
          <option value="">Area (All)</option>
          {areas.map(a => (<option key={a} value={a}>{a}</option>))}
        </select>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ borderBottom: "2px solid #1976D2", cursor: "pointer", padding: "7px 12px", background: "#e3eafc" }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortBy === col.key ? (order === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} style={{ textAlign: "center", padding: 30 }}>Loading...</td></tr>
            ) : drivers.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ textAlign: "center", padding: 30 }}>No drivers found.</td></tr>
            ) : (
              drivers.map(driver => (
                <tr key={driver.id} style={{ background: driver.disabled ? "#ffe0e0" : undefined }}>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: "7px 12px", borderBottom: "1px solid #eee" }}>
                      {col.key === "vehicleType"
                        ? VEHICLE_TYPE_LABELS[driver.vehicleType || ""] || driver.vehicleType || "-"
                        : col.key === "online"
                        ? driver.online ? "Online" : "Offline"
                        : col.key === "disabled"
                        ? driver.disabled ? "Disabled" : "Active"
                        : driver[col.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={prevPage} disabled={page <= 1}>Previous</button>
        <span>Page {page}</span>
        <button onClick={nextPage} disabled={drivers.length < DEFAULT_PAGE_SIZE}>Next</button>
        <span>{drivers.length} drivers shown</span>
      </div>
    </div>
  );
}