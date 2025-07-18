import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";

export async function checkUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    // Debug: log every entry into the middleware
    console.log("checkUserStatus: called", req.method, req.originalUrl);

    // Get the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("Missing or malformed Authorization header");
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }

    // Extract and verify JWT
    const token = authHeader.substring(7);
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err) {
      console.warn("Invalid JWT token");
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // Find user in DB
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      console.warn("User not found in DB (id:", decoded.id, ")");
      return res.status(401).json({ error: "User not found" });
    }

    if (user.disabled) {
      console.warn(`User ${user.id} is disabled`);
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

    // Debug: log successful authentication
    console.log("Authenticated user:", req.user);

    next();
  } catch (err) {
    console.error("Error in checkUserStatus middleware:", err);
    next(err);
  }
}