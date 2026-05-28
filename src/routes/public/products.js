const express = require("express");
const { prisma } = require("../../lib/prisma");
const { productTextSearchWhere } = require("../../lib/searchWhere");
const { serializeProduct, serializeProductList } = require("../../lib/serialize");
const {
  PRODUCT_LIST_SELECT,
  PRODUCT_DETAIL_SELECT,
  parseListLimit,
  parseBatchSlugs,
} = require("../../lib/productQuery");

const router = express.Router();

const LIST_CACHE = "public, max-age=30, stale-while-revalidate=60";

function buildWhere(query) {
  const where = { isActive: true };

  if (query.category) {
    where.category = { slug: String(query.category), isActive: true };
  }
  if (query.brand) {
    where.brand = { slug: String(query.brand), isActive: true };
  }
  if (query.badge) {
    where.badge = String(query.badge);
  }
  if (query.q) {
    const textWhere = productTextSearchWhere(query.q);
    if (textWhere) Object.assign(where, textWhere);
  }
  if (query.promo === "true") {
    where.OR = [{ badge: "promo" }, { originalPrice: { not: null } }];
  }
  if (query.official === "true") {
    where.badge = "official";
  }

  return where;
}

router.get("/", async (req, res, next) => {
  try {
    const take = parseListLimit(req.query.limit);
    const skip = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const products = await prisma.product.findMany({
      where: buildWhere(req.query),
      select: PRODUCT_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });

    res.set("Cache-Control", LIST_CACHE);
    res.json(products.map(serializeProductList));
  } catch (err) {
    next(err);
  }
});

router.get("/batch", async (req, res, next) => {
  try {
    const slugs = parseBatchSlugs(req.query.slugs);
    if (slugs.length === 0) {
      return res.json([]);
    }

    const products = await prisma.product.findMany({
      where: { slug: { in: slugs }, isActive: true },
      select: PRODUCT_LIST_SELECT,
    });

    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const ordered = slugs
      .map((slug) => bySlug.get(slug))
      .filter(Boolean)
      .map(serializeProductList);

    res.set("Cache-Control", LIST_CACHE);
    res.json(ordered);
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: {
        slug: req.params.slug,
        isActive: true,
      },
      select: PRODUCT_DETAIL_SELECT,
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.set("Cache-Control", LIST_CACHE);
    res.json(serializeProduct(product));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
