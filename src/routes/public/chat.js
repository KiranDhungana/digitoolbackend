const express = require("express");
const chatService = require("../../services/chatService");
const { authUser } = require("../../middleware/authUser");

const router = express.Router();

function handleChatError(err, res, next) {
  if (err.code === "CHAT_NOT_READY" || err.statusCode) {
    return res.status(err.statusCode || 503).json({ error: err.message });
  }
  next(err);
}

router.get("/messages", authUser, async (req, res, next) => {
  try {
    const messages = await chatService.listMessages(req.user.sub);
    res.json(messages);
  } catch (err) {
    handleChatError(err, res, next);
  }
});

router.post("/messages", authUser, async (req, res, next) => {
  try {
    const message = await chatService.sendUserMessage(req.user.sub, req.body?.body);
    res.status(201).json(message);
  } catch (err) {
    handleChatError(err, res, next);
  }
});

router.patch("/messages/read", authUser, async (req, res, next) => {
  try {
    await chatService.markAdminMessagesRead(req.user.sub);
    res.json({ ok: true });
  } catch (err) {
    handleChatError(err, res, next);
  }
});

module.exports = router;
