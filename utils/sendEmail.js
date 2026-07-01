const sendEmail = async ({ to, subject, html }) => {
  console.log('EMAIL_FROM value:', process.env.EMAIL_FROM);
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { email: process.env.EMAIL_FROM, name: 'DLFS' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Brevo error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  console.log('Email sent successfully to:', to);
};

module.exports = sendEmail;