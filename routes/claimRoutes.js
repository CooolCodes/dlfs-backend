const express = require("express");
const router = express.Router();
const {
  submitClaim,
  getMyClaims,
  getClaimById,
  confirmCollection,
} = require("../controllers/claimController");
const { protect } = require("../middleware/authMiddleware");
const { upload, processImages } = require("../middleware/uploadMiddleware");

// All claim routes require login
router.use(protect);

router.get("/my", getMyClaims);
router.get("/:id", getClaimById);
router.post(
  "/:itemId",
  upload.array("evidenceImages", 3),
  processImages,
  submitClaim,
);
router.patch("/:id/confirm", confirmCollection);

module.exports = router;
