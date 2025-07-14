import React, { useEffect, useState } from "react";

function PendingDriversList({ token }) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch pending drivers on mount or after approve/reject
  const fetchPendingDrivers = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/pending-drivers", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setDrivers(data);
    setLoading(false);
  };

  useEffect(() => { fetchPendingDrivers(); }, []);

  // Approve/Reject handlers
  const handleAction = async (driverId, action) => {
    await fetch(`/api/admin/driver/${driverId}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchPendingDrivers(); // Refresh after action
  };

  if (loading) return <div>Loading pending drivers...</div>;
  if (!drivers.length) return <div>No pending drivers found.</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th><th>Email</th><th>Phone</th><th>Vehicle</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {drivers.map(driver => (
          <tr key={driver.id}>
            <td>{driver.name}</td>
            <td>{driver.email}</td>
            <td>{driver.phone}</td>
            <td>{driver.vehicleType}</td>
            <td>{driver.status}</td>
            <td>
              <button onClick={() => handleAction(driver.id, "approve")}>Approve</button>
              <button onClick={() => handleAction(driver.id, "reject")}>Reject</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default PendingDriversList;