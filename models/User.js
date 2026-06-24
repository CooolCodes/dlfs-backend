const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (email) => {
          const studentPattern = /^\d{9}@live\.unilag\.edu\.ng$/;
          const staffPattern = /^[a-zA-Z.]+@unilag\.edu\.ng$/;
          return studentPattern.test(email) || staffPattern.test(email);
        },
        message:
          "Email must be a valid UNILAG student (matricno@live.unilag.edu.ng) or staff (name@unilag.edu.ng) address",
      },
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    studentId: { type: String, trim: true },
    isVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);
