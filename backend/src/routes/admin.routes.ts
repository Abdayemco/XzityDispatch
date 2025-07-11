import { Router } from "express";
import { isAdmin } from "../middlewares/isAdmin";
import { prisma } from "../utils/prisma";

// Helper to get safe sort params
function getSortParams(query: any, allowedFields: string[], defaultField: string = "id", defaultOrder: string = "desc") {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : defaultField;
  const order = (query.order === "asc" || query.order === "desc") ? query.order : defaultOrder;
  return { sortBy, order };
}

const router = Router();

// Apply isAdmin middleware to all admin endpoints
router.use(isAdmin);

// --- Live Map Endpoints ---
// Online drivers with location (for admin map)
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

// Online customers with location (for admin map)
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

// --- Drivers (all drivers, sortable) ---
router.get("/drivers", async (req, res) => {
  try {
    const allowedFields = [
      "id", "name", "phone", "email", "avatar",
      "trialStart", "trialEnd", "subscriptionStatus",
      "subscriptionFee", "paymentMethod", "isSubscriptionDisabled",
      "disabled", "online"
    ];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const drivers = await prisma.user.findMany({
      where: { role: "DRIVER" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
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
      },
      orderBy: { [sortBy]: order },
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// Get a single driver
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
      },
    });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Update a driver's subscription & location & status
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
        online
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
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
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- Customers (all customers, sortable) ---
router.get("/customers", async (req, res) => {
  try {
    const allowedFields = ["id", "name", "phone", "email", "avatar", "disabled", "online"];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        disabled: true,
        online: true,
      },
      orderBy: { [sortBy]: order },
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Block/unblock customer
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
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- Rides (sortable by id, requestedAt) ---
router.get("/rides", async (req, res) => {
  try {
    const allowedFields = ["id", "requestedAt"];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "requestedAt", "desc");
    const rides = await prisma.ride.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        driver: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: { [sortBy]: order },
    });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

export default router;