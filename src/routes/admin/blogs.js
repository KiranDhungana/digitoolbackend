const express = require("express");
const { prisma } = require("../../lib/prisma");
const { resolveImageFields } = require("../../lib/resolveImage");
const { syncPostTags } = require("../../lib/blogTags");
const {
  validateBlogSeoFields,
  normalizeFaq,
  normalizeHeadings,
  defaultCanonicalUrl,
  slugify,
} = require("../../lib/blogSeo");
const {
  serializeBlogPost,
  BLOG_POST_INCLUDE,
} = require("../../lib/blogSerialize");
const { publishDueScheduledPosts } = require("../../services/blogPublisher");

const router = express.Router();

function buildStatusDates(body, existing) {
  const status = body.status ?? existing?.status ?? "draft";
  const scheduledAt =
    body.scheduledAt !== undefined
      ? body.scheduledAt
        ? new Date(body.scheduledAt)
        : null
      : existing?.scheduledAt ?? null;

  let publishedAt =
    body.publishedAt !== undefined
      ? body.publishedAt
        ? new Date(body.publishedAt)
        : null
      : existing?.publishedAt ?? null;

  if (status === "published" && !publishedAt) {
    publishedAt = new Date();
  }
  if (status === "draft") {
    publishedAt = null;
  }
  if (status === "scheduled" && scheduledAt && scheduledAt <= new Date()) {
    return {
      status: "published",
      scheduledAt: null,
      publishedAt: new Date(),
    };
  }

  return { status, scheduledAt, publishedAt };
}

async function resolveFeaturedImage(featuredImageUrl, featuredMediaId) {
  const resolved = await resolveImageFields(featuredImageUrl, featuredMediaId);
  return {
    featuredImageUrl: resolved.imageUrl,
    featuredMediaId: resolved.mediaId,
  };
}

router.get("/stats", async (req, res, next) => {
  try {
    await publishDueScheduledPosts();
    const [drafts, published, scheduled] = await Promise.all([
      prisma.blogPost.count({ where: { status: "draft" } }),
      prisma.blogPost.count({ where: { status: "published" } }),
      prisma.blogPost.count({ where: { status: "scheduled" } }),
    ]);
    res.json({ drafts, published, scheduled, total: drafts + published + scheduled });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    await publishDueScheduledPosts();
    const { status, categoryId, tag } = req.query;
    const where = {};

    if (status) where.status = String(status);
    if (categoryId) where.categoryId = String(categoryId);
    if (tag) {
      where.tags = {
        some: { tag: { slug: String(tag) } },
      };
    }

    const posts = await prisma.blogPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: BLOG_POST_INCLUDE,
    });

    res.json(
      posts.map((p) => serializeBlogPost(p, { includeContent: false }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      include: BLOG_POST_INCLUDE,
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(serializeBlogPost(post));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const errors = validateBlogSeoFields(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });

    const {
      title,
      slug,
      excerpt,
      content,
      metaDescription,
      focusKeyword,
      categoryId,
      tagNames,
      canonicalUrl,
      featuredImageAlt,
      featuredImageUrl,
      featuredMediaId,
    } = req.body;

    const finalSlug = slugify(slug || title);
    const dates = buildStatusDates(req.body, null);
    const featured = await resolveFeaturedImage(
      featuredImageUrl,
      featuredMediaId
    );

    const post = await prisma.blogPost.create({
      data: {
        title: String(title).trim(),
        slug: finalSlug,
        excerpt: excerpt?.trim() || null,
        content: String(content || "").trim() || "<p></p>",
        metaDescription: metaDescription?.trim() || null,
        focusKeyword: focusKeyword?.trim() || null,
        headings: normalizeHeadings(req.body.headings),
        faq: normalizeFaq(req.body.faq),
        canonicalUrl: canonicalUrl?.trim() || defaultCanonicalUrl(finalSlug),
        featuredImageAlt: featuredImageAlt?.trim() || null,
        ...featured,
        ...dates,
        categoryId: categoryId || null,
        authorId: req.admin.sub,
      },
      include: BLOG_POST_INCLUDE,
    });

    await syncPostTags(post.id, tagNames);
    const full = await prisma.blogPost.findUnique({
      where: { id: post.id },
      include: BLOG_POST_INCLUDE,
    });
    res.status(201).json(serializeBlogPost(full));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: "Post not found" });

    const errors = validateBlogSeoFields(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });

    const data = {};
    if (req.body.title !== undefined) data.title = String(req.body.title).trim();
    if (req.body.slug !== undefined) data.slug = slugify(req.body.slug);
    if (req.body.excerpt !== undefined) {
      data.excerpt = req.body.excerpt?.trim() || null;
    }
    if (req.body.content !== undefined) {
      data.content = String(req.body.content).trim() || "<p></p>";
    }
    if (req.body.metaDescription !== undefined) {
      data.metaDescription = req.body.metaDescription?.trim() || null;
    }
    if (req.body.focusKeyword !== undefined) {
      data.focusKeyword = req.body.focusKeyword?.trim() || null;
    }
    if (req.body.headings !== undefined) {
      data.headings = normalizeHeadings(req.body.headings);
    }
    if (req.body.faq !== undefined) data.faq = normalizeFaq(req.body.faq);
    if (req.body.categoryId !== undefined) {
      data.categoryId = req.body.categoryId || null;
    }
    if (req.body.canonicalUrl !== undefined) {
      data.canonicalUrl =
        req.body.canonicalUrl?.trim() ||
        defaultCanonicalUrl(data.slug || existing.slug);
    }
    if (req.body.featuredImageAlt !== undefined) {
      data.featuredImageAlt = req.body.featuredImageAlt?.trim() || null;
    }
    if (
      req.body.featuredImageUrl !== undefined ||
      req.body.featuredMediaId !== undefined
    ) {
      Object.assign(
        data,
        await resolveFeaturedImage(
          req.body.featuredImageUrl ?? existing.featuredImageUrl,
          req.body.featuredMediaId ?? existing.featuredMediaId
        )
      );
    }

    if (req.body.status !== undefined || req.body.scheduledAt !== undefined) {
      Object.assign(data, buildStatusDates(req.body, existing));
    }

    await prisma.blogPost.update({
      where: { id: req.params.id },
      data,
    });

    if (req.body.tagNames !== undefined) {
      await syncPostTags(req.params.id, req.body.tagNames);
    }

    const full = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      include: BLOG_POST_INCLUDE,
    });
    res.json(serializeBlogPost(full));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Post not found" });
    }
    next(err);
  }
});

module.exports = router;
