import { Request, Response } from "express";
import { prisma } from "../utils/prisma";

// Create a new family group
export const createFamily = async (req: Request, res: Response) => {
  const { name, adminId } = req.body;
  if (!name || !adminId) return res.status(400).json({ error: "Missing fields" });

  const family = await prisma.family.create({
    data: {
      name,
      adminId,
      users: {
        create: {
          userId: adminId,
          role: "FAMILY_ADMIN"
        }
      }
    }
  });

  res.json(family);
};

// List all family groups for a user (as admin or member)
export const listFamilyGroups = async (req: Request, res: Response) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  // Find all families where user is an admin/member (via userRole)
  const userFamilies = await prisma.family.findMany({
    where: {
      users: { some: { userId } }
    }
  });

  res.json(userFamilies);
};

// Invite a family member (creates an invitation and a pending UserRole)
export const inviteFamilyMember = async (req: Request, res: Response) => {
  const familyId = Number(req.params.familyId);
  const { phone, name, invitedBy } = req.body;
  if (!familyId || !phone || !name) return res.status(400).json({ error: "Missing fields" });

  // Generate an OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.familyInvitation.create({
    data: {
      familyId,
      phone,
      name,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 min expiry
    }
  });

  // Create a pending UserRole for this phone (user account may not exist yet)
  await prisma.userRole.create({
    data: {
      userId: 0, // Placeholder until verification
      familyId,
      role: "FAMILY_MEMBER",
      phone,
      name,
      invitedBy,
      verified: false
    }
  });

  // TODO: Send code via SMS in production!

  res.json({ message: "Invitation sent", code }); // Send code in response only for dev/testing
};

// Verify a member using the code they received
export const verifyFamilyMember = async (req: Request, res: Response) => {
  const familyId = Number(req.params.familyId);
  const { phone, code, userId } = req.body;
  if (!familyId || !phone || !code || !userId) return res.status(400).json({ error: "Missing fields" });

  const invitation = await prisma.familyInvitation.findFirst({
    where: { familyId, phone, code, verified: false, expiresAt: { gt: new Date() } }
  });
  if (!invitation) return res.status(400).json({ error: "Invalid or expired code" });

  // Mark invitation as verified
  await prisma.familyInvitation.update({ where: { id: invitation.id }, data: { verified: true } });

  // Update UserRole to be linked to userId and set verified=true
  await prisma.userRole.updateMany({
    where: { familyId, phone, verified: false },
    data: { userId, verified: true }
  });

  res.json({ message: "Family member verified and added" });
};

// List all members of a family
export const listFamilyMembers = async (req: Request, res: Response) => {
  const familyId = Number(req.params.familyId);
  if (!familyId) return res.status(400).json({ error: "Missing familyId" });

  const members = await prisma.userRole.findMany({
    where: { familyId, verified: true },
    include: { user: true }
  });

  res.json(members);
};

// Remove a member from a family
export const removeFamilyMember = async (req: Request, res: Response) => {
  const userRoleId = Number(req.params.userRoleId);
  if (!userRoleId) return res.status(400).json({ error: "Missing userRoleId" });

  await prisma.userRole.delete({ where: { id: userRoleId } });

  res.json({ message: "Family member removed" });
};