const Item = require("../models/Item");
const Claim = require("../models/Claim");
const User = require("../models/User");
const runMatching = require("../utils/runMatching");

// GET /api/admin/items?status=pending  — view items by status
const getItemsByStatus = async (req, res) => {
  const { status = "pending", page = 1, limit = 20 } = req.query;

  try {
    const total = await Item.countDocuments({ status });
    const items = await Item.find({ status })
      .populate("reportedBy", "name email studentId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      items,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/admin/items/:id/approve  — approve a pending report
const approveItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate(
      "reportedBy",
      "name email",
    );

    if (!item) return res.status(404).json({ message: "Item not found" });

    if (item.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Item is already ${item.status}` });
    }

    item.status = "approved";
    await item.save();

    // Run matching in the background — don't await so the
    // admin response isn't delayed
    runMatching(item).catch((err) =>
      console.error("Background matching failed:", err),
    );

    res.json({
      message: "Item approved and now visible to the public",
      item,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/admin/items/:id/reject  — reject a pending report
const rejectItem = async (req, res) => {
  const { reason } = req.body;

  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (item.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Item is already ${item.status}` });
    }

    item.status = "archived";
    item.archivedAt = new Date();
    await item.save();

    res.json({
      message: "Item rejected",
      reason: reason || "No reason provided",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/claims?status=pending  — view claims by status
const getClaims = async (req, res) => {
  const { status = "pending" } = req.query;

  try {
    const claims = await Claim.find({ status })
      .populate("item", "title category location images verificationNote")
      .populate("claimant", "name email studentId")
      .sort({ createdAt: -1 });

    res.json(claims);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/admin/claims/:id/approve  — approve a claim
const approveClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id).populate("item");
    if (!claim) return res.status(404).json({ message: "Claim not found" });

    if (claim.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Claim is already ${claim.status}` });
    }

    // Generate a unique collection code
    const collectionCode = `DLFS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Update the claim
    claim.status = "approved";
    claim.collectionCode = collectionCode;
    await claim.save();

    // Update the item status
    claim.item.status = "claimed";
    claim.item.collectionCode = collectionCode;
    await claim.item.save();

    res.json({
      message: "Claim approved",
      collectionCode,
      claim,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/admin/claims/:id/reject  — reject a claim
const rejectClaim = async (req, res) => {
  const { reason } = req.body;

  try {
    const claim = await Claim.findById(req.params.id).populate("item");
    if (!claim) return res.status(404).json({ message: "Claim not found" });

    if (claim.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Claim is already ${claim.status}` });
    }

    claim.status = "rejected";
    claim.adminNote = reason || "No reason provided";
    await claim.save();

    // Put item back to approved so others can still claim it
    claim.item.status = "approved";
    await claim.item.save();

    res.json({ message: "Claim rejected", claim });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/stats  — dashboard analytics
const getStats = async (req, res) => {
  try {
    const [
      totalItems,
      pendingItems,
      approvedItems,
      claimedItems,
      recoveredItems,
      totalUsers,
      pendingClaims,
    ] = await Promise.all([
      Item.countDocuments(),
      Item.countDocuments({ status: "pending" }),
      Item.countDocuments({ status: "approved" }),
      Item.countDocuments({ status: "claimed" }),
      Item.countDocuments({ status: "recovered" }),
      User.countDocuments(),
      Claim.countDocuments({ status: "pending" }),
    ]);

    res.json({
      totalItems,
      pendingItems,
      approvedItems,
      claimedItems,
      recoveredItems,
      totalUsers,
      pendingClaims,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getItemsByStatus,
  approveItem,
  rejectItem,
  getClaims,
  approveClaim,
  rejectClaim,
  getStats,
};
