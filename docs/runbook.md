# İşletme Rehberi (Runbook)

Sunucuda tek giriş noktası `scripts/ops.sh`'dir. Aynı komutlar GitHub'daki bir issue'ya yorum olarak
da çalıştırılabilir (yalnızca depo sahibi): `/ops status`, `/ops logs backend`, `/ops restart backend`...

## Sık işler

| İş | Komut (sunucuda) | GitHub yorumu |
| --- | --- | --- |
| Durum özeti | `bash scripts/ops.sh status` | `/ops status` |
| Yayına al | `bash scripts/ops.sh deploy` | `/ops deploy` (zaten her birleştirmede otomatik) |
| Yedek al | `bash scripts/ops.sh backup` | `/ops backup` |
| Log bak | `bash scripts/ops.sh logs backend` | `/ops logs backend` (yalnızca özel depoda) |
| Servis yeniden başlat | `bash scripts/ops.sh restart backend` | `/ops restart backend` |
| Disk | `bash scripts/ops.sh disk` | `/ops disk` |
| Güvenlik güncellemesi var mı | `bash scripts/ops.sh security-updates` | `/ops security-updates` |
| Dalı staging'de dene | `bash scripts/ops.sh staging <dal>` | `/ops staging <dal>` |

## Sorun giderme

**Mail HQ açılmıyor.** `status` çalıştırın. `backend` kırmızıysa `logs backend`, sonra `restart backend`.
Düzelmezse son yayını geri alın: `git revert <commit>` ile PR açıp birleştirin (otomatik yayınlanır).

**Gelen mail görünmüyor.** (1) Cloudflare → Email Routing kuralı Worker'a mı gidiyor? (2) `npx wrangler tail
ramazanoglu-mail-inbound` bilgisayarınızda: istek geliyor mu? (3) Backend logunda `401` varsa
`INBOUND_WEBHOOK_SECRET` Worker ve sunucuda aynı değil.

**Giden mail gitmiyor.** Resend panelinde alan adı "Verified" mi, API anahtarı geçerli mi? Backend logunda
`[SMTP]` satırlarına bakın.

**Disk doluyor.** `disk` çalıştırın. `docker image prune -f`, eski yedekleri `~/mailhq-backups` içinden silin.

**Sunucu yanıt vermiyor.** AWS panelinde EC2 örneğini yeniden başlatın. Konteynerler `restart: unless-stopped`
olduğu için kendiliğinden kalkar.

## Yedekten dönüş

```bash
bash scripts/restore-db.sh ~/mailhq-backups/<dosya>.sql.gz
```
Mevcut veriyi siler, onay ister. Ayda bir test ortamında denenmelidir.

## Otomatik olanlar (bootstrap-server.sh)

- Güvenlik güncellemeleri otomatik, gerekirse 04:30'da yeniden başlatma.
- Her gün 03:30 UTC veritabanı yedeği (son 14), her 10 dakikada sağlık kontrolü, pazar günü eski imaj temizliği.
- Sağlık kontrolü geçtiğinde Uptime Kuma push adresine (`KUMA_PUSH_URL`) haber verir; sunucu susarsa uyarı gelir.
- Docker logları 10 MB x 3 ile sınırlı.
