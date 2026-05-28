const express = require("express");
const { prisma } = require("../../lib/prisma");
const { serializeContactMessage } = require("../../lib/serializeContact");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const subject = String(req.body.subject || "").trim() || null;
    const message = String(req.body.message || "").trim();

    if (!name || name.length > 120) {
      return res.status(400).json({ error: "Name is required (max 120 characters)" });
    }
    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (!message || message.length < 10) {
      return res.status(400).json({ error: "Message must be at least 10 characters" });
    }
    if (message.length > 5000) {
      return res.status(400).json({ error: "Message is too long (max 5000 characters)" });
    }
    if (subject && subject.length > 200) {
      return res.status(400).json({ error: "Subject is too long (max 200 characters)" });
    }

    const row = await prisma.contactMessage.create({
      data: { name, email, subject, message },
    });

    res.status(201).json({
      ok: true,
      id: row.id,
      message: "Thank you — we received your message and will get back to you soon.",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
