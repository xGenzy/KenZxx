// =================================================================
// 🤖 KenZx Bot — V8.3 (Lite Version: Downloader Only)
// =================================================================
// Jalankan: node fixx.js

const { IgApiClient } = require('instagram-private-api');
const fs = require('fs');
const { execSync } = require("child_process");
const path = require("path");
const https = require("https");
const readline = require("readline");
const { fbdown } = require('btch-downloader'); 

// =================== 1. AUTO INSTALL DEPENDENCIES ===================
const IG_USERNAME = 'tiger.4148083'; 
const IG_PASSWORD = '#Dimas094';

const ig = new IgApiClient();

// --- FUNGSI LOGIN & SAVE SESSION ---
async function loginInstagram() {
  ig.state.generateDevice(IG_USERNAME);

  // 1. Cek session file
  if (fs.existsSync('ig_state.json')) {
    try {
      await ig.state.deserialize(JSON.parse(fs.readFileSync('ig_state.json', 'utf8')));
      console.log('✅ [IG Internal] Berhasil load session.');
      return;
    } catch (e) {
      console.log('⚠️ [IG Internal] Session invalid, login ulang...');
    }
  }

  // 2. Login Baru
  try {
    console.log('🔄 [IG Internal] Sedang login...');
    
    // ❌ ERROR DISINI, JADI KITA MATIKAN SEMENTARA:
    // await ig.simulate.preLoginFlow(); 
    
    // Langsung login saja
    const loggedInUser = await ig.account.login(IG_USERNAME, IG_PASSWORD);
    
    // ❌ INI JUGA RAWAN ERROR, MATIKAN JUGA:
    // process.nextTick(async () => await ig.simulate.postLoginFlow());

    // 3. Simpan Session
    const serialized = await ig.state.serialize();
    delete serialized.constants;
    fs.writeFileSync('ig_state.json', JSON.stringify(serialized));
    console.log(`✅ [IG Internal] Login Sukses sebagai ${loggedInUser.username}`);
  } catch (e) {
    // Tangkap error spesifik checkpoint
    if (e.message.includes('checkpoint')) {
        console.error(`❌ [IG Internal] Akun terkena CHECKPOINT! Silakan login manual di HP atau ganti akun.`);
    } else {
        console.error(`❌ [IG Internal] Gagal Login: ${e.message}`);
    }
  }
}

const dependencies = [
  "@whiskeysockets/baileys",
  "pino",
  "axios",
  "btch-downloader", 
  "qs",
  "cheerio", 
  "file-type"
  // form-data dihapus karena hanya dipakai untuk fitur HD
];

console.log("🚀 Memeriksa dan menginstal dependensi...");
for (const dep of dependencies) {
  try {
    require.resolve(dep);
  } catch {
    console.log(`📦 Menginstal: ${dep}...`);
    execSync(`npm install ${dep} --silent`, { stdio: "inherit" });
  }
}

// Imports
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay,
  getContentType,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const qs = require("qs");
const cheerio = require("cheerio");
const { youtube } = require("btch-downloader");

// =================== 2. CONFIG & CLIENT ===================
const config = {
  sessionName: "session",
  pairingTimeout: 60000,
  downloadPath: "./downloads",
  botName: "KenZx Bot"
};

const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

// Buat folder download jika belum ada
if (!fs.existsSync(config.downloadPath)) fs.mkdirSync(config.downloadPath, { recursive: true });

// Axios Client
const client = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

// =================== 3. HELPER FUNCTIONS ===================

// Fungsi Waktu WIB
const getWIBTime = () => {
  const options = {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  return new Date().toLocaleString("id-ID", options) + " WIB";
};

// =================== 4. THE ENGINES (SCRAPERS) ===================

const Engine = {
  // 🎵 TikTok
  tiktok: async (url) => {
    try {
      const { data } = await client.post('https://www.tikwm.com/api/', qs.stringify({ url: url }));
      if (!data.data) throw new Error("Konten TikTok tidak ditemukan/Privat");
      if (data.data.images && data.data.images.length > 0) {
        return { type: 'slide', urls: data.data.images, title: data.data.title, author: data.data.author?.nickname };
      }
      return { url: data.data.play, title: data.data.title, type: "video" };
    } catch (e) { throw new Error(`TikTok Error: ${e.message}`); }
  },

  // 📸 Instagram (Support: Story, Post, Reels, TV)
  instagram: async (url) => {
    // 1. Bersihkan URL
    const cleanUrl = url.replace("m.instagram.com", "www.instagram.com").split("?")[0].replace(/\/$/, "");
    console.log(`\n🔍 Processing URL: ${cleanUrl}`);

    // --- METODE 1: INTERNAL PRIVATE API (Login Akun Tumbal) ---
    try {
      let mediaId = null;

      // [A] DETEKSI FORMAT STORY (Link ada angka panjang di belakang)
      // Contoh: .../stories/username/3773601740403926592
      const storyMatch = cleanUrl.match(/stories\/[^\/]+\/(\d+)/);
      
      if (storyMatch && storyMatch[1]) {
        console.log(`📱 Terdeteksi Link STORY`);
        mediaId = storyMatch[1]; // Story ID sudah berbentuk angka, langsung pakai
      } 
      
      // [B] DETEKSI FORMAT POST/REEL (Link pakai Shortcode)
      // Contoh: .../p/Cp-qj1_hC29
      else {
        const postMatch = cleanUrl.match(/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
        if (postMatch && postMatch[1]) {
          const shortcode = postMatch[1];
          console.log(`🎫 Terdeteksi Link POST/REEL (Shortcode: ${shortcode})`);
          
          // Convert Shortcode -> Media ID
          let id = 0n;
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
          for (let c of shortcode) {
             id = (id * 64n) + BigInt(alphabet.indexOf(c));
          }
          mediaId = id.toString();
        }
      }

      // [C] EKSEKUSI JIKA ID DITEMUKAN
      if (mediaId) {
        console.log(`🆔 Mengambil data dari Media ID: ${mediaId}`);
        const info = await ig.media.info(mediaId);
        const item = info.items[0];

        // Parsing Hasil
        let result = {
          title: "Instagram Media",
          type: "image",
          url: "",
          media: []
        };

        // Handling Caption (Story kadang tidak ada caption)
        result.title = item.caption ? item.caption.text : (item.story_music_lyrics ? "Story with Music" : "Instagram Story/Post");

        // Cek Tipe Konten
        if (item.carousel_media) {
           // Carousel
           result.type = "carousel";
           item.carousel_media.forEach(m => {
             result.media.push(m.video_versions ? m.video_versions[0].url : m.image_versions2.candidates[0].url);
           });
           result.url = result.media[0];
        } else if (item.video_versions) {
           // Video / Story Video
           result.type = "video";
           result.url = item.video_versions[0].url;
           result.media.push(result.url);
        } else {
           // Foto / Story Foto
           result.type = "image";
           result.url = item.image_versions2.candidates[0].url;
           result.media.push(result.url);
        }

        console.log("✅ Sukses via Internal API");
        return result;

      } else {
        console.log("⚠️ Pola URL tidak dikenali (Bukan Post/Reel/Story).");
      }

    } catch (e) {
      console.log(`⚠️ Internal API Gagal (${e.message}), beralih ke External...`);
      // Lanjut ke backup di bawah
    }

    // --- METODE 2: VKRBOT (Backup) ---
    try {
      console.log("🔄 Beralih ke Vkrbot...");
      const { data } = await axios.get(`https://vkrbot.online/api/igdl?url=${cleanUrl}`);
      if (data?.data && data.data.length > 0) {
        const media = data.data[0];
        return {
          url: media.url,
          title: "Instagram (Vkrbot)",
          type: (media.url.includes(".mp4") || media.type === "video") ? "video" : "image",
          media: data.data
        };
      }
    } catch (e) { console.log("Server 1 Gagal."); }

    // --- METODE 3: SIPUTZX (Cadangan) ---
    try {
      console.log("🔄 Beralih ke Siputzx...");
      const { data } = await axios.get(`https://api.siputzx.my.id/api/d/igdl?url=${cleanUrl}`);
      if (data?.data && data.data.length > 0) {
        const media = data.data[0];
        return {
          url: media.url,
          title: "Instagram (Siput)",
          type: media.url.includes(".mp4") ? "video" : "image"
        };
      }
    } catch (e) {
      return { status: false, message: "Gagal scrape data." };
    }
  },

  // 📘 Facebook
  facebook: async (url) => {
    try {
      const data = await fbdown(url);
      
      if (!data) throw new Error("Data tidak ditemukan");

      // Prioritas HD, fallback ke SD
      const videoUrl = data.HD || data.SD || data.Normal_video;
      
      if (videoUrl) {
          return { 
              url: videoUrl, 
              title: "Facebook Video Downloader",
              type: "video" 
          };
      }
    } catch (e) {
      console.error(e); // Cek error di console
      throw new Error("Gagal mengambil video. Pastikan link publik (bukan private group).");
    }
    throw new Error("Video FB tidak ditemukan.");
  },

  // 📺 YouTube
  youtube: async (url) => {
    try {
      const data = await youtube(url);
      if (!data || !data.mp4) throw new Error("Gagal mengambil data YouTube");
      return { url: data.mp4, title: data.title || "YouTube Video", type: "video" };
    } catch (e) { throw new Error(`YouTube Error: ${e.message}`); }
  }
};

// =================== 5. DOWNLOAD MANAGER ===================

async function downloadAndSave(data) {
  if (!data.url) throw new Error("URL tidak valid.");
  if (data.url.startsWith("//")) data.url = "https:" + data.url;
  const ext = data.type === "video" ? "mp4" : "jpg";
  const filename = `${Date.now()}.${ext}`;
  const filePath = path.join(config.downloadPath, filename);
  const writer = fs.createWriteStream(filePath);
  const response = await client({ url: data.url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => { resolve({ filePath, ...data }); });
    writer.on('error', reject);
  });
}

// =================== 6. MAIN BOT LOGIC ===================

async function startBot() {
    console.clear();
    console.log("🚀 STARTING KENZX BOT...");
    
    if (!fs.existsSync(config.sessionName)) fs.mkdirSync(config.sessionName, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });
const usePairingCode = true; 
    
    if (usePairingCode && !sock.authState.creds.registered) {
        console.clear();
console.log(`
╭──────────────────────────────────────────────────────────╮
│  ⚡  WHATSAPP PAIRING ASSISTANT                          │
╰──────────────────────────────────────────────────────────╯
│
│  Selamat datang di setup koneksi KenZx Bot.
│  Untuk menghubungkan, ikuti langkah berikut:
│
│  1. Buka WhatsApp di HP Anda.
│  2. Pilih menu "Perangkat Tertaut" > "Tautkan Perangkat".
│  3. Pilih opsi "Tautkan dengan nomor telepon".
│
╰──────────────────────────────────────────────────────────╯
`);
        // Menunggu input nomor telepon
        // Input Nomor
    const phone = await question("   📞 Masukkan Nomor HP (Contoh: +62xxxxx) : ");
    
    // Loading Message
    console.log("\n   ⚡  Sedang berkomunikasi dengan Server WhatsApp...");
    console.log("       Mohon tunggu sebentar, jangan tutup terminal.\n");

        try {
        const code = await sock.requestPairingCode(phone.replace(/\D/g, ""));
        
        // Memisahkan kode menjadi format 4-4 (contoh: ABC1-23DE)
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

        console.log(`
✅  PAIRING CODE BERHASIL DITERIMA!

   ╭──────────────────────────────────────────╮
   │   🔑  KODE ANDA :  ${formattedCode}    │
   ╰──────────────────────────────────────────╯

   👣  LANGKAH SELANJUTNYA:
   1. Buka WhatsApp di HP Anda.
   2. Pilih menu Perangkat Tertaut (Linked Devices).
   3. Ketuk Tautkan Perangkat > Tautkan dengan No. HP.
   4. Masukkan kode di atas.

   ⏳  Waktu sesi habis dalam ${(config.pairingTimeout / 60000)} menit.
   ──────────────────────────────────────────────────
`);
    } catch (err) {
        console.log(`
   ❌  GAGAL MENDAPATKAN KODE PAIRING
   
   ⚠️  Reason : ${err.message}
   
   Tips:
   - Pastikan nomor diawali kode negara (62).
   - Periksa koneksi internet server.
   - Coba lagi dalam beberapa saat.
   ──────────────────────────────────────────────────
`);
        }
    }
    // =========================================================================

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
        if (connection === "open") {
            console.log("✅ BOT ONLINE! Siap digunakan.");
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("⚠️ Koneksi terputus, mencoba menghubungkan ulang...");
                startBot();
            } else {
                console.log("❌ Sesi logout. Silakan hapus folder sesi dan scan ulang.");
                process.exit(1);
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const jid = m.key.remoteJid;
        const type = getContentType(m.message);
        const text = type === 'conversation' ? m.message.conversation : 
                     type === 'extendedTextMessage' ? m.message.extendedTextMessage.text : "";

        if (!text) return;

        const cmd = text.trim().toLowerCase();

    // === COMMAND: MENU ===
    if (['menu', '.menu', 'hi', 'hallo', 'assalamualaikum', 'p'].includes(cmd)) {
      const currentTime = getWIBTime();
      const menuText = `╭───────────────────────────╮
│  *⚡  WHATSAPP ASSISTANT*                       │ ╰───────────────────────────╯
│ *Waktu Indonesia Barat*                               
│ ${currentTime}                                         
│───────────────────────────╯
│ *Support Link:*                                        
│ ▫️ Instagram (Reels/Post)                       
│ ▫️ Facebook (Video)                                 
│ ▫️ TikTok (No Watermark)                        
│ ▫️ YouTube (Video)                                  
╰───────────────────────────╯
⚠️ Kirimkan Link platform yang ingin kamu unduh.`;
      await sock.sendMessage(jid, { text: menuText });
      return;
    }
    
    if (['bagus', 'keren', 'bermanfaat'].includes(cmd)) {
      const currentTime = getWIBTime();
      const menuText = `Terimakasih! 
bantu support kami:
- Dana 083177931811

Support kamu adalah semangat bagi kami.`;
      await sock.sendMessage(jid, { text: menuText });
      return;
    }

    // === COMMAND: DOWNLOADER (URL) ===
    if (text.startsWith("http")) {
      let scraper = null;
      let platform = "";

      if (text.includes("tiktok.com")) { scraper = Engine.tiktok; platform = "TikTok"; }
      else if (text.includes("instagram.com")) { scraper = Engine.instagram; platform = "Instagram"; }
      else if (text.includes("facebook.com") || text.includes("fb.watch")) { scraper = Engine.facebook; platform = "Facebook"; }
      else if (text.includes("youtube.com") || text.includes("youtu.be")) { scraper = Engine.youtube; platform = "YouTube"; }
      
      if (!scraper) return;

      try {
        await sock.sendMessage(jid, { react: { text: "🧑‍💻", key: m.key } });
        const rawData = await scraper(text);

        // TikTok Slide
        if (rawData.type === 'slide') {
            await sock.sendMessage(jid, { react: { text: "📸", key: m.key } });
            await sock.sendMessage(jid, { text: `✅ *SLIDE FOUND*\n📸 Total: ${rawData.urls.length}\n_Sending..._` }, { quoted: m });
            for (let i = 0; i < rawData.urls.length; i++) {
                const slideData = await downloadAndSave({ url: rawData.urls[i], title: `Slide ${i}`, type: 'image' });
                await sock.sendMessage(jid, { image: fs.readFileSync(slideData.filePath), caption: `Slide ${i+1}` });
                fs.unlinkSync(slideData.filePath);
            }
            await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });
            return;
        }

        // Video/Image Single
        await sock.sendMessage(jid, { react: { text: "🕵️", key: m.key } });
        const fileData = await downloadAndSave(rawData);
        const finishTime = getWIBTime();
        const caption = `✅ Source: ${platform}\n▶️ Judul: ${fileData.title}`;
        
        if (fileData.type === 'video') {
            await sock.sendMessage(jid, { video: fs.readFileSync(fileData.filePath), caption, mimetype: 'video/mp4' }, { quoted: m });
        } else {
            await sock.sendMessage(jid, { image: fs.readFileSync(fileData.filePath), caption }, { quoted: m });
        }
        
        await sock.sendMessage(jid, { react: { text: "📹", key: m.key } });
        fs.unlinkSync(fileData.filePath);

      } catch (e) {
        await sock.sendMessage(jid, { text: `⚠️ Gagal: ${e.message}` }, { quoted: m });
      }
    }
  });
}
loginInstagram();
startBot().catch(e => console.error("Fatal Error:", e));