function serializeContactMessage(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject ?? undefined,
    message: row.message,
    status: row.status,
    readAt: row.readAt?.toISOString() ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

module.exports = { serializeContactMessage };
