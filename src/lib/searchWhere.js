/** Text match for products (indexed-friendly fields only; skips description scan) */
function productTextSearchWhere(q) {
  const term = String(q).trim();
  if (!term) return null;
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
      { brand: { name: { contains: term, mode: "insensitive" } } },
      { category: { name: { contains: term, mode: "insensitive" } } },
    ],
  };
}

function brandTextSearchWhere(q) {
  const term = String(q).trim();
  if (!term) return null;
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
    ],
  };
}

function categoryTextSearchWhere(q) {
  const term = String(q).trim();
  if (!term) return null;
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
    ],
  };
}

module.exports = {
  productTextSearchWhere,
  brandTextSearchWhere,
  categoryTextSearchWhere,
};
