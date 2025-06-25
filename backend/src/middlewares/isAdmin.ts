import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";

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
    if (!payload || (payload.role && payload.role.toLowerCase() !== "admin")) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Optionally: Attach user info to req for downstream handlers
    req.user = payload;

    next();
  } catch (error) {
    console.error("isAdmin middleware error:", error);
    res.status(500).json({ error: "Internal server error in admin check" });
  }
};