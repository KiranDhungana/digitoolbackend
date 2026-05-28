const jwt = require("jsonwebtoken");
const chatService = require("../services/chatService");

function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function setupChatSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error("Unauthorized"));
    }
    if (payload.role === "USER") {
      socket.role = "user";
      socket.userId = payload.sub;
    } else if (payload.role === "SUPERADMIN") {
      socket.role = "admin";
      socket.adminId = payload.sub;
    } else {
      return next(new Error("Forbidden"));
    }
    next();
  });

  io.on("connection", (socket) => {
    if (socket.role === "user") {
      const room = `user:${socket.userId}`;
      socket.join(room);
      socket.join("chat");

      socket.on("chat:history", async (ack) => {
        try {
          chatService.assertChatReady();
          const messages = await chatService.listMessages(socket.userId);
          if (typeof ack === "function") ack({ ok: true, messages });
        } catch (err) {
          if (typeof ack === "function") {
            ack({ ok: false, error: err.message });
          }
        }
      });

      socket.on("chat:send", async ({ body }, ack) => {
        try {
          const message = await chatService.sendUserMessage(socket.userId, body);
          io.to(room).emit("chat:message", message);
          io.to("admin").emit("chat:message", { ...message, userId: socket.userId });
          io.to("admin").emit("chat:conversations_changed");
          if (typeof ack === "function") ack({ ok: true, message });
        } catch (err) {
          if (typeof ack === "function") {
            ack({ ok: false, error: err.message });
          }
        }
      });

      socket.on("chat:read", async (ack) => {
        try {
          const updated = await chatService.markAdminMessagesRead(socket.userId);
          if (updated > 0) {
            io.to("admin").emit("chat:read", {
              userId: socket.userId,
              sender: "admin",
            });
            io.to("admin").emit("chat:conversations_changed");
          }
          if (typeof ack === "function") ack({ ok: true });
        } catch (err) {
          if (typeof ack === "function") ack({ ok: false, error: err.message });
        }
      });
    }

    if (socket.role === "admin") {
      socket.join("admin");
      socket.join("chat");

      socket.on("chat:conversations", async (ack) => {
        try {
          chatService.assertChatReady();
          const conversations = await chatService.listConversations();
          if (typeof ack === "function") ack({ ok: true, conversations });
        } catch (err) {
          if (typeof ack === "function") {
            ack({ ok: false, error: err.message });
          }
        }
      });

      socket.on("chat:history", async ({ userId }, ack) => {
        try {
          const data = await chatService.getThreadForAdmin(userId);
          if (typeof ack === "function") ack({ ok: true, ...data });
        } catch (err) {
          if (typeof ack === "function") {
            ack({ ok: false, error: err.message });
          }
        }
      });

      socket.on("chat:send", async ({ userId, body }, ack) => {
        try {
          const message = await chatService.sendAdminMessage(
            userId,
            body,
            socket.adminId
          );
          const room = `user:${userId}`;
          io.to(room).emit("chat:message", message);
          io.to("admin").emit("chat:message", { ...message, userId });
          io.to("admin").emit("chat:conversations_changed");
          if (typeof ack === "function") ack({ ok: true, message });
        } catch (err) {
          if (typeof ack === "function") {
            ack({ ok: false, error: err.message });
          }
        }
      });

      socket.on("chat:read", async ({ userId }, ack) => {
        try {
          const updated = await chatService.markUserMessagesRead(userId);
          if (updated > 0) {
            io.to(`user:${userId}`).emit("chat:read", { sender: "user" });
            io.to("admin").emit("chat:conversations_changed");
          }
          if (typeof ack === "function") ack({ ok: true });
        } catch (err) {
          if (typeof ack === "function") ack({ ok: false, error: err.message });
        }
      });
    }
  });
}

module.exports = { setupChatSocket };
