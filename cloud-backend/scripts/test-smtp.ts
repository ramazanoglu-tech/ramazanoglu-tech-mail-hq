import 'dotenv/config';
import nodemailer from 'nodemailer';

async function testSmtp() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: (process.env.SMTP_USER || process.env.IMAP_USER || ''),
      pass: (process.env.SMTP_PASSWORD || process.env.IMAP_PASSWORD || '').replace(/\s+/g, ''),
    },
  });

  try {
    const verified = await transporter.verify();
    console.log('SMTP connection verified:', verified);

    const info = await transporter.sendMail({
      from: `"Ramazanoğlu Tech" <${process.env.SMTP_USER}>`,
      replyTo: 'contact@ramazanoglu.tech',
      to: (process.env.SMTP_USER || process.env.IMAP_USER || ''),
      subject: 'Test Ramazanoğlu Tech SMTP',
      text: 'Hello from Ramazanoğlu Tech Mail HQ!',
    });
    console.log('Send success! MessageId:', info.messageId);
  } catch (err) {
    console.error('SMTP test error:', err);
  }
}

testSmtp();
