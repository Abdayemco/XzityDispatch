import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const transportRolesMapping: Record<string, Role[]> = {
  CAR: ["DRIVER"],
  DELIVERY: ["DRIVER", "ERRAND_RUNNER"],
  TUKTUK: ["DRIVER"],
  LIMO: ["DRIVER"],
  TRUCK: ["DRIVER"],
  WATER_TRUCK: ["DRIVER"],
  TOW_TRUCK: ["DRIVER"],
  WHEELCHAIR: ["DRIVER", "ELDER_CARE"],
  SHOPPER: ["SHOPPER"],
};

async function main() {
  // Get all TRANSPORTATION subtypes
  const transportCategory = await prisma.serviceCategory.findUnique({
    where: { name: "TRANSPORTATION" },
    include: { subTypes: true },
  });

  if (!transportCategory) {
    console.error("TRANSPORTATION category not found.");
    process.exit(1);
  }

  for (const subType of transportCategory.subTypes) {
    const roles = transportRolesMapping[subType.name];
    if (!roles) {
      console.log(
        `No roles found for subtype "${subType.name}". Skipping.`
      );
      continue;
    }
    // Remove all previous role links for this subType
    await prisma.serviceSubTypeRole.deleteMany({
      where: { subTypeId: subType.id },
    });
    // Add the correct roles
    for (const role of roles) {
      await prisma.serviceSubTypeRole.create({
        data: {
          subTypeId: subType.id,
          role, // must match Role enum
        },
      });
    }
    console.log(
      `Set roles [${roles.join(", ")}] for TRANSPORTATION > ${subType.name}`
    );
  }
}

main()
  .then(() => {
    console.log("Bulk patch complete!");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });