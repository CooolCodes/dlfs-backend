const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Extract token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify it
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to the request (excluding password)
      req.user = await User.findById(decoded.id).select("-passwordHash");

      next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorised, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorised, no token" });
  }
};

// Admin-only access
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied: admins only" });
  }
};

module.exports = { protect, adminOnly };
