const Item = require("../models/Item");
const { computeMatchScore } = require("./matchingAlgorithm");
const sendEmail = require("./sendEmail");

const MATCH_THRESHOLD = 0.6;

const runMatching = async (newItem) => {
  try {
    // Find all approved items of the opposite type
    const oppositeType = newItem.type === "lost" ? "found" : "lost";

    const candidates = await Item.find({
      type: oppositeType,
      status: "approved",
      category: newItem.category, // only compare same category for efficiency
    }).populate("reportedBy", "name email");

    console.log(
      `Running matching for "${newItem.title}" against ${candidates.length} candidates`,
    );

    const matches = [];

    for (const candidate of candidates) {
      const { score, breakdown } = computeMatchScore(newItem, candidate);

      console.log(`  Score vs "${candidate.title}": ${score}`, breakdown);

      if (score >= MATCH_THRESHOLD) {
        matches.push({ item: candidate, score, breakdown });
      }
    }

    if (matches.length === 0) {
      console.log("  No matches above threshold found.");
      return;
    }

    // Sort matches by score descending
    matches.sort((a, b) => b.score - a.score);

    console.log(`  Found ${matches.length} match(es) above threshold.`);

    // Notify the relevant users for each match
    for (const match of matches) {
      await notifyMatch(newItem, match.item, match.score);
    }
  } catch (error) {
    console.error("Matching error:", error);
  }
};

// ─── Email Notification ───────────────────────────────────────────────────────
const notifyMatch = async (newItem, matchedItem, score) => {
  try {
    // If the new item is FOUND, notify the owner of the LOST report
    // If the new item is LOST, notify the owner of the FOUND report
    const lostItem = newItem.type === "lost" ? newItem : matchedItem;
    const foundItem = newItem.type === "found" ? newItem : matchedItem;

    // Populate the lost item owner's email
    const lostItemPopulated = await Item.findById(lostItem._id).populate(
      "reportedBy",
      "name email",
    );

    if (!lostItemPopulated?.reportedBy?.email) return;

    const { name, email } = lostItemPopulated.reportedBy;
    const matchPercent = Math.round(score * 100);
    const itemURL = `http://localhost:5173/items/${foundItem._id}`;

    await sendEmail({
      to: email,
      subject: `DLFS — Potential match found for your lost ${lostItem.category}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#374151">
          <div style="background:#0D1B2A;padding:1.5rem;border-radius:8px 8px 0 0">
            <h1 style="color:#ffffff;margin:0;font-size:1.3rem">
              🔍 Potential match found
            </h1>
          </div>
          <div style="background:#ffffff;padding:1.5rem;border:1px solid #e2e8f0;
            border-top:none;border-radius:0 0 8px 8px">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Good news — our system found a potential match for your lost item.</p>

            <div style="background:#f8fafc;border:1px solid #e2e8f0;
              border-radius:8px;padding:1rem;margin:1rem 0">
              <p style="margin:0 0 0.5rem">
                <strong>Your lost item:</strong> ${lostItem.title}
              </p>
              <p style="margin:0 0 0.5rem">
                <strong>Potential match:</strong> ${foundItem.title}
              </p>
              <p style="margin:0">
                <strong>Match confidence:</strong> ${matchPercent}%
              </p>
            </div>

            <p>
              Review the found item and submit a claim if you believe
              it belongs to you.
            </p>

            <a href="${itemURL}"
              style="display:inline-block;margin:1rem 0;padding:0.75rem 1.5rem;
              background:#0A7E8C;color:#fff;border-radius:8px;
              text-decoration:none;font-weight:600">
              View found item →
            </a>

            <p style="color:#64748b;font-size:0.82rem;margin-top:1.5rem">
              This is an automated notification from the University of Lagos
              Digital Lost and Found System. If this is not your item,
              please ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    console.log(`  Match notification sent to ${email}`);
  } catch (error) {
    console.error("Notification error:", error);
  }
};

module.exports = runMatching;
