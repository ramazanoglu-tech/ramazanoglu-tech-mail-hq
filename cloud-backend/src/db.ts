// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - CLOUD DATABASE REPOSITORY (POSTGRESQL & FALLBACK)
// =============================================================================

import { Pool, QueryResult } from 'pg';
import { config } from './config.js';
import { Email, EmailAlias, EmailAttachment } from './types.js';

let pool: Pool | null = null;
let isConnectedToPostgres = false;

// In-Memory fallback store with the complete 54-alias corporate Swiss matrix
function makeSwissSig(name: string, title: string, badge: string, email: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Inter', -apple-system, sans-serif; font-size: 13px; color: #111111; line-height: 1.5; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E2DF; max-width: 560px;">
  <tr>
    <td style="padding-bottom: 6px;">
      <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #111111;">RAMAZANOĞLU TECH</span>
      <span style="display: inline-block; width: 6px; height: 6px; background-color: #D9381E; margin-left: 3px; vertical-align: 1px;"></span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: #111111; background-color: #F3F3EF; padding: 2px 6px; border: 1px solid #E2E2DF; margin-left: 8px;">${badge}</span>
    </td>
  </tr>
  <tr>
    <td style="color: #111111; font-weight: 600; font-size: 13px;">${name}</td>
  </tr>
  <tr>
    <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #555555; padding-top: 2px;">
      ${title} &bull; <a href="mailto:${email}" style="color: #555555; text-decoration: underline; text-underline-offset: 3px;">${email}</a>
    </td>
  </tr>
  <tr>
    <td style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #888884; padding-top: 6px; letter-spacing: 0.5px;">
      R&amp;D AND ENGINEERING PRACTICE &bull; TÜRKİYE &bull; UTC+3 &bull; <a href="https://ramazanoglu.tech" style="color: #888884; text-decoration: underline;">ramazanoglu.tech</a>
    </td>
  </tr>
</table>`;
}

const rawAliasDefinitions = [
  // 0. Kurucu & Ortak (Founders & Executive Partners)
  { email: 'yusuf@ramazanoglu.tech', name: 'Yusuf Ramazanoğlu', title: 'Founder & Chief Architect', badge: '[YUSUF]' },
  { email: 'nur@ramazanoglu.tech', name: 'Nur Ramazanoğlu', title: 'Managing Partner & Co-Founder', badge: '[NUR]' },

  // 1. Genel İletişim (General Contact)
  { email: 'contact@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Contact', title: 'Global Relations & Partnerships', badge: '[CONTACT]' },
  { email: 'iletisim@ramazanoglu.tech', name: 'Ramazanoğlu Tech • İletişim', title: 'Kurumsal İletişim Koordinatörlüğü', badge: '[İLETİŞİM]' },

  // 2. Genel Bilgi (General Info)
  { email: 'info@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Desk', title: 'General Inquiries & Information', badge: '[INFO]' },
  { email: 'bilgi@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Bilgi', title: 'Genel Bilgi ve Danışma Masası', badge: '[BİLGİ]' },

  // 3. Karşılama & Networking (Modern Welcome)
  { email: 'hello@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Hello', title: 'Modern Tech & Community Networking', badge: '[HELLO]' },
  { email: 'merhaba@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Merhaba', title: 'Karşılama ve Topluluk İletişimi', badge: '[MERHABA]' },

  // 4. Ar-Ge & İleri Mühendislik (R&D & Engineering)
  { email: 'rd@ramazanoglu.tech', name: 'Ramazanoğlu Tech • R&D Practice', title: 'Applied AI & Mission-Critical Systems', badge: '[R&D]' },
  { email: 'arge@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Ar-Ge', title: 'Araştırma ve İleri Teknoloji Geliştirme', badge: '[AR-GE]' },

  // 5. Yazılım Geliştirme (Software Engineering)
  { email: 'dev@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Dev Team', title: 'Core Systems Programming & APIs', badge: '[DEV]' },
  { email: 'yazilim@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Yazılım', title: 'Yazılım Mühendisliği ve Çekirdek Sistemler', badge: '[YAZILIM]' },

  // 6. Robotik & Otonom Sistemler (Robotics & Autonomy)
  { email: 'robotics@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Robotics', title: 'Autonomous Surface & Ground Robotics', badge: '[ROBOTICS]' },
  { email: 'robotik@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Robotik', title: 'Otonom Araçlar ve Robotik Sistemler', badge: '[ROBOTİK]' },

  // 7. Uzay & Havacılık (Aerospace & Space Camel)
  { email: 'space@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Space Camel', title: 'Aerospace Systems & Propulsion Engineering', badge: '[SPACE]' },
  { email: 'uzay@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Uzay & Havacılık', title: 'Space Camel Roketçilik ve Aviyonik', badge: '[UZAY]' },

  // 8. Laboratuvar & Test (Systems Laboratory)
  { email: 'labs@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Labs', title: 'Experimental Hardware & 3D Prototyping', badge: '[LABS]' },
  { email: 'laboratuvar@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Laboratuvar', title: 'Test, Ölçüm ve Donanım Altyapısı', badge: '[LAB]' },

  // 9. Siber Güvenlik (Cybersecurity & Zero-Trust)
  { email: 'security@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Cybersecurity', title: 'Zero-Trust Architecture & SecOps', badge: '[SECURITY]' },
  { email: 'guvenlik@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Siber Güvenlik', title: 'Sistem Güvenliği ve Kriptografik Denetim', badge: '[GÜVENLİK]' },

  // 10. Bulut & Altyapı (Cloud Infrastructure)
  { email: 'cloud@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Cloud', title: 'Distributed Edge Compute & Cloud Systems', badge: '[CLOUD]' },
  { email: 'bulut@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Bulut', title: 'Bulut Altyapısı ve Sunucu Yönetimi', badge: '[BULUT]' },

  // 11. Ticari Satış (Enterprise Sales)
  { email: 'sales@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Sales', title: 'Enterprise Solutions & Commercial Licensing', badge: '[SALES]' },
  { email: 'satis@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Satış', title: 'Kurumsal Ürün ve Hizmet Satışları', badge: '[SATIŞ]' },

  // 12. Stratejik Ortaklıklar (Strategic Alliances)
  { email: 'partners@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Partners', title: 'Strategic Alliances & Joint Ventures', badge: '[PARTNERS]' },
  { email: 'ortaklik@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Ortaklık', title: 'Stratejik İş Ortaklıkları ve Sponsorluklar', badge: '[ORTAKLIK]' },

  // 13. Kurumsal Çözümler (B2B Solutions)
  { email: 'b2b@ramazanoglu.tech', name: 'Ramazanoğlu Tech • B2B', title: 'Custom Mission-Critical Software Engagements', badge: '[B2B]' },
  { email: 'kurumsal@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Kurumsal', title: 'Kurumsal Çözümler ve Özel Proje Teklifleri', badge: '[KURUMSAL]' },

  // 14. Yatırım & Fonlar (Investor Relations)
  { email: 'invest@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Ventures', title: 'Investor Relations & Grant Programs', badge: '[INVEST]' },
  { email: 'yatirim@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Yatırım', title: 'Yatırımcı İlişkileri, TÜBİTAK ve Fon Yönetimi', badge: '[YATIRIM]' },

  // 15. Faturalandırma (Billing & Subscriptions)
  { email: 'billing@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Billing', title: 'Cloud Subscriptions & Invoicing', badge: '[BILLING]' },
  { email: 'fatura@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Fatura', title: 'Bulut Servisleri ve Abonelik Faturaları', badge: '[FATURA]' },

  // 16. Genel Finans (Finance & Treasury)
  { email: 'finance@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Finance', title: 'Treasury & Corporate Financial Planning', badge: '[FINANCE]' },
  { email: 'finans@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Finans', title: 'Şirket Finansmanı ve Bütçe Yönetimi', badge: '[FİNANS]' },

  // 17. Muhasebe (Accounting & Fiscal)
  { email: 'accounting@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Accounting', title: 'Fiscal Compliance & Corporate Books', badge: '[ACC]' },
  { email: 'muhasebe@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Muhasebe', title: 'Mali Müşavirlik ve Resmi Vergi İşleri', badge: '[MUHASEBE]' },

  // 18. Hukuk & Telif (Legal, IP & Compliance)
  { email: 'legal@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Legal', title: 'Intellectual Property, Patents & Compliance', badge: '[LEGAL]' },
  { email: 'hukuk@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Hukuk', title: 'Sözleşmeler, Fikri Mülkiyet, Patent ve KVKK', badge: '[HUKUK]' },

  // 19. Teknik Destek (Support SLA)
  { email: 'support@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Support SLA', title: 'Tier-1/2 Technical Support & Incident SLA', badge: '[SUPPORT]' },
  { email: 'destek@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Destek', title: 'Teknik Destek ve Uygulama Çözüm Masası', badge: '[DESTEK]' },

  // 20. Yardım Masası (Helpdesk & Guidance)
  { email: 'help@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Helpdesk', title: 'Knowledge Base & Customer Assistance', badge: '[HELP]' },
  { email: 'yardim@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Yardım', title: 'Kullanım Kılavuzları ve Kullanıcı Yardımı', badge: '[YARDIM]' },

  // 21. Operasyon & Saha Lojistiği (Operations)
  { email: 'operations@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Operations', title: 'Field Operations & Mission Logistics', badge: '[OPS]' },
  { email: 'operasyon@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Operasyon', title: 'Saha Testleri ve Tedarik Lojistiği', badge: '[OPERASYON]' },

  // 22. Şirket Yönetimi (Executive Office)
  { email: 'admin@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Executive Admin', title: 'Executive Operations & Governance', badge: '[ADMIN]' },
  { email: 'yonetim@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Yönetim', title: 'Şirket Yönetim Masası ve İdari İşler', badge: '[YÖNETİM]' },

  // 23. Kariyer & İK (Talent Acquisition)
  { email: 'careers@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Careers', title: 'Engineering & Research Talent Acquisition', badge: '[CAREERS]' },
  { email: 'kariyer@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Kariyer', title: 'Mühendis ve Araştırmacı Başvuruları', badge: '[KARİYER]' },

  // 24. Stajyer Programı (Student Fellowship)
  { email: 'intern@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Fellowship', title: 'Student Research & Engineering Internship', badge: '[INTERN]' },
  { email: 'staj@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Staj Programı', title: 'Üniversite/Lise Mühendislik Stajı Başvuruları', badge: '[STAJ]' },

  // 25. Basın & Medya (Press Office)
  { email: 'press@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Press', title: 'Official Press Office & Media Releases', badge: '[PRESS]' },
  { email: 'basin@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Basın', title: 'Basın Bültenleri ve Medya İletişimi', badge: '[BASIN]' },

  // 26. Sosyal Medya & İçerik (Media & Creative)
  { email: 'media@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Media', title: 'Digital Media Production & Visual Assets', badge: '[MEDIA]' },
  { email: 'medya@ramazanoglu.tech', name: 'Ramazanoğlu Tech • Medya', title: 'Dijital İçerik, Video ve Sosyal Yayınlar', badge: '[MEDYA]' },
];

const mockAliases: EmailAlias[] = rawAliasDefinitions.map((def, idx) => ({
  id: `a0000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`,
  email: def.email,
  display_name: def.name,
  department_badge: def.badge,
  signature_html: makeSwissSig(def.name, def.title, def.badge, def.email),
  is_active: true,
  created_at: new Date().toISOString(),
}));

const mockEmails: Email[] = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    message_id: '<init-cloud-001@ramazanoglu.tech>',
    thread_id: '<init-cloud-001@ramazanoglu.tech>',
    alias_target: 'yusuf@ramazanoglu.tech',
    from_name: 'Elena Rostova',
    from_address: 'e.rostova@quantum-zurich.ch',
    to_addresses: ['yusuf@ramazanoglu.tech'],
    cc_addresses: ['info@ramazanoglu.tech'],
    bcc_addresses: [],
    subject: 'Strategic Enterprise Partnership - Q4 Distributed Systems Infrastructure',
    body_text: 'Dear Yusuf,\n\nFollowing up on our symposium discussion in Zurich regarding the high-concurrency architecture. We are prepared to proceed with the enterprise contract integration.\n\nPlease review the attached specifications.\n\nBest regards,\nElena Rostova',
    body_html: '<p>Dear Yusuf,</p><p>Following up on our symposium discussion in Zurich regarding the high-concurrency architecture. We are prepared to proceed with the enterprise contract integration.</p><p>Please review the specifications and let us know your availability for a technical alignment session.</p><p>Best regards,<br><strong>Elena Rostova</strong><br><span style="color: #666662; font-size: 12px;">Chief Systems Engineer, Quantum Zurich</span></p>',
    is_read: false,
    is_starred: true,
    is_archived: false,
    direction: 'INBOUND',
    received_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    attachments: [
      {
        id: 'att-001',
        email_id: 'e0000000-0000-0000-0000-000000000001',
        filename: 'Quantum_Enterprise_Specs_v2.pdf',
        mime_type: 'application/pdf',
        size_bytes: 418290,
        cloud_storage_url: 'https://storage.ramazanoglu.tech/attachments/Quantum_Enterprise_Specs_v2.pdf',
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    message_id: '<init-cloud-002@ramazanoglu.tech>',
    thread_id: '<init-cloud-002@ramazanoglu.tech>',
    alias_target: 'support@ramazanoglu.tech',
    from_name: 'Marcus Vance',
    from_address: 'm.vance@nordic-telecom.se',
    to_addresses: ['support@ramazanoglu.tech'],
    cc_addresses: [],
    bcc_addresses: [],
    subject: '[SLA-P1] API Gateway WebSocket Latency Verification',
    body_text: 'Hello Ramazanoğlu Support Team,\n\nWe noticed a sub-10ms latency shift on node cluster EU-Central-1 after the latest firmware deployment. All health checks remain green.\n\nMarcus Vance, Nordic Telecom Ops',
    body_html: '<p>Hello Ramazanoğlu Support Team,</p><p>We noticed a sub-10ms latency shift on node cluster <code>EU-Central-1</code> after the latest firmware deployment. All health checks remain green. Can you verify telemetry logs?</p><p>Marcus Vance<br><span style="color: #666662; font-size: 12px;">Nordic Telecom Operations</span></p>',
    is_read: true,
    is_starred: false,
    is_archived: false,
    direction: 'INBOUND',
    received_at: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    attachments: [],
  },
  {
    id: 'e0000000-0000-0000-0000-000000000003',
    message_id: '<init-cloud-003@ramazanoglu.tech>',
    thread_id: '<init-cloud-003@ramazanoglu.tech>',
    alias_target: 'billing@ramazanoglu.tech',
    from_name: 'Stripe Corporate Billing',
    from_address: 'invoices@stripe.com',
    to_addresses: ['billing@ramazanoglu.tech'],
    cc_addresses: [],
    bcc_addresses: [],
    subject: 'Invoice #RT-2026-1088 Paid Successfully ($14,250.00)',
    body_text: 'Your corporate subscription payment for Ramazanoğlu Tech Cloud Services has been processed successfully.',
    body_html: '<p>Your corporate subscription payment for <strong>Ramazanoğlu Technologies Inc.</strong> has been processed successfully.</p><table style="width: 100%; border: 1px solid #E2E2DC; border-collapse: collapse; margin: 12px 0;"><tr style="border-bottom: 1px solid #E2E2DC;"><td style="padding: 8px;">Invoice ID</td><td style="padding: 8px; font-family: monospace;">#RT-2026-1088</td></tr><tr style="border-bottom: 1px solid #E2E2DC;"><td style="padding: 8px;">Amount</td><td style="padding: 8px; font-weight: bold;">$14,250.00 USD</td></tr><tr><td style="padding: 8px;">Status</td><td style="padding: 8px; color: #111111;">PAID</td></tr></table>',
    is_read: true,
    is_starred: false,
    is_archived: false,
    direction: 'INBOUND',
    received_at: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    attachments: [],
  },
];

export async function initDatabase(): Promise<boolean> {
  if (config.mockMode) {
    console.log('[DB] MOCK_MODE=true: running with in-memory demo data (nothing is persisted).');
    isConnectedToPostgres = false;
    return false;
  }

  // Real mode: demo data must never be shown as real mail, and a missing DB must not be hidden.
  mockEmails.length = 0;
  if (!config.databaseUrl) {
    throw new Error('[DB] DATABASE_URL is required (or set MOCK_MODE=true for a throw-away demo).');
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();
  const res = await client.query('SELECT NOW() as current_time');
  client.release();

  isConnectedToPostgres = true;
  console.log(`[DB] Successfully connected to Cloud PostgreSQL at ${res.rows[0].current_time}`);
  return true;
}

export function isDbConnected(): boolean {
  return isConnectedToPostgres;
}

export async function getAliases(): Promise<EmailAlias[]> {
  if (isConnectedToPostgres && pool) {
    try {
      const res = await pool.query('SELECT * FROM aliases WHERE is_active = TRUE ORDER BY created_at ASC');
      return res.rows;
    } catch (err) {
      console.error('[DB] Error querying aliases from PostgreSQL:', err);
      if (!config.mockMode) throw err;
    }
  }
  return [...mockAliases];
}

export async function createAlias(aliasData: Partial<EmailAlias>): Promise<EmailAlias> {
  const newAlias: EmailAlias = {
    id: `a${Date.now()}`,
    email: (aliasData.email || '').toLowerCase().trim(),
    display_name: aliasData.display_name || 'Ramazanoğlu Tech Identity',
    department_badge: aliasData.department_badge || `[${aliasData.email?.split('@')[0]?.toUpperCase()}]`,
    signature_html: aliasData.signature_html || null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  if (isConnectedToPostgres && pool) {
    try {
      const res = await pool.query(
        `INSERT INTO aliases (email, display_name, department_badge, signature_html, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET is_active = TRUE
         RETURNING *`,
        [newAlias.email, newAlias.display_name, newAlias.department_badge, newAlias.signature_html, true]
      );
      return res.rows[0];
    } catch (err) {
      console.error('[DB] Error inserting alias into PostgreSQL:', err);
      if (!config.mockMode) throw err;
    }
  }

  mockAliases.push(newAlias);
  return newAlias;
}

export async function getEmails(params: {
  alias?: string;
  unread?: boolean;
  starred?: boolean;
  archived?: boolean;
  direction?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ emails: Email[]; total: number }> {
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  if (isConnectedToPostgres && pool) {
    try {
      const conditions: string[] = ['1=1'];
      const values: (string | boolean | number)[] = [];
      let valIdx = 1;

      if (params.alias && params.alias !== 'all' && params.alias !== 'master') {
        conditions.push(`LOWER(alias_target) = LOWER($${valIdx++})`);
        values.push(params.alias);
      }
      if (params.unread !== undefined) {
        conditions.push(`is_read = $${valIdx++}`);
        values.push(!params.unread); // if unread=true => is_read=false
      }
      if (params.starred !== undefined) {
        conditions.push(`is_starred = $${valIdx++}`);
        values.push(params.starred);
      }
      if (params.archived !== undefined) {
        conditions.push(`is_archived = $${valIdx++}`);
        values.push(params.archived);
      }
      if (params.direction) {
        conditions.push(`direction = $${valIdx++}`);
        values.push(params.direction);
      }
      if (params.search) {
        conditions.push(`(
          subject ILIKE $${valIdx} OR
          from_address ILIKE $${valIdx} OR
          from_name ILIKE $${valIdx} OR
          body_text ILIKE $${valIdx}
        )`);
        values.push(`%${params.search.replace(/[\\%_]/g, '\\$&')}%`);
        valIdx++;
      }

      const whereClause = conditions.join(' AND ');
      const countRes = await pool.query(`SELECT COUNT(*) FROM emails WHERE ${whereClause}`, values);
      const total = parseInt(countRes.rows[0].count, 10);

      const queryStr = `
        SELECT e.*, 
          COALESCE(
            json_agg(
              json_build_object(
                'id', a.id,
                'email_id', a.email_id,
                'filename', a.filename,
                'mime_type', a.mime_type,
                'size_bytes', a.size_bytes,
                'cloud_storage_url', a.cloud_storage_url,
                'created_at', a.created_at
              )
            ) FILTER (WHERE a.id IS NOT NULL), '[]'
          ) as attachments
        FROM emails e
        LEFT JOIN attachments a ON a.email_id = e.id
        WHERE ${whereClause}
        GROUP BY e.id
        ORDER BY e.received_at DESC
        LIMIT $${valIdx++} OFFSET $${valIdx++}
      `;
      values.push(limit, offset);

      const res = await pool.query(queryStr, values);
      return { emails: res.rows, total };
    } catch (err) {
      console.error('[DB] PostgreSQL error in getEmails:', err);
      if (!config.mockMode) throw err;
    }
  }

  // Fallback filtering on mockEmails
  let list = [...mockEmails];

  if (params.alias && params.alias !== 'all' && params.alias !== 'master') {
    list = list.filter((e) => e.alias_target.toLowerCase() === params.alias?.toLowerCase());
  }
  if (params.unread !== undefined) {
    list = list.filter((e) => (params.unread ? !e.is_read : e.is_read));
  }
  if (params.starred !== undefined) {
    list = list.filter((e) => e.is_starred === params.starred);
  }
  if (params.archived !== undefined) {
    list = list.filter((e) => e.is_archived === params.archived);
  }
  if (params.direction) {
    list = list.filter((e) => e.direction === params.direction);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.from_address.toLowerCase().includes(q) ||
        (e.from_name && e.from_name.toLowerCase().includes(q)) ||
        (e.body_text && e.body_text.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
  const total = list.length;
  const sliced = list.slice(offset, offset + limit);
  return { emails: sliced, total };
}

export async function getEmailById(id: string): Promise<Email | null> {
  if (isConnectedToPostgres && pool) {
    try {
      const res = await pool.query(
        `SELECT e.*, 
          COALESCE(
            json_agg(
              json_build_object(
                'id', a.id,
                'email_id', a.email_id,
                'filename', a.filename,
                'mime_type', a.mime_type,
                'size_bytes', a.size_bytes,
                'cloud_storage_url', a.cloud_storage_url,
                'created_at', a.created_at
              )
            ) FILTER (WHERE a.id IS NOT NULL), '[]'
          ) as attachments
        FROM emails e
        LEFT JOIN attachments a ON a.email_id = e.id
        WHERE e.id = $1
        GROUP BY e.id`,
        [id]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.error('[DB] PostgreSQL error in getEmailById:', err);
      if (!config.mockMode) throw err;
    }
  }

  return mockEmails.find((e) => e.id === id) || null;
}

export async function checkMessageExists(messageId: string): Promise<boolean> {
  if (isConnectedToPostgres && pool) {
    try {
      const res = await pool.query('SELECT 1 FROM emails WHERE message_id = $1 LIMIT 1', [messageId]);
      return res.rows.length > 0;
    } catch (err) {
      console.error('[DB] PostgreSQL error in checkMessageExists:', err);
      if (!config.mockMode) throw err;
    }
  }

  return mockEmails.some((e) => e.message_id === messageId);
}

export async function saveEmail(email: Omit<Email, 'id'>, attachments: Omit<EmailAttachment, 'id' | 'email_id'>[] = []): Promise<Email> {
  const generatedId = `e${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fullEmail: Email = {
    ...email,
    id: generatedId,
    attachments: attachments.map((att, i) => ({
      ...att,
      id: `att-${Date.now()}-${i}`,
      email_id: generatedId,
      created_at: new Date().toISOString(),
    })),
  };

  if (isConnectedToPostgres && pool) {
    try {
      const emailRes = await pool.query(
        `INSERT INTO emails (
          message_id, thread_id, alias_target, from_name, from_address,
          to_addresses, cc_addresses, bcc_addresses, subject, body_text,
          body_html, is_read, is_starred, is_archived, direction, received_at, raw_headers
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (message_id) DO NOTHING
        RETURNING *`,
        [
          fullEmail.message_id,
          fullEmail.thread_id,
          fullEmail.alias_target,
          fullEmail.from_name,
          fullEmail.from_address,
          fullEmail.to_addresses,
          fullEmail.cc_addresses,
          fullEmail.bcc_addresses,
          fullEmail.subject,
          fullEmail.body_text,
          fullEmail.body_html,
          fullEmail.is_read,
          fullEmail.is_starred,
          fullEmail.is_archived,
          fullEmail.direction,
          fullEmail.received_at,
          fullEmail.raw_headers ? JSON.stringify(fullEmail.raw_headers) : null,
        ]
      );

      if (emailRes.rows.length === 0) {
        // Same Message-ID already stored (IMAP re-poll race): return the existing row, do not duplicate
        const existing = await pool.query('SELECT * FROM emails WHERE message_id = $1', [fullEmail.message_id]);
        return { ...existing.rows[0], attachments: [] };
      }
      const savedDbEmail = emailRes.rows[0];

      if (attachments && attachments.length > 0) {
        const savedAttachments: EmailAttachment[] = [];
        for (const att of attachments) {
          const attRes = await pool.query(
            `INSERT INTO attachments (email_id, filename, mime_type, size_bytes, cloud_storage_url)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [savedDbEmail.id, att.filename, att.mime_type, att.size_bytes, att.cloud_storage_url]
          );
          savedAttachments.push(attRes.rows[0]);
        }
        savedDbEmail.attachments = savedAttachments;
      } else {
        savedDbEmail.attachments = [];
      }

      return savedDbEmail;
    } catch (err) {
      console.error('[DB] PostgreSQL error in saveEmail:', err);
      if (!config.mockMode) throw err;
    }
  }

  mockEmails.unshift(fullEmail);
  return fullEmail;
}

export async function updateEmailStatus(
  id: string,
  updates: Partial<Pick<Email, 'is_read' | 'is_starred' | 'is_archived'>>
): Promise<Email | null> {
  if (isConnectedToPostgres && pool) {
    try {
      const allowed = ['is_read', 'is_starred', 'is_archived'] as const;
      const keys = allowed.filter((k) => typeof updates[k] === 'boolean');
      if (keys.length === 0) return getEmailById(id);

      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = [id, ...keys.map((k) => updates[k])];

      const res = await pool.query(
        `UPDATE emails SET ${setClauses} WHERE id = $1 RETURNING *`,
        values
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.error('[DB] PostgreSQL error in updateEmailStatus:', err);
      if (!config.mockMode) throw err;
    }
  }

  const email = mockEmails.find((e) => e.id === id);
  if (email) {
    if (updates.is_read !== undefined) email.is_read = updates.is_read;
    if (updates.is_starred !== undefined) email.is_starred = updates.is_starred;
    if (updates.is_archived !== undefined) email.is_archived = updates.is_archived;
    return email;
  }
  return null;
}

export async function deleteEmail(id: string): Promise<boolean> {
  if (isConnectedToPostgres && pool) {
    try {
      const res = await pool.query('DELETE FROM emails WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('[DB] PostgreSQL error in deleteEmail:', err);
      if (!config.mockMode) throw err;
    }
  }

  const idx = mockEmails.findIndex((e) => e.id === id);
  if (idx !== -1) {
    mockEmails.splice(idx, 1);
    return true;
  }
  return false;
}

export async function getStats() {
  const aliases = await getAliases();
  const emailsResult = await getEmails({ limit: 1000 });
  const allEmails = emailsResult.emails;

  const aliasStats = aliases.map((al) => {
    const aliasEmails = allEmails.filter((e) => e.alias_target.toLowerCase() === al.email.toLowerCase());
    const unreadCount = aliasEmails.filter((e) => !e.is_read).length;
    return {
      alias: al.email,
      badge: al.department_badge,
      total: aliasEmails.length,
      unread: unreadCount,
    };
  });

  return {
    total_emails: allEmails.length,
    unread_total: allEmails.filter((e) => !e.is_read).length,
    inbound_total: allEmails.filter((e) => e.direction === 'INBOUND').length,
    outbound_total: allEmails.filter((e) => e.direction === 'OUTBOUND').length,
    alias_breakdown: aliasStats,
    database: isConnectedToPostgres ? 'POSTGRESQL_SUPABASE' : 'RESILIENT_IN_MEMORY',
  };
}
