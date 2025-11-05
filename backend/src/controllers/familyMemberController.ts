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

// POST /families/:familyId/members - Add member to a family (invitation logic)
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

    // Check if user exists by phone
    const existingUser = await prisma.user.findUnique({ where: { phone } });

    if (existingUser) {
      // User exists: add as FAMILY_MEMBER
      const member = await prisma.userRole.create({
        data: {
          userId: existingUser.id,
          familyId,
          role: "FAMILY_MEMBER",
          invitedBy: userId,
          name: existingUser.name,
          phone: existingUser.phone,
          // verified: true,  // removed! (verified does not exist on UserRole)
        },
      });
      return res.status(201).json({
        member,
        message: "User already exists and was added as a family member.",
      });
    }

    // User does not exist: create invitation only
    const code = Math.random().toString(36).substring(2, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.familyInvitation.create({
      data: {
        familyId,
        name,
        phone,
        code,
        expiresAt,
        verified: false,
      },
    });

    return res.status(201).json({
      invite: {
        code,
        link: `https://yourapp.com/invite/${code}`,
        expiresAt,
        name,
        phone,
      },
      message: "Invitation created and sent.",
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

// POST /families/invite/accept - Accept invitation and join family
export const acceptFamilyInvite = async (req: Request, res: Response) => {
  try {
    const { code, name, phone, password } = req.body;
    if (!code || !name || !phone || !password) {
      return res.status(400).json({ error: "Code, name, phone, and password required" });
    }

    // Find the invitation
    const invitation = await prisma.familyInvitation.findFirst({
      where: { code, phone },
    });
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found or invalid" });
    }
    if (invitation.verified) {
      return res.status(400).json({ error: "Invitation already claimed" });
    }
    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invitation expired" });
    }

    // Find or create the user
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          phone,
          password,          // You should hash this in production!
          role: "CUSTOMER",  // Or whatever fits your app
          phoneVerified: true,
        },
      });
    }

    // Create UserRole for this user in the family
    const userRole = await prisma.userRole.create({
      data: {
        userId: user.id,
        familyId: invitation.familyId,
        role: "FAMILY_MEMBER",
        invitedBy: null, // Or invitation.invitedBy if you store it
        name,
        phone,
        // verified: true, // REMOVED
      },
    });

    // Mark the invitation as claimed
    await prisma.familyInvitation.update({
      where: { id: invitation.id },
      data: { verified: true },
    });

    return res.json({
      message: "You have successfully joined the family!",
      user: { id: user.id, name: user.name, phone: user.phone },
      userRole,
    });
  } catch (err) {
    console.error("acceptFamilyInvite error:", err);
    res.status(500).json({ error: "Failed to accept invitation" });
  }
};