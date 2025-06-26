import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";

export async function checkUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id; // req.user should be set by authentication middleware
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.disabled) {
      return res.status(403).json({
        error: "Your account is currently on hold. Kindly call the administrator to reinstate your account."
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}