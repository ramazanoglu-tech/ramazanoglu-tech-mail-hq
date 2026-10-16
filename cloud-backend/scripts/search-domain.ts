import 'dotenv/config';
import imaps from 'imap-simple';

async function searchRamazanoglu() {
  const config = {
    imap: {
      user: (process.env.SMTP_USER || process.env.IMAP_USER || ''),
      password: (process.env.SMTP_PASSWORD || process.env.IMAP_PASSWORD || '').replace(/\s+/g, ''),
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: true },
    },
  };

  const connection = await imaps.connect(config);
  await connection.openBox('INBOX');

  // Search for any message containing ramazanoglu
  const searchCriteria = [['TEXT', 'ramazanoglu']];
  const fetchOptions = { bodies: ['HEADER'] };

  const messages = await connection.search(searchCriteria, fetchOptions);
  console.log(`Found ${messages.length} message(s) containing 'ramazanoglu' in text/headers:`);

  for (const msg of messages.slice(-5)) {
    const headerPart = msg.parts.find((p) => p.which === 'HEADER');
    const h = headerPart ? headerPart.body : {};
    console.log(`- Subj: ${h.subject?.[0]} | From: ${h.from?.[0]} | To: ${h.to?.[0]}`);
  }

  connection.end();
}

searchRamazanoglu();
