import { Request, Response } from "express";
import { prisma } from "../utils/prisma";

// Create a new business group
export const createBusiness = async (req: Request, res: Response) => {
  const { name, adminId } = req.body;
  if (!name || !adminId) return res.status(400).json({ error: "Missing fields" });

  const business = await prisma.business.create({
    data: {
      name,
      adminId,
      users: {
        create: {
          userId: adminId,
          role: "BUSINESS_ADMIN"
        }
      }
    }
  });

  res.json(business);
};

// List all business groups for a user (as admin or employee)
export const listBusinessGroups = async (req: Request, res: Response) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  // Find all businesses where user is an admin/employee (via userRole)
  const userBusinesses = await prisma.business.findMany({
    where: {
      users: { some: { userId } }
    }
  });

  res.json(userBusinesses);
};

// Invite an employee (creates an invitation and a pending UserRole)
export const inviteEmployee = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  const { phone, name, invitedBy } = req.body;
  if (!businessId || !phone || !name) return res.status(400).json({ error: "Missing fields" });

  // Generate an OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.businessInvitation.create({
    data: {
      businessId,
      phone,
      name,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  // Create a pending UserRole for this phone (user account may not exist yet)
  await prisma.userRole.create({
    data: {
      userId: 0, // Placeholder until verification
      businessId,
      role: "EMPLOYEE",
      phone,
      name,
      invitedBy,
      verified: false
    }
  });

  // TODO: Send code via SMS in production!

  res.json({ message: "Invitation sent", code }); // Send code in response only for dev/testing
};

// Verify an employee using the code they received
export const verifyEmployee = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  const { phone, code, userId } = req.body;
  if (!businessId || !phone || !code || !userId) return res.status(400).json({ error: "Missing fields" });

  const invitation = await prisma.businessInvitation.findFirst({
    where: { businessId, phone, code, verified: false, expiresAt: { gt: new Date() } }
  });
  if (!invitation) return res.status(400).json({ error: "Invalid or expired code" });

  // Mark invitation as verified
  await prisma.businessInvitation.update({ where: { id: invitation.id }, data: { verified: true } });

  // Update UserRole to be linked to userId and set verified=true
  await prisma.userRole.updateMany({
    where: { businessId, phone, verified: false },
    data: { userId, verified: true }
  });

  res.json({ message: "Employee verified and added" });
};

// List all employees of a business
export const listEmployees = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  if (!businessId) return res.status(400).json({ error: "Missing businessId" });

  const employees = await prisma.userRole.findMany({
    where: { businessId, verified: true },
    include: { user: true }
  });

  res.json(employees);
};

// Remove an employee from a business
export const removeEmployee = async (req: Request, res: Response) => {
  const userRoleId = Number(req.params.userRoleId);
  if (!userRoleId) return res.status(400).json({ error: "Missing userRoleId" });

  await prisma.userRole.delete({ where: { id: userRoleId } });

  res.json({ message: "Employee removed" });
};