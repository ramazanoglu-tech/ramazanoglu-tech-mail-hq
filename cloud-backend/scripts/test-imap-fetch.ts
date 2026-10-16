import 'dotenv/config';
import imaps from 'imap-simple';

async function inspectLatestMails() {
  const config = {
    imap: {
      user: (process.env.SMTP_USER || process.env.IMAP_USER || ''),
      password: (process.env.SMTP_PASSWORD || process.env.IMAP_PASSWORD || '').replace(/\s+/g, ''),
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: true },
      authTimeout: 15000,
    },
  };

  const connection = await imaps.connect(config);
  const box = await connection.openBox('INBOX');
  const total = box.messages.total;
  console.log('Total messages in INBOX:', total);

  // Search only the last 15 messages by sequence
  const startSeq = Math.max(1, total - 15);
  const searchCriteria = [[`${startSeq}:${total}`]];

  const fetchOptions = {
    bodies: ['HEADER'],
    struct: true,
  };

  const messages = await connection.search(searchCriteria, fetchOptions);
  console.log('Fetched messages count:', messages.length);

  for (const msg of messages) {
    const headerPart = msg.parts.find((p) => p.which === 'HEADER');
    const headers = headerPart ? headerPart.body : {};
    console.log('----------------------------------------');
    console.log('DATE:', headers.date ? headers.date[0] : '');
    console.log('FROM:', headers.from ? headers.from[0] : '');
    console.log('TO:', headers.to ? headers.to[0] : '');
    console.log('DELIVERED-TO:', headers['delivered-to'] ? headers['delivered-to'][0] : '');
    console.log('SUBJECT:', headers.subject ? headers.subject[0] : '');
  }

  connection.end();
}

inspectLatestMails();
