// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - C++20 QT 6 DESKTOP APPLICATION ENTRYPOINT
// =============================================================================

#include <QApplication>
#include <QIcon>
#include <QFile>
#include <QTextStream>
#include <QDir>
#include <QDebug>
#include "MainWindow.h"

int main(int argc, char* argv[]) {
    // Enable High-DPI Scaling for crisp 4K / Retina typography
    QApplication::setHighDpiScaleFactorRoundingPolicy(
        Qt::HighDpiScaleFactorRoundingPolicy::PassThrough);

    QApplication app(argc, argv);
    app.setOrganizationName("Ramazanoglu Technologies Inc.");
    app.setOrganizationDomain("ramazanoglu.tech");
    app.setApplicationName("Ramazanoglu Tech Mail HQ");
    app.setApplicationVersion("1.0.0");
    app.setWindowIcon(QIcon(":/app.ico"));

    // Load Swiss-Style Architectural Minimalist Stylesheet
    QFile qssFile(":/theme.qss");
    if (!qssFile.exists()) {
        // Fallback for direct development running from source tree
        qssFile.setFileName(QDir::current().filePath("resources/theme.qss"));
    }

    if (qssFile.open(QFile::ReadOnly | QFile::Text)) {
        QTextStream stream(&qssFile);
        QString stylesheet = stream.readAll();
        app.setStyleSheet(stylesheet);
        qssFile.close();
        qDebug() << "[THEME] Successfully applied Swiss-Style Architectural Minimalism stylesheet.";
    }
    app.setQuitOnLastWindowClosed(false);

    Ramazanoglu::MainWindow mainWindow;
    mainWindow.show();
    mainWindow.raise();
    mainWindow.activateWindow();

    return app.exec();
}
