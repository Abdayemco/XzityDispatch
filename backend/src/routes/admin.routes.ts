import { Router } from "express";
import { isAdmin } from "../middlewares/isAdmin";
import { prisma } from "../utils/prisma";

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
  // This assumes lat/lng are stored as Float in Prisma, and you want a simple filter
  // For performance, you may want to use PostGIS or similar for geospatial queries
  // Here, we filter with a bounding box for simplicity
  const deltaLat = radiusKm / 111; // ~111km per degree latitude
  const deltaLng = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  return {
    lat: { gte: lat - deltaLat, lte: lat + deltaLat },
    lng: { gte: lng - deltaLng, lte: lng + deltaLng },
  };
}

const router = Router();

router.use(isAdmin);

// --- Live Map Endpoints ---
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
        disabled: true,
      },
      orderBy: { id: "desc" },
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch online drivers for map" });
  }
});

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
        disabled: true,
      },
      orderBy: { id: "desc" },
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch online customers for map" });
  }
});

// --- Advanced Drivers endpoint ---
router.get("/drivers", async (req, res) => {
  try {
    const allowedFields = [
      "id", "name", "phone", "email", "avatar", "vehicleType",
      "trialStart", "trialEnd", "subscriptionStatus", "subscriptionFee",
      "paymentMethod", "isSubscriptionDisabled", "disabled", "online",
      "lat", "lng"
      // Add "area" here if you add it to your schema
    ];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const { take, skip } = getPagination(req.query);

    // Build "where" filter
    const where: any = { role: "DRIVER" };
    if (req.query.online !== undefined) where.online = req.query.online === "true";
    if (req.query.disabled !== undefined) where.disabled = req.query.disabled === "true";
    if (req.query.vehicleType) where.vehicleType = req.query.vehicleType;
    if (req.query.subscriptionStatus) where.subscriptionStatus = req.query.subscriptionStatus;
    if (req.query.lat) where.lat = Number(req.query.lat);
    if (req.query.lng) where.lng = Number(req.query.lng);
    // For location radius filter
    Object.assign(where, locationRadiusFilter(req.query));
    // For area filter (if you add area to schema)
    if (req.query.area) where.area = req.query.area;

    // Text search (by name, phone, email)
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
        // area: true, // uncomment if area in schema
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

// --- Single driver ---
router.get("/drivers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const driver = await prisma.user.findUnique({
      where: { id },
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
        // area: true,
      },
    });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- Update driver subscription/location/status ---
router.patch("/drivers/:id/subscription", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      trialStart,
      trialEnd,
      subscriptionStatus,
      subscriptionFee,
      paymentMethod,
      isSubscriptionDisabled,
      disabled,
      lat,
      lng,
      online
      // area // if you add area
    } = req.body;

    const driver = await prisma.user.findUnique({ where: { id } });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    if (driver.role !== "DRIVER") return res.status(400).json({ error: "Not a driver" });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        trialStart,
        trialEnd,
        subscriptionStatus,
        subscriptionFee,
        paymentMethod,
        isSubscriptionDisabled,
        disabled,
        lat,
        lng,
        online,
        // area
      },
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
        // area: true,
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- Advanced Customers endpoint ---
router.get("/customers", async (req, res) => {
  try {
    const allowedFields = [
      "id", "name", "phone", "email", "avatar", "disabled", "online", "lat", "lng"
      // Add "area" if you add to schema
    ];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const { take, skip } = getPagination(req.query);

    // Build "where" filter
    const where: any = { role: "CUSTOMER" };
    if (req.query.online !== undefined) where.online = req.query.online === "true";
    if (req.query.disabled !== undefined) where.disabled = req.query.disabled === "true";
    if (req.query.lat) where.lat = Number(req.query.lat);
    if (req.query.lng) where.lng = Number(req.query.lng);
    if (req.query.area) where.area = req.query.area;
    Object.assign(where, locationRadiusFilter(req.query));

    // Text search
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
        // area: true,
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

// --- Block/unblock customer ---
router.patch("/customers/:id/block", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { disabled } = req.body;
    const customer = await prisma.user.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (customer.role !== "CUSTOMER") return res.status(400).json({ error: "Not a customer" });

    const updated = await prisma.user.update({
      where: { id },
      data: { disabled: !!disabled },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        disabled: true,
        online: true,
        // area: true,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- Rides endpoint (sortable, paginated) ---
router.get("/rides", async (req, res) => {
  try {
    const allowedFields = ["id", "requestedAt"];
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

export default router;