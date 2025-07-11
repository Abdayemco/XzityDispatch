import { Router } from "express";
import { isAdmin } from "../middlewares/isAdmin";
import { prisma } from "../utils/prisma";

const router = Router();

// Helper to get sort params safely
function getSortParams(query: any, allowedFields: string[], defaultField: string = "id", defaultOrder: string = "desc") {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : defaultField;
  const order = (query.order === "asc" || query.order === "desc") ? query.order : defaultOrder;
  return { sortBy, order };
}

// List all users (all roles, sortable)
router.get("/users", isAdmin, async (req, res) => {
  try {
    const allowedFields = ["id", "name", "email", "phone", "role", "vehicleType", "isBusy", "phoneVerified", "disabled"];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        vehicleType: true,
        isBusy: true,
        phoneVerified: true,
        disabled: true,
      },
      orderBy: { [sortBy]: order },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// List all rides (sortable by id, requestedAt)
router.get("/rides", isAdmin, async (req, res) => {
  try {
    const allowedFields = ["id", "requestedAt"];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "requestedAt", "desc");
    const rides = await prisma.ride.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { [sortBy]: order },
    });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// List all drivers who are not verified by phone (sortable)
router.get("/pending-drivers", isAdmin, async (req, res) => {
  try {
    const allowedFields = ["id", "name", "email", "phone", "vehicleType", "phoneVerified", "disabled"];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const pendingDrivers = await prisma.user.findMany({
      where: {
        role: "DRIVER",
        phoneVerified: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        vehicleType: true,
        phoneVerified: true,
        disabled: true,
      },
      orderBy: { [sortBy]: order },
    });
    res.json(pendingDrivers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pending drivers" });
  }
});

// List all online drivers with location for admin live map
router.get("/map/drivers", isAdmin, async (req, res) => {
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
    res.status(500).json({ error: "Failed to fetch drivers for map" });
  }
});

// List all online customers with location for admin live map
router.get("/map/customers", isAdmin, async (req, res) => {
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
    res.status(500).json({ error: "Failed to fetch customers for map" });
  }
});

// List all drivers (sortable)
router.get("/drivers", isAdmin, async (req, res) => {
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
router.get("/drivers/:id", isAdmin, async (req, res) => {
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
router.patch("/drivers/:id/subscription", isAdmin, async (req, res) => {
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

// List all customers (sortable)
router.get("/customers", isAdmin, async (req, res) => {
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
router.patch("/customers/:id/block", isAdmin, async (req, res) => {
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

// PATCH block/unblock user (used by frontend for all roles)
router.patch("/users/:userId/block", isAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { disabled } = req.body;

    if (req.user?.id === userId) {
      return res.status(400).json({ error: "You cannot block/unblock yourself." });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { disabled: !!disabled },
    });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Old POST enable/disable user routes (all roles)
router.post("/user/:id/enable", isAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { disabled: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to enable user." });
  }
});

router.post("/user/:id/disable", isAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { disabled: true },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to disable user." });
  }
});

export default router;