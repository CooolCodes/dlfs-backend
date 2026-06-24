const Item = require("../models/Item");

// POST /api/items  — submit a new lost or found report
const createItem = async (req, res) => {
  console.log("Body:", req.body);
  console.log("Files:", req.files);
  const {
    type,
    category,
    title,
    description,
    location,
    dateOccurred,
    verificationNote,
  } = req.body;

  // trim all string fields so stray spaces never break validation
  const cleanType = type?.trim();
  const cleanCategory = category?.trim();
  const cleanTitle = title?.trim();

  try {
    const item = await Item.create({
      reportedBy: req.user._id,
      type,
      category,
      title,
      description,
      location,
      dateOccurred,
      verificationNote,
      images: req.processedImages || [],
    });

    res.status(201).json({ message: "Report submitted successfully", item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/items  — search and browse approved items
const getItems = async (req, res) => {
  const { type, category, location, keyword, page = 1, limit = 12 } = req.query;

  try {
    const query = { status: "approved" };

    if (type) query.type = type;
    if (category) query.category = category;
    if (location) query.location = new RegExp(location, "i");
    if (keyword) query.$text = { $search: keyword };

    const total = await Item.countDocuments(query);
    const items = await Item.find(query)
      .populate("reportedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      items,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/items/:id  — get a single item by ID
const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate(
      "reportedBy",
      "name email",
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Never expose the verification note to the public
    const itemObj = item.toObject();
    if (!req.user || req.user.role !== "admin") {
      delete itemObj.verificationNote;
    }

    res.json(itemObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/items/my  — get the logged-in user's own reports
const getMyItems = async (req, res) => {
  try {
    const items = await Item.find({ reportedBy: req.user._id }).sort({
      createdAt: -1,
    });

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createItem, getItems, getItemById, getMyItems };
