// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - SWISS-STYLE ENTERPRISE EMAIL TEMPLATES
// Crafted strictly according to c:\Users\PC\Desktop\ramazanoglu-web\index.html
// Paper: #FBFBF9 | Muted: #F3F3EF | Ink: #111111 | Slate: #555555 | Hairline: #E2E2DF | Orange: #D9381E
// =============================================================================

export interface EmailTemplate {
  id: string;
  name: string;
  category: 'official' | 'engineering' | 'partnership' | 'security' | 'talent' | 'support';
  defaultSubject: string;
  description: string;
  htmlContent: string;
}

export const SWISS_EMAIL_TEMPLATES: EmailTemplate[] = [
  // 1. OFFICIAL CORPORATE BRIEFING
  {
    id: 'tpl-corporate-briefing',
    name: '01 // Kurumsal & Resmi İletişim (Corporate Briefing)',
    category: 'official',
    defaultSubject: 'Ramazanoğlu Tech // Kurumsal Bilgilendirme ve Resmi Yazışma',
    description: 'Resmi kurumlar, paydaşlar ve genel kurumsal yazışmalar için mimari ızgara şablonu.',
    htmlContent: `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FBFBF9; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #111111; margin: 0; padding: 24px 0;">
  <tr>
    <td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 640px; background-color: #FFFFFF; border: 1px solid #E2E2DF; text-align: left;">
        
        <!-- Top Metadata Strip -->
        <tr>
          <td style="padding: 12px 24px; border-bottom: 1px solid #E2E2DF; background-color: #F3F3EF; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555555;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="display: inline-block; width: 6px; height: 6px; background-color: #111111; vertical-align: middle; margin-right: 6px;"></span>
                  <span>OFFICIAL CORRESPONDENCE</span>
                </td>
                <td align="right" style="color: #888884;">
                  REF // RT-2026-SYS &bull; TÜRKİYE
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Header Brand Bar -->
        <tr>
          <td style="padding: 24px 28px; border-bottom: 1px solid #E2E2DF;">
            <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #111111;">RAMAZANOĞLU TECH</span>
            <span style="display: inline-block; width: 6px; height: 6px; background-color: #D9381E; margin-left: 4px; vertical-align: 1px;"></span>
            <span style="display: block; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884; margin-top: 4px; letter-spacing: 0.5px;">R&amp;D AND ENGINEERING PRACTICE</span>
          </td>
        </tr>

        <!-- Main Body Content -->
        <tr>
          <td style="padding: 32px 28px;">
            <h1 style="font-size: 22px; font-weight: 600; line-height: 1.3; color: #111111; margin: 0 0 16px 0; letter-spacing: -0.02em;">
              Sayın Yetkili / Değerli Paydaşımız,
            </h1>
            <p style="font-size: 14px; line-height: 1.6; color: #555555; margin: 0 0 16px 0;">
              Ramazanoğlu Tech bünyesinde yürütülen bağımsız mühendislik pratikleri, otonom sistemler ve görev-kritik yazılım mimarileri kapsamında resmi bilgilendirme metnimiz aşağıda yer almaktadır.
            </p>
            <div style="background-color: #F3F3EF; border-left: 3px solid #111111; border-top: 1px solid #E2E2DF; border-right: 1px solid #E2E2DF; border-bottom: 1px solid #E2E2DF; padding: 16px 20px; margin: 20px 0;">
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #111111; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">ÖZET VE GÜNDEM NOTU:</span>
              <p style="font-size: 13px; line-height: 1.6; color: #111111; margin: 0;">
                Bu alana resmi yazışmanızın özet maddelerini, mutabakat detaylarını ve toplantı kararlarını ekleyebilirsiniz.
              </p>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #555555; margin: 0 0 24px 0;">
              Konu hakkındaki geri bildirimlerinizi ve resmi evrak onaylarını bu e-posta zinciri üzerinden iletebilirsiniz.
            </p>
            <div style="margin-top: 28px;">
              <span style="font-size: 13px; font-weight: 600; color: #111111; display: block;">Saygılarımızla,</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #555555;">Ramazanoğlu Tech Yönetim Kurulu</span>
            </div>
          </td>
        </tr>

        <!-- Footer Strip -->
        <tr>
          <td style="padding: 16px 28px; background-color: #FBFBF9; border-top: 1px solid #E2E2DF; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #888884; line-height: 1.6;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>RAMAZANOĞLU TECH &bull; SWISS ARCHITECTURAL GRID REV. 2.4</td>
                <td align="right"><a href="https://ramazanoglu.tech" style="color: #888884; text-decoration: underline;">ramazanoglu.tech</a></td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
    `.trim(),
  },

  // 2. R&D & TECHNICAL SPECIFICATION
  {
    id: 'tpl-rd-spec',
    name: '02 // Ar-Ge & Mühendislik Spesifikasyonu (Technical Release)',
    category: 'engineering',
    defaultSubject: 'Ramazanoğlu Tech // Teknik Spesifikasyon ve Mimari Rapor [REF: RT-ENG]',
    description: 'Space Camel, Robotik, Cerrahi Navigasyon ve ROS2/CUDA mimari yayınları için teknik şablon.',
    htmlContent: `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FBFBF9; font-family: 'Inter', -apple-system, sans-serif; color: #111111; margin: 0; padding: 24px 0;">
  <tr>
    <td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 640px; background-color: #FFFFFF; border: 1px solid #E2E2DF; text-align: left;">
        
        <!-- Header Strip -->
        <tr>
          <td style="padding: 12px 24px; border-bottom: 1px solid #E2E2DF; background-color: #F3F3EF; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555555;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="display: inline-block; width: 6px; height: 6px; background-color: #D9381E; vertical-align: middle; margin-right: 6px;"></span>
                  <span>02 — R&amp;D TECHNICAL SPECIFICATION</span>
                </td>
                <td align="right" style="color: #888884;">DETERMINISTIC // RT-SPEC</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding: 24px 28px 16px 28px;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">SYSTEM ARCHITECTURES &amp; RESEARCH</div>
            <h1 style="font-size: 20px; font-weight: 700; color: #111111; margin: 0 0 12px 0;">
              Mühendislik Sürüm Notu &amp; Test Telemetrisi
            </h1>
            <p style="font-size: 13px; line-height: 1.6; color: #555555; margin: 0 0 20px 0;">
              Aşağıdaki parametreler laboratuvar ortamında sub-millimeter uzamsal tolerans ve deterministik çalışma kriterleri altında doğrulanmıştır.
            </p>
          </td>
        </tr>

        <!-- 3-Metric Hairline Grid -->
        <tr>
          <td style="padding: 0 28px 24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #E2E2DF; background-color: #F3F3EF;">
              <tr>
                <td width="33%" style="padding: 14px 16px; border-right: 1px solid #E2E2DF;">
                  <span style="display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #888884; text-transform: uppercase;">SPATIAL ACCURACY</span>
                  <span style="display: block; font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; color: #111111; margin-top: 4px;">&lt; 1.0 mm</span>
                  <span style="display: block; font-size: 11px; color: #555555; margin-top: 2px;">6-DoF Optical Tracking</span>
                </td>
                <td width="33%" style="padding: 14px 16px; border-right: 1px solid #E2E2DF;">
                  <span style="display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #888884; text-transform: uppercase;">LATENCY</span>
                  <span style="display: block; font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; color: #111111; margin-top: 4px;">&lt; 10 ms</span>
                  <span style="display: block; font-size: 11px; color: #555555; margin-top: 2px;">Sensor Fusion / ROS2</span>
                </td>
                <td width="34%" style="padding: 14px 16px;">
                  <span style="display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #888884; text-transform: uppercase;">SECURITY</span>
                  <span style="display: block; font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; color: #111111; margin-top: 4px;">ZERO-TRUST</span>
                  <span style="display: block; font-size: 11px; color: #555555; margin-top: 2px;">HWID AES-256 GCM</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Technical Description -->
        <tr>
          <td style="padding: 0 28px 28px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #E2E2DF;">
              <tr style="background-color: #F3F3EF;">
                <td style="padding: 8px 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; border-bottom: 1px solid #E2E2DF;">PARAMETRE</td>
                <td style="padding: 8px 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; border-bottom: 1px solid #E2E2DF;">DEĞER / VERSİYON</td>
                <td style="padding: 8px 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; border-bottom: 1px solid #E2E2DF;">DURUM</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #E2E2DF; font-family: 'JetBrains Mono', monospace;">C++ Core Framework</td>
                <td style="padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #E2E2DF; color: #555555;">C++20 / Qt 6.6.3 MSVC</td>
                <td style="padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #E2E2DF; font-weight: 600; color: #111111;">[VERIFIED]</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #E2E2DF; font-family: 'JetBrains Mono', monospace;">Cloud IMAP/SMTP Relay</td>
                <td style="padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #E2E2DF; color: #555555;">Node.js / TLS 1.3 Strict</td>
                <td style="padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #E2E2DF; font-weight: 600; color: #111111;">[ACTIVE 7/24]</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; font-size: 12px; font-family: 'JetBrains Mono', monospace;">Aero &amp; Autonomous State</td>
                <td style="padding: 10px 14px; font-size: 12px; color: #555555;">Clothoid EKF / Telemetry</td>
                <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #111111;">[TEST PASS]</td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
    `.trim(),
  },

  // 3. STRATEGIC PARTNERSHIP & SPONSORSHIP PROPOSAL
  {
    id: 'tpl-partnership',
    name: '03 // Stratejik Ortaklık & Sponsorluk (Partnership Proposal)',
    category: 'partnership',
    defaultSubject: 'Ramazanoğlu Tech // Stratejik İş Birliği ve Teknoloji Ortaklığı Teklifi',
    description: 'Yatırımcılar, üniversite kulüpleri, TEKNOFEST ve kurumsal sponsorluk görüşmeleri için teklif şablonu.',
    htmlContent: `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FBFBF9; font-family: 'Inter', -apple-system, sans-serif; color: #111111; margin: 0; padding: 24px 0;">
  <tr>
    <td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 640px; background-color: #FFFFFF; border: 1px solid #E2E2DF; text-align: left;">
        
        <tr>
          <td style="padding: 12px 24px; border-bottom: 1px solid #E2E2DF; background-color: #F3F3EF; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555555;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><span style="display: inline-block; width: 6px; height: 6px; background-color: #111111; vertical-align: middle; margin-right: 6px;"></span>STRATEGIC ALLIANCE &bull; B2B</td>
                <td align="right" style="color: #888884;">REF // RT-PARTNER</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 32px 28px;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888884;">İŞ BİRLİĞİ VE SPONSORLUK DAVETİ</span>
            <h1 style="font-size: 22px; font-weight: 700; color: #111111; margin: 8px 0 16px 0; letter-spacing: -0.02em;">
              Geleceğin Yüksek Hassasiyetli Sistemlerini Birlikte İnşa Edelim.
            </h1>
            <p style="font-size: 14px; line-height: 1.6; color: #555555; margin: 0 0 20px 0;">
              Ramazanoğlu Tech; cerrahi navigasyon, otonom mobil robotik ve Space Camel roketçilik alanlarında özgün algoritmalar ve görev-kritik mimariler geliştirmektedir. Kurumunuzun vizyonu ile mühendislik gücümüzü birleştirerek karşılıklı katma değer yaratmayı hedefliyoruz.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0; border: 1px solid #E2E2DF;">
              <tr>
                <td style="padding: 16px; background-color: #F3F3EF; border-bottom: 1px solid #E2E2DF;">
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #111111;">İŞ BİRLİĞİ KAPSAMI VE KAZANIMLAR</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px; font-size: 13px; line-height: 1.6; color: #555555;">
                  &bull; <strong>Teknoloji Entegrasyonu:</strong> Ortak Ar-Ge ve donanım test altyapısı paylaşımı.<br>
                  &bull; <strong>Sponsorluk &amp; Marka Görünürlüğü:</strong> Ulusal/uluslararası yarışmalarda ve bilimsel yayınlarda kurumsal temsil.<br>
                  &bull; <strong>Özel Yazılım Çözümleri:</strong> Kritik görev ve telemetri arayüzlerinin kurumunuza uyarlanması.
                </td>
              </tr>
            </table>

            <p style="font-size: 14px; line-height: 1.6; color: #555555; margin: 0 0 24px 0;">
              İş birliği modellerimizi detaylandırmak üzere online veya yüz yüze teknik değerlendirme toplantısı planlamaktan memnuniyet duyarız.
            </p>

            <a href="mailto:partners@ramazanoglu.tech" style="display: inline-block; background-color: #111111; color: #FBFBF9; font-family: 'JetBrains Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px 24px; text-decoration: none; font-weight: 600;">
              Toplantı Planla &bull; partners@ramazanoglu.tech &rarr;
            </a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
    `.trim(),
  },

  // 4. CYBERSECURITY & ZERO-TRUST SYSTEM ADVISORY
  {
    id: 'tpl-security-advisory',
    name: '04 // Siber Güvenlik & Sistem Bildirimi (Security Advisory)',
    category: 'security',
    defaultSubject: '[SECURITY // PRIORITY 1] Ramazanoğlu Tech Sistem Güvenlik Bildirimi',
    description: 'Siber güvenlik uyarıları, SSL/TLS, Zero-Trust erişim ve altyapı güncellemeleri için şablon.',
    htmlContent: `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FBFBF9; font-family: 'Inter', -apple-system, sans-serif; color: #111111; margin: 0; padding: 24px 0;">
  <tr>
    <td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 640px; background-color: #FFFFFF; border: 1px solid #E2E2DF; text-align: left;">
        
        <tr>
          <td style="padding: 12px 24px; border-bottom: 1px solid #E2E2DF; background-color: #111111; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #FBFBF9;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><span style="display: inline-block; width: 6px; height: 6px; background-color: #D9381E; vertical-align: middle; margin-right: 6px;"></span>SECURITY ADVISORY &bull; ZERO-TRUST</td>
                <td align="right" style="color: #CCCCCC;">SEVERITY: NOTICE</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 28px;">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #D9381E; font-weight: 700; letter-spacing: 1px; margin-bottom: 6px;">[SEC-ALERT // RT-2026-SYS]</div>
            <h1 style="font-size: 20px; font-weight: 700; color: #111111; margin: 0 0 14px 0;">
              Sistem ve Altyapı Güvenlik Bildirimi
            </h1>
            <p style="font-size: 13px; line-height: 1.6; color: #555555; margin: 0 0 20px 0;">
              Ramazanoğlu Tech kurumsal domain ve bulut servisleri genelinde periyodik Zero-Trust denetimi tamamlanmıştır.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #E2E2DF; margin-bottom: 20px; font-size: 12px; font-family: 'JetBrains Mono', monospace;">
              <tr style="background-color: #F3F3EF;">
                <td style="padding: 8px 12px; border-bottom: 1px solid #E2E2DF;">DENETİM PARAMETRESİ</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #E2E2DF;">DURUM</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E2DF;">TLS / SSL Şifreleme</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E2DF; color: #111111; font-weight: 700;">TLS 1.3 Active (Pass)</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E2DF;">Strict Domain İzolasyonu</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E2DF; color: #111111; font-weight: 700;">100% Enforced</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px;">IMAP / SMTP Relay Koruması</td>
                <td style="padding: 10px 12px; color: #111111; font-weight: 700;">App Password Authenticated</td>
              </tr>
            </table>

            <p style="font-size: 13px; line-height: 1.6; color: #555555; margin: 0;">
              Herhangi bir şüpheli trafik veya zaafiyet bildirimini doğrudan <a href="mailto:security@ramazanoglu.tech" style="color: #111111; font-weight: 600;">security@ramazanoglu.tech</a> adresine şifreli olarak iletebilirsiniz.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
    `.trim(),
  },

  // 5. TALENT & FELLOWSHIP ACCEPTANCE
  {
    id: 'tpl-talent-acceptance',
    name: '05 // Kariyer & Stajyer Kabul (Talent & Fellowship)',
    category: 'talent',
    defaultSubject: 'Ramazanoğlu Tech // Araştırmacı & Stajyer Başvurusu Değerlendirmesi',
    description: 'Mühendis, araştırmacı ve TEKNOFEST/Ar-Ge stajyer adaylarına teknik kabul ve süreç mektubu.',
    htmlContent: `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FBFBF9; font-family: 'Inter', -apple-system, sans-serif; color: #111111; margin: 0; padding: 24px 0;">
  <tr>
    <td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 640px; background-color: #FFFFFF; border: 1px solid #E2E2DF; text-align: left;">
        
        <tr>
          <td style="padding: 12px 24px; border-bottom: 1px solid #E2E2DF; background-color: #F3F3EF; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555555;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><span style="display: inline-block; width: 6px; height: 6px; background-color: #111111; vertical-align: middle; margin-right: 6px;"></span>TALENT &amp; FELLOWSHIP</td>
                <td align="right" style="color: #888884;">CAREERS // 2026</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 32px 28px;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884; letter-spacing: 1px; text-transform: uppercase;">BAŞVURU DEĞERLENDİRME BİLDİRİMİ</span>
            <h1 style="font-size: 20px; font-weight: 700; color: #111111; margin: 8px 0 16px 0;">
              Ramazanoğlu Tech Ekibine İlginiz İçin Teşekkür Ederiz.
            </h1>
            <p style="font-size: 14px; line-height: 1.6; color: #555555; margin: 0 0 18px 0;">
              Mühendislik stüdyomuza ilettiğiniz özgeçmiş, teknik portfolyo ve proje detayları incelenmiştir. Ekibimiz yüksek matematiksel disiplin, C++/Python sistem programlama ve otonom sistemler vizyonuna uygun yetenekleri aramaktadır.
            </p>

            <div style="background-color: #F3F3EF; border: 1px solid #E2E2DF; padding: 16px; margin: 20px 0;">
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #111111; display: block; margin-bottom: 6px;">SONRAKİ ADIMLAR (NEXT MILESTONES):</span>
              <ul style="font-size: 13px; line-height: 1.6; color: #555555; margin: 0; padding-left: 20px;">
                <li>Teknik mülakat ve kod incelemesi (ROS2, C++ veya Bilgisayarlı Görü).</li>
                <li>Laboratuvar donanım çalışma ortamı tanıtımı.</li>
                <li>Proje eşleştirme (Klinik Navigasyon / Space Camel / Otonom Sürüş).</li>
              </ul>
            </div>

            <p style="font-size: 14px; line-height: 1.6; color: #555555; margin: 0 0 24px 0;">
              Müsaitlik takviminizi belirten yanıtınızı bu e-postaya doğrudan iletebilirsiniz.
            </p>

            <div style="margin-top: 24px;">
              <span style="font-size: 13px; font-weight: 600; color: #111111; display: block;">Kariyer &amp; Araştırmacı Komitesi</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884;">careers@ramazanoglu.tech &bull; intern@ramazanoglu.tech</span>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
    `.trim(),
  },

  // 6. TECHNICAL SUPPORT & SLA RESOLUTION
  {
    id: 'tpl-support-resolution',
    name: '06 // Teknik Destek & Çözüm SLA (Issue Resolution)',
    category: 'support',
    defaultSubject: 'Ramazanoğlu Tech // Destek Talebi Çözüm Bildirimi [#TICK-SYS]',
    description: 'Yazılım kullanıcıları ve iş ortakları için teknik sorun giderme ve çözüm raporu şablonu.',
    htmlContent: `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FBFBF9; font-family: 'Inter', -apple-system, sans-serif; color: #111111; margin: 0; padding: 24px 0;">
  <tr>
    <td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 640px; background-color: #FFFFFF; border: 1px solid #E2E2DF; text-align: left;">
        
        <tr>
          <td style="padding: 12px 24px; border-bottom: 1px solid #E2E2DF; background-color: #F3F3EF; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555555;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><span style="display: inline-block; width: 6px; height: 6px; background-color: #111111; vertical-align: middle; margin-right: 6px;"></span>SUPPORT &amp; SLA OPERATIONS</td>
                <td align="right" style="color: #888884;">STATUS: RESOLVED</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding: 28px;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884; letter-spacing: 1px; text-transform: uppercase;">TEKNİK DESTEK KAPANIŞ RAPORU</span>
            <h1 style="font-size: 20px; font-weight: 700; color: #111111; margin: 8px 0 14px 0;">
              Bildirilen Destek Talebi Başarıyla Çözümlendi.
            </h1>
            <p style="font-size: 13px; line-height: 1.6; color: #555555; margin: 0 0 20px 0;">
              İlettiğiniz teknik bildirim mühendislik ekibimizce analiz edilmiş ve gerekli sistem düzeltmesi canlı ortama dağıtılmıştır.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #E2E2DF; margin-bottom: 20px; font-size: 12px;">
              <tr style="background-color: #F3F3EF; font-family: 'JetBrains Mono', monospace;">
                <td style="padding: 8px 12px; border-bottom: 1px solid #E2E2DF;">BİLEŞEN</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #E2E2DF;">UYGULANAN DÜZELTME</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E2DF; font-weight: 600; font-family: 'JetBrains Mono', monospace;">Kök Neden</td>
                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E2DF; color: #555555;">MIME header ayrıştırma &amp; kimlik eşleme uyumsuzluğu.</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; font-family: 'JetBrains Mono', monospace;">Uygulanan Yama</td>
                <td style="padding: 10px 12px; color: #555555;">Dinamik takma ad yetkilendirmesi &amp; optimize sequence fetch devrede.</td>
              </tr>
            </table>

            <p style="font-size: 13px; line-height: 1.6; color: #555555; margin: 0;">
              Sorunun devam etmesi durumunda bu e-postaya yanıt vererek destek biletini yeniden açabilirsiniz.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
    `.trim(),
  },
];
