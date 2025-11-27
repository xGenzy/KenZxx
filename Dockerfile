# Gunakan Node.js versi LTS
FROM node:18-bullseye

# 1. Install Library Sistem yang dibutuhkan
# Kita butuh python3 untuk yt-dlp, dan library grafik untuk canvas/puppeteer jika dibutuhkan
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    webp \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 2. Setup Direktori Kerja
WORKDIR /usr/src/app

# 3. Copy Package Files
COPY package*.json ./

# 4. Install Dependensi Node.js
# --omit=dev agar lebih ringan
RUN node wabot.js

# 5. Copy Semua Kode Bot
COPY . .

# 6. Expose Port (Penting untuk Cloud Hosting)
EXPOSE 3000

# 7. Perintah Menjalankan Bot
CMD ["node", "index.js"] 
# Ganti index.js dengan nama file utama bot kamu
