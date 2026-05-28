function serializeMessage(msg) {
  return {
    id: msg.id,
    userId: msg.userId,
    sender: msg.sender,
    body: msg.body,
    adminId: msg.adminId ?? undefined,
    readAt: msg.readAt ? new Date(msg.readAt).toISOString() : undefined,
    createdAt: new Date(msg.createdAt).toISOString(),
  };
}

function serializeConversation(user, lastMessage, unreadCount) {
  return {
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? undefined,
    },
    lastMessage: lastMessage ? serializeMessage(lastMessage) : undefined,
    unreadCount,
  };
}

module.exports = { serializeMessage, serializeConversation };
