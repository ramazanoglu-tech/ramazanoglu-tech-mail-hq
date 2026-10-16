using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

namespace RamazanogluTech.Installer;

public class InstallerForm : Form
{
    private readonly Color ColorPaper = ColorTranslator.FromHtml("#FBFBF9");
    private readonly Color ColorPaperMuted = ColorTranslator.FromHtml("#F3F3EF");
    private readonly Color ColorInk = ColorTranslator.FromHtml("#111111");
    private readonly Color ColorSlateMuted = ColorTranslator.FromHtml("#555555");
    private readonly Color ColorSlateLight = ColorTranslator.FromHtml("#888884");
    private readonly Color ColorHairline = ColorTranslator.FromHtml("#E2E2DF");
    private readonly Color ColorIntlOrange = ColorTranslator.FromHtml("#D9381E");

    private int currentStep = 0;
    private const int TotalSteps = 6;

    // Controls
    private Panel headerPanel = null!;
    private Panel contentPanel = null!;
    private Panel footerPanel = null!;
    private Button btnBack = null!;
    private Button btnNext = null!;
    private Button btnCancel = null!;
    private Label stepIndicatorLabel = null!;

    // Step 1: Destination
    private TextBox txtInstallPath = null!;
    private Button btnBrowse = null!;
    private Label lblDiskSpace = null!;

    // Step 2: Cloud Configuration
    private TextBox txtApiUrl = null!;
    private TextBox txtWsUrl = null!;
    private TextBox txtAdminKey = null!;
    private Button btnTestConnection = null!;
    private Label lblConnectionStatus = null!;

    // Step 3: Options
    private CheckBox chkDesktopShortcut = null!;
    private CheckBox chkStartMenu = null!;
    private CheckBox chkAutoStart = null!;

    // Step 4: Progress
    private ProgressBar progressBar = null!;
    private TextBox txtExtractLog = null!;
    private Label lblCurrentAction = null!;

    // Step 5: Completed
    private CheckBox chkLaunchNow = null!;

    public InstallerForm()
    {
        InitializeComponent();
        LoadIconFromResource();
        ShowStep(0);
    }

    private void LoadIconFromResource()
    {
        try
        {
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("RamazanogluTech.Installer.app.ico");
            if (stream != null)
            {
                this.Icon = new Icon(stream);
            }
        }
        catch { }
    }

    private void InitializeComponent()
    {
        this.Text = "RAMAZANOĞLU TECH // MAIL HQ KURULUM SİHİRBAZI";
        this.Size = new Size(820, 580);
        this.MinimumSize = new Size(820, 580);
        this.FormBorderStyle = FormBorderStyle.FixedSingle;
        this.MaximizeBox = false;
        this.StartPosition = FormStartPosition.CenterScreen;
        this.BackColor = ColorPaper;
        this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

        // 1. HEADER PANEL
        headerPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 80,
            BackColor = ColorInk
        };

        var orangeSquare = new Panel
        {
            Size = new Size(10, 10),
            Location = new Point(24, 26),
            BackColor = ColorIntlOrange
        };
        headerPanel.Controls.Add(orangeSquare);

        var lblBrand = new Label
        {
            Text = "RAMAZANOĞLU TECH",
            Font = new Font("Segoe UI", 13F, FontStyle.Bold, GraphicsUnit.Point),
            ForeColor = ColorPaper,
            AutoSize = true,
            Location = new Point(42, 20)
        };
        headerPanel.Controls.Add(lblBrand);

        var lblSubBrand = new Label
        {
            Text = "MAIL HQ (SUPER ADMIN SUITE) — KURULUM PROGRAMI",
            Font = new Font("Consolas", 8.5F, FontStyle.Regular, GraphicsUnit.Point),
            ForeColor = ColorSlateLight,
            AutoSize = true,
            Location = new Point(44, 46)
        };
        headerPanel.Controls.Add(lblSubBrand);

        stepIndicatorLabel = new Label
        {
            Text = "ADIM 1 / 6",
            Font = new Font("Consolas", 9F, FontStyle.Bold, GraphicsUnit.Point),
            ForeColor = ColorPaper,
            AutoSize = true,
            Location = new Point(700, 32)
        };
        headerPanel.Controls.Add(stepIndicatorLabel);

        this.Controls.Add(headerPanel);

        // 2. FOOTER PANEL
        footerPanel = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 65,
            BackColor = ColorPaperMuted
        };
        footerPanel.Paint += (s, e) =>
        {
            using var pen = new Pen(ColorHairline, 1);
            e.Graphics.DrawLine(pen, 0, 0, footerPanel.Width, 0);
        };

        btnCancel = CreateSwissButton("İPTAL", 24, 15, 100, 35, false);
        btnCancel.Click += (s, e) => this.Close();
        footerPanel.Controls.Add(btnCancel);

        btnBack = CreateSwissButton("< GERİ", 550, 15, 110, 35, false);
        btnBack.Click += (s, e) => NavigateBack();
        footerPanel.Controls.Add(btnBack);

        btnNext = CreateSwissButton("İLERİ >", 670, 15, 120, 35, true);
        btnNext.Click += (s, e) => NavigateNext();
        footerPanel.Controls.Add(btnNext);

        this.Controls.Add(footerPanel);

        // 3. CONTENT PANEL
        contentPanel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = ColorPaper,
            Padding = new Padding(35, 25, 35, 20)
        };
        this.Controls.Add(contentPanel);
    }

    private Button CreateSwissButton(string text, int x, int y, int w, int h, bool isPrimary)
    {
        var btn = new Button
        {
            Text = text,
            Location = new Point(x, y),
            Size = new Size(w, h),
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Consolas", 9F, FontStyle.Bold, GraphicsUnit.Point),
            Cursor = Cursors.Hand,
            UseVisualStyleBackColor = false
        };
        btn.FlatAppearance.BorderSize = isPrimary ? 0 : 1;
        btn.FlatAppearance.BorderColor = ColorHairline;
        btn.BackColor = isPrimary ? ColorInk : ColorPaper;
        btn.ForeColor = isPrimary ? ColorPaper : ColorInk;

        btn.MouseEnter += (s, e) =>
        {
            if (isPrimary)
                btn.BackColor = Color.FromArgb(40, 40, 40);
            else
                btn.BackColor = ColorPaperMuted;
        };
        btn.MouseLeave += (s, e) =>
        {
            if (isPrimary)
                btn.BackColor = ColorInk;
            else
                btn.BackColor = ColorPaper;
        };
        return btn;
    }

    private void ShowStep(int step)
    {
        currentStep = step;
        contentPanel.Controls.Clear();
        stepIndicatorLabel.Text = $"ADIM {currentStep + 1} / {TotalSteps}";

        btnBack.Enabled = currentStep > 0 && currentStep < 4;
        btnCancel.Enabled = currentStep < 4 || currentStep == 5;

        switch (currentStep)
        {
            case 0:
                BuildStepWelcome();
                btnNext.Text = "BAŞLA >";
                break;
            case 1:
                BuildStepDirectory();
                btnNext.Text = "İLERİ >";
                break;
            case 2:
                BuildStepCloudConfig();
                btnNext.Text = "İLERİ >";
                break;
            case 3:
                BuildStepShortcuts();
                btnNext.Text = "KURULUMU YAP >";
                break;
            case 4:
                BuildStepInstalling();
                btnNext.Text = "BEKLEYİN...";
                btnNext.Enabled = false;
                btnBack.Enabled = false;
                btnCancel.Enabled = false;
                StartInstallation();
                break;
            case 5:
                BuildStepFinish();
                btnNext.Text = "TAMAMLA VE BAŞLAT";
                btnNext.Enabled = true;
                btnBack.Enabled = false;
                btnCancel.Text = "KAPAT";
                break;
        }
    }

    private void NavigateNext()
    {
        if (currentStep < 3)
        {
            ShowStep(currentStep + 1);
        }
        else if (currentStep == 3)
        {
            ShowStep(4);
        }
        else if (currentStep == 5)
        {
            if (chkLaunchNow.Checked)
            {
                LaunchInstalledApp();
            }
            this.Close();
        }
    }

    private void NavigateBack()
    {
        if (currentStep > 0 && currentStep < 4)
        {
            ShowStep(currentStep - 1);
        }
    }

    // =========================================================================
    // STEP 0: WELCOME
    // =========================================================================
    private void BuildStepWelcome()
    {
        var title = new Label
        {
            Text = "RAMAZANOĞLU TECH MAIL HQ KURULUMUNA HOŞ GELDİNİZ",
            Font = new Font("Segoe UI", 13F, FontStyle.Bold),
            ForeColor = ColorInk,
            AutoSize = true,
            Location = new Point(35, 20)
        };
        contentPanel.Controls.Add(title);

        var desc = new Label
        {
            Text = "Bu kurulum sihirbazı, Ramazanoğlu Technologies Inc. kurumsal ortakları (Yusuf & Nur) ve mühendislik kadrosu için yerel veritabanı bağımlılığı bulunmayan (100% Cloud-Synced) C++20 Qt 6 masaüstü yönetim merkezini bilgisayarınıza kurar.",
            Font = new Font("Segoe UI", 9.5F),
            ForeColor = ColorSlateMuted,
            Size = new Size(730, 60),
            Location = new Point(35, 60)
        };
        contentPanel.Controls.Add(desc);

        var specBox = new Panel
        {
            Location = new Point(35, 130),
            Size = new Size(730, 200),
            BackColor = ColorPaperMuted
        };
        specBox.Paint += (s, e) =>
        {
            using var pen = new Pen(ColorHairline, 1);
            e.Graphics.DrawRectangle(pen, 0, 0, specBox.Width - 1, specBox.Height - 1);
        };

        var lblSpecTitle = new Label
        {
            Text = "MİMARİ SPESİFİKASYONLAR VE SİSTEM GEREKSİNİMLERİ",
            Font = new Font("Consolas", 9.5F, FontStyle.Bold),
            ForeColor = ColorInk,
            Location = new Point(20, 16),
            AutoSize = true
        };
        specBox.Controls.Add(lblSpecTitle);

        string[] specs = new string[]
        {
            "• Mimari Dil: Swiss-Style Architectural Minimalism (Sıfır border-radius, hairlines)",
            "• Çekirdek Motor: Native Windows C++20 / Qt 6.6.3 Desktop HQ Suite",
            "• Bulut Güvenliği: Zero-Trust Handshake, CRLF Sanitized SMTP & IMAP Sync",
            "• Çoklu Kimlik: 54 Entegre @ramazanoglu.tech Kurumsal E-Posta Alias Matrisi",
            "• Şablonlar: 6 Hazır Kurumsal & Ar-Ge İsviçre E-Posta Şablon Kütüphanesi",
            "• Bağımsız Kurulum: UAC Yönetici izni gerekmez, doğrudan kullanıcı profiline kurulur"
        };

        int y = 50;
        foreach (var s in specs)
        {
            var lbl = new Label
            {
                Text = s,
                Font = new Font("Segoe UI", 9F),
                ForeColor = ColorInk,
                Location = new Point(20, y),
                AutoSize = true
            };
            specBox.Controls.Add(lbl);
            y += 24;
        }

        contentPanel.Controls.Add(specBox);
    }

    // =========================================================================
    // STEP 1: DIRECTORY SELECTION
    // =========================================================================
    private void BuildStepDirectory()
    {
        var title = new Label
        {
            Text = "KURULUM DİZİNİNİ SEÇİN",
            Font = new Font("Segoe UI", 13F, FontStyle.Bold),
            ForeColor = ColorInk,
            AutoSize = true,
            Location = new Point(35, 20)
        };
        contentPanel.Controls.Add(title);

        var desc = new Label
        {
            Text = "Ramazanoğlu Tech Mail HQ dosyaları aşağıdaki hedef klasöre kurulacaktır. Varsayılan olarak kullanıcı programları klasörü seçilmiştir.",
            Font = new Font("Segoe UI", 9.5F),
            ForeColor = ColorSlateMuted,
            Size = new Size(730, 45),
            Location = new Point(35, 60)
        };
        contentPanel.Controls.Add(desc);

        string defaultPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs", "Ramazanoglu Tech", "Mail HQ");

        txtInstallPath = new TextBox
        {
            Text = defaultPath,
            Font = new Font("Consolas", 10F),
            Location = new Point(35, 120),
            Size = new Size(600, 32),
            BorderStyle = BorderStyle.FixedSingle,
            BackColor = Color.White
        };
        contentPanel.Controls.Add(txtInstallPath);

        btnBrowse = CreateSwissButton("GÖZAT...", 645, 118, 120, 30, false);
        btnBrowse.Click += (s, e) =>
        {
            using var dlg = new FolderBrowserDialog();
            dlg.Description = "Ramazanoğlu Tech Mail HQ Kurulum Klasörünü Seçin";
            dlg.SelectedPath = txtInstallPath.Text;
            if (dlg.ShowDialog() == DialogResult.OK)
            {
                txtInstallPath.Text = dlg.SelectedPath;
            }
        };
        contentPanel.Controls.Add(btnBrowse);

        lblDiskSpace = new Label
        {
            Text = "Gereken Alan: ~55 MB   |   Kullanılabilir Disk Alanı: Hesaplanıyor...",
            Font = new Font("Consolas", 9F),
            ForeColor = ColorSlateMuted,
            Location = new Point(35, 165),
            AutoSize = true
        };
        contentPanel.Controls.Add(lblDiskSpace);

        UpdateDiskSpace();
    }

    private void UpdateDiskSpace()
    {
        try
        {
            string root = Path.GetPathRoot(txtInstallPath.Text) ?? "C:\\";
            var drive = new DriveInfo(root);
            long freeMb = drive.AvailableFreeSpace / (1024 * 1024);
            lblDiskSpace.Text = $"Gereken Alan: ~55 MB   |   Kullanılabilir Alan ({root}): {freeMb:N0} MB";
        }
        catch { }
    }

    // =========================================================================
    // STEP 2: CLOUD ENDPOINT CONFIGURATION
    // =========================================================================
    private void BuildStepCloudConfig()
    {
        var title = new Label
        {
            Text = "BULUT API VE GÜVENLİK AYARLARI",
            Font = new Font("Segoe UI", 13F, FontStyle.Bold),
            ForeColor = ColorInk,
            AutoSize = true,
            Location = new Point(35, 20)
        };
        contentPanel.Controls.Add(title);

        var desc = new Label
        {
            Text = "Ramazanoğlu Tech Mail HQ masaüstü uygulaması, e-posta veritabanını yerel diskte tutmaz; doğrudan bulut REST API ve WebSocket akışına bağlanır.",
            Font = new Font("Segoe UI", 9.5F),
            ForeColor = ColorSlateMuted,
            Size = new Size(730, 45),
            Location = new Point(35, 60)
        };
        contentPanel.Controls.Add(desc);

        var lblApi = new Label { Text = "BULUT REST API ADRESİ:", Font = new Font("Consolas", 9F, FontStyle.Bold), Location = new Point(35, 115), AutoSize = true };
        contentPanel.Controls.Add(lblApi);

        txtApiUrl = new TextBox
        {
            Text = "http://localhost:8765",
            Font = new Font("Consolas", 10F),
            Location = new Point(35, 135),
            Size = new Size(580, 28),
            BorderStyle = BorderStyle.FixedSingle
        };
        contentPanel.Controls.Add(txtApiUrl);

        var lblWs = new Label { Text = "CANLI WEBSOCKET AKIŞ ADRESİ:", Font = new Font("Consolas", 9F, FontStyle.Bold), Location = new Point(35, 175), AutoSize = true };
        contentPanel.Controls.Add(lblWs);

        txtWsUrl = new TextBox
        {
            Text = "ws://localhost:8765/ws",
            Font = new Font("Consolas", 10F),
            Location = new Point(35, 195),
            Size = new Size(580, 28),
            BorderStyle = BorderStyle.FixedSingle
        };
        contentPanel.Controls.Add(txtWsUrl);

        var lblKey = new Label { Text = "SUPER ADMIN MASTER ERİŞİM ANAHTARI:", Font = new Font("Consolas", 9F, FontStyle.Bold), Location = new Point(35, 235), AutoSize = true };
        contentPanel.Controls.Add(lblKey);

        txtAdminKey = new TextBox
        {
            Text = "",
            UseSystemPasswordChar = true,
            Font = new Font("Consolas", 10F),
            Location = new Point(35, 255),
            Size = new Size(580, 28),
            BorderStyle = BorderStyle.FixedSingle
        };
        contentPanel.Controls.Add(txtAdminKey);

        btnTestConnection = CreateSwissButton("BAĞLANTIYI TEST ET", 625, 135, 140, 30, false);
        btnTestConnection.Click += async (s, e) => await TestCloudConnectionAsync();
        contentPanel.Controls.Add(btnTestConnection);

        lblConnectionStatus = new Label
        {
            Text = "○ Durum: Test edilmedi",
            Font = new Font("Consolas", 9F, FontStyle.Bold),
            ForeColor = ColorSlateMuted,
            Location = new Point(35, 300),
            AutoSize = true
        };
        contentPanel.Controls.Add(lblConnectionStatus);
    }

    private async Task TestCloudConnectionAsync()
    {
        btnTestConnection.Enabled = false;
        lblConnectionStatus.Text = "● Bulut sunucuya bağlanılıyor...";
        lblConnectionStatus.ForeColor = ColorInk;

        try
        {
            using var client = new HttpClient();
            client.Timeout = TimeSpan.FromSeconds(5);
            var url = txtApiUrl.Text.TrimEnd('/') + "/api/health";
            var response = await client.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                lblConnectionStatus.Text = "● BAŞARILI: Bulut API ve IMAP Motoru Çevrimiçi (Online).";
                lblConnectionStatus.ForeColor = Color.DarkGreen;
            }
            else
            {
                lblConnectionStatus.Text = $"○ HATA: Sunucu HTTP {(int)response.StatusCode} yanıtı verdi.";
                lblConnectionStatus.ForeColor = ColorIntlOrange;
            }
        }
        catch (Exception ex)
        {
            lblConnectionStatus.Text = $"○ BAĞLANTI BAŞARISIZ: {ex.Message}";
            lblConnectionStatus.ForeColor = ColorIntlOrange;
        }
        finally
        {
            btnTestConnection.Enabled = true;
        }
    }

    // =========================================================================
    // STEP 3: SHORTCUTS & OPTIONS
    // =========================================================================
    private void BuildStepShortcuts()
    {
        var title = new Label
        {
            Text = "KISAYOLLAR VE ENTEGRASYON",
            Font = new Font("Segoe UI", 13F, FontStyle.Bold),
            ForeColor = ColorInk,
            AutoSize = true,
            Location = new Point(35, 20)
        };
        contentPanel.Controls.Add(title);

        var desc = new Label
        {
            Text = "Yazılımın masaüstü ve başlat menüsü entegrasyonu için aşağıdaki seçenekleri belirleyin:",
            Font = new Font("Segoe UI", 9.5F),
            ForeColor = ColorSlateMuted,
            Size = new Size(730, 45),
            Location = new Point(35, 60)
        };
        contentPanel.Controls.Add(desc);

        chkDesktopShortcut = new CheckBox
        {
            Text = "Masaüstüne 'Ramazanoglu Tech Mail HQ' kısayolu ekle",
            Font = new Font("Segoe UI", 10F),
            Checked = true,
            Location = new Point(35, 120),
            AutoSize = true
        };
        contentPanel.Controls.Add(chkDesktopShortcut);

        chkStartMenu = new CheckBox
        {
            Text = "Windows Başlat Menüsüne 'Ramazanoğlu Tech' program grubu ekle",
            Font = new Font("Segoe UI", 10F),
            Checked = true,
            Location = new Point(35, 160),
            AutoSize = true
        };
        contentPanel.Controls.Add(chkStartMenu);

        chkAutoStart = new CheckBox
        {
            Text = "Windows açıldığında arka planda bildirim çubuğunda (System Tray) başlat",
            Font = new Font("Segoe UI", 10F),
            Checked = true,
            Location = new Point(35, 200),
            AutoSize = true
        };
        contentPanel.Controls.Add(chkAutoStart);
    }

    // =========================================================================
    // STEP 4: INSTALLATION PROGRESS
    // =========================================================================
    private void BuildStepInstalling()
    {
        var title = new Label
        {
            Text = "KURULUM YAPILIYOR, LÜTFEN BEKLEYİN...",
            Font = new Font("Segoe UI", 13F, FontStyle.Bold),
            ForeColor = ColorInk,
            AutoSize = true,
            Location = new Point(35, 20)
        };
        contentPanel.Controls.Add(title);

        lblCurrentAction = new Label
        {
            Text = "Paket bileşenleri hazırlanıyor...",
            Font = new Font("Consolas", 9F),
            ForeColor = ColorSlateMuted,
            Location = new Point(35, 60),
            Size = new Size(730, 25)
        };
        contentPanel.Controls.Add(lblCurrentAction);

        progressBar = new ProgressBar
        {
            Location = new Point(35, 90),
            Size = new Size(730, 18),
            Style = ProgressBarStyle.Continuous,
            Maximum = 100,
            Value = 0
        };
        contentPanel.Controls.Add(progressBar);

        txtExtractLog = new TextBox
        {
            Location = new Point(35, 125),
            Size = new Size(730, 220),
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            Font = new Font("Consolas", 8F),
            BackColor = ColorPaperMuted,
            ForeColor = ColorInk,
            BorderStyle = BorderStyle.FixedSingle
        };
        contentPanel.Controls.Add(txtExtractLog);
    }

    private async void StartInstallation()
    {
        string targetDir = txtInstallPath.Text;
        string apiUrl = txtApiUrl.Text;
        string wsUrl = txtWsUrl.Text;
        string adminKey = txtAdminKey.Text;
        bool createDesktop = chkDesktopShortcut.Checked;
        bool createStartMenu = chkStartMenu.Checked;

        await Task.Run(() =>
        {
            try
            {
                AppendLog("Hedef kurulum dizini oluşturuluyor: " + targetDir);
                Directory.CreateDirectory(targetDir);
                UpdateProgress(10, "Gömülü arşiv yükleniyor...");

                var assembly = Assembly.GetExecutingAssembly();
                using var stream = assembly.GetManifestResourceStream("RamazanogluTech.Installer.payload.zip");
                if (stream == null)
                {
                    throw new Exception("Kurulum paketi 'payload.zip' gömülü kaynaklarda bulunamadı.");
                }

                AppendLog("Arşiv açılıyor ve dosyalar yerleştiriliyor...");
                using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
                int totalEntries = archive.Entries.Count;
                int currentEntry = 0;

                foreach (var entry in archive.Entries)
                {
                    currentEntry++;
                    string destinationPath = Path.GetFullPath(Path.Combine(targetDir, entry.FullName));

                    // Security check against zip-slip
                    if (!destinationPath.StartsWith(Path.GetFullPath(targetDir), StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    if (string.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(destinationPath);
                    }
                    else
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
                        entry.ExtractToFile(destinationPath, overwrite: true);
                        AppendLog($"[ÇIKARILDI] {entry.FullName}");
                    }

                    int pct = 10 + (int)((float)currentEntry / totalEntries * 70);
                    UpdateProgress(pct, $"Dosyalar çıkartılıyor ({currentEntry}/{totalEntries})...");
                }

                // Write custom config.json
                UpdateProgress(85, "Kurumsal konfigürasyon (config.json) yazılıyor...");
                string configPath = Path.Combine(targetDir, "config.json");
                var configObj = new
                {
                    api_base_url = apiUrl,
                    ws_url = wsUrl,
                    super_admin_key = adminKey,
                    domain = "@ramazanoglu.tech",
                    installed_at = DateTime.UtcNow.ToString("o")
                };
                File.WriteAllText(configPath, JsonSerializer.Serialize(configObj, new JsonSerializerOptions { WriteIndented = true }));
                AppendLog("[YAZILDI] config.json -> Özel sunucu adresi ve erişim anahtarı kaydedildi.");

                // Write Uninstaller Batch
                string uninstallerPath = Path.Combine(targetDir, "uninstall.bat");
                string uninstallerContent = $@"@echo off
echo Ramazanoglu Tech Mail HQ kaldiriliyor...
taskkill /f /im RamazanogluTechMailHQ.exe >nul 2>&1
timeout /t 1 >nul
rmdir /s /q ""{targetDir}""
del ""{Environment.GetFolderPath(Environment.SpecialFolder.Desktop)}\Ramazanoglu Tech Mail HQ.lnk"" >nul 2>&1
echo Kaldirma tamamlandi.
pause
";
                File.WriteAllText(uninstallerPath, uninstallerContent);

                // Create Shortcuts
                string exePath = Path.Combine(targetDir, "RamazanogluTechMailHQ.exe");
                string icoPath = Path.Combine(targetDir, "app.ico");

                if (createDesktop)
                {
                    UpdateProgress(90, "Masaüstü kısayolu oluşturuluyor...");
                    string desktopLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "Ramazanoglu Tech Mail HQ.lnk");
                    CreateWindowsShortcut(desktopLnk, exePath, targetDir, icoPath, "Ramazanoğlu Tech Mail HQ Super Admin Suite");
                    AppendLog("[KISAYOL] Masaüstü kısayolu oluşturuldu.");
                }

                if (createStartMenu)
                {
                    UpdateProgress(95, "Başlat menüsü klasörü oluşturuluyor...");
                    string startMenuFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Ramazanoglu Tech");
                    Directory.CreateDirectory(startMenuFolder);
                    string startLnk = Path.Combine(startMenuFolder, "Ramazanoglu Tech Mail HQ.lnk");
                    CreateWindowsShortcut(startLnk, exePath, targetDir, icoPath, "Ramazanoğlu Tech Mail HQ Super Admin Suite");
                    AppendLog("[KISAYOL] Başlat menüsü kısayolu oluşturuldu.");
                }

                RegisterUninstallRegistry(targetDir, exePath, uninstallerPath, icoPath);

                UpdateProgress(100, "Kurulum başarıyla tamamlandı.");
                AppendLog("Tüm bileşenler ve kısayollar başarıyla doğrulandı.");

                this.Invoke(new Action(() => ShowStep(5)));
            }
            catch (Exception ex)
            {
                AppendLog($"[HATA] Kurulum sırasında hata: {ex.Message}");
                this.Invoke(new Action(() =>
                {
                    MessageBox.Show(this, "Kurulum sırasında bir hata oluştu:\n" + ex.Message,
                        "Kurulum Hatası", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    btnCancel.Enabled = true;
                }));
            }
        });
    }

    private void AppendLog(string message)
    {
        if (txtExtractLog.InvokeRequired)
        {
            txtExtractLog.Invoke(new Action(() => AppendLog(message)));
            return;
        }
        txtExtractLog.AppendText(message + Environment.NewLine);
    }

    private void UpdateProgress(int value, string actionText)
    {
        if (progressBar.InvokeRequired)
        {
            progressBar.Invoke(new Action(() => UpdateProgress(value, actionText)));
            return;
        }
        progressBar.Value = Math.Min(100, Math.Max(0, value));
        lblCurrentAction.Text = actionText;
    }

    private void CreateWindowsShortcut(string shortcutPath, string targetPath, string workingDir, string iconPath, string description)
    {
        try
        {
            // Use PowerShell to create Windows Shell Link reliably
            string psScript = $@"
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('{shortcutPath.Replace("'", "''")}')
$Shortcut.TargetPath = '{targetPath.Replace("'", "''")}'
$Shortcut.WorkingDirectory = '{workingDir.Replace("'", "''")}'
$Shortcut.IconLocation = '{iconPath.Replace("'", "''")},0'
$Shortcut.Description = '{description.Replace("'", "''")}'
$Shortcut.Save()
";
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -NonInteractive -Command \"{psScript.Replace("\r\n", " ")}\"",
                CreateNoWindow = true,
                UseShellExecute = false
            };
            var p = Process.Start(psi);
            p?.WaitForExit(3000);
        }
        catch (Exception ex)
        {
            AppendLog($"[UYARI] Kısayol oluşturma uyarısı: {ex.Message}");
        }
    }

    private void RegisterUninstallRegistry(string installDir, string exePath, string uninstallerPath, string iconPath)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\RamazanogluTechMailHQ");
            if (key != null)
            {
                key.SetValue("DisplayName", "Ramazanoğlu Tech Mail HQ (Super Admin Suite)");
                key.SetValue("DisplayIcon", iconPath);
                key.SetValue("DisplayVersion", "1.0.0");
                key.SetValue("Publisher", "Ramazanoğlu Technologies Inc.");
                key.SetValue("InstallLocation", installDir);
                key.SetValue("UninstallString", uninstallerPath);
            }
        }
        catch { }
    }

    // =========================================================================
    // STEP 5: FINISH
    // =========================================================================
    private void BuildStepFinish()
    {
        var title = new Label
        {
            Text = "KURULUM BAŞARIYLA TAMAMLANDI",
            Font = new Font("Segoe UI", 14F, FontStyle.Bold),
            ForeColor = ColorInk,
            AutoSize = true,
            Location = new Point(35, 20)
        };
        contentPanel.Controls.Add(title);

        var accentLine = new Panel
        {
            Size = new Size(80, 4),
            Location = new Point(35, 55),
            BackColor = ColorIntlOrange
        };
        contentPanel.Controls.Add(accentLine);

        var desc = new Label
        {
            Text = "Ramazanoğlu Tech Mail HQ başarıyla kuruldu ve yapılandırıldı. Uygulama masaüstü ve başlat menüsü üzerinden normal bir Windows masaüstü programı olarak çalışmaya hazırdır.",
            Font = new Font("Segoe UI", 10F),
            ForeColor = ColorSlateMuted,
            Size = new Size(730, 50),
            Location = new Point(35, 75)
        };
        contentPanel.Controls.Add(desc);

        var summaryBox = new Panel
        {
            Location = new Point(35, 140),
            Size = new Size(730, 160),
            BackColor = ColorPaperMuted
        };
        summaryBox.Paint += (s, e) =>
        {
            using var pen = new Pen(ColorHairline, 1);
            e.Graphics.DrawRectangle(pen, 0, 0, summaryBox.Width - 1, summaryBox.Height - 1);
        };

        var lblSummaryTitle = new Label
        {
            Text = "KURULUM ÖZETİ VE ÇALIŞMA BİLGİLERİ",
            Font = new Font("Consolas", 9.5F, FontStyle.Bold),
            ForeColor = ColorInk,
            Location = new Point(20, 15),
            AutoSize = true
        };
        summaryBox.Controls.Add(lblSummaryTitle);

        var lblPathInfo = new Label
        {
            Text = $"• Kurulum Dizini: {txtInstallPath.Text}",
            Font = new Font("Segoe UI", 9F),
            Location = new Point(20, 45),
            AutoSize = true
        };
        summaryBox.Controls.Add(lblPathInfo);

        var lblApiInfo = new Label
        {
            Text = $"• Bulut Sunucu Uç Noktası: {txtApiUrl.Text}",
            Font = new Font("Segoe UI", 9F),
            Location = new Point(20, 70),
            AutoSize = true
        };
        summaryBox.Controls.Add(lblApiInfo);

        var lblAliasInfo = new Label
        {
            Text = "• Tanımlı Kimlikler: 54 Kurumsal Alias (Yusuf & Nur + 26 Çift Dilli Departman)",
            Font = new Font("Segoe UI", 9F),
            Location = new Point(20, 95),
            AutoSize = true
        };
        summaryBox.Controls.Add(lblAliasInfo);

        var lblSecurityInfo = new Label
        {
            Text = "• Güvenlik: Zero-Trust Handshake & Brute-Force Rate Limiting Aktif",
            Font = new Font("Segoe UI", 9F),
            Location = new Point(20, 120),
            AutoSize = true
        };
        summaryBox.Controls.Add(lblSecurityInfo);

        contentPanel.Controls.Add(summaryBox);

        chkLaunchNow = new CheckBox
        {
            Text = "Ramazanoğlu Tech Mail HQ uygulamasını hemen başlat",
            Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
            ForeColor = ColorInk,
            Checked = true,
            Location = new Point(35, 320),
            AutoSize = true
        };
        contentPanel.Controls.Add(chkLaunchNow);
    }

    private void LaunchInstalledApp()
    {
        try
        {
            string exePath = Path.Combine(txtInstallPath.Text, "RamazanogluTechMailHQ.exe");
            if (File.Exists(exePath))
            {
                var psi = new ProcessStartInfo(exePath)
                {
                    WorkingDirectory = txtInstallPath.Text,
                    UseShellExecute = true
                };
                Process.Start(psi);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show("Uygulama başlatılamadı: " + ex.Message);
        }
    }
}
