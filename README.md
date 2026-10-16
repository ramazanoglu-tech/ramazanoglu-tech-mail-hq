# RAMAZANOĞLU TECH // MAIL HQ (SUPER ADMIN SUITE)

[![Architecture](https://img.shields.io/badge/Architecture-Swiss%20Minimalism-black.svg?style=flat-square)](https://ramazanoglu.tech)
[![C++](https://img.shields.io/badge/Desktop-C%2B%2B20%20%2F%20Qt%206.6.3-00599C.svg?style=flat-square&logo=c%2B%2B)](desktop-cpp/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%2024%20%2F%20TypeScript-339933.svg?style=flat-square&logo=node.js)](cloud-backend/)
[![PWA](https://img.shields.io/badge/Mobile-PWA%20%2F%20Vanilla%20JS-F7DF1E.svg?style=flat-square&logo=javascript)](mobile-pwa/)
[![Installer](https://img.shields.io/badge/Installer-.NET%2010%20WinForms-512BD4.svg?style=flat-square&logo=dotnet)](installer/)
[![Security](https://img.shields.io/badge/Zero--Trust-Enforced-red.svg?style=flat-square)](DOCUMENTATION.md)

> **Ramazanoğlu Technologies Inc.** kurumsal ortakları (Yusuf & Nur) ve mühendislik kadrosu için geliştirilmiş; yerel veritabanı şişmesi barındırmayan (**Zero-Local Dependency**), 7/24 Gmail TLS IMAP ve SSL SMTP motoruyla senkronize (**100% Cloud-Synced**) kurumsal e-posta yönetim merkezi.

Tüm tasarım dili, [ramazanoglu.tech](https://ramazanoglu.tech) kurumsal web sitesinin benimsediği **İsviçre Mimari Minimalizmi (Swiss Architectural Style)** ilkelerine (`#111111` Mürekkep, `#FBFBF9` Kağıt, `#D9381E` Uluslararası Turuncu odak karesi, sıfır border-radius, Inter ve JetBrains Mono tipografisi) göre geliştirilmiştir.

---

## 🏛️ Proje Mimarisi

Sistem 4 bağımsız ve entegre modülden oluşur:

```
ramazanoglu-tech-mail-hq/
├── cloud-backend/         # Node.js 24 + TypeScript Bulut Sunucu Motoru
│   ├── src/db.ts          # 54 Kurumsal Alias & Bellek İçi/PostgreSQL Veritabanı
│   ├── src/imapSync.ts    # 7/24 Gmail IMAP IDLE ve E-Posta İzolasyon Motoru
│   ├── src/smtpDispatcher.ts # Outbound SMTP Dispatcher & İsviçre İmza Enjeksiyonu
│   ├── src/websocket.ts   # Canlı E-Posta Akışı Broadcaster (<5ms)
│   ├── src/routes.ts      # Zero-Trust REST API (Rate-Limited, Protected)
│   └── src/templates.ts   # 6 Hazır Kurumsal & Ar-Ge İsviçre E-Posta Şablonu
│
├── desktop-cpp/           # Native Windows C++20 / Qt 6.6.3 Super Admin Suite
│   ├── src/MainWindow.cpp # 3 Sütunlu İsviçre Mimari Arayüzü & System Tray
│   ├── src/ApiClient.cpp  # REST & Canlı WebSocket İstemcisi
│   ├── src/ComposeDialog.cpp # Şablon Seçicili E-Posta Gönderim Penceresi
│   └── resources/         # app.ico, theme.qss ve vektörel SVG ikonlar
│
├── mobile-pwa/            # Mobil & Web İstemcisi (Responsive PWA)
│   ├── public/index.html  # Mobil PWA Arayüzü
│   ├── public/app.js      # Canlı WebSocket + REST Senkronizasyonu
│   └── public/sw.js       # Çevrimdışı Önbellek ve Service Worker
│
├── installer/             # Bağımsız Windows Kurulum Programı (.NET 10)
│   ├── InstallerForm.cs   # 6 Adımlı İsviçre Tarzı Kurulum Sihirbazı
│   └── SetupWizard.csproj # Self-Contained Tek Dosyalık Setup Derleyici
│
└── email-templates/       # Bağımsız Kullanıma Hazır 6 Adet HTML Şablonu
```

---

## 🛡️ Güvenlik & Zero-Trust Sertifikasyonu

- **Çift Modlu Yönetici Kimlik Doğrulaması:** Tüm REST ve WebSocket istekleri `X-Super-Admin-Key` veya `Bearer JWT` taşımak zorundadır. Yetkisiz istekler anında `401 Unauthorized` ile engellenir.
- **WebSocket Handshake Koruması:** `ws://.../ws` canlı dinleyicisine kimlik doğrulaması olmadan erişilemez (`1008 Policy Violation`).
- **CRLF Header Sanitization:** Konu ve alıcı adreslerindeki `\r\n` karakterleri filtrelenir; SMTP komut enjeksiyonu engellenir.
- **Brute-Force & Flooding Koruması:** IP bazlı sliding-window rate limiter aktiftir (Giriş: 15 dk/5, Gönderim: 1 dk/30, Sync: 1 dk/5).
- **HTTP Hardening:** `nosniff`, `SAMEORIGIN`, `1; mode=block` güvenlik başlıkları ve sıkı CORS kuralları aktiftir.

---

## 📬 54 Kurumsal Alias Matrisi

Sistemde 6 kategori altında çift dilli (İngilizce - Türkçe) toplam **54 kurumsal e-posta kimliği** tanımlıdır:
- **Kurucular:** `yusuf@ramazanoglu.tech` (`[YUSUF]`), `nur@ramazanoglu.tech` (`[NUR]`)
- **Genel & İletişim:** `contact@` / `iletisim@`, `info@` / `bilgi@`, `hello@` / `merhaba@`
- **Ar-Ge & Mühendislik:** `rd@` / `arge@`, `dev@` / `yazilim@`, `kod@` / `teknoloji@`, `labs@` / `laboratuvar@`, `security@` / `guvenlik@`
- **İş & Ortaklıklar:** `sales@` / `satis@`, `partners@` / `isortakliklari@`, `b2b@` / `kurumsal@`, `bizdev@` / `isgelistirme@`
- **Finans & Muhasebe:** `billing@` / `faturalandirma@`, `finance@` / `finans@`, `accounting@` / `muhasebe@`
- **Destek & Operasyon:** `support@` / `destek@`, `help@` / `yardim@`, `operations@` / `operasyon@`, `systems@` / `sistem@`
- **Yönetim & Kariyer:** `admin@` / `yonetim@`, `careers@` / `kariyer@`, `jobs@` / `staj@`, `press@` / `basin@`, `media@` / `medya@`, `legal@` / `hukuk@`, `ethics@` / `etik@`

---

## 🚀 Hızlı Başlangıç (Kurulum ve Çalıştırma)

### 1. Bulut Sunucu (Backend)
```bash
cd cloud-backend
cp .env.example .env
# .env dosyasını kendi kimlik bilgilerinizle doldurun
npm install
npm run build
npm start
```

### 2. Native Masaüstü Uygulaması (C++ / Qt 6)
```bash
cd desktop-cpp
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
windeployqt --release build/Release/RamazanogluTechMailHQ.exe
```

### 3. Bağımsız Kurulum Sihirbazı (Setup Programı)
```bash
python package_bundle.py
cd installer
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ../dist_setup
```

---

## 📄 Detaylı Dokümantasyon

Tüm mimari kararlar, yapılan denetimler ve adım adım değişiklikler için [DOCUMENTATION.md](DOCUMENTATION.md) dosyasını inceleyin.

---

**© 2026 Ramazanoğlu Technologies Inc. Tüm hakları saklıdır.**  
*Swiss-Style Architectural Minimalism & Zero-Local Dependency Engine*
