import 'dotenv/config';
import nodemailer from 'nodemailer';

async function testSmtpCustomFrom() {
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
    const info = await transporter.sendMail({
      from: '"Ramazanoğlu Tech Relations" <contact@ramazanoglu.tech>',
      sender: (process.env.SMTP_USER || process.env.IMAP_USER || ''),
      replyTo: 'contact@ramazanoglu.tech',
      to: (process.env.SMTP_USER || process.env.IMAP_USER || ''),
      subject: 'Test Custom From Domain',
      text: 'Testing contact@ramazanoglu.tech from header',
    });
    console.log('Send custom from success! MessageId:', info.messageId);
  } catch (err) {
    console.error('SMTP custom from error:', err);
  }
}

testSmtpCustomFrom();
