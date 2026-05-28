const express = require("express");
const chatService = require("../../services/chatService");

const router = express.Router();

function handleChatError(err, res, next) {
  if (err.code === "CHAT_NOT_READY" || err.statusCode) {
    return res.status(err.statusCode || 503).json({ error: err.message });
  }
  next(err);
}

router.get("/conversations", async (req, res, next) => {
  try {
    const conversations = await chatService.listConversations();
    res.json(conversations);
  } catch (err) {
    handleChatError(err, res, next);
  }
});

router.get("/users/:userId/messages", async (req, res, next) => {
  try {
    const data = await chatService.getThreadForAdmin(req.params.userId);
    res.json(data);
  } catch (err) {
    handleChatError(err, res, next);
  }
});

router.post("/users/:userId/messages", async (req, res, next) => {
  try {
    const message = await chatService.sendAdminMessage(
      req.params.userId,
      req.body?.body,
      req.admin?.sub
    );
    res.status(201).json(message);
  } catch (err) {
    handleChatError(err, res, next);
  }
});

router.patch("/users/:userId/read", async (req, res, next) => {
  try {
    await chatService.markUserMessagesRead(req.params.userId);
    res.json({ ok: true });
  } catch (err) {
    handleChatError(err, res, next);
  }
});

module.exports = router;
