import { prisma } from "../utils/prisma";

/**
 * Fetches the latest locations of all family members in a family group.
 * Only returns members with valid lastKnownLat/lastKnownLng values.
 */
export async function getFamilyMembersLocations(familyId: number) {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: {
      users: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!family) {
    throw new Error("Family not found");
  }

  // Map UserRole -> User, filter out those without location
  const members = family.users
    .map((role) => role.user)
    .filter(u => u.lastKnownLat !== null && u.lastKnownLng !== null);

  // Return locations and basic info
  return members.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    lastKnownLat: u.lastKnownLat,
    lastKnownLng: u.lastKnownLng,
    lastLocationAt: u.lastLocationAt,
    avatar: u.avatar,
    online: u.online,
  }));
}

/**
 * Fetches the latest locations of all employees in a business group.
 * Only returns members with valid lastKnownLat/lastKnownLng values.
 */
export async function getBusinessMembersLocations(businessId: number) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      users: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!business) {
    throw new Error("Business not found");
  }

  // Map UserRole -> User, filter out those without location
  const members = business.users
    .map((role) => role.user)
    .filter(u => u.lastKnownLat !== null && u.lastKnownLng !== null);

  // Return locations and basic info
  return members.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    lastKnownLat: u.lastKnownLat,
    lastKnownLng: u.lastKnownLng,
    lastLocationAt: u.lastLocationAt,
    avatar: u.avatar,
    online: u.online,
  }));
}

/**
 * Generic: Get latest locations for users linked to a group (family or business) by type/id.
 */
export async function getGroupMembersLocations(groupType: "family" | "business", groupId: number) {
  if (groupType === "family") {
    return getFamilyMembersLocations(groupId);
  }
  if (groupType === "business") {
    return getBusinessMembersLocations(groupId);
  }
  throw new Error("Invalid group type");
}