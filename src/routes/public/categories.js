const express = require("express");
const { prisma } = require("../../lib/prisma");
const { serializeProductList, serializeCategory } = require("../../lib/serialize");
const { PRODUCT_LIST_SELECT, parseListLimit } = require("../../lib/productQuery");

const MEDIA_URL = { select: { url: true } };
const CATEGORY_MEDIA_SELECT = {
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
const LIST_CACHE = "public, max-age=60, stale-while-revalidate=120";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        ...CATEGORY_MEDIA_SELECT,
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    res.set("Cache-Control", LIST_CACHE);
    res.json(categories.map((c) => serializeCategory(c, c._count.products)));
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const [category, products] = await Promise.all([
      prisma.category.findFirst({
        where: { slug: req.params.slug, isActive: true },
        select: {
          ...CATEGORY_MEDIA_SELECT,
          _count: { select: { products: { where: { isActive: true } } } },
        },
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          category: { slug: req.params.slug, isActive: true },
        },
        select: PRODUCT_LIST_SELECT,
        orderBy: { name: "asc" },
        take: parseListLimit(req.query.limit),
      }),
    ]);

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.set("Cache-Control", LIST_CACHE);
    res.json({
      category: serializeCategory(category, category._count.products),
      products: products.map(serializeProductList),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
