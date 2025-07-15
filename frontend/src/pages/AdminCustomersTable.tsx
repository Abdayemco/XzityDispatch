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

const DEFAULT_PAGE_SIZE = 20;

export default function AdminCustomersTable() {
  const API_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : "";

  const token = localStorage.getItem("token");

  const [customers, setCustomers] = useState<Customer[]>([]);
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: 30 }}>
                  Loading...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: 30 }}>
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