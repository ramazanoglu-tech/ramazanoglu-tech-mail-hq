// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - COMPOSE DIALOG IMPLEMENTATION
// =============================================================================

#include "ComposeDialog.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QMessageBox>

namespace Ramazanoglu {

ComposeDialog::ComposeDialog(const QList<EmailAlias>& aliases,
                             const QString& defaultFromAlias,
                             QWidget* parent)
    : QDialog(parent),
      m_aliases(aliases)
{
    setWindowTitle("E-POSTA GÖNDER // RAMAZANOĞLU TECH SUPER ADMIN");
    setModal(true);
    resize(720, 600);
    setStyleSheet("background-color: #FBFBF9; color: #111111;");

    auto* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(20, 20, 20, 20);
    mainLayout->setSpacing(12);

    // Top Header
    auto* header = new QLabel("YENİ GÖNDERİM // CLOUD SMTP RELAY", this);
    header->setStyleSheet("font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: bold; letter-spacing: 1px; color: #111111; border-bottom: 1px solid #E2E2DC; padding-bottom: 8px;");
    mainLayout->addWidget(header);

    // Grid for From, To, Cc, Subject
    auto* grid = new QGridLayout();
    grid->setHorizontalSpacing(12);
    grid->setVerticalSpacing(8);

    // 1. From (Smart Identity Selector)
    auto* fromLabel = new QLabel("GÖNDERİCİ (FROM):", this);
    fromLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; font-weight: bold;");
    grid->addWidget(fromLabel, 0, 0);

    m_fromCombo = new QComboBox(this);
    m_fromCombo->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 6px; font-family: 'JetBrains Mono'; font-size: 12px;");

    int defaultIndex = 0;
    for (int i = 0; i < m_aliases.size(); ++i) {
        const auto& a = m_aliases[i];
        QString displayText = QString("%1  <%2>  —  %3").arg(a.departmentBadge, a.email, a.displayName);
        m_fromCombo->addItem(displayText, a.email);
        if (a.email.compare(defaultFromAlias, Qt::CaseInsensitive) == 0) {
            defaultIndex = i;
        }
    }
    m_fromCombo->setCurrentIndex(defaultIndex);
    connect(m_fromCombo, QOverload<int>::of(&QComboBox::currentIndexChanged), this, &ComposeDialog::onFromAliasChanged);
    grid->addWidget(m_fromCombo, 0, 1);

    // 2. Template Selector (Swiss-Style Architectural Templates)
    auto* tplLabel = new QLabel("ŞABLON (TEMPLATE):", this);
    tplLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; font-weight: bold;");
    grid->addWidget(tplLabel, 1, 0);

    m_templateCombo = new QComboBox(this);
    m_templateCombo->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 6px; font-family: 'JetBrains Mono'; font-size: 11px;");
    m_templateCombo->addItem("-- Hazır Swiss Şablon Seçin (İsteğe Bağlı) --", "");
    m_templateCombo->addItem("01 // Kurumsal & Resmi İletişim (Corporate Briefing)", "corporate");
    m_templateCombo->addItem("02 // Ar-Ge & Mühendislik Spesifikasyonu (Technical Release)", "rd_spec");
    m_templateCombo->addItem("03 // Stratejik Ortaklık & Sponsorluk (Partnership Proposal)", "partnership");
    m_templateCombo->addItem("04 // Siber Güvenlik & Sistem Bildirimi (Security Advisory)", "security");
    m_templateCombo->addItem("05 // Kariyer & Stajyer Kabul (Talent & Fellowship)", "talent");
    m_templateCombo->addItem("06 // Teknik Destek & Çözüm SLA (Issue Resolution)", "support");
    connect(m_templateCombo, QOverload<int>::of(&QComboBox::currentIndexChanged), this, &ComposeDialog::onTemplateChanged);
    grid->addWidget(m_templateCombo, 1, 1);

    // 3. To
    auto* toLabel = new QLabel("ALICI (TO):", this);
    toLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; font-weight: bold;");
    grid->addWidget(toLabel, 2, 0);

    m_toEdit = new QLineEdit(this);
    m_toEdit->setPlaceholderText("alici@kurum.com, diger@sirket.ch");
    m_toEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 6px; font-family: 'JetBrains Mono';");
    grid->addWidget(m_toEdit, 2, 1);

    // 4. CC
    auto* ccLabel = new QLabel("BİLGİ (CC):", this);
    ccLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; font-weight: bold;");
    grid->addWidget(ccLabel, 3, 0);

    m_ccEdit = new QLineEdit(this);
    m_ccEdit->setPlaceholderText("İsteğe bağlı kopya e-posta adresleri");
    m_ccEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 6px; font-family: 'JetBrains Mono';");
    grid->addWidget(m_ccEdit, 3, 1);

    // 5. Subject
    auto* subjLabel = new QLabel("KONU (SUBJECT):", this);
    subjLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; font-weight: bold;");
    grid->addWidget(subjLabel, 4, 0);

    m_subjectEdit = new QLineEdit(this);
    m_subjectEdit->setPlaceholderText("E-posta konusu");
    m_subjectEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 6px; font-weight: bold;");
    grid->addWidget(m_subjectEdit, 4, 1);

    mainLayout->addLayout(grid);

    // Body Editor
    auto* bodyLabel = new QLabel("İÇERİK (BODY TEXT / HTML):", this);
    bodyLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; font-weight: bold; margin-top: 4px;");
    mainLayout->addWidget(bodyLabel);

    m_bodyEdit = new QTextEdit(this);
    m_bodyEdit->setPlaceholderText("Kurumsal e-posta metninizi buraya yazın...");
    m_bodyEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 10px; font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.5;");
    mainLayout->addWidget(m_bodyEdit, 1);

    // Corporate Signature Preview Container
    auto* sigBox = new QWidget(this);
    sigBox->setStyleSheet("background: #F3F3EE; border: 1px solid #E2E2DC; padding: 8px;");
    auto* sigLayout = new QVBoxLayout(sigBox);
    sigLayout->setContentsMargins(8, 8, 8, 8);

    auto* sigHeader = new QLabel("OTOMATİK EKLENECEK KURUMSAL SWISS İMZA ÖNİZLEMESİ:", sigBox);
    sigHeader->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 10px; color: #666662; font-weight: bold;");
    sigLayout->addWidget(sigHeader);

    m_signaturePreview = new QLabel(sigBox);
    m_signaturePreview->setStyleSheet("font-size: 12px; color: #111111;");
    m_signaturePreview->setTextFormat(Qt::RichText);
    sigLayout->addWidget(m_signaturePreview);
    mainLayout->addWidget(sigBox);

    // Bottom Action Row
    auto* btnLayout = new QHBoxLayout();
    btnLayout->addStretch(1);

    m_cancelBtn = new QPushButton("İPTAL", this);
    m_cancelBtn->setStyleSheet("background: #F3F3EE; border: 1px solid #E2E2DC; padding: 8px 18px; font-weight: bold; font-family: 'JetBrains Mono';");
    connect(m_cancelBtn, &QPushButton::clicked, this, &QDialog::reject);
    btnLayout->addWidget(m_cancelBtn);

    m_sendBtn = new QPushButton("SMTP ÜZERİNDEN GÖNDER", this);
    m_sendBtn->setStyleSheet("background: #111111; color: #FFFFFF; border: none; padding: 8px 24px; font-weight: bold; font-family: 'JetBrains Mono'; letter-spacing: 0.5px;");
    connect(m_sendBtn, &QPushButton::clicked, this, &ComposeDialog::onSubmit);
    btnLayout->addWidget(m_sendBtn);

    mainLayout->addLayout(btnLayout);

    // Trigger initial signature preview
    onFromAliasChanged(m_fromCombo->currentIndex());
}

void ComposeDialog::onFromAliasChanged(int index) {
    if (index >= 0 && index < m_aliases.size()) {
        const auto& alias = m_aliases[index];
        m_signaturePreview->setText(alias.signatureHtml.isEmpty() ? "<i>(İmza tanımlanmamış)</i>" : alias.signatureHtml);
    }
}

void ComposeDialog::onTemplateChanged(int index) {
    Q_UNUSED(index);
    if (!m_templateCombo) return;
    QString key = m_templateCombo->currentData().toString();
    if (key.isEmpty()) return;

    if (key == "corporate") {
        m_subjectEdit->setText("Ramazanoğlu Tech // Kurumsal Bilgilendirme ve Resmi Yazışma");
        m_bodyEdit->setHtml(
            "<div style=\"font-family: 'Inter', sans-serif; color: #111111; line-height: 1.6;\">"
            "<div style=\"font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884; margin-bottom: 8px;\">REF // RT-2026-SYS &bull; OFFICIAL CORRESPONDENCE</div>"
            "<h2 style=\"font-size: 18px; margin: 0 0 12px 0;\">Sayın Yetkili / Değerli Paydaşımız,</h2>"
            "<p>Ramazanoğlu Tech bağımsız mühendislik pratikleri ve otonom sistemler mimarileri kapsamındaki resmi bilgilendirmemiz aşağıdadır.</p>"
            "<div style=\"background: #F3F3EF; border-left: 3px solid #111111; padding: 12px 16px; margin: 16px 0;\">"
            "<strong>GÜNDEM NOTU:</strong><br>Resmi yazışma detaylarınızı buraya ekleyebilirsiniz."
            "</div>"
            "<p>Bilgilerinize arz eder, çalışmalarınızda başarılar dileriz.</p>"
            "<p><strong>Ramazanoğlu Tech Yönetim Kurulu</strong></p>"
            "</div>"
        );
    } else if (key == "rd_spec") {
        m_subjectEdit->setText("Ramazanoğlu Tech // Teknik Spesifikasyon ve Mimari Rapor [REF: RT-ENG]");
        m_bodyEdit->setHtml(
            "<div style=\"font-family: 'Inter', sans-serif; color: #111111; line-height: 1.6;\">"
            "<div style=\"font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884; margin-bottom: 8px;\">02 — R&amp;D TECHNICAL SPECIFICATION &bull; DETERMINISTIC</div>"
            "<h2 style=\"font-size: 18px; margin: 0 0 12px 0;\">Mühendislik Sürüm Notu &amp; Test Telemetrisi</h2>"
            "<p>Aşağıdaki parametreler sub-millimeter uzamsal tolerans ve deterministik çalışma kriterleri altında doğrulanmıştır:</p>"
            "<table border='1' cellpadding='8' style='border-collapse: collapse; border: 1px solid #E2E2DF; width: 100%; font-family: JetBrains Mono; font-size: 12px;'>"
            "<tr style='background: #F3F3EF;'><th>PARAMETRE</th><th>HASSASİYET</th><th>DURUM</th></tr>"
            "<tr><td>Spatial Accuracy</td><td>&lt; 1.0 mm (6-DoF Optical)</td><td>[PASS]</td></tr>"
            "<tr><td>Perception Latency</td><td>&lt; 10 ms (ROS2 Edge)</td><td>[PASS]</td></tr>"
            "<tr><td>Security Architecture</td><td>Zero-Trust AES-256</td><td>[ACTIVE]</td></tr>"
            "</table>"
            "</div>"
        );
    } else if (key == "partnership") {
        m_subjectEdit->setText("Ramazanoğlu Tech // Stratejik İş Birliği ve Teknoloji Ortaklığı Teklifi");
        m_bodyEdit->setHtml(
            "<div style=\"font-family: 'Inter', sans-serif; color: #111111; line-height: 1.6;\">"
            "<div style=\"font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884; margin-bottom: 8px;\">STRATEGIC ALLIANCE &bull; B2B PARTNERSHIP</div>"
            "<h2 style=\"font-size: 18px; margin: 0 0 12px 0;\">Geleceğin Yüksek Hassasiyetli Sistemlerini Birlikte İnşa Edelim.</h2>"
            "<p>Cerrahi navigasyon, otonom robotik ve Space Camel roketçilik projelerimizde stratejik ortaklık ve ortak Ar-Ge yürütmek adına toplantı davetimizdir.</p>"
            "<p>Detaylı teklifimizi görüşmek üzere müsait olduğunuz zaman dilimini bu zincir üzerinden iletebilirsiniz.</p>"
            "</div>"
        );
    } else if (key == "security") {
        m_subjectEdit->setText("[SECURITY // PRIORITY 1] Ramazanoğlu Tech Sistem Güvenlik Bildirimi");
        m_bodyEdit->setHtml(
            "<div style=\"font-family: 'Inter', sans-serif; color: #111111; line-height: 1.6;\">"
            "<div style=\"font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #D9381E; font-weight: bold; margin-bottom: 8px;\">[SEC-ALERT // ZERO-TRUST]</div>"
            "<h2 style=\"font-size: 18px; margin: 0 0 12px 0;\">Sistem ve Altyapı Güvenlik Bildirimi</h2>"
            "<p>Ramazanoğlu Tech kurumsal domain ve bulut servisleri genelinde periyodik Zero-Trust denetimi tamamlanmıştır.</p>"
            "<p>TLS 1.3 ve Strict Domain İzolasyonu %100 oranında devrededir.</p>"
            "</div>"
        );
    } else if (key == "talent") {
        m_subjectEdit->setText("Ramazanoğlu Tech // Araştırmacı & Stajyer Başvurusu Değerlendirmesi");
        m_bodyEdit->setHtml(
            "<div style=\"font-family: 'Inter', sans-serif; color: #111111; line-height: 1.6;\">"
            "<div style=\"font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884; margin-bottom: 8px;\">TALENT &amp; FELLOWSHIP // CAREERS 2026</div>"
            "<h2 style=\"font-size: 18px; margin: 0 0 12px 0;\">Ramazanoğlu Tech Ekibine İlginiz İçin Teşekkür Ederiz.</h2>"
            "<p>İlettiğiniz teknik portfolyo ve proje detayları incelenmiştir. Bir sonraki aşama teknik mülakat ve proje eşleştirmesidir.</p>"
            "</div>"
        );
    } else if (key == "support") {
        m_subjectEdit->setText("Ramazanoğlu Tech // Destek Talebi Çözüm Bildirimi [#TICK-SYS]");
        m_bodyEdit->setHtml(
            "<div style=\"font-family: 'Inter', sans-serif; color: #111111; line-height: 1.6;\">"
            "<div style=\"font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888884; margin-bottom: 8px;\">SUPPORT &amp; SLA OPERATIONS // STATUS: RESOLVED</div>"
            "<h2 style=\"font-size: 18px; margin: 0 0 12px 0;\">Bildirilen Destek Talebi Başarıyla Çözümlendi.</h2>"
            "<p>İlettiğiniz teknik bildirim analiz edilmiş, ilgili sistem güncellemesi canlı ortama dağıtılmıştır.</p>"
            "</div>"
        );
    }
}

void ComposeDialog::prepareReply(const EmailItem& email) {
    // 1. Smart Identity Selector: Auto-select alias to match recipient
    for (int i = 0; i < m_aliases.size(); ++i) {
        if (m_aliases[i].email.compare(email.aliasTarget, Qt::CaseInsensitive) == 0) {
            m_fromCombo->setCurrentIndex(i);
            break;
        }
    }

    // 2. Set Recipient to sender
    m_toEdit->setText(email.fromAddress);

    // 3. Prefix Subject with Re:
    QString subj = email.subject;
    if (!subj.startsWith("Re:", Qt::CaseInsensitive)) {
        subj = "Re: " + subj;
    }
    m_subjectEdit->setText(subj);

    // 4. Threading headers
    m_inReplyTo = email.messageId;
    m_threadId = email.threadId.isEmpty() ? email.messageId : email.threadId;

    // 5. Prepend quoting block
    QString quote = QString("\n\n\n--- %1 tarihinde %2 <%3> yazdı: ---\n> %4")
                        .arg(email.receivedAt.toString("dd.MM.yyyy hh:mm"),
                             email.fromName,
                             email.fromAddress,
                             email.bodyText.left(500).replace("\n", "\n> "));
    m_bodyEdit->setText(quote);
    m_bodyEdit->moveCursor(QTextCursor::Start);
}

SendPayload ComposeDialog::getPayload() const {
    SendPayload payload;
    payload.fromAlias = m_fromCombo->currentData().toString();

    QStringList toList;
    const auto rawTo = m_toEdit->text().split(',', Qt::SkipEmptyParts);
    for (const auto& s : rawTo) toList.append(s.trimmed());
    payload.to = toList;

    QStringList ccList;
    const auto rawCc = m_ccEdit->text().split(',', Qt::SkipEmptyParts);
    for (const auto& s : rawCc) ccList.append(s.trimmed());
    payload.cc = ccList;

    payload.subject = m_subjectEdit->text().trimmed();
    payload.bodyText = m_bodyEdit->toPlainText();
    if (payload.bodyText.contains("<table") || payload.bodyText.contains("<div") || payload.bodyText.contains("<p")) {
        payload.bodyHtml = payload.bodyText;
    } else {
        payload.bodyHtml = QString("<p>%1</p>").arg(payload.bodyText.toHtmlEscaped().replace("\n", "<br>"));
    }
    payload.inReplyTo = m_inReplyTo;
    payload.threadId = m_threadId;

    return payload;
}

void ComposeDialog::onSubmit() {
    if (m_toEdit->text().trimmed().isEmpty()) {
        QMessageBox::warning(this, "Hata", "Lütfen en az bir alıcı (To) e-posta adresi belirtin.");
        return;
    }
    if (m_subjectEdit->text().trimmed().isEmpty()) {
        QMessageBox::warning(this, "Hata", "Lütfen bir e-posta konusu girin.");
        return;
    }
    accept();
}

} // namespace Ramazanoglu
