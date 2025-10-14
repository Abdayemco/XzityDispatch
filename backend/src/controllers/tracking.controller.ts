import { Request, Response, NextFunction } from "express";
import { getFamilyMembersLocations, getBusinessMembersLocations } from "../services/tracking.service";

// GET /api/family/:familyId/locations
export const getFamilyLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const familyId = Number(req.params.familyId);
    if (!familyId) return res.status(400).json({ error: "Missing or invalid familyId" });
    const locations = await getFamilyMembersLocations(familyId);
    res.json({ familyId, members: locations });
  } catch (error) {
    next(error);
  }
};

// GET /api/business/:businessId/locations
export const getBusinessLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = Number(req.params.businessId);
    if (!businessId) return res.status(400).json({ error: "Missing or invalid businessId" });
    const locations = await getBusinessMembersLocations(businessId);
    res.json({ businessId, members: locations });
  } catch (error) {
    next(error);
  }
};