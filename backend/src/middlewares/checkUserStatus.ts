import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";

/**
 * Middleware to check if the user is authenticated via Bearer token,
 * exists in the database, and is not disabled.
 * Sets req.user = { id, role, name, ... } for downstream handlers.
 */
export async function checkUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    // Get the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }

    // Extract and verify JWT
    const token = authHeader.substring(7);
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // Find user in DB
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.disabled) {
      return res.status(403).json({
        error: "Your account is currently on hold. Kindly call the administrator to reinstate your account."
      });
    }

    // Attach user info to req.user for downstream handlers
    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone,
      email: user.email,
      vehicleType: user.vehicleType,
      // Add anything else your app needs
    };

    next();
  } catch (err) {
    next(err);
  }
}