const { slugify } = require("./slugify");

const META_DESC_MIN = 50;
const META_DESC_MAX = 160;
const TITLE_MAX = 70;

function validateBlogSeoFields(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.title !== undefined) {
    const title = String(body.title ?? "").trim();
    if (!title) errors.push("Title is required");
    else if (title.length > TITLE_MAX) {
      errors.push(`Title should be under ${TITLE_MAX} characters`);
    }
  }

  if (!partial || body.metaDescription !== undefined) {
    const meta = body.metaDescription;
    if (meta != null && String(meta).trim() !== "") {
      const len = String(meta).trim().length;
      if (len < META_DESC_MIN || len > META_DESC_MAX) {
        errors.push(
          `Meta description should be ${META_DESC_MIN}-${META_DESC_MAX} characters`
        );
      }
    }
  }

  if (!partial || body.slug !== undefined) {
    const slug = body.slug != null ? slugify(body.slug) : "";
    if (body.slug != null && body.slug !== "" && !slug) {
      errors.push("Invalid slug");
    }
  }

  if (body.faq !== undefined) {
    const faq = normalizeFaq(body.faq);
    for (const item of faq) {
      if (!item.question?.trim() || !item.answer?.trim()) {
        errors.push("Each FAQ item needs a question and answer");
        break;
      }
    }
  }

  return errors;
}

function normalizeFaq(faq) {
  if (!faq) return [];
  if (Array.isArray(faq)) {
    return faq.map((item) => ({
      question: String(item.question ?? "").trim(),
      answer: String(item.answer ?? "").trim(),
    }));
  }
  return [];
}

function normalizeHeadings(headings) {
  if (!headings) return [];
  if (!Array.isArray(headings)) return [];
  return headings.map((h) => String(h).trim()).filter(Boolean);
}

function defaultCanonicalUrl(slug) {
  const base = (process.env.SITE_URL || "https://digitoolera.com").replace(
    /\/$/,
    ""
  );
  return `${base}/blog/${slug}`;
}

module.exports = {
  validateBlogSeoFields,
  normalizeFaq,
  normalizeHeadings,
  defaultCanonicalUrl,
  slugify,
};
