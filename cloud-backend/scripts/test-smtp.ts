import nodemailer from 'nodemailer';

async function testSmtp() {
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
    const verified = await transporter.verify();
    console.log('SMTP connection verified:', verified);

    const info = await transporter.sendMail({
      from: '"Ramazanoğlu Tech" <yousefalrmdan@gmail.com>',
      replyTo: 'contact@ramazanoglu.tech',
      to: 'yousefalrmdan@gmail.com',
      subject: 'Test Ramazanoğlu Tech SMTP',
      text: 'Hello from Ramazanoğlu Tech Mail HQ!',
    });
    console.log('Send success! MessageId:', info.messageId);
  } catch (err) {
    console.error('SMTP test error:', err);
  }
}

testSmtp();
