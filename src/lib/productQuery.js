/** Lean Prisma selects — avoid loading description, denominations, full media rows */

const MEDIA_URL = { select: { url: true } };

const BRAND_LIST = {
  select: {
    name: true,
    slug: true,
    imageUrl: true,
    media: MEDIA_URL,
  },
};

const CATEGORY_LIST = {
  select: {
    name: true,
    slug: true,
    imageUrl: true,
    media: MEDIA_URL,
  },
};

const PRODUCT_LIST_SELECT = {
  slug: true,
  name: true,
  price: true,
  originalPrice: true,
  currency: true,
  gradient: true,
  imageUrl: true,
  badge: true,
  mediaId: true,
  isActive: true,
  brand: BRAND_LIST,
  category: CATEGORY_LIST,
  media: MEDIA_URL,
};

const PRODUCT_DETAIL_SELECT = {
  ...PRODUCT_LIST_SELECT,
  description: true,
  denominations: true,
};

/** Admin table — no description/denominations payload */
const ADMIN_PRODUCT_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  price: true,
  originalPrice: true,
  currency: true,
  gradient: true,
  imageUrl: true,
  badge: true,
  mediaId: true,
  isActive: true,
  brandId: true,
  categoryId: true,
  brand: { select: { name: true, slug: true, imageUrl: true, media: MEDIA_URL } },
  category: { select: { name: true, slug: true } },
  media: MEDIA_URL,
};

const ADMIN_PRODUCT_DETAIL_SELECT = {
  ...ADMIN_PRODUCT_LIST_SELECT,
  description: true,
  denominations: true,
};

/** Dropdowns on product create/edit — id + name only */
const ADMIN_BRAND_PICKER_SELECT = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
};

const ADMIN_CATEGORY_PICKER_SELECT = {
  id: true,
  name: true,
  slug: true,
  icon: true,
  isActive: true,
};

const DEFAULT_LIST_LIMIT = 48;
const ADMIN_LIST_MAX = 500;
const MAX_LIST_LIMIT = 48;
const MAX_BATCH_SLUGS = 24;

function parseListLimit(raw) {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(n, MAX_LIST_LIMIT);
}

function parseBatchSlugs(raw) {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_BATCH_SLUGS);
}

function parseAdminListLimit(raw) {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, ADMIN_LIST_MAX);
}

module.exports = {
  PRODUCT_LIST_SELECT,
  PRODUCT_DETAIL_SELECT,
  ADMIN_PRODUCT_LIST_SELECT,
  ADMIN_PRODUCT_DETAIL_SELECT,
  ADMIN_BRAND_PICKER_SELECT,
  ADMIN_CATEGORY_PICKER_SELECT,
  DEFAULT_LIST_LIMIT,
  ADMIN_LIST_MAX,
  parseListLimit,
  parseBatchSlugs,
  parseAdminListLimit,
};
