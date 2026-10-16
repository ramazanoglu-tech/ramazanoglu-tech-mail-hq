// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - C++20 QT 6 MAIN WINDOW (SWISS ARCHITECTURAL GRID)
// =============================================================================

#pragma once

#include <QMainWindow>
#include <QListWidget>
#include <QTextBrowser>
#include <QLineEdit>
#include <QPushButton>
#include <QComboBox>
#include <QLabel>
#include <QSystemTrayIcon>
#include <QMenu>
#include <QCloseEvent>
#include "ApiClient.h"
#include "Models.h"

namespace Ramazanoglu {

class MainWindow : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(QWidget* parent = nullptr);
    ~MainWindow() override;

protected:
    void closeEvent(QCloseEvent* event) override;

private slots:
    // API & WebSocket Slots
    void onAliasesLoaded(const QList<EmailAlias>& aliases);
    void onAliasCreated(const EmailAlias& alias);
    void onEmailsLoaded(const QList<EmailItem>& emails, int total);
    void onEmailDetailsLoaded(const EmailItem& email);
    void onEmailUpdated(const EmailItem& email);
    void onEmailDeleted(const QString& id);
    void onEmailSent(const EmailItem& email);
    void onEmailReceived(const EmailItem& email);
    void onWsConnected();
    void onWsDisconnected();

    // UI Action Slots
    void onAliasFilterClicked(QListWidgetItem* item);
    void onEmailSelectionChanged();
    void onFilterTabChanged(const QString& tab);
    void onSearchTextChanged(const QString& query);
    void onOpenComposeDialog();
    void onOpenAddAliasDialog();
    void onToggleStarCurrentEmail();
    void onToggleReadCurrentEmail();
    void onDeleteCurrentEmail();
    void onSendQuickReply();
    void onSimulateIncomingMail();
    void onTrayIconActivated(QSystemTrayIcon::ActivationReason reason);

private:
    void setupUi();
    void setupSystemTray();
    void refreshCurrentView();
    void updateStatusIndicator(bool connected);
    QWidget* createEmailListItemWidget(const EmailItem& item);

    // Core Services
    ApiClient* m_apiClient{nullptr};
    QList<EmailAlias> m_aliases;
    QList<EmailItem> m_emails;
    std::optional<EmailItem> m_selectedEmail;

    // Filter State
    QString m_selectedAlias{"all"};
    QString m_selectedFilter{"all"}; // all, unread, starred, sent
    QString m_searchQuery{""};

    // UI Components - Left Column (Navigation)
    QLabel* m_statusLabel{nullptr};
    QListWidget* m_aliasNavList{nullptr};
    QPushButton* m_addAliasBtn{nullptr};
    QPushButton* m_simulateBtn{nullptr};

    // UI Components - Middle Column (Email List)
    QLineEdit* m_searchEdit{nullptr};
    QPushButton* m_tabAllBtn{nullptr};
    QPushButton* m_tabUnreadBtn{nullptr};
    QPushButton* m_tabStarredBtn{nullptr};
    QPushButton* m_tabSentBtn{nullptr};
    QListWidget* m_emailListWidget{nullptr};
    QLabel* m_listCountLabel{nullptr};

    // UI Components - Right Column (Reading & Reply)
    QWidget* m_emptyViewWidget{nullptr};
    QWidget* m_detailViewWidget{nullptr};
    QLabel* m_detailSubjectLabel{nullptr};
    QLabel* m_detailFromLabel{nullptr};
    QLabel* m_detailToLabel{nullptr};
    QLabel* m_detailDateLabel{nullptr};
    QLabel* m_detailBadgeLabel{nullptr};
    QLabel* m_detailMessageIdLabel{nullptr};
    QPushButton* m_starBtn{nullptr};
    QPushButton* m_readBtn{nullptr};
    QPushButton* m_deleteBtn{nullptr};
    QTextBrowser* m_bodyBrowser{nullptr};
    QWidget* m_attachmentsBar{nullptr};

    // Quick Reply Drawer
    QComboBox* m_replyFromCombo{nullptr};
    QLineEdit* m_replySubjectEdit{nullptr};
    QTextEdit* m_replyBodyEdit{nullptr};
    QPushButton* m_sendQuickReplyBtn{nullptr};

    // System Tray
    QSystemTrayIcon* m_trayIcon{nullptr};
    QMenu* m_trayMenu{nullptr};
};

} // namespace Ramazanoglu
