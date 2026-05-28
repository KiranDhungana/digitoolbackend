const express = require("express");
const { prisma } = require("../../lib/prisma");
const { serializeProductList, serializeBrand } = require("../../lib/serialize");
const { PRODUCT_LIST_SELECT, parseListLimit } = require("../../lib/productQuery");

const MEDIA_URL = { select: { url: true } };
const BRAND_MEDIA_SELECT = {
  slug: true,
  name: true,
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
    const brands = await prisma.brand.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        ...BRAND_MEDIA_SELECT,
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    res.set("Cache-Control", LIST_CACHE);
    res.json(brands.map((b) => serializeBrand(b, b._count.products)));
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const [brand, products] = await Promise.all([
      prisma.brand.findFirst({
        where: { slug: req.params.slug, isActive: true },
        select: {
          ...BRAND_MEDIA_SELECT,
          _count: { select: { products: { where: { isActive: true } } } },
        },
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          brand: { slug: req.params.slug, isActive: true },
        },
        select: PRODUCT_LIST_SELECT,
        orderBy: { name: "asc" },
        take: parseListLimit(req.query.limit),
      }),
    ]);

    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    res.set("Cache-Control", LIST_CACHE);
    res.json({
      brand: serializeBrand(brand, brand._count.products),
      products: products.map(serializeProductList),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
