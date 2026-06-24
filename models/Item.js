const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    pHash: { type: String },
  },
  { _id: false },
);

const ItemSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: ["lost", "found"], required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "matched",
        "claimed",
        "verified",
        "recovered",
        "archived",
      ],
      default: "pending",
    },
    category: {
      type: String,
      enum: [
        "Electronics",
        "Documents",
        "Clothing",
        "Bags",
        "Books",
        "Accessories",
        "Keys",
        "Wallets",
        "Other",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    dateOccurred: { type: Date, required: true },
    images: { type: [ImageSchema], validate: (v) => v.length <= 5 },
    verificationNote: { type: String }, // finder's private note — never exposed publicly
    collectionCode: { type: String }, // generated on claim approval
    archivedAt: { type: Date },
  },
  { timestamps: true },
);

ItemSchema.index({ type: 1, status: 1 });
ItemSchema.index({ category: 1 });
ItemSchema.index({ title: "text", description: "text" }); // enables full-text search

module.exports = mongoose.model("Item", ItemSchema);
