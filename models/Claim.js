const mongoose = require("mongoose");

const ClaimSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    verificationDetails: { type: String, required: true }, // claimant's proof
    evidenceImages: [{ type: String }], // URLs to uploaded receipts/photos
    adminNote: { type: String },
    collectionCode: { type: String },
  },
  { timestamps: true },
);

ClaimSchema.index({ item: 1 });
ClaimSchema.index({ claimant: 1 });

module.exports = mongoose.model("Claim", ClaimSchema);
