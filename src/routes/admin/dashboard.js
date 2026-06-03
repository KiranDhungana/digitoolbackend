const express = require("express");
const { prisma } = require("../../lib/prisma");

const router = express.Router();

router.get("/stats", async (req, res, next) => {
  try {
    const [
      products,
      activeProducts,
      categories,
      brands,
      admins,
      media,
      pendingOrders,
      unreadChats,
      newContactMessages,
      blogDrafts,
      blogPublished,
      blogScheduled,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.category.count(),
      prisma.brand.count(),
      prisma.admin.count(),
      prisma.media.count(),
      prisma.order.count({ where: { status: "pending_verification" } }),
      prisma.chatMessage
        ? prisma.chatMessage.count({
            where: { sender: "user", readAt: null },
          })
        : Promise.resolve(0),
      prisma.contactMessage
        ? prisma.contactMessage.count({ where: { status: "new" } })
        : Promise.resolve(0),
      prisma.blogPost
        ? prisma.blogPost.count({ where: { status: "draft" } })
        : Promise.resolve(0),
      prisma.blogPost
        ? prisma.blogPost.count({ where: { status: "published" } })
        : Promise.resolve(0),
      prisma.blogPost
        ? prisma.blogPost.count({ where: { status: "scheduled" } })
        : Promise.resolve(0),
    ]);

    res.json({
      products,
      activeProducts,
      categories,
      brands,
      admins,
      media,
      pendingOrders,
      unreadChats,
      newContactMessages,
      blogDrafts,
      blogPublished,
      blogScheduled,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
