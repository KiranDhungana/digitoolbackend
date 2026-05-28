const cloudinary = require("cloudinary").v2;

function ensureConfigured() {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error("CLOUDINARY_URL is not set in .env");
  }
  cloudinary.config({ secure: true });
}

function uploadBuffer(buffer, options = {}) {
  ensureConfigured();
  const { folder = "ecommerce", ...rest } = options;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", ...rest },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function destroy(publicId) {
  ensureConfigured();
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

module.exports = { cloudinary, uploadBuffer, destroy };
