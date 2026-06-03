const { defaultCanonicalUrl } = require("./blogSeo");

function serializeTag(tag) {
  return {
    id: tag.id,
    slug: tag.slug,
    name: tag.name,
  };
}

function serializeBlogCategory(category, postCount = 0) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description ?? null,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    postCount,
  };
}

function serializeBlogPost(post, { includeContent = true } = {}) {
  const tags = post.tags?.map((pt) => serializeTag(pt.tag)) ?? [];
  const canonicalUrl =
    post.canonicalUrl?.trim() || defaultCanonicalUrl(post.slug);

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? null,
    content: includeContent ? post.content : undefined,
    metaDescription: post.metaDescription ?? null,
    focusKeyword: post.focusKeyword ?? null,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    canonicalUrl,
    featuredImageUrl: post.featuredImageUrl ?? null,
    featuredImageAlt: post.featuredImageAlt ?? null,
    featuredMediaId: post.featuredMediaId ?? null,
    headings: Array.isArray(post.headings) ? post.headings : [],
    faq: Array.isArray(post.faq) ? post.faq : [],
    categoryId: post.categoryId ?? null,
    category: post.category
      ? serializeBlogCategory(post.category)
      : null,
    tags,
    author: post.author
      ? { id: post.author.id, name: post.author.name, email: post.author.email }
      : null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

const BLOG_POST_INCLUDE = {
  category: true,
  author: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
};

module.exports = {
  serializeBlogPost,
  serializeBlogCategory,
  serializeTag,
  BLOG_POST_INCLUDE,
};
