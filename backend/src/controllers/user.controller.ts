import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VALID_PROVIDER_CATEGORIES = [
  "CLEANER", "DRIVER", "HAIR_DRESSER", "TUTOR", "INSTITUTE", "PET_CARE",
  "PROPERTY_CARE", "ENGINEERING", "HUMAN_CARE", "LIFESTYLE", "IT_SERVICE",
  "LEGAL_SERVICE", "REALTOR", "SHOPPER", "BEAUTY"
  // Add/remove as you wish, matching ServiceCategory records if needed!
];

// PATCH /users/:id/main-provider-category
export async function updateMainProviderCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { mainProviderCategory } = req.body;

  if (!mainProviderCategory) {
    return res.status(400).json({ error: "mainProviderCategory is required" });
  }
  if (!VALID_PROVIDER_CATEGORIES.includes(mainProviderCategory)) {
    return res.status(400).json({ error: "Invalid mainProviderCategory" });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { mainProviderCategory }
    });
    res.json({ success: true, user });
  } catch (e) {
    res.status(404).json({ error: "User not found" });
  }
}