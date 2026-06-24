const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

// Helper: generate a JWT token for a user
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// POST /api/auth/register
const register = async (req, res) => {
  const { name, email, password, studentId } = req.body;
  // Check institutional email
  const studentPattern = /^\d{9}@live\.unilag\.edu\.ng$/;
  const staffPattern = /^[a-zA-Z.]+@unilag\.edu\.ng$/;
  const normalizedEmail = email?.toLowerCase().trim();

  if (
    !normalizedEmail ||
    (!studentPattern.test(normalizedEmail) &&
      !staffPattern.test(normalizedEmail))
  ) {
    return res.status(400).json({
      message:
        "Email must be a valid UNILAG student (matricno@live.unilag.edu.ng) or staff (name@unilag.edu.ng) address",
    });
  }

  // Automatically assign role based on email format
  const role = studentPattern.test(normalizedEmail) ? "student" : "staff";
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "An account with this email already exists" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create the user
    const user = await User.create({
      name,
      email,
      passwordHash,
      studentId,
    });

    // Respond with token
    res.status(201).json({
      message: "Account created successfully",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Respond with token
    res.json({
      message: "Login successful",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email?.toLowerCase().trim() });

    // Always respond the same way whether user exists or not
    // This prevents email enumeration attacks
    if (!user) {
      return res.json({
        message:
          "If that email is registered you will receive a reset link shortly.",
      });
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash it before saving to the database
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Token expires in 30 minutes
    user.passwordResetExpires = Date.now() + 30 * 60 * 1000;
    await user.save();

    // Send the email
    const resetURL = `http://localhost:5173/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "DLFS Password Reset",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #0D1B2A;">Reset your password</h2>
          <p>You requested a password reset for your DLFS account.</p>
          <p>Click the button below to set a new password. This link expires in 30 minutes.</p>
          <a href="${resetURL}"
            style="display:inline-block;margin:1.5rem 0;padding:0.75rem 1.5rem;
            background:#0A7E8C;color:#fff;border-radius:8px;
            text-decoration:none;font-weight:600;">
            Reset Password
          </a>
          <p style="color:#64748b;font-size:0.85rem;">
            If you did not request this, ignore this email.
            Your password will not change.
          </p>
        </div>
      `,
    });

    res.json({
      message:
        "If that email is registered you will receive a reset link shortly.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
};

// POST /api/auth/reset-password/:token
const resetPassword = async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;

  try {
    // Hash the token from the URL to compare with the stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with matching token that hasn't expired
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message:
          "Reset link is invalid or has expired. Please request a new one.",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    // Hash and save the new password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);

    // Clear the reset token fields
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
};
module.exports = { register, login, forgotPassword, resetPassword };
