// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - API CLIENT IMPLEMENTATION
// =============================================================================

#include "ApiClient.h"
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QUrlQuery>
#include <QDebug>

namespace Ramazanoglu {

ApiClient::ApiClient(const QString& baseUrl, const QString& wsUrl, QObject* parent)
    : QObject(parent),
      m_baseUrl(baseUrl),
      m_wsUrl(wsUrl)
{
    m_netManager = new QNetworkAccessManager(this);
    m_webSocket = new QWebSocket(QString(), QWebSocketProtocol::VersionLatest, this);

    connect(m_webSocket, &QWebSocket::connected, this, &ApiClient::onWsConnected);
    connect(m_webSocket, &QWebSocket::disconnected, this, &ApiClient::onWsDisconnected);
    connect(m_webSocket, &QWebSocket::textMessageReceived, this, &ApiClient::onWsTextMessageReceived);
    connect(m_webSocket, &QWebSocket::errorOccurred, this, &ApiClient::onWsError);

    m_wsReconnectTimer = new QTimer(this);
    m_wsReconnectTimer->setInterval(5000);
    connect(m_wsReconnectTimer, &QTimer::timeout, this, &ApiClient::reconnectWsTimerFired);
}

ApiClient::~ApiClient() {
    if (m_webSocket) {
        m_webSocket->close();
    }
}

void ApiClient::setBaseUrl(const QString& url) {
    m_baseUrl = url;
}

void ApiClient::setWsUrl(const QString& url) {
    m_wsUrl = url;
}

void ApiClient::setAuthToken(const QString& token) {
    m_authToken = token;
}

void ApiClient::setSuperAdminKey(const QString& key) {
    m_superAdminKey = key;
}

QString ApiClient::getSuperAdminKey() const {
    return m_superAdminKey;
}

QUrl ApiClient::makeApiUrl(const QString& path) const {
    QString cleanBase = m_baseUrl;
    if (cleanBase.endsWith('/')) {
        cleanBase.chop(1);
    }
    QString cleanPath = path;
    if (!cleanPath.startsWith('/')) {
        cleanPath.prepend('/');
    }
    return QUrl(cleanBase + cleanPath);
}

void ApiClient::setupRequestHeaders(QNetworkRequest& request) const {
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    if (!m_authToken.isEmpty()) {
        request.setRawHeader("Authorization", ("Bearer " + m_authToken).toUtf8());
    }
    request.setRawHeader("X-Super-Admin-Key", m_superAdminKey.toUtf8());
    request.setRawHeader("User-Agent", "RamazanogluTech-DesktopHQ/1.0.0 (Windows; Native Qt6)");
}

void ApiClient::checkHealth() {
    QUrl url = makeApiUrl("/api/health");
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QNetworkReply* reply = m_netManager->get(request);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QByteArray data = reply->readAll();
            QJsonDocument doc = QJsonDocument::fromJson(data);
            emit healthStatusReceived(true, doc.object());
        } else {
            emit healthStatusReceived(false, QJsonObject());
        }
    });
}

void ApiClient::fetchAliases() {
    QUrl url = makeApiUrl("/api/aliases");
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QNetworkReply* reply = m_netManager->get(request);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QByteArray data = reply->readAll();
            QJsonDocument doc = QJsonDocument::fromJson(data);
            QJsonArray arr = doc.object()["aliases"].toArray();

            QList<EmailAlias> aliases;
            for (const auto& item : arr) {
                if (item.isObject()) {
                    aliases.append(EmailAlias::fromJson(item.toObject()));
                }
            }
            emit aliasesLoaded(aliases);
        } else {
            emit errorOccurred(QString("Failed to fetch aliases: %1").arg(reply->errorString()));
        }
    });
}

void ApiClient::createAlias(const QString& email, const QString& displayName,
                            const QString& badge, const QString& signatureHtml)
{
    QUrl url = makeApiUrl("/api/aliases");
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QJsonObject body;
    body["email"] = email;
    body["display_name"] = displayName;
    body["department_badge"] = badge;
    body["signature_html"] = signatureHtml;

    QNetworkReply* reply = m_netManager->post(request, QJsonDocument(body).toJson());
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QByteArray data = reply->readAll();
            QJsonDocument doc = QJsonDocument::fromJson(data);
            EmailAlias created = EmailAlias::fromJson(doc.object()["alias"].toObject());
            emit aliasCreated(created);
        } else {
            emit errorOccurred(QString("Failed to create alias: %1").arg(reply->errorString()));
        }
    });
}

void ApiClient::fetchEmails(const QString& alias, const QString& filter, const QString& search) {
    QUrl url = makeApiUrl("/api/emails");
    QUrlQuery query;

    if (!alias.isEmpty() && alias != "all") {
        query.addQueryItem("alias", alias);
    }
    if (filter == "unread") {
        query.addQueryItem("unread", "true");
    } else if (filter == "starred") {
        query.addQueryItem("starred", "true");
    } else if (filter == "sent") {
        query.addQueryItem("direction", "OUTBOUND");
    }
    if (!search.trimmed().isEmpty()) {
        query.addQueryItem("search", search.trimmed());
    }
    query.addQueryItem("limit", "100");

    url.setQuery(query);
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QNetworkReply* reply = m_netManager->get(request);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QByteArray data = reply->readAll();
            QJsonDocument doc = QJsonDocument::fromJson(data);
            QJsonObject obj = doc.object();
            int total = obj["total"].toInt(0);
            QJsonArray arr = obj["emails"].toArray();

            QList<EmailItem> emails;
            for (const auto& item : arr) {
                if (item.isObject()) {
                    emails.append(EmailItem::fromJson(item.toObject()));
                }
            }
            emit emailsLoaded(emails, total);
        } else {
            emit errorOccurred(QString("Failed to fetch emails: %1").arg(reply->errorString()));
        }
    });
}

void ApiClient::getEmailDetails(const QString& id) {
    QUrl url = makeApiUrl(QString("/api/emails/%1").arg(id));
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QNetworkReply* reply = m_netManager->get(request);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QByteArray data = reply->readAll();
            QJsonDocument doc = QJsonDocument::fromJson(data);
            EmailItem item = EmailItem::fromJson(doc.object()["email"].toObject());
            emit emailDetailsLoaded(item);
        } else {
            emit errorOccurred(QString("Failed to load email details: %1").arg(reply->errorString()));
        }
    });
}

void ApiClient::updateEmailStatus(const QString& id, std::optional<bool> isRead,
                                  std::optional<bool> isStarred, std::optional<bool> isArchived)
{
    QUrl url = makeApiUrl(QString("/api/emails/%1").arg(id));
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QJsonObject body;
    if (isRead.has_value()) body["is_read"] = *isRead;
    if (isStarred.has_value()) body["is_starred"] = *isStarred;
    if (isArchived.has_value()) body["is_archived"] = *isArchived;

    QNetworkReply* reply = m_netManager->sendCustomRequest(request, "PATCH", QJsonDocument(body).toJson());
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QByteArray data = reply->readAll();
            QJsonDocument doc = QJsonDocument::fromJson(data);
            EmailItem item = EmailItem::fromJson(doc.object()["email"].toObject());
            emit emailUpdated(item);
        } else {
            emit errorOccurred(QString("Failed to update email: %1").arg(reply->errorString()));
        }
    });
}

void ApiClient::deleteEmail(const QString& id) {
    QUrl url = makeApiUrl(QString("/api/emails/%1").arg(id));
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QNetworkReply* reply = m_netManager->deleteResource(request);
    connect(reply, &QNetworkReply::finished, this, [this, id, reply]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            emit emailDeleted(id);
        } else {
            emit errorOccurred(QString("Failed to delete email: %1").arg(reply->errorString()));
        }
    });
}

void ApiClient::sendEmail(const SendPayload& payload) {
    QUrl url = makeApiUrl("/api/emails/send");
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QNetworkReply* reply = m_netManager->post(request, QJsonDocument(payload.toJson()).toJson());
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() == QNetworkReply::NoError) {
            QByteArray data = reply->readAll();
            QJsonDocument doc = QJsonDocument::fromJson(data);
            EmailItem item = EmailItem::fromJson(doc.object()["email"].toObject());
            emit emailSent(item);
        } else {
            emit errorOccurred(QString("Failed to dispatch email: %1").arg(reply->errorString()));
        }
    });
}

void ApiClient::simulateIncoming(const QString& aliasTarget) {
    QUrl url = makeApiUrl("/api/dev/simulate");
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QJsonObject body;
    body["alias_target"] = aliasTarget;

    QNetworkReply* reply = m_netManager->post(request, QJsonDocument(body).toJson());
    connect(reply, &QNetworkReply::finished, reply, &QNetworkReply::deleteLater);
}

void ApiClient::triggerManualSync() {
    QUrl url = makeApiUrl("/api/sync/trigger");
    QNetworkRequest request(url);
    setupRequestHeaders(request);

    QNetworkReply* reply = m_netManager->post(request, QByteArray());
    connect(reply, &QNetworkReply::finished, reply, &QNetworkReply::deleteLater);
}

void ApiClient::connectWebSocket() {
    if (m_webSocket) {
        QUrl wsUrl(m_wsUrl);
        QUrlQuery query(wsUrl);
        query.addQueryItem("key", m_superAdminKey);
        wsUrl.setQuery(query);
        qDebug() << "[WS] Connecting to:" << wsUrl.toString();
        m_webSocket->open(wsUrl);
    }
}

void ApiClient::disconnectWebSocket() {
    m_wsReconnectTimer->stop();
    if (m_webSocket) {
        m_webSocket->close();
    }
}

bool ApiClient::isWsConnected() const {
    return m_isWsConnected;
}

void ApiClient::onWsConnected() {
    m_isWsConnected = true;
    m_wsReconnectTimer->stop();
    qDebug() << "[WS] Connected to Ramazanoğlu Tech Live Cloud Stream (Zero-Trust Authenticated).";
    emit wsConnected();
}

void ApiClient::onWsDisconnected() {
    m_isWsConnected = false;
    qDebug() << "[WS] Disconnected from Cloud Stream. Scheduling auto-reconnect...";
    emit wsDisconnected();
    if (!m_wsReconnectTimer->isActive()) {
        m_wsReconnectTimer->start();
    }
}

void ApiClient::onWsError(QAbstractSocket::SocketError error) {
    Q_UNUSED(error);
    qDebug() << "[WS Socket Error]:" << m_webSocket->errorString();
}

void ApiClient::reconnectWsTimerFired() {
    if (!m_isWsConnected && m_webSocket) {
        QUrl wsUrl(m_wsUrl);
        QUrlQuery query(wsUrl);
        query.addQueryItem("key", m_superAdminKey);
        wsUrl.setQuery(query);
        qDebug() << "[WS] Attempting reconnection to" << wsUrl.toString();
        m_webSocket->open(wsUrl);
    }
}

void ApiClient::onWsTextMessageReceived(const QString& message) {
    QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8());
    if (!doc.isObject()) return;

    QJsonObject root = doc.object();
    QString type = root["type"].toString();
    QJsonObject payload = root["payload"].toObject();

    if (type == "EMAIL_RECEIVED") {
        EmailItem item = EmailItem::fromJson(payload);
        emit emailReceived(item);
    } else if (type == "EMAIL_SENT") {
        EmailItem item = EmailItem::fromJson(payload);
        emit emailSent(item);
    } else if (type == "EMAIL_UPDATED") {
        EmailItem item = EmailItem::fromJson(payload);
        emit emailUpdated(item);
    }
}

} // namespace Ramazanoglu
