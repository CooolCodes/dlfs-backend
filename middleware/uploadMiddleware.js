const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Store uploads in memory first, sharp will process then save
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG and WebP images are allowed"));
    }
  },
});

// Process and save images after multer receives them
const processImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    req.processedImages = [];
    return next();
  }

  // Make sure uploads folder exists
  const uploadDir = path.join(__dirname, "..", "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

  try {
    const processed = await Promise.all(
      req.files.map(async (file) => {
        const filename = `item-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
        const filepath = path.join(uploadDir, filename);

        await sharp(file.buffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(filepath);

        return {
          url: `/uploads/${filename}`,
          pHash: null, // you will add pHash generation here in semester 2
        };
      }),
    );

    req.processedImages = processed;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { upload, processImages };
