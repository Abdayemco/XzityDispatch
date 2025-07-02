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
  return prisma.message.findMany({
    where: { chatId },
    include: { sender: true },
    orderBy: { sentAt: "asc" },
  });
};

export const createMessage = async (chatId: number, senderId: number, content: string) => {
  return prisma.message.create({
    data: {
      chatId,
      senderId,
      content,
    },
    include: { sender: true },
  });
};