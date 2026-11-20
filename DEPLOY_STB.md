# 🚀 Panduan Deployment Otomatis (CI/CD)

Dokumen ini berisi panduan untuk alur kerja pengembangan aplikasi di mana deployment dilakukan sepenuhnya secara otomatis via GitHub Actions.

---

## 📌 Alur Kerja Deployment Otomatis

| Tahap | Penanggung Jawab | Keterangan |
|---|---|---|
| **Coding & Perubahan** | Teammate (Backend/Frontend) | Melakukan perubahan kode sesuai tugas. |
| **Commit & Push** | Teammate | Setelah perubahan selesai, teammate wajib melakukan `commit` dan `push` ke branch `main`. |
| **CI/CD Pipeline** | GitHub Actions | Otomatis mendeteksi push, melakukan build di cloud, dan deploy ke STB. |
| **Verifikasi** | Pardi Server | Memantau status service via PM2 jika ada kegagalan deploy. |

> [!IMPORTANT]
> **Tidak ada lagi langkah manual oleh user!**
> Segala bentuk perubahan kode, build, push, dan sinkronisasi ke STB sekarang sepenuhnya dikelola oleh tim dan sistem GitHub Actions.

---

## 🛠️ Tugas Teammate

Setiap teammate yang mengerjakan fitur **wajib** melakukan langkah berikut:

1. **Pastikan perubahan sudah di-add & commit:**
   ```bash
   git add .
   git commit -m "feat: [nama fitur] - [deskripsi]"
   ```
2. **Push ke repositori:**
   ```bash
   git push origin main
   ```
3. **Pantau Hasil:**
   Setelah push, buka tab **Actions** di repositori [ry-itsolutions-v2](https://github.com/ryankputra/ry-itsolutions-v2) untuk memastikan pipeline berjalan sukses.

---

## 🔍 Monitoring (Khusus Tim Server)

Jika pipeline gagal:
1. Cek log di tab **Actions** GitHub.
2. Jika ada masalah koneksi/SSH, hubungi Pardi Server untuk sinkronisasi manual jika diperlukan.
3. Pastikan `pm2` berjalan normal dengan perintah `pm2 status` di STB.
