const nodemailer = require("nodemailer");
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const sendEmail = async ({ to, subject, html }) => {
  console.log("Attempting to send email to:", to);
  console.log("Using Gmail account:", process.env.EMAIL_USER);

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    family: 4,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log("SMTP connection verified successfully");
  } catch (err) {
    console.error("SMTP verification failed:", err.message);
    throw err;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });

  console.log("Email sent successfully");
};

module.exports = sendEmail;
