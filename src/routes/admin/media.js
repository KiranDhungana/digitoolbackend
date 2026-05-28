const express = require("express");
const multer = require("multer");
const { prisma } = require("../../lib/prisma");
const { uploadBuffer, destroy } = require("../../lib/cloudinary");

const router = express.Router();

const MAX_FILES_BULK = 50;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_FILES_BULK },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

async function saveUploadedFile(file, folder, alt) {
  const result = await uploadBuffer(file.buffer, { folder });
  return prisma.media.create({
    data: {
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width ?? null,
      height: result.height ?? null,
      format: result.format ?? null,
      bytes: result.bytes ?? null,
      folder: result.folder || folder,
      filename: file.originalname || null,
      alt,
    },
  });
}

function serializeMedia(media) {
  return {
    id: media.id,
    publicId: media.publicId,
    url: media.url,
    width: media.width,
    height: media.height,
    format: media.format,
    bytes: media.bytes,
    folder: media.folder,
    filename: media.filename,
    alt: media.alt,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { folder, limit = "50", offset = "0" } = req.query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset, 10) || 0, 0);

    const where = folder ? { folder: String(folder) } : {};

    const [items, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.media.count({ where }),
    ]);

    res.json({
      items: items.map(serializeMedia),
      total,
      limit: take,
      offset: skip,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
    });
    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }
    res.json(serializeMedia(media));
  } catch (err) {
    next(err);
  }
});

router.post("/upload/bulk", upload.array("files", MAX_FILES_BULK), async (req, res, next) => {
  try {
    const files = req.files;
    if (!files?.length) {
      return res.status(400).json({
        error: "files are required (multipart field: files, up to 50 images)",
      });
    }

    const folder = (req.body.folder || "ecommerce").trim();
    const alt = req.body.alt?.trim() || null;

    const settled = await Promise.allSettled(
      files.map((file) => saveUploadedFile(file, folder, alt))
    );

    const items = [];
    const failed = [];

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        items.push(serializeMedia(result.value));
      } else {
        failed.push({
          filename: files[index].originalname || `file-${index + 1}`,
          error: result.reason?.message || "Upload failed",
        });
      }
    });

    const status = failed.length === files.length ? 400 : 201;
    res.status(status).json({
      items,
      failed,
      uploadedCount: items.length,
      failedCount: failed.length,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "file is required (multipart field: file)" });
    }

    const folder = (req.body.folder || "ecommerce").trim();
    const alt = req.body.alt?.trim() || null;

    const media = await saveUploadedFile(req.file, folder, alt);

    res.status(201).json(serializeMedia(media));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
    });
    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }

    await destroy(media.publicId);
    await prisma.media.delete({ where: { id: media.id } });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large (max 10MB)" });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: `Too many files (max ${MAX_FILES_BULK})` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message === "Only image files are allowed") {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
