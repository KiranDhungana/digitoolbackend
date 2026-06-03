const { prisma } = require("../lib/prisma");

async function publishDueScheduledPosts() {
  const now = new Date();
  const due = await prisma.blogPost.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
    },
    select: { id: true },
  });

  if (due.length === 0) return 0;

  await prisma.blogPost.updateMany({
    where: { id: { in: due.map((p) => p.id) } },
    data: {
      status: "published",
      publishedAt: now,
    },
  });

  return due.length;
}

function startBlogPublisher(intervalMs = 60_000) {
  const tick = async () => {
    try {
      const count = await publishDueScheduledPosts();
      if (count > 0) {
        console.log(`Blog publisher: published ${count} scheduled post(s)`);
      }
    } catch (err) {
      console.error("Blog publisher error:", err.message);
    }
  };

  tick();
  return setInterval(tick, intervalMs);
}

module.exports = { publishDueScheduledPosts, startBlogPublisher };
