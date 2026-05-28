const express = require("express");
const { prisma } = require("../../lib/prisma");
const { resolveImageFields } = require("../../lib/resolveImage");
const { serializeBrand } = require("../../lib/serialize");

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
const BRAND_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  gradient: true,
  imageUrl: true,
  mediaId: true,
  isActive: true,
  sortOrder: true,
  media: MEDIA_URL,
};

router.get("/", async (req, res, next) => {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        ...BRAND_LIST_SELECT,
        _count: { select: { products: true } },
      },
    });
    res.json(
      brands.map((b) => ({
        ...serializeBrand(b, b._count.products),
        id: b.id,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const brand = await prisma.brand.findUnique({
      where: { id: req.params.id },
      select: {
        ...BRAND_LIST_SELECT,
        _count: { select: { products: true } },
      },
    });
    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }
    res.json({
      ...serializeBrand(brand, brand._count.products),
      id: brand.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, slug, gradient, isActive, sortOrder, imageUrl, mediaId } =
      req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const finalSlug = slugify(slug || name);
    const imageFields =
      imageUrl !== undefined || mediaId !== undefined
        ? await resolveImageFields(imageUrl, mediaId)
        : {};
    const brand = await prisma.brand.create({
      data: {
        name,
        slug: finalSlug,
        gradient: gradient || "from-gray-600 to-gray-800",
        isActive: isActive !== false,
        sortOrder: Number(sortOrder) || 0,
        ...imageFields,
      },
      include: { media: true },
    });
    res.status(201).json({ ...serializeBrand(brand, 0), id: brand.id });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { name, slug, gradient, isActive, sortOrder, imageUrl, mediaId } =
      req.body;
    const data = {};
    if (name != null) data.name = name;
    if (slug != null) data.slug = slugify(slug);
    if (gradient != null) data.gradient = gradient;
    if (isActive != null) data.isActive = Boolean(isActive);
    if (sortOrder != null) data.sortOrder = Number(sortOrder);
    if (imageUrl !== undefined || mediaId !== undefined) {
      Object.assign(data, await resolveImageFields(imageUrl, mediaId));
    }

    const brand = await prisma.brand.update({
      where: { id: req.params.id },
      data,
      include: {
        media: true,
        _count: { select: { products: true } },
      },
    });
    res.json({
      ...serializeBrand(brand, brand._count.products),
      id: brand.id,
    });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Brand not found" });
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
      where: { brandId: req.params.id },
    });
    if (count > 0) {
      return res.status(400).json({
        error: "Cannot delete brand with products. Delete products first.",
      });
    }
    await prisma.brand.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Brand not found" });
    }
    next(err);
  }
});

module.exports = router;
