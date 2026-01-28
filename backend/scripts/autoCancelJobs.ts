import { PrismaClient, RideStatus } from "@prisma/client";
import { DateTime } from "luxon";

const prisma = new PrismaClient();

const cancellationRules: { [key: string]: { maxHours: number } } = {
  TRANSPORTATION: { maxHours: 2 },
  RIDE: { maxHours: 2 },
  SHOPPING: { maxHours: 3 },
  PROPERTY_CARE: { maxHours: 72 },
  ENGINEERING: { maxHours: 72 },
  CLEANING: { maxHours: 48 },
  HUMAN_CARE: { maxHours: 48 },
  PET_CARE: { maxHours: 48 },
  LIFESTYLE: { maxHours: 72 },
  LEGAL_SERVICES: { maxHours: 72 },
  HAIR_BEAUTY: { maxHours: 48 },
  IT_SERVICES: { maxHours: 72 },
  REALTOR: { maxHours: 72 },
  TUTOR: { maxHours: 72 },
};

function getCancellationKey(ride: any): string {
  // Prefer serviceType if set, fallback to vehicleType, fallback to categoryName
  if (ride.serviceType) return String(ride.serviceType).toUpperCase();
  if (ride.vehicleType) return String(ride.vehicleType).toUpperCase();
  if (ride.categoryName) return String(ride.categoryName).toUpperCase();
  return "";
}

function getReferenceTime(ride: any): DateTime | undefined {
  // Use scheduledAt for scheduled rides, requestedAt for others.
  if (
    ride.scheduledAt &&
    ["scheduled", "pending"].includes((ride.status || "").toLowerCase())
  ) {
    return DateTime.fromISO(ride.scheduledAt instanceof Date ? ride.scheduledAt.toISOString() : ride.scheduledAt);
  }
  if (ride.requestedAt) {
    return DateTime.fromISO(ride.requestedAt instanceof Date ? ride.requestedAt.toISOString() : ride.requestedAt);
  }
  if (ride.createdAt) {
    return DateTime.fromISO(ride.createdAt instanceof Date ? ride.createdAt.toISOString() : ride.createdAt);
  }
  return undefined;
}

async function autoCancelJobs() {
  // 1. Find all non-terminal jobs (not completed, not cancelled, not no_show)
  const openStatuses = [
    RideStatus.PENDING,
    RideStatus.ACCEPTED,
    RideStatus.IN_PROGRESS,
    RideStatus.SCHEDULED,
  ];

  // Fetch all rides that might need auto-cancel
  const rides = await prisma.ride.findMany({
    where: {
      status: { in: openStatuses },
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      requestedAt: true,
      createdAt: true,
      serviceType: true,
      vehicleType: true,
      categoryName: true,
      customerId: true, // for notification if needed
    },
  });

  const now = DateTime.utc();
  let canceledCount = 0;
  for (const ride of rides) {
    const key = getCancellationKey(ride);
    const rule = cancellationRules[key] || { maxHours: 48 };

    const referenceTime = getReferenceTime(ride);
    if (!referenceTime || !referenceTime.isValid) continue;

    const expireAt = referenceTime.plus({ hours: rule.maxHours });

    if (now >= expireAt) {
      await prisma.ride.update({
        where: { id: ride.id },
        data: {
          status: RideStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });
      canceledCount++;
      console.log(`[auto-cancel] Cancelled ride #${ride.id} (type: ${key})`);
      // (Optional: trigger notification/email/SMS here)
    }
  }

  console.log(
    `[auto-cancel] Run completed at ${now.toISO()}. Total auto-cancelled: ${canceledCount}`
  );
}

// For direct CLI execution, e.g., `npx ts-node scripts/autoCancelJobs.ts`
if (require.main === module) {
  autoCancelJobs()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      process.exit();
    });
}

export default autoCancelJobs;