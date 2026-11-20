# Panduan Deployment Otomatis (CI/CD)

Alur: **teammate push ke `main` → GitHub Actions build → deploy ke STB → PM2 restart**.
Tidak ada lagi build manual di laptop dan tidak ada build di STB (RAM terbatas).

---

## 1. Alur Kerja

| Tahap | Siapa | Apa |
|---|---|---|
| Coding | Backend / Frontend / UI-UX / Mobile | Ubah kode sesuai tugas |
| Commit & push | Teammate | `git add -A`, `git commit -m "feat: ..."`, `git push origin main` |
| Build (cloud) | GitHub Actions, job `build` | `npm ci` + `npm run build` di `ubuntu-latest`, hasil `.next` di-upload sebagai artifact `frontend-next` |
| Deploy | GitHub Actions, job `deploy` | Runner **self-hosted yang terpasang di STB** mengunduh artifact, mengganti `.next`, lalu `pm2 restart rystore-frontend` |
| Verifikasi | Pardi (Server) | Cek `pm2 ls`, `version.json`, halaman web |

**Penting:** job `build` yang hijau **bukan** berarti web sudah terbarui. Web baru terbarui kalau job `deploy` juga hijau.

---

## 2. Kenapa runner harus di STB

STB ada di IP privat `192.168.0.203`. Runner GitHub (`ubuntu-latest`) berjalan di cloud,
jadi tidak bisa SSH ke IP privat itu — percobaan `scp`/`ssh` dari cloud akan timeout.
Karena itu job deploy dijalankan oleh runner kecil yang dipasang **di dalam STB**
(`runs-on: [self-hosted, stb]`). Runner ini hanya menarik artifact dan me-restart PM2,
jadi ringan — build Next.js tetap di cloud.

---

## 3. Tugas sekali jalan: Pardi (Server)

### 3.1 Pasang kunci deploy

Di STB, sebagai root:

```bash
mkdir -p /root/.ssh && chmod 700 /root/.ssh
echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDXoNSrUY9lbeshTxKQlxGD2/qI+/JY7UlOZCCUXY1X7q9El3NxSTl8iH6isaiHhdYrfNG31qd4zOIe0y12l+2oxeVyd2fg25TuxYdbU1zuOy5tbalzXVHT9ib5lN9hsHEaXmLwSYXyJM03c/0YkNZMTmiFsnIASq469l1ssSnCkGr3edJmPpIVzQhBS1UXbwJLbY1XcbGOxKIFaxGYj/8raKttFwxqPTe5cx1SlJyw/awoGUaQCpAHV4thxQ3BtpXEsQfbN0lC0S4hFVcmpZvuTlpUv9sYGmyUC99dDTu8M/VdDk+Nqdrm2yVaqObr6vDGNxZvqcu92WlAW1EMTWo5swmHKDxf60YX2IxJmy1TxPXLiDEnULdZXKxJ+MujHPRKGZMoOApu131yJ90ZqB/873UIQi3+YpS5STfi++s/xSIFEoeMFqwzyjGjyK/Y8NISzQ58iJvFkjmpGAc11nxkyBf1FG66sU7ab5RN/6kkCUW9tlfxsKrPGRkqFMcrgVeZ4X6krf8LPbl7wYoZmK9T610yk/geYxckjMFP2wmHB0wWzHy/4RWo8HN1wy7EYohq6bfav20aZeXETBlUq4BgvCX387pU/BmbwYtTe0Pn5Qxw53yR2VgKvMaadeSbjI/TtaIPmc2z+VkzucFg3JQInRUUpojWfcuVCdMtCjQc5Q== ryan@DESKTOP-IKFD01E' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

Cek dari komputer Ryan: `ssh -i C:/Users/Ryan/.ssh/id_rsa root@192.168.0.203 hostname`
harus langsung keluar tanpa minta password.

### 3.2 Daftarkan self-hosted runner

GitHub → repo `ryankputra/ry-itsolutions-v2` → **Settings → Actions → Runners → New self-hosted runner**,
pilih **Linux / x64**, lalu jalankan perintah yang muncul (`./config.sh` …) di STB.

Saat `./config.sh`, isi:

- `--labels stb` (wajib, karena workflow memakai `runs-on: [self-hosted, stb]`)
- `--name stb-01`
- `--work /root/actions-runner-ry-itsolutions`

Agar tetap hidup setelah reboot:

```bash
cd /root/actions-runner-ry-itsolutions
sudo ./svc.sh install
sudo ./svc.sh start
```

Terakhir, di GitHub → **Settings → Secrets and variables → Actions → Variables → New repository variable**:

- Name: `STB_RUNNER_READY`
- Value: `true`

Sebelum variabel ini diisi, job `deploy` dilewati (`skipped`) supaya pipeline tidak menggantung
menunggu runner yang belum ada.

---

## 4. Monitoring

- Tab **Actions** di repo: run terbaru harus hijau di dua job (`build` dan `deploy`).
- `deploy` hijau → di STB: `pm2 ls` (semua `online`), `pm2 logs rystore-frontend --lines 50`.
- Web: `https://ry-itsolutionts.web.id` — buka halaman Hiburan / lagu untuk cek player musik.
- Cache CSS/JS di-browser keras (`Ctrl+Shift+R`) setelah deploy, karena file ber-hash tetap di-cache.

### Cek cepat versi yang sedang tayang (tanpa SSH)

```powershell
Invoke-WebRequest https://ry-itsolutionts.web.id/version.json -UseBasicParsing
```

Bandingkan `timestamp` dengan waktu build terakhir. Kalau angkanya masih lama, deploy belum jalan.

---

## 5. Kalau deploy gagal

| Gejala | Sebab | Tindakan |
|---|---|---|
| Job `deploy` `skipped` | `STB_RUNNER_READY` belum `true` | Isi variable, atau tunggu Pardi |
| Job `deploy` antre lama | Runner STB offline | `sudo ./svc.sh status` di STB |
| `Prevent writing to file that only differs in casing` | dua file hanya beda huruf besar/kecil (Windows tidak bisa menyimpannya) | hapus salah satu, commit |
| `This request has been automatically failed because it uses a deprecated version of actions/upload-artifact: v3` | action versi lama | pakai `@v4` |
| `Permission denied (publickey)` | kunci belum ada di `authorized_keys` | ulangi 3.1 |
| Web 502 setelah restart | build rusak / dependency hilang | `pm2 logs`, lalu redeploy commit sebelumnya |

---

## 6. Aturan penting

1. **Jangan build Next.js di STB** — RAM habis dan PM2 lain ikut mati.
2. **Jangan `git clean -xd` atau `git reset --hard`** di STB — `database.sqlite`, `.env`, `sessions/` ikut terhapus.
3. File data produksi yang terlacak Git (`backend/public/tracks.json`, `frontend-v2/public/audio/tiktok/tracks.json`, `backend/data/*.json`) **wajib dibackup** sebelum menimpa working tree.
4. Jangan commit `.next/` dari laptop lagi; hasil build sekarang datang dari artifact Actions.
5. Satu approval user untuk satu deploy. Jangan push berkali-kali hanya untuk mencoba.
