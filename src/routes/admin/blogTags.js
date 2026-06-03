const express = require("express");
const { prisma } = require("../../lib/prisma");
const { slugify } = require("../../lib/slugify");
const { serializeTag } = require("../../lib/blogSerialize");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const tags = await prisma.blogTag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: true } } },
    });
    res.json(
      tags.map((t) => ({
        ...serializeTag(t),
        postCount: t._count.posts,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, slug } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const tag = await prisma.blogTag.create({
      data: {
        name: String(name).trim(),
        slug: slugify(slug || name),
      },
    });
    res.status(201).json({ ...serializeTag(tag), postCount: 0 });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.blogTag.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Tag not found" });
    }
    next(err);
  }
});

module.exports = router;
