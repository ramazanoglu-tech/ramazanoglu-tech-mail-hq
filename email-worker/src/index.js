// Cloudflare Email Routing -> Mail HQ.
// Every mail sent to *@ramazanoglu.tech reaches email(); we POST the raw MIME to the backend, signed with HMAC.
// If the backend cannot be reached we reject the message (sender gets a bounce) instead of losing it silently.

const MAX_BYTES = 25 * 1024 * 1024;

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async email(message, env) {
    if (!env.INBOUND_WEBHOOK_SECRET || !env.INBOUND_URL) {
      message.setReject('Mail system not configured');
      return;
    }
    if (message.rawSize > MAX_BYTES) {
      message.setReject('Message too large');
      return;
    }

    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer()); // stream is single-use
    const to = message.to.toLowerCase();
    const from = message.from.toLowerCase();
    const timestamp = String(Math.floor(Date.now() / 1000));

    const prefix = new TextEncoder().encode(`${timestamp}\n${to}\n${from}\n`);
    const signed = new Uint8Array(prefix.length + raw.length);
    signed.set(prefix, 0);
    signed.set(raw, prefix.length);
    const signature = await hmacHex(env.INBOUND_WEBHOOK_SECRET, signed);

    let res;
    try {
      res = await fetch(env.INBOUND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'message/rfc822',
          'X-Timestamp': timestamp,
          'X-Signature': signature,
          'X-Envelope-To': to,
          'X-Envelope-From': from,
        },
        body: raw,
      });
    } catch {
      message.setReject('Temporary failure, please retry later');
      return;
    }
    if (!res.ok) message.setReject('Temporary failure, please retry later');
  },
};
