# Ringkasan Proyek

Healthcare Scheduling MVP adalah sistem penjadwalan klinik berbasis NestJS dan GraphQL. Layanan Auth menangani registrasi, login, serta validasi JWT. Layanan Schedule menangani data pasien, dokter, dan janji temu dengan proteksi bentrok jadwal dokter. Kedua layanan memiliki basis data PostgreSQL terpisah.

Redis digunakan untuk cache data dengan invalidasi berversi. Notifikasi konfirmasi dan pembatalan dikirim secara asinkron melalui BullMQ ke layanan Notification, lalu diteruskan ke Mailpit untuk demonstrasi lokal. Seluruh komponen dapat dijalankan dengan satu perintah Docker Compose.

Cara tercepat untuk mencoba proyek:

1. Salin `.env.example` menjadi `.env`.
2. Jalankan `docker compose up --build -d`.
3. Buka `http://localhost:3000` dan masuk menggunakan akun demo pada `.env`.
4. Jalankan `node scripts/acceptance.mjs` untuk verifikasi otomatis.

Dokumentasi arsitektur, API, operasional, dan pengujian tersedia di folder `docs/`. Nilai lokal pada `.env.example` hanya untuk demonstrasi dan tidak boleh digunakan di lingkungan produksi.
