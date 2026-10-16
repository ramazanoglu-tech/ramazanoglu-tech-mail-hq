// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - ADD ALIAS DIALOG IMPLEMENTATION
// =============================================================================

#include "AddAliasDialog.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QMessageBox>

namespace Ramazanoglu {

AddAliasDialog::AddAliasDialog(QWidget* parent) : QDialog(parent) {
    setWindowTitle("YENİ DEPARTMAN KİMLİĞİ EKLE // SUPER ADMIN");
    setModal(true);
    resize(480, 420);
    setStyleSheet("background-color: #FBFBF9; color: #111111;");

    auto* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(24, 24, 24, 24);
    mainLayout->setSpacing(16);

    auto* titleLabel = new QLabel("YENİ @ramazanoglu.tech DEPARTMANI TANIMLA", this);
    titleLabel->setStyleSheet("font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: bold; letter-spacing: 1px; color: #111111;");
    mainLayout->addWidget(titleLabel);

    auto* subLabel = new QLabel("Bulut PostgreSQL ve IMAP senkronizasyon motoruna yeni bir kurumsal kimlik ekler.", this);
    subLabel->setStyleSheet("color: #666662; font-size: 12px; margin-bottom: 8px;");
    mainLayout->addWidget(subLabel);

    // E-posta Adresi
    auto* emailLabel = new QLabel("E-Posta Adresi (Adres @ramazanoglu.tech ile sonlanmalıdır):", this);
    emailLabel->setStyleSheet("font-weight: bold; font-size: 11px;");
    mainLayout->addWidget(emailLabel);

    auto* emailLayout = new QHBoxLayout();
    m_emailPrefixEdit = new QLineEdit(this);
    m_emailPrefixEdit->setPlaceholderText("departman-adi (orn. security, lab)");
    m_emailPrefixEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 8px; font-family: 'JetBrains Mono';");
    connect(m_emailPrefixEdit, &QLineEdit::textChanged, this, &AddAliasDialog::onEmailChanged);

    auto* domainLabel = new QLabel("@ramazanoglu.tech", this);
    domainLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-weight: bold; background: #F3F3EE; border: 1px solid #E2E2DC; padding: 8px;");

    emailLayout->addWidget(m_emailPrefixEdit, 1);
    emailLayout->addWidget(domainLabel);
    mainLayout->addLayout(emailLayout);

    // Departman Rozeti
    auto* badgeLabel = new QLabel("Departman Rozeti (Grid & Liste gorunumu icin):", this);
    badgeLabel->setStyleSheet("font-weight: bold; font-size: 11px;");
    mainLayout->addWidget(badgeLabel);

    m_badgeEdit = new QLineEdit(this);
    m_badgeEdit->setPlaceholderText("[ORNEK]");
    m_badgeEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 8px; font-family: 'JetBrains Mono';");
    mainLayout->addWidget(m_badgeEdit);

    // Gorunen Isim
    auto* nameLabel = new QLabel("Gorunen Isim (Gonderen basligi):", this);
    nameLabel->setStyleSheet("font-weight: bold; font-size: 11px;");
    mainLayout->addWidget(nameLabel);

    m_displayNameEdit = new QLineEdit(this);
    m_displayNameEdit->setPlaceholderText("Ramazanoglu Tech Bilgi Guvenligi");
    m_displayNameEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 8px;");
    mainLayout->addWidget(m_displayNameEdit);

    // Imza HTML
    auto* sigLabel = new QLabel("Kurumsal HTML Imza:", this);
    sigLabel->setStyleSheet("font-weight: bold; font-size: 11px;");
    mainLayout->addWidget(sigLabel);

    m_signatureEdit = new QTextEdit(this);
    m_signatureEdit->setPlaceholderText("<div style=\"font-family: sans-serif;\">Ramazanoglu Technologies Inc.</div>");
    m_signatureEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 8px; font-family: 'JetBrains Mono'; font-size: 11px;");
    m_signatureEdit->setFixedHeight(90);
    mainLayout->addWidget(m_signatureEdit);

    // Buttons
    auto* btnLayout = new QHBoxLayout();
    btnLayout->addStretch(1);

    m_cancelBtn = new QPushButton("IPTAL", this);
    m_cancelBtn->setStyleSheet("background: #F3F3EE; border: 1px solid #E2E2DC; padding: 8px 16px; font-weight: bold;");
    connect(m_cancelBtn, &QPushButton::clicked, this, &QDialog::reject);
    btnLayout->addWidget(m_cancelBtn);

    m_submitBtn = new QPushButton("BULUT VERITABANINA EKLE", this);
    m_submitBtn->setStyleSheet("background: #111111; color: #FFFFFF; border: none; padding: 8px 20px; font-weight: bold; font-family: 'JetBrains Mono';");
    connect(m_submitBtn, &QPushButton::clicked, this, &AddAliasDialog::onSubmit);
    btnLayout->addWidget(m_submitBtn);

    mainLayout->addLayout(btnLayout);
}

void AddAliasDialog::onEmailChanged(const QString& text) {
    if (!text.isEmpty()) {
        QString clean = text.trimmed().toUpper();
        m_badgeEdit->setText(QString("[%1]").arg(clean));
        m_displayNameEdit->setText(QString("Ramazanoğlu Tech %1").arg(text.trimmed()));
    }
}

void AddAliasDialog::onSubmit() {
    if (m_emailPrefixEdit->text().trimmed().isEmpty()) {
        QMessageBox::warning(this, "Hata", "Lutfen departman e-posta adresini girin.");
        return;
    }
    accept();
}

QString AddAliasDialog::getEmail() const {
    return m_emailPrefixEdit->text().trimmed().toLower() + "@ramazanoglu.tech";
}

QString AddAliasDialog::getDisplayName() const {
    return m_displayNameEdit->text().trimmed();
}

QString AddAliasDialog::getBadge() const {
    return m_badgeEdit->text().trimmed();
}

QString AddAliasDialog::getSignatureHtml() const {
    return m_signatureEdit->toPlainText().trimmed();
}

} // namespace Ramazanoglu
