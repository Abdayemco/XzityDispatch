import { Router } from "express";
import { prisma } from "../utils/prisma";
import { RideStatus, Role } from "@prisma/client";

const router = Router();

router.post("/reset", async (req, res) => {
  try {
    // Reset all rides to COMPLETED and unassign drivers
    await prisma.ride.updateMany({
      data: { status: RideStatus.COMPLETED, driverId: null },
      where: {}, // all rides
    });
    // Mark all drivers as not busy
    await prisma.user.updateMany({
      data: { isBusy: false },
      where: { role: Role.DRIVER },
    });
    res.json({ message: "All rides reset and drivers marked as not busy." });
  } catch (error) {
    console.error("Error resetting rides:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;