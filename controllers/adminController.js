const Item = require("../models/Item");
const Claim = require("../models/Claim");
const User = require("../models/User");
const runMatching = require("../utils/runMatching");
const sendEmail = require('../utils/sendEmail')

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

    runMatching(item).catch((err) =>
      console.error("Background matching failed:", err),
    );

    // Send approval email to reporter
    try {
      await sendEmail({
        to: item.reportedBy.email,
        subject: 'DLFS — Your report has been approved',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#374151">
            <div style="background:#0D1B2A;padding:1.5rem;border-radius:8px 8px 0 0">
              <h1 style="color:#ffffff;margin:0;font-size:1.3rem">
                ✅ Report Approved
              </h1>
            </div>
            <div style="background:#ffffff;padding:1.5rem;border:1px solid #e2e8f0;
              border-top:none;border-radius:0 0 8px 8px">
              <p>Hi <strong>${item.reportedBy.name}</strong>,</p>
              <p>Your report has been reviewed and approved. It is now visible to the public on DLFS.</p>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;
                border-radius:8px;padding:1rem;margin:1rem 0">
                <p style="margin:0 0 0.5rem">
                  <strong>Item:</strong> ${item.title}
                </p>
                <p style="margin:0 0 0.5rem">
                  <strong>Category:</strong> ${item.category}
                </p>
                <p style="margin:0 0 0.5rem">
                  <strong>Type:</strong> ${item.type === 'lost' ? 'Lost' : 'Found'}
                </p>
                <p style="margin:0">
                  <strong>Location:</strong> ${item.location}
                </p>
              </div>

              <p>
                Other UNILAG students can now find and claim this item.
                You will be notified if someone submits a claim.
              </p>

              <a href="https://dlfs.app/items/${item._id}"
                style="display:inline-block;margin:1rem 0;padding:0.75rem 1.5rem;
                background:#0A7E8C;color:#fff;border-radius:8px;
                text-decoration:none;font-weight:600;">
                View your report
              </a>

              <p style="color:#64748b;font-size:0.82rem;margin-top:1.5rem">
                This is an automated notification from the University of Lagos
                Digital Lost and Found System.
              </p>
            </div>
          </div>
        `,
      })
    } catch (emailError) {
      console.error('Approval email failed:', emailError.message)
      // Don't fail the request if email fails
    }

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

// DELETE /api/admin/items/:id  — delete an approved item
const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    // Delete any associated claims
    await Claim.deleteMany({ item: item._id });

    await item.deleteOne();

    res.json({ message: "Item deleted successfully" });
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
    const claim = await Claim.findById(req.params.id)
      .populate('item')
      .populate('claimant', 'name email')

    if (!claim) return res.status(404).json({ message: 'Claim not found' })

    if (claim.status !== 'pending') {
      return res.status(400).json({ message: `Claim is already ${claim.status}` })
    }

    // Generate a unique collection code
    const collectionCode = `DLFS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Update the claim
    claim.status = 'approved'
    claim.collectionCode = collectionCode
    await claim.save()

    // Update the item status
    claim.item.status = 'claimed'
    claim.item.collectionCode = collectionCode
    await claim.item.save()

    // Send collection email to claimant
    try {
      await sendEmail({
        to: claim.claimant.email,
        subject: 'DLFS — Your claim has been approved',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#374151">
            <div style="background:#0D1B2A;padding:1.5rem;border-radius:8px 8px 0 0">
              <h1 style="color:#ffffff;margin:0;font-size:1.3rem">
                ✅ Claim Approved
              </h1>
            </div>
            <div style="background:#ffffff;padding:1.5rem;border:1px solid #e2e8f0;
              border-top:none;border-radius:0 0 8px 8px">
              <p>Hi <strong>${claim.claimant.name}</strong>,</p>
              <p>Your ownership claim for the following item has been approved:</p>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;
                border-radius:8px;padding:1rem;margin:1rem 0">
                <p style="margin:0 0 0.5rem">
                  <strong>Item:</strong> ${claim.item.title}
                </p>
                <p style="margin:0 0 0.5rem">
                  <strong>Category:</strong> ${claim.item.category}
                </p>
                <p style="margin:0">
                  <strong>Location found:</strong> ${claim.item.location}
                </p>
              </div>

              <p>Your unique collection code is:</p>

              <div style="background:#f0fdf4;border:1px solid #86efac;
                border-radius:8px;padding:1rem;margin:1rem 0;text-align:center">
                <p style="font-size:1.6rem;font-weight:700;letter-spacing:0.1em;
                  font-family:monospace;color:#0D1B2A;margin:0">
                  ${collectionCode}
                </p>
              </div>

              <p><strong>To collect your item:</strong></p>
              <ol style="padding-left:1.25rem;line-height:1.8">
                <li>Visit the campus security checkpoint where the item is being held</li>
                <li>Present your valid University of Lagos ID card</li>
                <li>Provide the collection code above to the security officer</li>
                <li>Sign the release form and collect your item</li>
                <li>Log back into DLFS and confirm you have received your item</li>
              </ol>

              <p style="color:#64748b;font-size:0.82rem;margin-top:1.5rem">
                This is an automated notification from the University of Lagos
                Digital Lost and Found System.
              </p>
            </div>
          </div>
        `,
      })
    } catch (emailError) {
      console.error('Claim approval email failed:', emailError.message)
      // Don't fail the whole request if email fails
    }

    res.json({
      message: 'Claim approved',
      collectionCode,
      claim,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
}

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
  deleteItem,
  getClaims,
  approveClaim,
  rejectClaim,
  getStats,
};
