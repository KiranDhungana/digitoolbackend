const express = require("express");
const { prisma } = require("../../lib/prisma");
const {
  productTextSearchWhere,
  brandTextSearchWhere,
  categoryTextSearchWhere,
} = require("../../lib/searchWhere");
const {
  serializeProductSuggest,
  serializeBrandSuggest,
  serializeCategorySuggest,
} = require("../../lib/serialize");

const router = express.Router();

const SUGGEST_SELECT = {
  slug: true,
  name: true,
  price: true,
  currency: true,
  gradient: true,
  imageUrl: true,
  badge: true,
  media: { select: { url: true } },
  brand: { select: { name: true, slug: true, imageUrl: true, media: { select: { url: true } } } },
  category: { select: { name: true, slug: true } },
};

const BRAND_SELECT = {
  slug: true,
  name: true,
  gradient: true,
  imageUrl: true,
  media: { select: { url: true } },
};

const CATEGORY_SELECT = {
  slug: true,
  name: true,
  icon: true,
  gradient: true,
  imageUrl: true,
  media: { select: { url: true } },
};

/** In-memory suggest cache (short TTL, small catalog) */
const suggestCache = new Map();
const SUGGEST_CACHE_MS = 30_000;

let catalogCache = null;
let catalogCacheAt = 0;
const CATALOG_CACHE_MS = 120_000;

function getCachedSuggest(key) {
  const hit = suggestCache.get(key);
  if (!hit || Date.now() - hit.at > SUGGEST_CACHE_MS) {
    if (hit) suggestCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCachedSuggest(key, data) {
  if (suggestCache.size > 200) {
    const oldest = suggestCache.keys().next().value;
    suggestCache.delete(oldest);
  }
  suggestCache.set(key, { at: Date.now(), data });
}

/** One-shot lightweight index for instant client-side search */
router.get("/catalog", async (req, res, next) => {
  try {
    if (catalogCache && Date.now() - catalogCacheAt < CATALOG_CACHE_MS) {
      res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
      return res.json(catalogCache);
    }

    const [products, brands, categories] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: SUGGEST_SELECT,
        orderBy: { name: "asc" },
      }),
      prisma.brand.findMany({
        where: { isActive: true },
        select: BRAND_SELECT,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: CATEGORY_SELECT,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

    const payload = {
      products: products.map(serializeProductSuggest),
      brands: brands.map(serializeBrandSuggest),
      categories: categories.map(serializeCategorySuggest),
    };
    catalogCache = payload;
    catalogCacheAt = Date.now();

    res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get("/suggest", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);

    if (q.length < 1) {
      return res.json({ products: [], brands: [], categories: [] });
    }

    const cacheKey = `${q}:${limit}`;
    const cached = getCachedSuggest(cacheKey);
    if (cached) {
      res.set("Cache-Control", "public, max-age=30");
      return res.json(cached);
    }

    const productWhere = productTextSearchWhere(q);
    const brandWhere = brandTextSearchWhere(q);
    const categoryWhere = categoryTextSearchWhere(q);

    const [products, brands, categories] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, ...productWhere },
        select: SUGGEST_SELECT,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.brand.findMany({
        where: { isActive: true, ...brandWhere },
        select: BRAND_SELECT,
        take: 4,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.category.findMany({
        where: { isActive: true, ...categoryWhere },
        select: CATEGORY_SELECT,
        take: 4,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

    const payload = {
      products: products.map(serializeProductSuggest),
      brands: brands.map(serializeBrandSuggest),
      categories: categories.map(serializeCategorySuggest),
    };

    setCachedSuggest(cacheKey, payload);
    res.set("Cache-Control", "public, max-age=30");
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
