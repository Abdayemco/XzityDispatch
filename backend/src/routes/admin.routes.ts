import { Router } from "express";
import { isAdmin } from "../middlewares/isAdmin";
import { prisma } from "../utils/prisma";
import {
  getCustomerScheduledRide,
  getDriverScheduledRide,
  getCustomerNoShowCount,
  getDriverNoShowCount,
  assignDriverToScheduledRide
} from "../controllers/admin.controller";

// Helper to get safe sort params
function getSortParams(query: any, allowedFields: string[], defaultField = "id", defaultOrder = "desc") {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : defaultField;
  const order = (query.order === "asc" || query.order === "desc") ? query.order : defaultOrder;
  return { sortBy, order };
}

// Helper for pagination
function getPagination(query: any, defaultLimit = 50) {
  const limit = Math.max(1, Math.min(100, Number(query.limit) || defaultLimit));
  const offset = Math.max(0, Number(query.offset) || 0);
  return { take: limit, skip: offset };
}

// Helper for location radius filtering (Haversine formula)
function locationRadiusFilter(query: any) {
  const lat = query.lat ? Number(query.lat) : undefined;
  const lng = query.lng ? Number(query.lng) : undefined;
  const radiusKm = query.radiusKm ? Number(query.radiusKm) : undefined;
  if (!lat || !lng || !radiusKm) return undefined;
  const deltaLat = radiusKm / 111;
  const deltaLng = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  return {
    lat: { gte: lat - deltaLat, lte: lat + deltaLat },
    lng: { gte: lng - deltaLng, lte: lng + deltaLng },
  };
}

const router = Router();
router.use(isAdmin);

// --- Advanced Drivers endpoint ---
router.get("/drivers", async (req, res) => {
  try {
    const allowedFields = [
      "id", "name", "phone", "email", "avatar", "vehicleType",
      "trialStart", "trialEnd", "subscriptionStatus", "subscriptionFee",
      "paymentMethod", "isSubscriptionDisabled", "disabled", "online",
      "lat", "lng", "country", "area"
    ];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const { take, skip } = getPagination(req.query);

    const where: any = { role: "DRIVER" };
    if (req.query.online !== undefined) where.online = req.query.online === "true";
    if (req.query.disabled !== undefined) where.disabled = req.query.disabled === "true";
    if (req.query.vehicleType) where.vehicleType = req.query.vehicleType;
    if (req.query.subscriptionStatus) where.subscriptionStatus = req.query.subscriptionStatus;
    if (req.query.lat) where.lat = Number(req.query.lat);
    if (req.query.lng) where.lng = Number(req.query.lng);
    if (req.query.country) where.country = req.query.country;
    if (req.query.area) where.area = req.query.area;
    Object.assign(where, locationRadiusFilter(req.query));

    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    const drivers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        vehicleType: true,
        lat: true,
        lng: true,
        online: true,
        trialStart: true,
        trialEnd: true,
        subscriptionStatus: true,
        subscriptionFee: true,
        paymentMethod: true,
        isSubscriptionDisabled: true,
        disabled: true,
        country: true,
        area: true,
      },
      orderBy: { [sortBy]: order },
      skip,
      take
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// --- Enable/Disable Driver endpoints ---
router.put("/drivers/:id/disable", async (req, res) => {
  try {
    const driverId = Number(req.params.id);
    const driver = await prisma.user.update({
      where: { id: driverId, role: "DRIVER" },
      data: { disabled: true },
      select: {
        id: true, name: true, disabled: true
      }
    });
    res.json(driver);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.status(500).json({ error: "Failed to disable driver" });
  }
});
router.put("/drivers/:id/enable", async (req, res) => {
  try {
    const driverId = Number(req.params.id);
    const driver = await prisma.user.update({
      where: { id: driverId, role: "DRIVER" },
      data: { disabled: false },
      select: {
        id: true, name: true, disabled: true
      }
    });
    res.json(driver);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.status(500).json({ error: "Failed to enable driver" });
  }
});

// --- MAP DRIVERS endpoint for admin live map ---
router.get("/map/drivers", async (req, res) => {
  try {
    const drivers = await prisma.user.findMany({
      where: {
        role: "DRIVER",
        online: true,
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleType: true,
        lat: true,
        lng: true,
        online: true,
      },
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch map drivers" });
  }
});

// --- Advanced Customers endpoint ---
router.get("/customers", async (req, res) => {
  try {
    const allowedFields = [
      "id", "name", "phone", "email", "avatar", "disabled", "online", "lat", "lng", "country", "area"
    ];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const { take, skip } = getPagination(req.query);

    const where: any = { role: "CUSTOMER" };
    if (req.query.online !== undefined) where.online = req.query.online === "true";
    if (req.query.disabled !== undefined) where.disabled = req.query.disabled === "true";
    if (req.query.lat) where.lat = Number(req.query.lat);
    if (req.query.lng) where.lng = Number(req.query.lng);
    if (req.query.country) where.country = req.query.country;
    if (req.query.area) where.area = req.query.area;
    Object.assign(where, locationRadiusFilter(req.query));

    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    const customers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        lat: true,
        lng: true,
        online: true,
        disabled: true,
        country: true,
        area: true,
      },
      orderBy: { [sortBy]: order },
      skip,
      take
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// --- Enable/Disable Customer endpoints ---
router.put("/customers/:id/disable", async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const customer = await prisma.user.update({
      where: { id: customerId, role: "CUSTOMER" },
      data: { disabled: true },
      select: {
        id: true, name: true, disabled: true
      }
    });
    res.json(customer);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(500).json({ error: "Failed to disable customer" });
  }
});
router.put("/customers/:id/enable", async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const customer = await prisma.user.update({
      where: { id: customerId, role: "CUSTOMER" },
      data: { disabled: false },
      select: {
        id: true, name: true, disabled: true
      }
    });
    res.json(customer);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(500).json({ error: "Failed to enable customer" });
  }
});

// --- MAP CUSTOMERS endpoint for admin live map ---
router.get("/map/customers", async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        online: true,
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleType: true,
        lat: true,
        lng: true,
        online: true,
      },
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch map customers" });
  }
});

// --- Rides endpoint (sortable, paginated) ---
router.get("/rides", async (req, res) => {
  try {
    const allowedFields = ["id", "requestedAt", "scheduledAt"];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "requestedAt", "desc");
    const { take, skip } = getPagination(req.query);

    const rides = await prisma.ride.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        driver: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: { [sortBy]: order },
      skip,
      take
    });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// --- SCHEDULED RIDE FOR CUSTOMER ---
router.get("/customers/:id/scheduled_ride", getCustomerScheduledRide);

// --- SCHEDULED RIDE FOR DRIVER ---
router.get("/drivers/:id/scheduled_ride", getDriverScheduledRide);

// --- NO SHOW COUNTS FOR CUSTOMER/DRIVER ---
router.get("/customers/:id/no_show_count", getCustomerNoShowCount);
router.get("/drivers/:id/no_show_count", getDriverNoShowCount);

// --- ASSIGN DRIVER TO SCHEDULED RIDE ---
router.put("/rides/:rideId/assign", assignDriverToScheduledRide);

export default router;