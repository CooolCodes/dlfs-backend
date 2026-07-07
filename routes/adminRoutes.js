const express = require("express");
const router = express.Router();
const {
  getItemsByStatus,
  approveItem,
  rejectItem,
  revokeItem,
  getClaims,
  approveClaim,
  rejectClaim,
  getStats,
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// All admin routes require login AND admin role
router.use(protect, adminOnly);

router.get("/items", getItemsByStatus);
router.patch("/items/:id/approve", approveItem);
router.patch("/items/:id/reject", rejectItem);
//router.delete("/items/:id", deleteItem);
router.patch("/items/:id/revoke", revokeItem);

router.get("/claims", getClaims);
router.patch("/claims/:id/approve", approveClaim);
router.patch("/claims/:id/reject", rejectClaim);


router.get("/stats", getStats);

module.exports = router;
