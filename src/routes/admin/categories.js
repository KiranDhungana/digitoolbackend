const express = require("express");
const { prisma } = require("../../lib/prisma");
const { resolveImageFields } = require("../../lib/resolveImage");
const { serializeCategory } = require("../../lib/serialize");

const router = express.Router();

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MEDIA_URL = { select: { url: true } };
const CATEGORY_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  icon: true,
  gradient: true,
  imageUrl: true,
  mediaId: true,
  isActive: true,
  sortOrder: true,
  media: MEDIA_URL,
};

router.get("/", async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        ...CATEGORY_LIST_SELECT,
        _count: { select: { products: true } },
      },
    });
    res.json(
      categories.map((c) => ({
        ...serializeCategory(c, c._count.products),
        id: c.id,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      select: {
        ...CATEGORY_LIST_SELECT,
        _count: { select: { products: true } },
      },
    });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({
      ...serializeCategory(category, category._count.products),
      id: category.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, slug, icon, gradient, isActive, sortOrder, imageUrl, mediaId } =
      req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const finalSlug = slugify(slug || name);
    const imageFields =
      imageUrl !== undefined || mediaId !== undefined
        ? await resolveImageFields(imageUrl, mediaId)
        : {};
    const category = await prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        icon: icon || "shopping-bag",
        gradient: gradient || "from-gray-500 to-gray-700",
        isActive: isActive !== false,
        sortOrder: Number(sortOrder) || 0,
        ...imageFields,
      },
      include: { media: true },
    });
    res.status(201).json({ ...serializeCategory(category, 0), id: category.id });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { name, slug, icon, gradient, isActive, sortOrder, imageUrl, mediaId } =
      req.body;
    const data = {};
    if (name != null) data.name = name;
    if (slug != null) data.slug = slugify(slug);
    if (icon != null) data.icon = icon;
    if (gradient != null) data.gradient = gradient;
    if (isActive != null) data.isActive = Boolean(isActive);
    if (sortOrder != null) data.sortOrder = Number(sortOrder);
    if (imageUrl !== undefined || mediaId !== undefined) {
      Object.assign(data, await resolveImageFields(imageUrl, mediaId));
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
      include: {
        media: true,
        _count: { select: { products: true } },
      },
    });
    res.json({
      ...serializeCategory(category, category._count.products),
      id: category.id,
    });
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
    const count = await prisma.product.count({
      where: { categoryId: req.params.id },
    });
    if (count > 0) {
      return res.status(400).json({
        error: "Cannot delete category with products. Reassign or delete products first.",
      });
    }
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }
    next(err);
  }
});

module.exports = router;
