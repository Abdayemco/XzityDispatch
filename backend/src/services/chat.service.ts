import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getOrCreateChatByRide = async (rideId: number) => {
  let chat = await prisma.chat.findUnique({ where: { rideId } });
  if (!chat) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || !ride.driverId) throw new Error("Ride or driver not found");
    chat = await prisma.chat.create({
      data: {
        rideId,
        customerId: ride.customerId,
        driverId: ride.driverId,
      },
    });
  }
  return chat;
};

export const getMessages = async (chatId: number) => {
  // Always include sender info (id, name, role, avatar)
  return prisma.message.findMany({
    where: { chatId },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
          avatar: true,
        },
      },
    },
    orderBy: { sentAt: "asc" },
  });
};

export const createMessage = async (chatId: number, senderId: number, content: string) => {
  // Always include sender info (id, name, role, avatar)
  return prisma.message.create({
    data: {
      chatId,
      senderId,
      content,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
          avatar: true,
        },
      },
    },
  });
};