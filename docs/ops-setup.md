# Otomatik yayın ve uzaktan işletme: tek seferlik kurulum

Amaç: `main`'e birleştirilen her değişiklik test edilip sunucuya kendiliğinden yayınlansın ve sunucu
komutları GitHub'dan çalıştırılabilsin; SSH portu açılmadan.

## 1. Sunucuda (bir kez)

```bash
cd ~/ramazanoglu-tech-mail-hq && git pull origin main && bash scripts/bootstrap-server.sh
```

## 2. AWS: yetki şablonu (CloudFormation)

1. AWS Console → **CloudFormation → Create stack → With new resources** → `infra/aws/github-ssm-access.yml` dosyasını yükleyin.
2. `InstanceId` olarak sunucunuzu seçin (EC2 → Instances'ta `i-...`). Hesapta GitHub OIDC sağlayıcısı zaten varsa `CreateOidcProvider=false`.
3. Stack bitince **Outputs** sekmesindeki `DeployRoleArn` değerini not edin.
4. EC2 → sunucuyu seçin → **Actions → Security → Modify IAM role** → `mailhq-ec2-ssm` rolünü seçip kaydedin.
5. 5 dakika sonra **Systems Manager → Fleet Manager** sayfasında sunucu "Online" görünmeli.

## 3. GitHub: gizli değerler

Depo → **Settings → Secrets and variables → Actions → New repository secret**:

| Ad | Değer |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | 2. adımdaki `DeployRoleArn` |
| `AWS_REGION` | `eu-north-1` |
| `AWS_INSTANCE_ID` | `i-...` |

## 4. Deneme

`main`'e birleştirilen bir değişiklik Actions sekmesinde **Deploy** çalıştırır. Elle denemek için herhangi
bir issue'ya `/ops status` yorumu yazın; birkaç dakika içinde sonuç yanıt olarak gelir.

## 5. Depoyu korumak (önerilir)

- Settings → Branches → `main` için kural: pull request zorunlu, CI geçmeli, doğrudan push kapalı.
- Settings → Code security: secret scanning, push protection ve Dependabot güvenlik güncellemelerini açın.
- Depo herkese açıksa `/ops logs` çıktıları gizlenir (loglarda müşteri mail konuları olabilir). Özel depoda çalışır.
