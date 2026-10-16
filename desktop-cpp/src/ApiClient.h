// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - API CLIENT (REST & WEBSOCKET)
// =============================================================================

#pragma once

#include <QObject>
#include <QString>
#include <QUrl>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QWebSocket>
#include <QTimer>
#include "Models.h"

namespace Ramazanoglu {

class ApiClient : public QObject {
    Q_OBJECT

public:
    explicit ApiClient(const QString& baseUrl = "http://localhost:8765",
                       const QString& wsUrl = "ws://localhost:8765/ws",
                       QObject* parent = nullptr);
    ~ApiClient() override;

    void setBaseUrl(const QString& url);
    void setWsUrl(const QString& url);
    void setAuthToken(const QString& token);
    void setSuperAdminKey(const QString& key);
    QString getSuperAdminKey() const;

    // REST API Actions
    void checkHealth();
    void fetchAliases();
    void createAlias(const QString& email, const QString& displayName,
                     const QString& badge, const QString& signatureHtml);
    void fetchEmails(const QString& alias = "all", const QString& filter = "all",
                     const QString& search = "");
    void getEmailDetails(const QString& id);
    void updateEmailStatus(const QString& id, std::optional<bool> isRead,
                           std::optional<bool> isStarred, std::optional<bool> isArchived);
    void deleteEmail(const QString& id);
    void sendEmail(const SendPayload& payload);
    void simulateIncoming(const QString& aliasTarget = "info@ramazanoglu.tech");
    void triggerManualSync();

    // WebSocket Controls
    void connectWebSocket();
    void disconnectWebSocket();
    bool isWsConnected() const;

signals:
    void healthStatusReceived(bool online, const QJsonObject& details);
    void aliasesLoaded(const QList<EmailAlias>& aliases);
    void aliasCreated(const EmailAlias& alias);
    void emailsLoaded(const QList<EmailItem>& emails, int total);
    void emailDetailsLoaded(const EmailItem& email);
    void emailUpdated(const EmailItem& email);
    void emailDeleted(const QString& id);
    void emailSent(const EmailItem& email);
    void emailReceived(const EmailItem& email);
    void wsConnected();
    void wsDisconnected();
    void errorOccurred(const QString& errorMsg);

private slots:
    void onWsConnected();
    void onWsDisconnected();
    void onWsTextMessageReceived(const QString& message);
    void onWsError(QAbstractSocket::SocketError error);
    void reconnectWsTimerFired();

private:
    QUrl makeApiUrl(const QString& path) const;
    void setupRequestHeaders(QNetworkRequest& request) const;

    QString m_baseUrl;
    QString m_wsUrl;
    QString m_authToken;
    QString m_superAdminKey{"RamazanogluTech2026!Master"};
    QNetworkAccessManager* m_netManager{nullptr};
    QWebSocket* m_webSocket{nullptr};
    QTimer* m_wsReconnectTimer{nullptr};
    bool m_isWsConnected{false};
};

} // namespace Ramazanoglu
