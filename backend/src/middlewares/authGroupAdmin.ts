import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";

/**
 * Middleware to check if the user is an admin for a given family or business group.
 * Accepts req.params.familyId or req.params.businessId.
 * Assumes req.user is set by previous authentication middleware (e.g., JWT).
 * 
 * Usage: Place before controller in routes:
 *   router.get("/family/:familyId/locations", authGroupAdmin("family"), getFamilyLocations);
 *   router.get("/business/:businessId/locations", authGroupAdmin("business"), getBusinessLocations);
 */
export function authGroupAdmin(groupType: "family" | "business") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as { id: number, role?: string };
      if (!user || typeof user.id !== "number") {
        return res.status(401).json({ error: "Not authenticated" });
      }
      let groupId: number | undefined;
      if (groupType === "family") {
        groupId = Number(req.params.familyId);
        if (!groupId) return res.status(400).json({ error: "Missing familyId param" });
        // Check if this user is FAMILY_ADMIN in this family
        const userRole = await prisma.userRole.findFirst({
          where: {
            userId: user.id,
            familyId: groupId,
            role: "FAMILY_ADMIN",
          },
        });
        if (!userRole) {
          return res.status(403).json({ error: "Forbidden: not family admin" });
        }
      } else if (groupType === "business") {
        groupId = Number(req.params.businessId);
        if (!groupId) return res.status(400).json({ error: "Missing businessId param" });
        // Check if this user is BUSINESS_ADMIN in this business
        const userRole = await prisma.userRole.findFirst({
          where: {
            userId: user.id,
            businessId: groupId,
            role: "BUSINESS_ADMIN",
          },
        });
        if (!userRole) {
          return res.status(403).json({ error: "Forbidden: not business admin" });
        }
      } else {
        return res.status(400).json({ error: "Invalid group type" });
      }
      next();
    } catch (error) {
      console.error("authGroupAdmin middleware error:", error);
      res.status(500).json({ error: "Internal server error (authGroupAdmin)" });
    }
  };
}