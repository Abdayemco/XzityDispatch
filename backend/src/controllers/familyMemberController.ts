import { Request, Response } from "express";
import { prisma } from "../utils/prisma";

// GET /families/:familyId/members - List members in a family
export const listFamilyMembers = async (req: Request, res: Response) => {
  try {
    const familyId = Number(req.params.familyId);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.adminId !== userId)
      return res.status(403).json({ error: "Forbidden" });

    const members = await prisma.userRole.findMany({
      where: { familyId },
      include: { user: true },
    });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: "Failed to get members" });
  }
};

// POST /families/:familyId/members - Add member to a family
export const addFamilyMember = async (req: Request, res: Response) => {
  try {
    const familyId = Number(req.params.familyId);
    const userId = req.user?.id;
    const { name, phone } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!name || !phone)
      return res.status(400).json({ error: "Name and phone required" });

    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.adminId !== userId)
      return res.status(403).json({ error: "Forbidden" });

    // Create invitation code
    const code = Math.random().toString(36).substring(2, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invitation and unregistered member
    const invitation = await prisma.familyInvitation.create({
      data: {
        familyId,
        name,
        phone,
        code,
        expiresAt,
      },
    });

    // Optionally, create UserRole for pending member (or only after invite accepted)
    const member = await prisma.userRole.create({
      data: {
        familyId,
        name,
        phone,
        role: "FAMILY_MEMBER",
        verified: false,
        invitedBy: userId,
      },
    });

    res.status(201).json({
      member,
      invite: {
        code,
        link: `https://yourapp.com/invite/${code}`,
        expiresAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to add member" });
  }
};

// PATCH /user-roles/:id - Edit member info
export const updateFamilyMember = async (req: Request, res: Response) => {
  try {
    const memberId = Number(req.params.id);
    const userId = req.user?.id;
    const { name, phone } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const member = await prisma.userRole.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: "Member not found" });

    // Only admin can edit members
    const family = member.familyId
      ? await prisma.family.findUnique({ where: { id: member.familyId } })
      : null;
    if (!family || family.adminId !== userId)
      return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.userRole.update({
      where: { id: memberId },
      data: { name, phone },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update member" });
  }
};

// DELETE /user-roles/:id - Remove member from family
export const deleteFamilyMember = async (req: Request, res: Response) => {
  try {
    const memberId = Number(req.params.id);
    const userId = req.user?.id;

    const member = await prisma.userRole.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: "Member not found" });

    const family = member.familyId
      ? await prisma.family.findUnique({ where: { id: member.familyId } })
      : null;
    if (!family || family.adminId !== userId)
      return res.status(403).json({ error: "Forbidden" });

    await prisma.userRole.delete({ where: { id: memberId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete member" });
  }
};