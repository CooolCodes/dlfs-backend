const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM, // must be a verified domain on Resend, or use their default onboarding domain for testing
    to,
    subject,
    html,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(error.message);
  }

  console.log('Email sent:', data.id);
};

module.exports = sendEmail;