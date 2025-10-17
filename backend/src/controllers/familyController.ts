import { Request, Response } from "express";
import { prisma } from "../utils/prisma";

// GET /families - get all families/groups for current user
export const getFamilies = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const families = await prisma.family.findMany({
      where: { adminId: userId },
      include: {
        users: {
          include: { user: true }
        }
      }
    });
    res.json(families);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch families" });
  }
};

// POST /families - create a new family/group
export const createFamily = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!name) return res.status(400).json({ error: "Group name required" });

    const family = await prisma.family.create({
      data: {
        name,
        adminId: userId,
        users: {
          create: {
            userId,
            role: "FAMILY_ADMIN",
            verified: true,
          }
        }
      }
    });
    res.status(201).json(family);
  } catch (err) {
    res.status(500).json({ error: "Failed to create family" });
  }
};

// PATCH /families/:id - edit a family/group
export const updateFamily = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const familyId = Number(req.params.id);
    const { name } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Only allow editing own family where user is admin
    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.adminId !== userId)
      return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.family.update({
      where: { id: familyId },
      data: { name }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update family" });
  }
};

// DELETE /families/:id - delete a family/group
export const deleteFamily = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const familyId = Number(req.params.id);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Only allow deleting own family where user is admin
    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.adminId !== userId)
      return res.status(403).json({ error: "Forbidden" });

    await prisma.family.delete({ where: { id: familyId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete family" });
  }
};