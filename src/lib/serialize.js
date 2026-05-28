function toNumber(value) {
  if (value == null) return undefined;
  return Number(value);
}

/** Prefer stored imageUrl, then linked Media library URL */
function pickImageUrl(record) {
  if (record?.imageUrl) return record.imageUrl;
  if (record?.media?.url) return record.media.url;
  return undefined;
}

function serializeProductCore(product, { includeDetail }) {
  const brandImageUrl = pickImageUrl(product.brand);
  const categoryImageUrl = pickImageUrl(product.category);
  const imageUrl =
    pickImageUrl(product) ?? brandImageUrl ?? categoryImageUrl ?? undefined;

  const base = {
    id: product.slug,
    name: product.name,
    brand: product.brand.name,
    brandSlug: product.brand.slug,
    category: product.category.name,
    categorySlug: product.category.slug,
    price: toNumber(product.price),
    originalPrice: product.originalPrice
      ? toNumber(product.originalPrice)
      : undefined,
    currency: product.currency,
    gradient: product.gradient,
    badge: product.badge ?? undefined,
    isActive: product.isActive,
    imageUrl,
    mediaId: product.mediaId ?? undefined,
    brandImageUrl,
    categoryImageUrl,
  };

  if (!includeDetail) {
    return {
      ...base,
      description: "",
      denominations: [],
    };
  }

  return {
    ...base,
    description: product.description,
    denominations: product.denominations,
  };
}

function serializeProduct(product) {
  return serializeProductCore(product, { includeDetail: true });
}

function serializeProductList(product) {
  return serializeProductCore(product, { includeDetail: false });
}

function serializeAdminProductList(product) {
  return {
    ...serializeProductList(product),
    dbId: product.id,
    brandId: product.brandId,
    categoryId: product.categoryId,
  };
}

function serializeAdminProductDetail(product) {
  return {
    ...serializeProduct(product),
    dbId: product.id,
    brandId: product.brandId,
    categoryId: product.categoryId,
  };
}

function serializeCategory(category, productCount) {
  return {
    slug: category.slug,
    name: category.name,
    icon: category.icon,
    gradient: category.gradient,
    imageUrl: pickImageUrl(category),
    mediaId: category.mediaId ?? undefined,
    productCount: productCount ?? 0,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  };
}

function serializeBrand(brand, productCount) {
  return {
    slug: brand.slug,
    name: brand.name,
    gradient: brand.gradient,
    imageUrl: pickImageUrl(brand),
    mediaId: brand.mediaId ?? undefined,
    productCount: productCount ?? 0,
    isActive: brand.isActive,
    sortOrder: brand.sortOrder,
  };
}

/** Minimal product shape for client-side search index */
function serializeProductSuggest(product) {
  const brandImageUrl = pickImageUrl(product.brand);
  const imageUrl = pickImageUrl(product) ?? brandImageUrl;

  return {
    id: product.slug,
    name: product.name,
    brand: product.brand.name,
    brandSlug: product.brand.slug,
    category: product.category.name,
    categorySlug: product.category.slug,
    price: toNumber(product.price),
    currency: product.currency,
    gradient: product.gradient,
    imageUrl,
    badge: product.badge ?? undefined,
    description: "",
    denominations: [],
  };
}

function serializeBrandSuggest(brand) {
  return {
    slug: brand.slug,
    name: brand.name,
    gradient: brand.gradient,
    imageUrl: pickImageUrl(brand),
    productCount: 0,
  };
}

function serializeCategorySuggest(category) {
  return {
    slug: category.slug,
    name: category.name,
    icon: category.icon,
    gradient: category.gradient,
    imageUrl: pickImageUrl(category),
    productCount: 0,
  };
}

module.exports = {
  serializeProduct,
  serializeProductList,
  serializeAdminProductList,
  serializeAdminProductDetail,
  serializeCategory,
  serializeBrand,
  serializeProductSuggest,
  serializeBrandSuggest,
  serializeCategorySuggest,
  pickImageUrl,
};
