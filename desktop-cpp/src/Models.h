// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - C++20 DATA MODELS
// =============================================================================

#pragma once

#include <QString>
#include <QStringList>
#include <QDateTime>
#include <QJsonObject>
#include <QJsonArray>
#include <QJsonDocument>
#include <QList>

namespace Ramazanoglu {

struct EmailAlias {
    QString id;
    QString email;
    QString displayName;
    QString departmentBadge;
    QString signatureHtml;
    bool isActive{true};

    static EmailAlias fromJson(const QJsonObject& obj) {
        EmailAlias alias;
        alias.id = obj["id"].toString();
        alias.email = obj["email"].toString();
        alias.displayName = obj["display_name"].toString();
        alias.departmentBadge = obj["department_badge"].toString();
        alias.signatureHtml = obj["signature_html"].toString();
        alias.isActive = obj["is_active"].toBool(true);
        return alias;
    }

    QJsonObject toJson() const {
        QJsonObject obj;
        obj["id"] = id;
        obj["email"] = email;
        obj["display_name"] = displayName;
        obj["department_badge"] = departmentBadge;
        obj["signature_html"] = signatureHtml;
        obj["is_active"] = isActive;
        return obj;
    }
};

struct EmailAttachment {
    QString id;
    QString filename;
    QString mimeType;
    qint64 sizeBytes{0};
    QString url;

    static EmailAttachment fromJson(const QJsonObject& obj) {
        EmailAttachment att;
        att.id = obj["id"].toString();
        att.filename = obj["filename"].toString();
        att.mimeType = obj["mime_type"].toString();
        att.sizeBytes = static_cast<qint64>(obj["size_bytes"].toDouble(0));
        att.url = obj["cloud_storage_url"].toString();
        return att;
    }
};

struct EmailItem {
    QString id;
    QString messageId;
    QString threadId;
    QString aliasTarget;
    QString fromName;
    QString fromAddress;
    QStringList toAddresses;
    QStringList ccAddresses;
    QStringList bccAddresses;
    QString subject;
    QString bodyText;
    QString bodyHtml;
    bool isRead{false};
    bool isStarred{false};
    bool isArchived{false};
    QString direction{"INBOUND"}; // INBOUND or OUTBOUND
    QDateTime receivedAt;
    QList<EmailAttachment> attachments;

    static EmailItem fromJson(const QJsonObject& obj) {
        EmailItem item;
        item.id = obj["id"].toString();
        item.messageId = obj["message_id"].toString();
        item.threadId = obj["thread_id"].toString();
        item.aliasTarget = obj["alias_target"].toString();
        item.fromName = obj["from_name"].toString();
        item.fromAddress = obj["from_address"].toString();

        const QJsonArray toArr = obj["to_addresses"].toArray();
        for (const auto& v : toArr) item.toAddresses.append(v.toString());

        const QJsonArray ccArr = obj["cc_addresses"].toArray();
        for (const auto& v : ccArr) item.ccAddresses.append(v.toString());

        const QJsonArray bccArr = obj["bcc_addresses"].toArray();
        for (const auto& v : bccArr) item.bccAddresses.append(v.toString());

        item.subject = obj["subject"].toString();
        item.bodyText = obj["body_text"].toString();
        item.bodyHtml = obj["body_html"].toString();
        item.isRead = obj["is_read"].toBool(false);
        item.isStarred = obj["is_starred"].toBool(false);
        item.isArchived = obj["is_archived"].toBool(false);
        item.direction = obj["direction"].toString("INBOUND");

        const QString dateStr = obj["received_at"].toString();
        item.receivedAt = QDateTime::fromString(dateStr, Qt::ISODate);

        if (obj.contains("attachments") && obj["attachments"].isArray()) {
            const QJsonArray attArr = obj["attachments"].toArray();
            for (const auto& v : attArr) {
                if (v.isObject()) {
                    item.attachments.append(EmailAttachment::fromJson(v.toObject()));
                }
            }
        }

        return item;
    }
};

struct SendPayload {
    QString fromAlias;
    QStringList to;
    QStringList cc;
    QStringList bcc;
    QString subject;
    QString bodyText;
    QString bodyHtml;
    QString inReplyTo;
    QString threadId;

    QJsonObject toJson() const {
        QJsonObject obj;
        obj["from_alias"] = fromAlias;

        QJsonArray toArr;
        for (const auto& s : to) toArr.append(s);
        obj["to"] = toArr;

        QJsonArray ccArr;
        for (const auto& s : cc) ccArr.append(s);
        obj["cc"] = ccArr;

        QJsonArray bccArr;
        for (const auto& s : bcc) bccArr.append(s);
        obj["bcc"] = bccArr;

        obj["subject"] = subject;
        obj["body_text"] = bodyText;
        obj["body_html"] = bodyHtml;
        if (!inReplyTo.isEmpty()) obj["in_reply_to"] = inReplyTo;
        if (!threadId.isEmpty()) obj["thread_id"] = threadId;
        return obj;
    }
};

} // namespace Ramazanoglu
