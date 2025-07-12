import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";

// Middleware should set req.user for the authenticated driver.
export const updateLocationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as { id: number; role: string };
    if (!user || user.role !== "DRIVER") {
      return res.status(401).json({ error: "Not authorized" });
    }

    // Accept location and status from body
    const { lat, lng, online } = req.body;

    // Validate input
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      typeof online !== "boolean"
    ) {
      return res.status(400).json({ error: "Missing or invalid lat, lng, or online status" });
    }

    // Update the driver in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { lat, lng, online },
    });

    res.json({ message: "Location and status updated." });
  } catch (error) {
    console.error("Error updating driver location/status:", error);
    next(error);
  }
};