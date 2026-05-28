const { prisma } = require("../lib/prisma");
const { serializeMessage, serializeConversation } = require("../lib/serializeChat");

function chatModel() {
  if (!prisma.chatMessage) {
    const err = new Error(
      "Chat is not ready: run `npx prisma migrate deploy` and `npx prisma generate`, then restart the API server."
    );
    err.code = "CHAT_NOT_READY";
    throw err;
  }
  return prisma.chatMessage;
}

function validateBody(body) {
  const text = body?.trim();
  if (!text) {
    const err = new Error("Message body is required");
    err.statusCode = 400;
    throw err;
  }
  if (text.length > 4000) {
    const err = new Error("Message is too long (max 4000 characters)");
    err.statusCode = 400;
    throw err;
  }
  return text;
}

async function listMessages(userId) {
  const messages = await chatModel().findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return messages.map(serializeMessage);
}

async function sendUserMessage(userId, body) {
  const text = validateBody(body);
  const message = await chatModel().create({
    data: { userId, sender: "user", body: text },
  });
  return serializeMessage(message);
}

async function sendAdminMessage(userId, body, adminId) {
  const text = validateBody(body);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
  const message = await chatModel().create({
    data: {
      userId,
      sender: "admin",
      body: text,
      adminId: adminId ?? null,
    },
  });
  return serializeMessage(message);
}

async function markAdminMessagesRead(userId) {
  const { count } = await chatModel().updateMany({
    where: { userId, sender: "admin", readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}

async function markUserMessagesRead(userId) {
  const { count } = await chatModel().updateMany({
    where: { userId, sender: "user", readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}

async function listConversations() {
  const users = await prisma.user.findMany({
    where: { chatMessages: { some: {} } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      chatMessages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 100,
  });

  const unreadGroups = await chatModel().groupBy({
    by: ["userId"],
    where: { sender: "user", readAt: null },
    _count: { _all: true },
  });

  const unreadMap = new Map(
    unreadGroups.map((g) => [g.userId, g._count._all])
  );

  const conversations = users.map((user) =>
    serializeConversation(
      user,
      user.chatMessages[0] ?? null,
      unreadMap.get(user.id) ?? 0
    )
  );

  conversations.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? "";
    const bTime = b.lastMessage?.createdAt ?? "";
    return bTime.localeCompare(aTime);
  });

  return conversations;
}

async function getThreadForAdmin(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
  const messages = await listMessages(userId);
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? undefined,
    },
    messages,
  };
}

function assertChatReady() {
  chatModel();
}

module.exports = {
  assertChatReady,
  listMessages,
  sendUserMessage,
  sendAdminMessage,
  markAdminMessagesRead,
  markUserMessagesRead,
  listConversations,
  getThreadForAdmin,
};
