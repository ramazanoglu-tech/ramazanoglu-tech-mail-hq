// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - SIMULATE INCOMING MAIL SCRIPT
// =============================================================================

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8765';

const sampleEmails = [
  {
    alias_target: 'yusuf@ramazanoglu.tech',
    from_name: 'Dr. Aris Thorne',
    from_address: 'a.thorne@oxford-research.ac.uk',
    subject: 'Follow-up: High-Concurrency State Replication Whitepaper',
    body_html: '<p>Dear Yusuf,</p><p>We have concluded our benchmarks on the peer-to-peer consensus layer. The results match your predictions in Section 4.3 with sub-millisecond p99 latencies.</p><p>Shall we coordinate an advisory call this Thursday?</p><p>Sincerely,<br>Dr. Aris Thorne<br>Department of Computer Science, University of Oxford</p>',
  },
  {
    alias_target: 'info@ramazanoglu.tech',
    from_name: 'Sophia Lindqvist',
    from_address: 'sophia.l@nordic-invest.se',
    subject: 'Inquiry: Ramazanoğlu Tech Enterprise Licensing Terms',
    body_html: '<p>Hi Ramazanoğlu Tech Desk,</p><p>We are evaluating your Super Admin infrastructure for deployment across our Scandinavian cloud region. Could you provide the master enterprise SLA document and procurement schedule?</p><p>Regards,<br>Sophia Lindqvist<br>Nordic Capital Partners</p>',
  },
  {
    alias_target: 'support@ramazanoglu.tech',
    from_name: 'Viktor Krumm',
    from_address: 'v.krumm@berlin-telematics.de',
    subject: '[TICKET #4902] Webhook Signature Verification in Rust SDK',
    body_html: '<p>Hello Support Team,</p><p>We are integrating the incoming WebSocket stream with our Rust worker services. Is the HMAC header computed with SHA-256 or SHA-512? Documentation mentions both in v1.2.</p><p>Viktor Krumm<br>Senior Infrastructure Engineer</p>',
  },
  {
    alias_target: 'billing@ramazanoglu.tech',
    from_name: 'Oracle Cloud Accounts',
    from_address: 'invoicing@oracle.com',
    subject: 'OCI Enterprise Cluster Billing Statement - Cycle Oct 2026',
    body_html: '<p>Dear Ramazanoğlu Technologies Finance Team,</p><p>Your automated invoice for dedicated bare-metal GPU clusters has been generated. Total balance: $28,490.00. Payment method: Corporate Wire Transfer.</p><p>Oracle Cloud Finance</p>',
  },
];

async function simulate() {
  const sample = sampleEmails[Math.floor(Math.random() * sampleEmails.length)];
  console.log(`[SIMULATE] Sending mock inbound email to ${sample.alias_target}...`);

  try {
    const res = await fetch(`${BACKEND_URL}/api/dev/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample),
    });

    const data = await res.json();
    console.log('[SIMULATE SUCCESS] Response from Cloud Backend:');
    console.log(data);
  } catch (err) {
    console.error('[SIMULATE ERROR] Is the backend running? Failed to fetch:', err);
  }
}

simulate();
