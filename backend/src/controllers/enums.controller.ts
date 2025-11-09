// Add this new controller to allow the frontend to fetch enums for jobs/roles/types

import { Request, Response } from "express";
import { Role, VehicleType, RideStatus } from "@prisma/client";

// Helper: map to user-friendly labels (optional, can expand as needed)
const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  DRIVER: "Driver",
  CUSTOMER: "Customer",
  SHOPPER: "Shopper",
  HAIR_DRESSER: "Hair Dresser",
  INSTITUTE: "Institute / Beauty",
  CLEANER: "Cleaner",
  GARDENER: "Gardener",
  PLUMBER: "Plumber",
  ELECTRICIAN: "Electrician",
  ERRAND_RUNNER: "Errand Runner",
  BABYSITTER: "Babysitter",
  TUTOR: "Tutor",
  LAUNDRY: "Laundry",
  PAINTER: "Painter",
  PHYSIOTHERAPIST: "Physiotherapist",
  ELDER_CARE: "Elder Care",
  JOB1: "Specialist 1",
  JOB2: "Specialist 2",
  JOB3: "Specialist 3",
  JOB4: "Specialist 4",
};

export const getRoles = (req: Request, res: Response) => {
  const roles = Object.values(Role);
  res.json({
    roles,
    labels: roleLabels
  });
};

export const getVehicleTypes = (req: Request, res: Response) => {
  const vehicleTypes = Object.values(VehicleType);
  res.json({ vehicleTypes });
};

export const getRideStatuses = (req: Request, res: Response) => {
  const rideStatuses = Object.values(RideStatus);
  res.json({ rideStatuses });
};