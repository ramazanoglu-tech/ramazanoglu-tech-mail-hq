// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - COMPOSE & REPLY DIALOG
// =============================================================================

#pragma once

#include <QDialog>
#include <QComboBox>
#include <QLineEdit>
#include <QTextEdit>
#include <QPushButton>
#include <QLabel>
#include "Models.h"

namespace Ramazanoglu {

class ComposeDialog : public QDialog {
    Q_OBJECT

public:
    explicit ComposeDialog(const QList<EmailAlias>& aliases,
                           const QString& defaultFromAlias = "yusuf@ramazanoglu.tech",
                           QWidget* parent = nullptr);

    void prepareReply(const EmailItem& email);
    SendPayload getPayload() const;

private slots:
    void onFromAliasChanged(int index);
    void onTemplateChanged(int index);
    void onSubmit();

private:
    QList<EmailAlias> m_aliases;
    QString m_inReplyTo;
    QString m_threadId;

    QComboBox* m_fromCombo{nullptr};
    QComboBox* m_templateCombo{nullptr};
    QLineEdit* m_toEdit{nullptr};
    QLineEdit* m_ccEdit{nullptr};
    QLineEdit* m_subjectEdit{nullptr};
    QTextEdit* m_bodyEdit{nullptr};
    QLabel* m_signaturePreview{nullptr};
    QPushButton* m_sendBtn{nullptr};
    QPushButton* m_cancelBtn{nullptr};
};

} // namespace Ramazanoglu
