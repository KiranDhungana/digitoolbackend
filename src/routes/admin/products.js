const express = require("express");
const { prisma } = require("../../lib/prisma");
const { resolveImageFields } = require("../../lib/resolveImage");
const {
  serializeAdminProductList,
  serializeAdminProductDetail,
} = require("../../lib/serialize");
const {
  ADMIN_PRODUCT_LIST_SELECT,
  ADMIN_PRODUCT_DETAIL_SELECT,
  ADMIN_BRAND_PICKER_SELECT,
  ADMIN_CATEGORY_PICKER_SELECT,
  parseAdminListLimit,
} = require("../../lib/productQuery");

async function loadFormOptions() {
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({
      select: ADMIN_BRAND_PICKER_SELECT,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.category.findMany({
      select: ADMIN_CATEGORY_PICKER_SELECT,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return {
    brands: brands.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      isActive: b.isActive,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      isActive: c.isActive,
    })),
  };
}

const router = express.Router();

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

router.get("/", async (req, res, next) => {
  try {
    const take = parseAdminListLimit(req.query.limit);
    const skip = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const products = await prisma.product.findMany({
      select: ADMIN_PRODUCT_LIST_SELECT,
      orderBy: { updatedAt: "desc" },
      ...(take != null ? { take, skip } : skip > 0 ? { skip } : {}),
    });

    res.json(products.map(serializeAdminProductList));
  } catch (err) {
    next(err);
  }
});

/** Lean brand/category lists for product forms (create page) */
router.get("/form-options", async (req, res, next) => {
  try {
    res.json(await loadFormOptions());
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const withFormOptions =
      req.query.formOptions === "1" || req.query.formOptions === "true";

    const productPromise = prisma.product.findUnique({
      where: { id: req.params.id },
      select: ADMIN_PRODUCT_DETAIL_SELECT,
    });

    if (withFormOptions) {
      const [product, formOptions] = await Promise.all([
        productPromise,
        loadFormOptions(),
      ]);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      return res.json({
        product: serializeAdminProductDetail(product),
        ...formOptions,
      });
    }

    const product = await productPromise;
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(serializeAdminProductDetail(product));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      name,
      slug,
      description,
      price,
      originalPrice,
      currency,
      gradient,
      badge,
      denominations,
      isActive,
      brandId,
      categoryId,
      imageUrl,
      mediaId,
    } = req.body;

    if (!name || !description || price == null || !brandId || !categoryId) {
      return res.status(400).json({
        error: "name, description, price, brandId, and categoryId are required",
      });
    }

    const finalSlug = slugify(slug || name);
    const imageFields =
      imageUrl !== undefined || mediaId !== undefined
        ? await resolveImageFields(imageUrl, mediaId)
        : {};

    const product = await prisma.product.create({
      data: {
        name,
        slug: finalSlug,
        description,
        price,
        originalPrice: originalPrice ?? null,
        currency: currency || "NPR",
        gradient: gradient || "from-gray-600 to-gray-800",
        badge: badge || null,
        denominations: denominations ?? [10, 25, 50],
        isActive: isActive !== false,
        brandId,
        categoryId,
        ...imageFields,
      },
      select: ADMIN_PRODUCT_DETAIL_SELECT,
    });

    res.status(201).json(serializeAdminProductDetail(product));
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Invalid brand or category" });
    }
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const {
      name,
      slug,
      description,
      price,
      originalPrice,
      currency,
      gradient,
      badge,
      denominations,
      isActive,
      brandId,
      categoryId,
      imageUrl,
      mediaId,
    } = req.body;

    const data = {};
    if (name != null) data.name = name;
    if (slug != null) data.slug = slugify(slug);
    if (description != null) data.description = description;
    if (price != null) data.price = price;
    if (originalPrice !== undefined) {
      data.originalPrice =
        originalPrice === "" || originalPrice == null ? null : originalPrice;
    }
    if (currency != null) data.currency = currency;
    if (gradient != null) data.gradient = gradient;
    if (badge !== undefined) data.badge = badge || null;
    if (denominations != null) data.denominations = denominations;
    if (isActive != null) data.isActive = Boolean(isActive);
    if (brandId != null) data.brandId = brandId;
    if (categoryId != null) data.categoryId = categoryId;
    if (imageUrl !== undefined || mediaId !== undefined) {
      Object.assign(data, await resolveImageFields(imageUrl, mediaId));
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      select: ADMIN_PRODUCT_DETAIL_SELECT,
    });

    res.json(serializeAdminProductDetail(product));
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    next(err);
  }
});

module.exports = router;
