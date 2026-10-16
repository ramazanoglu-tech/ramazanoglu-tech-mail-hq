// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - C++20 QT 6 MAIN WINDOW IMPLEMENTATION
// Swiss-Style Architectural Minimalism & Cloud-Synced Zero-Local Dependency
// =============================================================================

#include "MainWindow.h"
#include "ComposeDialog.h"
#include "AddAliasDialog.h"

#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QGridLayout>
#include <QSplitter>
#include <QFrame>
#include <QMessageBox>
#include <QDateTime>
#include <QApplication>
#include <QStyle>
#include <QDebug>
#include <QFile>
#include <QDir>
#include <QJsonDocument>
#include <QJsonObject>

namespace Ramazanoglu {

MainWindow::MainWindow(QWidget* parent) : QMainWindow(parent) {
    setWindowTitle("RAMAZANOĞLU TECH // MAIL HQ (SUPER ADMIN SUITE)");
    setWindowIcon(QIcon(":/app.ico"));
    resize(1440, 900);
    setMinimumSize(1100, 700);

    QString baseUrl = "http://localhost:8765";
    QString wsUrl = "ws://localhost:8765/ws";
    QString adminKey = "RamazanogluTech2026!Master";

    QString configPath = QDir(QCoreApplication::applicationDirPath()).filePath("config.json");
    if (QFile::exists(configPath)) {
        QFile cfgFile(configPath);
        if (cfgFile.open(QFile::ReadOnly | QFile::Text)) {
            QJsonDocument doc = QJsonDocument::fromJson(cfgFile.readAll());
            if (doc.isObject()) {
                QJsonObject root = doc.object();
                if (root.contains("api_base_url")) baseUrl = root["api_base_url"].toString();
                if (root.contains("ws_url")) wsUrl = root["ws_url"].toString();
                if (root.contains("super_admin_key")) adminKey = root["super_admin_key"].toString();
                qDebug() << "[CONFIG] Loaded external configuration from config.json. Endpoint:" << baseUrl;
            }
        }
    }

    // Initialize Network Client
    m_apiClient = new ApiClient(baseUrl, wsUrl, this);
    m_apiClient->setSuperAdminKey(adminKey);

    connect(m_apiClient, &ApiClient::aliasesLoaded, this, &MainWindow::onAliasesLoaded);
    connect(m_apiClient, &ApiClient::aliasCreated, this, &MainWindow::onAliasCreated);
    connect(m_apiClient, &ApiClient::emailsLoaded, this, &MainWindow::onEmailsLoaded);
    connect(m_apiClient, &ApiClient::emailDetailsLoaded, this, &MainWindow::onEmailDetailsLoaded);
    connect(m_apiClient, &ApiClient::emailUpdated, this, &MainWindow::onEmailUpdated);
    connect(m_apiClient, &ApiClient::emailDeleted, this, &MainWindow::onEmailDeleted);
    connect(m_apiClient, &ApiClient::emailSent, this, &MainWindow::onEmailSent);
    connect(m_apiClient, &ApiClient::emailReceived, this, &MainWindow::onEmailReceived);
    connect(m_apiClient, &ApiClient::wsConnected, this, &MainWindow::onWsConnected);
    connect(m_apiClient, &ApiClient::wsDisconnected, this, &MainWindow::onWsDisconnected);

    setupUi();
    setupSystemTray();

    // Kickoff initial cloud fetch & live websocket connection
    m_apiClient->fetchAliases();
    m_apiClient->fetchEmails(m_selectedAlias, m_selectedFilter, m_searchQuery);
    m_apiClient->connectWebSocket();
}

MainWindow::~MainWindow() = default;

void MainWindow::closeEvent(QCloseEvent* event) {
    if (m_trayIcon && m_trayIcon->isVisible()) {
        hide();
        m_trayIcon->showMessage("Ramazanoğlu Tech Mail HQ",
                                "Uygulama arka planda bulut IMAP/WebSocket akışını dinlemeye devam ediyor.",
                                QSystemTrayIcon::Information, 3000);
        event->ignore();
    } else {
        event->accept();
    }
}

void MainWindow::setupSystemTray() {
    m_trayIcon = new QSystemTrayIcon(this);
    m_trayIcon->setIcon(QIcon(":/app.ico"));
    m_trayIcon->setToolTip("Ramazanoğlu Tech Mail HQ // Super Admin");

    m_trayMenu = new QMenu(this);
    auto* showAction = m_trayMenu->addAction("Ramazanoğlu Tech HQ'yu Aç");
    connect(showAction, &QAction::triggered, this, [this]() {
        showNormal();
        activateWindow();
    });

    auto* composeAction = m_trayMenu->addAction("Yeni E-Posta Yaz...");
    connect(composeAction, &QAction::triggered, this, &MainWindow::onOpenComposeDialog);

    m_trayMenu->addSeparator();
    auto* quitAction = m_trayMenu->addAction("Tamamen Kapat");
    connect(quitAction, &QAction::triggered, qApp, &QApplication::quit);

    m_trayIcon->setContextMenu(m_trayMenu);
    connect(m_trayIcon, &QSystemTrayIcon::activated, this, &MainWindow::onTrayIconActivated);
    m_trayIcon->show();
}

void MainWindow::onTrayIconActivated(QSystemTrayIcon::ActivationReason reason) {
    if (reason == QSystemTrayIcon::DoubleClick || reason == QSystemTrayIcon::Trigger) {
        showNormal();
        activateWindow();
    }
}

void MainWindow::setupUi() {
    auto* centralWidget = new QWidget(this);
    centralWidget->setObjectName("centralWidget");
    setCentralWidget(centralWidget);

    auto* rootLayout = new QHBoxLayout(centralWidget);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    // =========================================================================
    // 1. SOL SÜTUN: DEPARTMAN & ALIAS NAVİGASYONU (240px Sabit Genişlik)
    // =========================================================================
    auto* leftCol = new QWidget(centralWidget);
    leftCol->setFixedWidth(240);
    leftCol->setObjectName("leftColumn");
    leftCol->setStyleSheet("background-color: #F3F3EE; border-right: 1px solid #E2E2DC;");

    auto* leftLayout = new QVBoxLayout(leftCol);
    leftLayout->setContentsMargins(16, 20, 16, 16);
    leftLayout->setSpacing(12);

    // Header Branding
    auto* brandTitle = new QLabel("RAMAZANOĞLU TECH", leftCol);
    brandTitle->setStyleSheet("font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: bold; letter-spacing: 1.5px; color: #111111;");
    leftLayout->addWidget(brandTitle);

    auto* suiteTitle = new QLabel("MAIL HQ // SUPER ADMIN", leftCol);
    suiteTitle->setStyleSheet("font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #666662; letter-spacing: 1px; margin-bottom: 6px;");
    leftLayout->addWidget(suiteTitle);

    // Status Indicator Pill
    m_statusLabel = new QLabel("● BULUT: BAĞLANIYOR...", leftCol);
    m_statusLabel->setStyleSheet("font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: bold; background: #E2E2DC; color: #666662; padding: 4px 8px; border: 1px solid #D2D2CC;");
    leftLayout->addWidget(m_statusLabel);

    // Global Compose Button
    auto* newMailBtn = new QPushButton("YENİ E-POSTA YAZ", leftCol);
    newMailBtn->setStyleSheet("background: #111111; color: #FFFFFF; font-family: 'JetBrains Mono'; font-weight: bold; font-size: 11px; padding: 10px; border: none; letter-spacing: 0.5px; margin-top: 8px;");
    connect(newMailBtn, &QPushButton::clicked, this, &MainWindow::onOpenComposeDialog);
    leftLayout->addWidget(newMailBtn);

    // Navigation Section Label
    auto* navHeader = new QLabel("DEPARTMAN FİLTRELERİ", leftCol);
    navHeader->setStyleSheet("font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: bold; color: #666662; margin-top: 12px;");
    leftLayout->addWidget(navHeader);

    // Alias List Widget
    m_aliasNavList = new QListWidget(leftCol);
    m_aliasNavList->setStyleSheet("QListWidget { background: transparent; border: none; font-family: 'JetBrains Mono', monospace; font-size: 12px; } QListWidget::item { padding: 8px 6px; border-bottom: 1px solid #E2E2DC; } QListWidget::item:selected { background: #E2E2DC; color: #111111; font-weight: bold; }");
    connect(m_aliasNavList, &QListWidget::itemClicked, this, &MainWindow::onAliasFilterClicked);

    // Master Traffic Item (Always present at the top)
    auto* masterItem = new QListWidgetItem("ALL TRAFFIC [MASTER]", m_aliasNavList);
    masterItem->setData(Qt::UserRole, "all");
    m_aliasNavList->setCurrentItem(masterItem);
    leftLayout->addWidget(m_aliasNavList, 1);

    // Add Department Button
    m_addAliasBtn = new QPushButton("+ YENİ DEPARTMAN EKLE", leftCol);
    m_addAliasBtn->setStyleSheet("background: #FFFFFF; color: #111111; border: 1px solid #E2E2DC; font-family: 'JetBrains Mono'; font-weight: bold; font-size: 11px; padding: 8px;");
    connect(m_addAliasBtn, &QPushButton::clicked, this, &MainWindow::onOpenAddAliasDialog);
    leftLayout->addWidget(m_addAliasBtn);

    // Dev Simulation Button
    m_simulateBtn = new QPushButton("[TEST: MAİL SİMÜLE ET]", leftCol);
    m_simulateBtn->setStyleSheet("background: #F3F3EE; color: #666662; border: 1px dashed #D2D2CC; font-family: 'JetBrains Mono'; font-size: 10px; padding: 6px;");
    connect(m_simulateBtn, &QPushButton::clicked, this, &MainWindow::onSimulateIncomingMail);
    leftLayout->addWidget(m_simulateBtn);

    rootLayout->addWidget(leftCol);

    // =========================================================================
    // 2. ORTA SÜTUN: FİLTRELENMİŞ MAİL LİSTESİ (360px Sabit Genişlik)
    // =========================================================================
    auto* midCol = new QWidget(centralWidget);
    midCol->setFixedWidth(360);
    midCol->setObjectName("middleColumn");
    midCol->setStyleSheet("background-color: #FBFBF9; border-right: 1px solid #E2E2DC;");

    auto* midLayout = new QVBoxLayout(midCol);
    midLayout->setContentsMargins(16, 16, 16, 16);
    midLayout->setSpacing(10);

    // Search Bar
    m_searchEdit = new QLineEdit(midCol);
    m_searchEdit->setPlaceholderText("Maillerde ara (Kimden, Konu, İçerik)...");
    m_searchEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 8px 10px; font-family: 'Inter'; font-size: 12px;");
    m_searchEdit->setClearButtonEnabled(true);
    connect(m_searchEdit, &QLineEdit::textChanged, this, &MainWindow::onSearchTextChanged);
    midLayout->addWidget(m_searchEdit);

    // Segmented Filter Bar
    auto* filterBar = new QHBoxLayout();
    filterBar->setSpacing(4);

    auto makeFilterBtn = [this, filterBar](const QString& label, const QString& tabId, bool isDefault = false) -> QPushButton* {
        auto* btn = new QPushButton(label, this);
        btn->setStyleSheet(isDefault
            ? "background: #111111; color: #FFFFFF; border: none; font-family: 'JetBrains Mono'; font-size: 10px; font-weight: bold; padding: 6px 0;"
            : "background: #F3F3EE; color: #666662; border: 1px solid #E2E2DC; font-family: 'JetBrains Mono'; font-size: 10px; padding: 6px 0;");
        connect(btn, &QPushButton::clicked, this, [this, tabId]() { onFilterTabChanged(tabId); });
        filterBar->addWidget(btn);
        return btn;
    };

    m_tabAllBtn = makeFilterBtn("TÜMÜ", "all", true);
    m_tabUnreadBtn = makeFilterBtn("OKUNMAMIŞ", "unread");
    m_tabStarredBtn = makeFilterBtn("YILDIZLI", "starred");
    m_tabSentBtn = makeFilterBtn("GÖNDERİLEN", "sent");
    midLayout->addLayout(filterBar);

    // Counter Label
    m_listCountLabel = new QLabel("Yükleniyor...", midCol);
    m_listCountLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; color: #666662; padding: 2px 0;");
    midLayout->addWidget(m_listCountLabel);

    // Emails List Widget
    m_emailListWidget = new QListWidget(midCol);
    m_emailListWidget->setStyleSheet("QListWidget { background: #FFFFFF; border: 1px solid #E2E2DC; } QListWidget::item { border-bottom: 1px solid #E2E2DC; padding: 0px; } QListWidget::item:selected { background: #F3F3EE; }");
    connect(m_emailListWidget, &QListWidget::itemSelectionChanged, this, &MainWindow::onEmailSelectionChanged);
    midLayout->addWidget(m_emailListWidget, 1);

    rootLayout->addWidget(midCol);

    // =========================================================================
    // 3. SAĞ SÜTUN: OKUMA & HIZLI YANITLAMA PANİ (Esnek Genişlik)
    // =========================================================================
    auto* rightCol = new QWidget(centralWidget);
    rightCol->setObjectName("rightColumn");
    rightCol->setStyleSheet("background-color: #FBFBF9;");

    auto* rightLayout = new QVBoxLayout(rightCol);
    rightLayout->setContentsMargins(0, 0, 0, 0);
    rightLayout->setSpacing(0);

    // Empty View Placeholder
    m_emptyViewWidget = new QWidget(rightCol);
    auto* emptyLayout = new QVBoxLayout(m_emptyViewWidget);
    emptyLayout->setAlignment(Qt::AlignCenter);
    auto* emptyIcon = new QLabel("✉", m_emptyViewWidget);
    emptyIcon->setStyleSheet("font-size: 48px; color: #D2D2CC;");
    emptyIcon->setAlignment(Qt::AlignCenter);
    auto* emptyText = new QLabel("Görüntülemek için soldan bir e-posta seçin.", m_emptyViewWidget);
    emptyText->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 13px; color: #666662; margin-top: 8px;");
    emptyText->setAlignment(Qt::AlignCenter);
    emptyLayout->addWidget(emptyIcon);
    emptyLayout->addWidget(emptyText);
    rightLayout->addWidget(m_emptyViewWidget, 1);

    // Detail View Container
    m_detailViewWidget = new QWidget(rightCol);
    auto* detailLayout = new QVBoxLayout(m_detailViewWidget);
    detailLayout->setContentsMargins(24, 20, 24, 20);
    detailLayout->setSpacing(14);

    // Detail Action Bar (Top)
    auto* actionBar = new QHBoxLayout();
    actionBar->setSpacing(8);

    m_detailBadgeLabel = new QLabel("[DEPARTMAN]", m_detailViewWidget);
    m_detailBadgeLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-weight: bold; font-size: 11px; background: #111111; color: #FFFFFF; padding: 4px 8px;");
    actionBar->addWidget(m_detailBadgeLabel);

    actionBar->addStretch(1);

    m_starBtn = new QPushButton("★ YILDIZLA", m_detailViewWidget);
    m_starBtn->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; font-family: 'JetBrains Mono'; font-size: 11px; padding: 6px 12px;");
    connect(m_starBtn, &QPushButton::clicked, this, &MainWindow::onToggleStarCurrentEmail);
    actionBar->addWidget(m_starBtn);

    m_readBtn = new QPushButton("OKUNDU İŞARETLE", m_detailViewWidget);
    m_readBtn->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; font-family: 'JetBrains Mono'; font-size: 11px; padding: 6px 12px;");
    connect(m_readBtn, &QPushButton::clicked, this, &MainWindow::onToggleReadCurrentEmail);
    actionBar->addWidget(m_readBtn);

    m_deleteBtn = new QPushButton("SİL", m_detailViewWidget);
    m_deleteBtn->setStyleSheet("background: #FFFFFF; color: #D9381E; border: 1px solid #E2E2DC; font-family: 'JetBrains Mono'; font-size: 11px; padding: 6px 12px;");
    connect(m_deleteBtn, &QPushButton::clicked, this, &MainWindow::onDeleteCurrentEmail);
    actionBar->addWidget(m_deleteBtn);

    detailLayout->addLayout(actionBar);

    // Subject Title
    m_detailSubjectLabel = new QLabel(m_detailViewWidget);
    m_detailSubjectLabel->setStyleSheet("font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.02em;");
    m_detailSubjectLabel->setWordWrap(true);
    detailLayout->addWidget(m_detailSubjectLabel);

    // Metadata Card
    auto* metaBox = new QFrame(m_detailViewWidget);
    metaBox->setStyleSheet("background: #F3F3EE; border: 1px solid #E2E2DC; padding: 8px;");
    auto* metaLayout = new QGridLayout(metaBox);
    metaLayout->setHorizontalSpacing(16);
    metaLayout->setVerticalSpacing(4);

    auto makeMetaRow = [metaLayout, metaBox](int row, const QString& labelText, QLabel*& valLabel) {
        auto* lbl = new QLabel(labelText, metaBox);
        lbl->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; color: #666662; font-weight: bold;");
        valLabel = new QLabel(metaBox);
        valLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; color: #111111;");
        metaLayout->addWidget(lbl, row, 0);
        metaLayout->addWidget(valLabel, row, 1);
    };

    makeMetaRow(0, "KİMDEN (FROM):", m_detailFromLabel);
    makeMetaRow(1, "KİME (TO):", m_detailToLabel);
    makeMetaRow(2, "TARİH (DATE):", m_detailDateLabel);
    makeMetaRow(3, "MESSAGE-ID:", m_detailMessageIdLabel);
    detailLayout->addWidget(metaBox);

    // Email Body Browser
    m_bodyBrowser = new QTextBrowser(m_detailViewWidget);
    m_bodyBrowser->setOpenExternalLinks(true);
    m_bodyBrowser->setStyleSheet("QTextBrowser { background: #FFFFFF; border: 1px solid #E2E2DC; padding: 16px; font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.6; color: #111111; }");
    detailLayout->addWidget(m_bodyBrowser, 1);

    // =========================================================================
    // HIZLI YANITLA (QUICK REPLY) ÇEKMECESİ - AKILLI KİMLİK SEÇİCİ
    // =========================================================================
    auto* replyDrawer = new QFrame(m_detailViewWidget);
    replyDrawer->setStyleSheet("background: #F3F3EE; border: 1px solid #E2E2DC; padding: 12px;");
    auto* replyLayout = new QVBoxLayout(replyDrawer);
    replyLayout->setContentsMargins(12, 12, 12, 12);
    replyLayout->setSpacing(8);

    auto* replyTitleRow = new QHBoxLayout();
    auto* replyTitle = new QLabel("HIZLI YANITLA // AKILLI KİMLİK EŞLEŞTİRME", replyDrawer);
    replyTitle->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; font-weight: bold; color: #111111;");
    replyTitleRow->addWidget(replyTitle);

    replyTitleRow->addStretch(1);

    auto* fromLabel = new QLabel("GÖNDERİCİ (FROM):", replyDrawer);
    fromLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 11px; color: #666662; font-weight: bold;");
    replyTitleRow->addWidget(fromLabel);

    m_replyFromCombo = new QComboBox(replyDrawer);
    m_replyFromCombo->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; font-family: 'JetBrains Mono'; font-size: 11px; padding: 4px;");
    replyTitleRow->addWidget(m_replyFromCombo);

    replyLayout->addLayout(replyTitleRow);

    m_replySubjectEdit = new QLineEdit(replyDrawer);
    m_replySubjectEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 6px; font-family: 'JetBrains Mono'; font-size: 11px;");
    replyLayout->addWidget(m_replySubjectEdit);

    m_replyBodyEdit = new QTextEdit(replyDrawer);
    m_replyBodyEdit->setPlaceholderText("Yanıtınızı buraya yazın...");
    m_replyBodyEdit->setFixedHeight(80);
    m_replyBodyEdit->setStyleSheet("background: #FFFFFF; border: 1px solid #E2E2DC; padding: 8px; font-family: 'Inter'; font-size: 12px;");
    replyLayout->addWidget(m_replyBodyEdit);

    auto* replyActionRow = new QHBoxLayout();
    replyActionRow->addStretch(1);

    m_sendQuickReplyBtn = new QPushButton("YANITLA VE GÖNDER (SMTP)", replyDrawer);
    m_sendQuickReplyBtn->setStyleSheet("background: #111111; color: #FFFFFF; border: none; font-family: 'JetBrains Mono'; font-size: 11px; font-weight: bold; padding: 8px 20px;");
    connect(m_sendQuickReplyBtn, &QPushButton::clicked, this, &MainWindow::onSendQuickReply);
    replyActionRow->addWidget(m_sendQuickReplyBtn);

    replyLayout->addLayout(replyActionRow);
    detailLayout->addWidget(replyDrawer);

    m_detailViewWidget->hide();
    rightLayout->addWidget(m_detailViewWidget, 1);

    rootLayout->addWidget(rightCol, 1);
}

void MainWindow::updateStatusIndicator(bool connected) {
    if (connected) {
        m_statusLabel->setText("● BULUT: CANLI BAĞLI");
        m_statusLabel->setStyleSheet("font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: bold; background: #111111; color: #FFFFFF; padding: 4px 8px;");
    } else {
        m_statusLabel->setText("○ BULUT: BAĞLANTI KOPTU");
        m_statusLabel->setStyleSheet("font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: bold; background: #E2E2DC; color: #D9381E; padding: 4px 8px;");
    }
}

void MainWindow::onWsConnected() {
    updateStatusIndicator(true);
}

void MainWindow::onWsDisconnected() {
    updateStatusIndicator(false);
}

void MainWindow::onAliasesLoaded(const QList<EmailAlias>& aliases) {
    m_aliases = aliases;

    // Repopulate Navigation List while preserving master item
    m_aliasNavList->clear();
    auto* masterItem = new QListWidgetItem("ALL TRAFFIC [MASTER]", m_aliasNavList);
    masterItem->setData(Qt::UserRole, "all");

    for (const auto& a : m_aliases) {
        auto* item = new QListWidgetItem(QString("%1 %2").arg(a.departmentBadge, a.email), m_aliasNavList);
        item->setData(Qt::UserRole, a.email);
    }

    // Set selection
    for (int i = 0; i < m_aliasNavList->count(); ++i) {
        if (m_aliasNavList->item(i)->data(Qt::UserRole).toString() == m_selectedAlias) {
            m_aliasNavList->setCurrentRow(i);
            break;
        }
    }

    // Repopulate Reply Combo
    m_replyFromCombo->clear();
    for (const auto& a : m_aliases) {
        m_replyFromCombo->addItem(QString("%1 <%2>").arg(a.departmentBadge, a.email), a.email);
    }
}

void MainWindow::onAliasCreated(const EmailAlias& alias) {
    m_aliases.append(alias);
    auto* item = new QListWidgetItem(QString("%1 %2").arg(alias.departmentBadge, alias.email), m_aliasNavList);
    item->setData(Qt::UserRole, alias.email);
    m_replyFromCombo->addItem(QString("%1 <%2>").arg(alias.departmentBadge, alias.email), alias.email);
    QMessageBox::information(this, "Başarılı", QString("Departman %1 başarıyla eklendi.").arg(alias.email));
}

void MainWindow::onEmailsLoaded(const QList<EmailItem>& emails, int total) {
    m_emails = emails;
    m_emailListWidget->clear();

    m_listCountLabel->setText(QString("%1 e-posta listelendi (Toplam: %2)").arg(emails.size()).arg(total));

    for (const auto& email : emails) {
        auto* listItem = new QListWidgetItem(m_emailListWidget);
        listItem->setSizeHint(QSize(340, 78));
        listItem->setData(Qt::UserRole, email.id);

        QWidget* itemWidget = createEmailListItemWidget(email);
        m_emailListWidget->setItemWidget(listItem, itemWidget);
    }

    if (m_emails.isEmpty()) {
        m_detailViewWidget->hide();
        m_emptyViewWidget->show();
        m_selectedEmail.reset();
    }
}

QWidget* MainWindow::createEmailListItemWidget(const EmailItem& item) {
    auto* widget = new QWidget();
    widget->setStyleSheet("background: transparent;");

    auto* layout = new QVBoxLayout(widget);
    layout->setContentsMargins(12, 8, 12, 8);
    layout->setSpacing(3);

    // Row 1: Badge + Sender + Timestamp
    auto* row1 = new QHBoxLayout();
    row1->setSpacing(6);

    // Find badge for target alias
    QString badge = "[RT]";
    for (const auto& a : m_aliases) {
        if (a.email.compare(item.aliasTarget, Qt::CaseInsensitive) == 0) {
            badge = a.departmentBadge;
            break;
        }
    }

    auto* badgeLabel = new QLabel(badge, widget);
    badgeLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 10px; font-weight: bold; background: #E2E2DC; color: #111111; padding: 2px 4px;");
    row1->addWidget(badgeLabel);

    QString senderText = item.fromName.isEmpty() ? item.fromAddress : item.fromName;
    auto* senderLabel = new QLabel(senderText, widget);
    senderLabel->setStyleSheet(item.isRead ? "font-size: 12px; color: #666662;" : "font-size: 12px; font-weight: bold; color: #111111;");
    row1->addWidget(senderLabel, 1);

    auto* timeLabel = new QLabel(item.receivedAt.toString("dd.MM hh:mm"), widget);
    timeLabel->setStyleSheet("font-family: 'JetBrains Mono'; font-size: 10px; color: #999990;");
    row1->addWidget(timeLabel);

    layout->addLayout(row1);

    // Row 2: Subject
    auto* subj = new QLabel(item.subject, widget);
    subj->setStyleSheet(item.isRead ? "font-size: 12px; color: #333330;" : "font-size: 12px; font-weight: bold; color: #111111;");
    layout->addWidget(subj);

    // Row 3: Snippet
    QString snippet = item.bodyText.left(75).replace("\n", " ");
    auto* snipLabel = new QLabel(snippet, widget);
    snipLabel->setStyleSheet("font-size: 11px; color: #666662;");
    layout->addWidget(snipLabel);

    return widget;
}

void MainWindow::onEmailSelectionChanged() {
    auto* curItem = m_emailListWidget->currentItem();
    if (!curItem) return;

    QString emailId = curItem->data(Qt::UserRole).toString();
    for (const auto& e : m_emails) {
        if (e.id == emailId) {
            m_selectedEmail = e;
            onEmailDetailsLoaded(e);
            if (!e.isRead) {
                m_apiClient->updateEmailStatus(e.id, true, std::nullopt, std::nullopt);
            }
            break;
        }
    }
}

void MainWindow::onEmailDetailsLoaded(const EmailItem& email) {
    m_emptyViewWidget->hide();
    m_detailViewWidget->show();

    // Populate Headers
    m_detailSubjectLabel->setText(email.subject);

    // Badge
    QString badge = "[RT]";
    for (const auto& a : m_aliases) {
        if (a.email.compare(email.aliasTarget, Qt::CaseInsensitive) == 0) {
            badge = a.departmentBadge;
            break;
        }
    }
    m_detailBadgeLabel->setText(QString("%1 %2").arg(badge, email.aliasTarget));

    m_detailFromLabel->setText(QString("%1 <%2>").arg(email.fromName, email.fromAddress));
    m_detailToLabel->setText(email.toAddresses.join(", "));
    m_detailDateLabel->setText(email.receivedAt.toString("yyyy-MM-dd hh:mm:ss t"));
    m_detailMessageIdLabel->setText(email.messageId);

    // Star & Read button labels
    m_starBtn->setText(email.isStarred ? "★ YILDIZLI" : "☆ YILDIZLA");
    m_readBtn->setText(email.isRead ? "OKUNMADI YAP" : "OKUNDU İŞARETLE");

    // Email Body
    if (!email.bodyHtml.isEmpty()) {
        m_bodyBrowser->setHtml(email.bodyHtml);
    } else {
        m_bodyBrowser->setPlainText(email.bodyText);
    }

    // Smart Identity Selection for Quick Reply Drawer
    for (int i = 0; i < m_replyFromCombo->count(); ++i) {
        if (m_replyFromCombo->itemData(i).toString().compare(email.aliasTarget, Qt::CaseInsensitive) == 0) {
            m_replyFromCombo->setCurrentIndex(i);
            break;
        }
    }

    QString replySubj = email.subject;
    if (!replySubj.startsWith("Re:", Qt::CaseInsensitive)) {
        replySubj = "Re: " + replySubj;
    }
    m_replySubjectEdit->setText(replySubj);
    m_replyBodyEdit->clear();
}

void MainWindow::onEmailUpdated(const EmailItem& email) {
    for (int i = 0; i < m_emails.size(); ++i) {
        if (m_emails[i].id == email.id) {
            m_emails[i] = email;
            break;
        }
    }
    if (m_selectedEmail && m_selectedEmail->id == email.id) {
        m_selectedEmail = email;
        m_starBtn->setText(email.isStarred ? "★ YILDIZLI" : "☆ YILDIZLA");
        m_readBtn->setText(email.isRead ? "OKUNMADI YAP" : "OKUNDU İŞARETLE");
    }
}

void MainWindow::onEmailDeleted(const QString& id) {
    m_emails.removeIf([&id](const EmailItem& e) { return e.id == id; });
    m_apiClient->fetchEmails(m_selectedAlias, m_selectedFilter, m_searchQuery);
}

void MainWindow::onEmailSent(const EmailItem& email) {
    Q_UNUSED(email);
    m_apiClient->fetchEmails(m_selectedAlias, m_selectedFilter, m_searchQuery);
}

void MainWindow::onEmailReceived(const EmailItem& email) {
    // 1. Windows Native System Tray Notification
    if (m_trayIcon) {
        QString notifyMsg = QString("[%1] Kimden: %2\nKonu: %3")
                                .arg(email.aliasTarget, email.fromAddress, email.subject);
        m_trayIcon->showMessage("Yeni E-Posta [@ramazanoglu.tech]", notifyMsg,
                                QSystemTrayIcon::Information, 6000);
    }

    // 2. Refresh active email list if relevant
    m_apiClient->fetchEmails(m_selectedAlias, m_selectedFilter, m_searchQuery);
}

void MainWindow::onAliasFilterClicked(QListWidgetItem* item) {
    if (!item) return;
    m_selectedAlias = item->data(Qt::UserRole).toString();
    m_apiClient->fetchEmails(m_selectedAlias, m_selectedFilter, m_searchQuery);
}

void MainWindow::onFilterTabChanged(const QString& tab) {
    m_selectedFilter = tab;

    auto updateBtnStyle = [this](QPushButton* btn, bool active) {
        btn->setStyleSheet(active
            ? "background: #111111; color: #FFFFFF; border: none; font-family: 'JetBrains Mono'; font-size: 10px; font-weight: bold; padding: 6px 0;"
            : "background: #F3F3EE; color: #666662; border: 1px solid #E2E2DC; font-family: 'JetBrains Mono'; font-size: 10px; padding: 6px 0;");
    };

    updateBtnStyle(m_tabAllBtn, tab == "all");
    updateBtnStyle(m_tabUnreadBtn, tab == "unread");
    updateBtnStyle(m_tabStarredBtn, tab == "starred");
    updateBtnStyle(m_tabSentBtn, tab == "sent");

    m_apiClient->fetchEmails(m_selectedAlias, m_selectedFilter, m_searchQuery);
}

void MainWindow::onSearchTextChanged(const QString& query) {
    m_searchQuery = query;
    m_apiClient->fetchEmails(m_selectedAlias, m_selectedFilter, m_searchQuery);
}

void MainWindow::onOpenComposeDialog() {
    ComposeDialog dlg(m_aliases, "yusuf@ramazanoglu.tech", this);
    if (dlg.exec() == QDialog::Accepted) {
        SendPayload payload = dlg.getPayload();
        m_apiClient->sendEmail(payload);
    }
}

void MainWindow::onOpenAddAliasDialog() {
    AddAliasDialog dlg(this);
    if (dlg.exec() == QDialog::Accepted) {
        m_apiClient->createAlias(dlg.getEmail(), dlg.getDisplayName(),
                                 dlg.getBadge(), dlg.getSignatureHtml());
    }
}

void MainWindow::onToggleStarCurrentEmail() {
    if (!m_selectedEmail) return;
    bool newStarred = !m_selectedEmail->isStarred;
    m_apiClient->updateEmailStatus(m_selectedEmail->id, std::nullopt, newStarred, std::nullopt);
}

void MainWindow::onToggleReadCurrentEmail() {
    if (!m_selectedEmail) return;
    bool newRead = !m_selectedEmail->isRead;
    m_apiClient->updateEmailStatus(m_selectedEmail->id, newRead, std::nullopt, std::nullopt);
}

void MainWindow::onDeleteCurrentEmail() {
    if (!m_selectedEmail) return;
    auto reply = QMessageBox::question(this, "E-Postayı Sil",
                                       "Bu e-postayı bulut veritabanından kalıcı olarak silmek istiyor musunuz?",
                                       QMessageBox::Yes | QMessageBox::No);
    if (reply == QMessageBox::Yes) {
        m_apiClient->deleteEmail(m_selectedEmail->id);
    }
}

void MainWindow::onSendQuickReply() {
    if (!m_selectedEmail) return;
    QString replyText = m_replyBodyEdit->toPlainText().trimmed();
    if (replyText.isEmpty()) {
        QMessageBox::warning(this, "Hata", "Lütfen bir yanıt metni girin.");
        return;
    }

    SendPayload payload;
    payload.fromAlias = m_replyFromCombo->currentData().toString();
    payload.to = { m_selectedEmail->fromAddress };
    payload.subject = m_replySubjectEdit->text().trimmed();
    payload.bodyText = replyText;
    payload.bodyHtml = QString("<p>%1</p>").arg(replyText.toHtmlEscaped().replace("\n", "<br>"));
    payload.inReplyTo = m_selectedEmail->messageId;
    payload.threadId = m_selectedEmail->threadId.isEmpty() ? m_selectedEmail->messageId : m_selectedEmail->threadId;

    m_apiClient->sendEmail(payload);
    m_replyBodyEdit->clear();
    QMessageBox::information(this, "Gönderildi", QString("%1 üzerinden yanıt başarıyla SMTP ile iletildi.").arg(payload.fromAlias));
}

void MainWindow::onSimulateIncomingMail() {
    QString target = m_selectedAlias == "all" ? "info@ramazanoglu.tech" : m_selectedAlias;
    m_apiClient->simulateIncoming(target);
}

} // namespace Ramazanoglu
