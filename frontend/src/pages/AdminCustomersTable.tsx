import React, { useEffect, useState } from "react";

type Customer = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  online?: boolean;
  disabled?: boolean;
  lat?: number;
  lng?: number;
  country?: string;
  area?: string;
};

type ScheduledRide = {
  scheduledAt: string;
  destLat: number;
  destLng: number;
  vehicleType?: string;
  status?: string;
};

const DEFAULT_PAGE_SIZE = 20;

function customersToCSV(customers: Customer[]): string {
  const columns = [
    "id", "name", "phone", "email", "online", "disabled", "country", "area", "lat", "lng"
  ];
  const header = columns.join(",");
  const rows = customers.map(customer =>
    columns.map(col => {
      let value = customer[col as keyof Customer];
      if (col === "online") value = customer.online ? "Online" : "Offline";
      if (col === "disabled") value = customer.disabled ? "Disabled" : "Active";
      return `"${value ?? ""}"`;
    }).join(",")
  );
  return [header, ...rows].join("\r\n");
}

export default function AdminCustomersTable() {
  const API_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : "";
  const token = localStorage.getItem("token");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [scheduledRides, setScheduledRides] = useState<{ [id: number]: ScheduledRide | null }>({});
  const [noShowCounts, setNoShowCounts] = useState<{ [id: number]: number }>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Customer>("id");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [online, setOnline] = useState<"" | "true" | "false">("");
  const [disabled, setDisabled] = useState<"" | "true" | "false">("");
  const [country, setCountry] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    params.append("limit", String(DEFAULT_PAGE_SIZE));
    params.append("offset", String((page - 1) * DEFAULT_PAGE_SIZE));
    params.append("sortBy", sortBy);
    params.append("order", order);
    if (search) params.append("search", search);
    if (online) params.append("online", online);
    if (disabled) params.append("disabled", disabled);
    if (country) params.append("country", country);
    if (area) params.append("area", area);

    fetch(`${API_URL}/api/admin/customers?${params.toString()}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then(async (res) => {
        if (res.status === 401) {
          setError("Unauthorized. Please log in again.");
          setCustomers([]);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch customers");
        const data = await res.json();
        setCustomers(data);
        setTotal(
          data.length < DEFAULT_PAGE_SIZE
            ? (page - 1) * DEFAULT_PAGE_SIZE + data.length
            : page * DEFAULT_PAGE_SIZE + 1
        );
      })
      .catch(() => {
        setCustomers([]);
        setError("Failed to fetch customers.");
      })
      .finally(() => setLoading(false));
  }, [API_URL, page, sortBy, order, search, online, disabled, country, area, token]);

  // Fetch scheduled ride + no show count for each customer on page
  useEffect(() => {
    customers.forEach((customer) => {
      // Scheduled ride info
      fetch(`${API_URL}/api/admin/customers/${customer.id}/scheduled_ride`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("No scheduled ride");
          const data = await res.json();
          setScheduledRides((prev) => ({ ...prev, [customer.id]: data }));
        })
        .catch(() => setScheduledRides((prev) => ({ ...prev, [customer.id]: null })));

      // No Show count
      fetch(`${API_URL}/api/admin/customers/${customer.id}/no_show_count`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("No show count");
          const data = await res.json();
          setNoShowCounts((prev) => ({ ...prev, [customer.id]: data.count || 0 }));
        })
        .catch(() => setNoShowCounts((prev) => ({ ...prev, [customer.id]: 0 })));
    });
  }, [customers, API_URL, token]);

  // Table column headers
  const columns: { label: string; key: keyof Customer }[] = [
    { label: "ID", key: "id" },
    { label: "Name", key: "name" },
    { label: "Phone", key: "phone" },
    { label: "Email", key: "email" },
    { label: "Online", key: "online" },
    { label: "Disabled", key: "disabled" },
    { label: "Country", key: "country" },
    { label: "Area", key: "area" },
    { label: "Lat", key: "lat" },
    { label: "Lng", key: "lng" },
  ];

  function handleSort(key: keyof Customer) {
    if (sortBy === key) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setOrder("asc");
    }
    setPage(1);
  }

  const countries = Array.from(new Set(customers.map(c => c.country).filter(Boolean))) as string[];
  const areas = Array.from(new Set(customers.map(c => c.area).filter(Boolean))) as string[];

  function nextPage() {
    setPage(page + 1);
  }
  function prevPage() {
    if (page > 1) setPage(page - 1);
  }

  function handleExportCSV() {
    const csv = customersToCSV(customers);
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `customers-page${page}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Enable/disable customer
  async function handleToggleDisabled(customer: Customer) {
    const endpoint = customer.disabled
      ? `${API_URL}/api/admin/customers/${customer.id}/enable`
      : `${API_URL}/api/admin/customers/${customer.id}/disable`;
    try {
      setLoading(true);
      setError("");
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Failed to update customer");
      setCustomers(list =>
        list.map(c =>
          c.id === customer.id ? { ...c, disabled: !c.disabled } : c
        )
      );
    } catch (err) {
      setError("Failed to update customer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h2>Admin - Customer List</h2>
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
        <input
          type="text"
          value={search}
          placeholder="Search name, phone, email..."
          onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ padding: 8, minWidth: 220 }}
        />
        <select value={online} onChange={e => { setOnline(e.target.value as any); setPage(1); }}>
          <option value="">Online (All)</option>
          <option value="true">Online</option>
          <option value="false">Offline</option>
        </select>
        <select value={disabled} onChange={e => { setDisabled(e.target.value as any); setPage(1); }}>
          <option value="">Disabled (All)</option>
          <option value="true">Disabled</option>
          <option value="false">Active</option>
        </select>
        <select value={country} onChange={e => { setCountry(e.target.value); setPage(1); }}>
          <option value="">Country (All)</option>
          {countries.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={area} onChange={e => { setArea(e.target.value); setPage(1); }}>
          <option value="">Area (All)</option>
          {areas.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button onClick={handleExportCSV}>Export CSV</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        {error && (
          <div style={{ color: "red", marginBottom: 12 }}>
            {error}
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    borderBottom: "2px solid #1976D2",
                    cursor: "pointer",
                    padding: "7px 12px",
                    background: "#e3eafc",
                  }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortBy === col.key ? (order === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th style={{ borderBottom: "2px solid #1976D2", padding: "7px 12px", background: "#e3eafc" }}>Scheduled Ride</th>
              <th style={{ borderBottom: "2px solid #1976D2", padding: "7px 12px", background: "#e3eafc" }}>No Show Count</th>
              <th style={{ borderBottom: "2px solid #1976D2", padding: "7px 12px", background: "#e3eafc" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 3} style={{ textAlign: "center", padding: 30 }}>
                  Loading...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3} style={{ textAlign: "center", padding: 30 }}>
                  No customers found.
                </td>
              </tr>
            ) : (
              customers.map(customer => (
                <tr key={customer.id} style={{ background: customer.disabled ? "#ffe0e0" : undefined }}>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: "7px 12px", borderBottom: "1px solid #eee" }}>
                      {col.key === "online"
                        ? customer.online ? "Online" : "Offline"
                        : col.key === "disabled"
                        ? customer.disabled ? "Disabled" : "Active"
                        : customer[col.key] ?? "-"}
                    </td>
                  ))}
                  <td style={{ padding: "7px 12px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                    {scheduledRides[customer.id] ? (
                      <span>
                        {new Date(scheduledRides[customer.id]!.scheduledAt).toLocaleString()}<br />
                        Dest: {scheduledRides[customer.id]!.destLat}, {scheduledRides[customer.id]!.destLng}<br />
                        {scheduledRides[customer.id]!.vehicleType && <span>Vehicle: {scheduledRides[customer.id]!.vehicleType}</span>}
                        {scheduledRides[customer.id]!.status === "no_show" && <span style={{ color: "#f44336" }}>No Show</span>}
                      </span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "7px 12px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                    {noShowCounts[customer.id] ?? 0}
                  </td>
                  <td style={{ padding: "7px 12px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                    <button
                      style={{
                        padding: "6px 10px",
                        borderRadius: 4,
                        background: customer.disabled ? "#1976d2" : "#d32f2f",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onClick={() => handleToggleDisabled(customer)}
                      disabled={loading}
                    >
                      {customer.disabled ? "Enable" : "Disable"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={prevPage} disabled={page <= 1}>
          Previous
        </button>
        <span>Page {page}</span>
        <button onClick={nextPage} disabled={customers.length < DEFAULT_PAGE_SIZE}>
          Next
        </button>
        <span>{customers.length} customers shown</span>
      </div>
    </div>
  );
}