# Photoblur

Photoblur adalah website kamera berbasis browser untuk mengambil 2 atau 4 foto otomatis saat pose peace terdeteksi oleh backend Python, lalu menghias hasilnya dengan layout, frame, stiker, teks, filter, blur, dan mengunduh PNG.

## Arsitektur

- Frontend: HTML, CSS, JavaScript, Browser Camera API, Canvas API, Fetch API, SessionStorage.
- Backend: Python, Flask, Flask-CORS, MediaPipe, OpenCV, NumPy.
- Kamera dibuka oleh browser melalui `navigator.mediaDevices.getUserMedia()`.
- Backend tidak memakai `cv2.VideoCapture(0)`.
- Frontend mengirim frame base64 ke `POST /api/detect-gesture` sekitar setiap 200 ms dan tidak mengirim request baru saat request sebelumnya masih berjalan.

## Instalasi Python

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Jika memakai macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Menjalankan Backend

```bash
cd backend
python app.py
```

Backend berjalan di:

```text
http://127.0.0.1:5000
```

Endpoint utama:

```text
POST http://127.0.0.1:5000/api/detect-gesture
```

## Menjalankan Frontend

Dari folder proyek:

```bash
cd frontend
python -m http.server 8000
```

Buka:

```text
http://127.0.0.1:8000
```

Gunakan `localhost` atau `127.0.0.1` supaya browser mengizinkan akses kamera saat development.

## Deploy ke Render Satu Service

Project ini sudah disiapkan agar Flask melayani frontend dan backend dalam satu URL Render.

1. Push project ke GitHub.
2. Buka Render, pilih `New` lalu `Blueprint`.
3. Pilih repository Photoblur.
4. Render akan membaca `render.yaml`.
5. Deploy service `photoblur`.

Konfigurasi Render:

```text
Build Command: pip install -r backend/requirements.txt
Start Command: gunicorn backend.app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120
```

Setelah deploy, buka URL Render yang diberikan. Frontend, asset, audio, frame, dan API gesture berjalan dari URL yang sama.

## Fitur Selesai

- Landing page Photoblur dengan logo, tutorial, dekorasi pastel, dan modal pilihan 2 atau 4 foto.
- Halaman kamera dengan preview browser camera, status gesture, countdown, counter, thumbnail, ulang foto, ulang semua, dan lanjut editor.
- Komunikasi frontend ke Flask backend lewat Fetch API.
- Deteksi gesture peace di backend menggunakan MediaPipe/OpenCV berdasarkan landmark jari telunjuk, tengah, manis, kelingking, dan jarak antar jari.
- Mekanisme stabilitas pose dan cooldown setelah capture.
- Editor Canvas dengan layout mode 2/4 foto, frame, stiker, teks, filter, blur, brightness, contrast, saturation.
- Stiker dan teks dapat digeser, diperbesar/diperkecil, diputar, dan dihapus lewat handle pada canvas.
- Undo, redo, reset dekorasi, preview penuh, halaman hasil, dan download PNG.
- CSS responsif untuk handphone, tablet, laptop/desktop, dan monitor besar.

## Placeholder

- Stiker versi awal dibuat dari teks/simbol Canvas dan label sederhana, bukan aset PNG/WebP kompleks.
- Frame versi awal dibuat secara programatis di Canvas, dengan satu aset frame PNG yang tersedia belum dipakai sebagai overlay final.
- Efek blur diterapkan ke foto di Canvas secara global pada area foto, belum memisahkan wajah dan background.

## Pengujian Kamera dan Gesture

1. Jalankan backend Flask.
2. Jalankan frontend dengan server lokal.
3. Buka `http://127.0.0.1:8000`.
4. Klik `Mulai Foto Sekarang`.
5. Pilih `2 Foto` atau `4 Foto`.
6. Izinkan kamera dari browser.
7. Angkat pose peace dengan telunjuk dan jari tengah terbuka, jari manis dan kelingking tertutup.
8. Tahan pose sampai indikator stabil penuh dan countdown 3, 2, 1 selesai.
9. Pastikan foto masuk ke thumbnail.
10. Ulangi sampai semua slot terisi, lalu klik `Lanjut Hias Foto`.
11. Tambah frame, stiker, teks, filter, dan unduh PNG.

## Keterbatasan

- MediaPipe perlu berhasil terpasang di environment Python. Jika belum, endpoint tetap merespons tetapi tidak dapat mendeteksi gesture sungguhan.
- Akses kamera umumnya membutuhkan `localhost`, `127.0.0.1`, atau HTTPS.
- Deteksi peace bergantung pencahayaan, jarak tangan, dan orientasi kamera.
