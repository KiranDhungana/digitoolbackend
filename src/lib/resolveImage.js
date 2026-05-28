const { prisma } = require("./prisma");

async function resolveImageFields(imageUrl, mediaId) {
  const clear =
    imageUrl === null ||
    imageUrl === "" ||
    mediaId === null ||
    mediaId === "";

  if (clear) {
    return { imageUrl: null, mediaId: null };
  }

  if (mediaId) {
    const media = await prisma.media.findUnique({
      where: { id: String(mediaId) },
    });
    if (!media) {
      const err = new Error("Invalid media library image");
      err.statusCode = 400;
      throw err;
    }
    return { imageUrl: media.url, mediaId: media.id };
  }

  if (imageUrl) {
    return { imageUrl: String(imageUrl).trim(), mediaId: null };
  }

  return { imageUrl: null, mediaId: null };
}

module.exports = { resolveImageFields };
