import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const categoriesWithSubtypes = [
  {
    name: "TRANSPORTATION",
    subTypes: [
      "CAR", "DELIVERY", "TUKTUK", "LIMO", "TRUCK", "WATER_TRUCK",
      "TOW_TRUCK", "WHEELCHAIR", "SHOPPER"
    ]
  },
  {
    name: "CLEANING",
    subTypes: [
      "HOME_CLEANING", "BUSINESS_CLEANING", "WINDOWS_CLEANING",
      "VEHICLE_CLEANING", "CARPET_CLEANING", "LAUNDRY"
    ]
  },
  {
    name: "BEAUTY",
    subTypes: [
      "MALE_HAIR", "FEMALE_HAIR", "MAKEUP", "FACIAL", "NAILS",
      "EYELASH", "BROWS", "WAXING", "SKINCARE"
    ]
  },
  {
    name: "ENGINEERING",
    subTypes: [
      "CIVIL", "ARCHITECT", "INTERIOR", "MECHANICAL", "ELECTRICAL",
      "SURVEY", "ENVIRONMENTAL", "INDUSTRIAL", "CONSULTANT"
    ]
  },
  {
    name: "HUMAN_CARE",
    subTypes: [
      "BABY_SITTING", "ELDERCARE", "PHYSIOTHERAPY", "MASSAGE", "TRAINING",
      "SPIRITUAL_ADVISOR", "NUTRITION_DIET", "COUNSELING"
    ]
  },
  {
    name: "LIFESTYLE",
    subTypes: [
      "EVENT_PLANNER", "PHOTOGRAPHY", "SHOPPING", "DJ_MUSIC"
    ]
  },
  {
    name: "IT_SERVICES",
    subTypes: [
      "WEB_DESIGN", "SOCIAL_MEDIA", "SOFTWARE", "APP_DESIGN",
      "GRAPHIC_DESIGN", "SEO_MARKETING"
    ]
  },
  {
    name: "LEGAL_SERVICES",
    subTypes: [
      "ERRAND_RUNNER", "ACCOUNTING_BOOKKEEPING", "DOCUMENT_AUTHENTICATION",
      "TAX_FILING", "NOTARY_LEGAL"
    ]
  },
  {
    name: "PROPERTY_CARE",
    subTypes: [
      "CARPENTER", "PLUMBER", "ELECTRICIAN", "INSULATION",
      "WATER_PROOFING", "GARDNER", "ROOFER", "DECORATOR",
      "LANDSCAPER", "GARDENER", "PEST_CONTROL", "FENCER", "FLOORING"
    ]
  },
  {
    name: "TUTOR",
    subTypes: [
      "Math", "Science", "Physics", "Chemistry", "History",
      "Geography", "Coding", "Language", "Grammar", "Art", "Music"
    ]
  },
  {
    name: "PET_CARE",
    subTypes: [
      "SITTING", "BATHING", "WALKING", "TRAINING", "HAIR_CUTTING",
      "NAIL_CLIPPING", "TRANSPORTATION", "BOARDING"
    ]
  },
  {
    name: "REALTOR",
    subTypes: [
      "BUY", "SELL", "RENT", "OFFER_RENT"
    ]
  }
];

async function main() {
  for (const cat of categoriesWithSubtypes) {
    const created = await prisma.serviceCategory.create({
      data: {
        name: cat.name,
        subTypes: {
          create: cat.subTypes.map(st => ({ name: st }))
        }
      }
    });
    console.log(`Created category: ${created.name}`);
  }
}

main().finally(() => prisma.$disconnect());