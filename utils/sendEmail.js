const Brevo = require('@getbrevo/brevo')

const sendEmail = async ({ to, subject, html }) => {
  const apiInstance = new Brevo.TransactionalEmailsApi()

  apiInstance.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY

  const sendSmtpEmail = new Brevo.SendSmtpEmail()

  sendSmtpEmail.subject = subject
  sendSmtpEmail.htmlContent = html
  sendSmtpEmail.sender = {
    name: 'DLFS UniLag',
    email: process.env.EMAIL_USER,
  }
  sendSmtpEmail.to = [{ email: to }]

  await apiInstance.sendTransacEmail(sendSmtpEmail)
}

module.exports = sendEmail