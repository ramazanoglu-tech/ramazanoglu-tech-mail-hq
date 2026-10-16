import nodemailer from 'nodemailer';

async function testSmtpCustomFrom() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'yousefalrmdan@gmail.com',
      pass: 'szzbbtagyywlgxlg',
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"Ramazanoğlu Tech Relations" <contact@ramazanoglu.tech>',
      sender: 'yousefalrmdan@gmail.com',
      replyTo: 'contact@ramazanoglu.tech',
      to: 'yousefalrmdan@gmail.com',
      subject: 'Test Custom From Domain',
      text: 'Testing contact@ramazanoglu.tech from header',
    });
    console.log('Send custom from success! MessageId:', info.messageId);
  } catch (err) {
    console.error('SMTP custom from error:', err);
  }
}

testSmtpCustomFrom();
