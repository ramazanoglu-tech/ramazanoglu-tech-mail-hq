// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - ADD ALIAS DIALOG
// =============================================================================

#pragma once

#include <QDialog>
#include <QLineEdit>
#include <QTextEdit>
#include <QPushButton>

namespace Ramazanoglu {

class AddAliasDialog : public QDialog {
    Q_OBJECT

public:
    explicit AddAliasDialog(QWidget* parent = nullptr);

    QString getEmail() const;
    QString getDisplayName() const;
    QString getBadge() const;
    QString getSignatureHtml() const;

private slots:
    void onEmailChanged(const QString& text);
    void onSubmit();

private:
    QLineEdit* m_emailPrefixEdit{nullptr};
    QLineEdit* m_displayNameEdit{nullptr};
    QLineEdit* m_badgeEdit{nullptr};
    QTextEdit* m_signatureEdit{nullptr};
    QPushButton* m_submitBtn{nullptr};
    QPushButton* m_cancelBtn{nullptr};
};

} // namespace Ramazanoglu
