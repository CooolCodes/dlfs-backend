const User = require('../models/User')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const sendEmail = require('../utils/sendEmail')

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  })
}

// Helper — generates a token, hashes it, sets a 24-hour expiry, and emails the link
const sendVerificationEmail = async (user) => {
  const verifyToken = crypto.randomBytes(32).toString('hex')

  user.emailVerifyToken = crypto
    .createHash('sha256')
    .update(verifyToken)
    .digest('hex')
  user.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  await user.save()

  const verifyURL = `${process.env.FRONTEND_URL}/verify-email/${verifyToken}`

  await sendEmail({
    to: user.email,
    subject: 'Verify your DLFS account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0D1B2A;">Welcome to DLFS</h2>
        <p>Hi ${user.name},</p>
        <p>Thanks for registering on the University of Lagos Digital Lost and Found System. Please confirm your email address to activate your account.</p>
        <a href="${verifyURL}"
          style="display:inline-block;margin:1.5rem 0;padding:0.75rem 1.5rem;
          background:#0A7E8C;color:#fff;border-radius:8px;
          text-decoration:none;font-weight:600;">
          Verify my email
        </a>
        <p style="color:#64748b;font-size:0.85rem;">
          This link expires in 24 hours. If you did not create this account, ignore this email.
        </p>
      </div>
    `,
  })
}

// POST /api/auth/register
const register = async (req, res) => {
  const { name, email, password, studentId } = req.body

  const studentPattern = /^\d{9}@live\.unilag\.edu\.ng$/
  const staffPattern = /^[a-zA-Z.]+@unilag\.edu\.ng$/
  const normalizedEmail = email?.toLowerCase().trim()

  if (!normalizedEmail || (!studentPattern.test(normalizedEmail) && !staffPattern.test(normalizedEmail))) {
    return res.status(400).json({
      message: 'Email must be a valid UNILAG student (matricno@live.unilag.edu.ng) or staff (name@unilag.edu.ng) address',
    })
  }

  const role = studentPattern.test(normalizedEmail) ? 'student' : 'staff'

  try {
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists' })
    }

    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      studentId,
      role,
    })

    await sendVerificationEmail(user)

    // No token issued at registration — user must verify first
    res.status(201).json({
      message: 'Account created. Please check your email to verify your account before signing in.',
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
}

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body

  try {
    const user = await User.findOne({ email: email?.toLowerCase().trim() })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before signing in. Check your inbox for the verification link.',
        unverified: true,
      })
    }

    res.json({
      message: 'Login successful',
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
}

// GET /api/auth/verify-email/:token
const verifyEmail = async (req, res) => {
  const { token } = req.params

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({
        message: 'Verification link is invalid or has expired. Please request a new one.',
      })
    }

    user.isVerified = true
    user.emailVerifyToken = undefined
    user.emailVerifyExpires = undefined
    await user.save()

    res.json({ message: 'Email verified successfully. You can now sign in.' })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
}

// POST /api/auth/resend-verification
const resendVerification = async (req, res) => {
  const { email } = req.body

  try {
    const user = await User.findOne({ email: email?.toLowerCase().trim() })

    // Same response whether the user exists or not — avoids email enumeration
    if (!user || user.isVerified) {
      return res.json({
        message: 'If that email is registered and unverified, a new verification link has been sent.',
      })
    }

    await sendVerificationEmail(user)

    res.json({
      message: 'If that email is registered and unverified, a new verification link has been sent.',
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
}

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const { email } = req.body

  try {
    const user = await User.findOne({ email: email?.toLowerCase().trim() })

    if (!user) {
      return res.json({
        message: 'If that email is registered you will receive a reset link shortly.',
      })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')

    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex')

    user.passwordResetExpires = Date.now() + 30 * 60 * 1000
    await user.save()

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`

    await sendEmail({
      to: user.email,
      subject: 'DLFS Password Reset',
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
    })

    res.json({
      message: 'If that email is registered you will receive a reset link shortly.',
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error. Please try again.' })
  }
}

// POST /api/auth/reset-password/:token
const resetPassword = async (req, res) => {
  const { password } = req.body
  const { token } = req.params

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({
        message: 'Reset link is invalid or has expired. Please request a new one.',
      })
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters.',
      })
    }

    const salt = await bcrypt.genSalt(10)
    user.passwordHash = await bcrypt.hash(password, salt)

    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()

    res.json({ message: 'Password reset successful. You can now log in.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error. Please try again.' })
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
}