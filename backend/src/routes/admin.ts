import { Router } from "express";
import { isAdmin } from "../middlewares/isAdmin";
import { prisma } from "../utils/prisma";

const router = Router();

// List all users
router.get("/users", isAdmin, async (req, res) => {
  console.log("HIT /api/admin/users");
  try {
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
    });
    console.log("USERS FETCHED:", users.length);
    res.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// List all rides
router.get("/rides", isAdmin, async (req, res) => {
  console.log("HIT /api/admin/rides");
  try {
    const rides = await prisma.ride.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { requestedAt: "desc" },
    });
    console.log("RIDES FETCHED:", rides.length);
    res.json(rides);
  } catch (error) {
    console.error("Failed to fetch rides:", error);
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// List all drivers who are not verified by phone
router.get("/pending-drivers", isAdmin, async (req, res) => {
  console.log("HIT /api/admin/pending-drivers");
  try {
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
    });
    console.log("PENDING DRIVERS FETCHED:", pendingDrivers.length);
    res.json(pendingDrivers);
  } catch (error) {
    console.error("Failed to fetch pending drivers:", error);
    res.status(500).json({ error: "Failed to fetch pending drivers" });
  }
});

// --- NEW: List all online drivers with location for admin live map ---
router.get("/drivers", isAdmin, async (req, res) => {
  console.log("HIT /api/admin/drivers");
  try {
    const drivers = await prisma.user.findMany({
      where: {
        role: "DRIVER",
        online: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleType: true,
        lat: true,        // <-- Location
        lng: true,        // <-- Location
        online: true,
        disabled: true,
      },
      orderBy: { id: "desc" },
    });
    console.log("DRIVERS FETCHED:", drivers.length);
    res.json(drivers);
  } catch (error) {
    console.error("Failed to fetch drivers:", error);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// PATCH block/unblock user (used by frontend)
router.patch("/users/:userId/block", isAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { disabled } = req.body;

    // Prevent self-blocking
    if (req.user?.id === userId) {
      return res.status(400).json({ error: "You cannot block/unblock yourself." });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { disabled: !!disabled },
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error blocking/unblocking user:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// (Optional) Old POST enable/disable user routes
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