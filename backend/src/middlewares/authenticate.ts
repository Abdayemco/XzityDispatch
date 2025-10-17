import { Request, Response, NextFunction } from "express";

/**
 * Simple authentication middleware to ensure req.user is present.
 * Use after JWT decoding middleware (e.g. checkUserStatus).
 */
export default function authenticate(req: Request, res: Response, next: NextFunction) {
  if (req.user && req.user.id) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized: User not authenticated" });
}