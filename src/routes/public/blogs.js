const express = require("express");
const { prisma } = require("../../lib/prisma");
const {
  serializeBlogPost,
  serializeBlogCategory,
  BLOG_POST_INCLUDE,
} = require("../../lib/blogSerialize");
const { publishDueScheduledPosts } = require("../../services/blogPublisher");

const router = express.Router();

const publishedWhere = {
  status: "published",
  OR: [{ publishedAt: { lte: new Date() } }, { publishedAt: null }],
};

router.get("/", async (req, res, next) => {
  try {
    await publishDueScheduledPosts();
    const { category, tag, limit } = req.query;
    const where = { ...publishedWhere };

    if (category) {
      where.category = { slug: String(category), isActive: true };
    }
    if (tag) {
      where.tags = { some: { tag: { slug: String(tag) } } };
    }

    const take = Math.min(Math.max(parseInt(String(limit ?? "24"), 10) || 24, 1), 100);

    const posts = await prisma.blogPost.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take,
      include: BLOG_POST_INCLUDE,
    });

    res.json(
      posts.map((p) => serializeBlogPost(p, { includeContent: false }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/categories", async (req, res, next) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            posts: { where: publishedWhere },
          },
        },
      },
    });
    res.json(
      categories
        .filter((c) => c._count.posts > 0)
        .map((c) => serializeBlogCategory(c, c._count.posts))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/sitemap", async (req, res, next) => {
  try {
    await publishDueScheduledPosts();
    const posts = await prisma.blogPost.findMany({
      where: publishedWhere,
      select: { slug: true, updatedAt: true, publishedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    res.json(
      posts.map((p) => ({
        slug: p.slug,
        lastmod: (p.updatedAt || p.publishedAt).toISOString(),
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    await publishDueScheduledPosts();
    const post = await prisma.blogPost.findFirst({
      where: { slug: req.params.slug, ...publishedWhere },
      include: BLOG_POST_INCLUDE,
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(serializeBlogPost(post));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
