const Claim = require("../models/Claim");
const Item = require("../models/Item");

// POST /api/claims/:itemId  — submit a claim on a found item
const submitClaim = async (req, res) => {
  const { verificationDetails } = req.body;

  try {
    const item = await Item.findById(req.params.itemId);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (item.type !== "found") {
      return res
        .status(400)
        .json({ message: "You can only claim found items" });
    }

    if (item.status !== "approved") {
      return res
        .status(400)
        .json({ message: "This item is not available for claiming" });
    }

    // Prevent users from claiming their own report
    if (item.reportedBy.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot claim an item you reported" });
    }

    // Prevent duplicate claims from the same user
    const existingClaim = await Claim.findOne({
      item: req.params.itemId,
      claimant: req.user._id,
    });

    if (existingClaim) {
      return res
        .status(400)
        .json({ message: "You have already submitted a claim for this item" });
    }

    if (!verificationDetails || verificationDetails.trim().length < 10) {
      return res
        .status(400)
        .json({ message: "Please provide detailed verification information" });
    }

    const claim = await Claim.create({
      item: req.params.itemId,
      claimant: req.user._id,
      verificationDetails: verificationDetails.trim(),
      evidenceImages: req.processedImages?.map((img) => img.url) || [],
    });

    // Update item status to show a claim is pending
    item.status = "matched";
    await item.save();

    res.status(201).json({
      message:
        "Claim submitted successfully. An administrator will review it shortly.",
      claim,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/claims/my  — get the logged-in user's own claims
const getMyClaims = async (req, res) => {
  try {
    const claims = await Claim.find({ claimant: req.user._id })
      .populate("item", "title category location images status")
      .sort({ createdAt: -1 });

    res.json(claims);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/claims/:id  — get a single claim by ID
const getClaimById = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate("item", "title category location images status")
      .populate("claimant", "name email studentId");

    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    // Only the claimant or an admin can view a claim
    if (
      claim.claimant._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorised to view this claim" });
    }

    res.json(claim);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/claims/:id/confirm  — owner confirms they collected the item
const confirmCollection = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id).populate("item");

    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    if (claim.claimant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorised" });
    }

    if (claim.status !== "approved") {
      return res
        .status(400)
        .json({ message: "This claim has not been approved yet" });
    }

    // Mark item as recovered
    claim.item.status = "recovered";
    await claim.item.save();

    res.json({ message: "Collection confirmed. Thank you for using DLFS." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { submitClaim, getMyClaims, getClaimById, confirmCollection };
