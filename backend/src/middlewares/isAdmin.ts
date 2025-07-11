import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";

/**
 * isAdmin middleware:
 * - Authenticates the JWT token
 * - Checks user is admin (role = "admin" case-insensitive)
 * - Checks user is not disabled
 * - Attaches full user object to req.user for downstream handlers
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.split(" ")[1];
    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Accept both "ADMIN" and "admin" for robustness
    if (!payload || !payload.role || payload.role.toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Ensure the user still exists and is not disabled
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    if (user.disabled) {
      return res.status(403).json({
        error:
          "Your account is currently on hold. Kindly call the administrator to reinstate your account.",
      });
    }

    // Attach full user object to req.user for downstream handlers
    req.user = user;

    next();
  } catch (error) {
    console.error("isAdmin middleware error:", error);
    res.status(500).json({ error: "Internal server error in admin check" });
  }
};