const { prisma } = require("./prisma");
const { slugify } = require("./slugify");

async function syncPostTags(postId, tagNames) {
  const names = [...new Set((tagNames || []).map((t) => String(t).trim()).filter(Boolean))];
  await prisma.blogPostTag.deleteMany({ where: { postId } });

  if (names.length === 0) return [];

  const tags = [];
  for (const name of names) {
    const slug = slugify(name);
    const tag = await prisma.blogTag.upsert({
      where: { slug },
      create: { name, slug },
      update: { name },
    });
    tags.push(tag);
  }

  await prisma.blogPostTag.createMany({
    data: tags.map((tag) => ({ postId, tagId: tag.id })),
    skipDuplicates: true,
  });

  return tags;
}

module.exports = { syncPostTags };
