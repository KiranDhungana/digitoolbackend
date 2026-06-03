const express = require("express");
const { prisma } = require("../../lib/prisma");
const { slugify } = require("../../lib/slugify");
const { serializeBlogCategory } = require("../../lib/blogSerialize");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { posts: true } } },
    });
    res.json(
      categories.map((c) =>
        serializeBlogCategory(c, c._count.posts)
      )
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, slug, description, isActive, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const category = await prisma.blogCategory.create({
      data: {
        name: String(name).trim(),
        slug: slugify(slug || name),
        description: description?.trim() || null,
        isActive: isActive !== false,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    res.status(201).json(serializeBlogCategory(category, 0));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { name, slug, description, isActive, sortOrder } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (slug !== undefined) data.slug = slugify(slug);
    if (description !== undefined) data.description = description?.trim() || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder) || 0;

    const category = await prisma.blogCategory.update({
      where: { id: req.params.id },
      data,
      include: { _count: { select: { posts: true } } },
    });
    res.json(serializeBlogCategory(category, category._count.posts));
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.blogCategory.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }
    next(err);
  }
});

module.exports = router;
