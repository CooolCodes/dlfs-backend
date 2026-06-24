const express = require("express");
const router = express.Router();
const {
  createItem,
  getItems,
  getItemById,
  getMyItems,
} = require("../controllers/itemController");
const { protect } = require("../middleware/authMiddleware");
const { upload, processImages } = require("../middleware/uploadMiddleware");

// Public routes
router.get("/", getItems);

// Protected routes (must be logged in)
router.post("/", protect, upload.array("images", 5), processImages, createItem);
router.get("/user/my", protect, getMyItems);

router.get("/:id", getItemById);

module.exports = router;
