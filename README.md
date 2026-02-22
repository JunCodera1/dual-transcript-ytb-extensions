# ⬡ YT Bilingual Subtitle

Firefox extension that adds **bilingual subtitles** to YouTube videos — translated text appears directly inside YouTube's caption window, right below the original.

![Firefox](https://img.shields.io/badge/Firefox-109%2B-ff7139?logo=firefox)
![Version](https://img.shields.io/badge/version-6.0-00ffcc)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📥 Installation (1 minute)

### Option A — Download `.xpi` (Easiest)

1. Go to [**Releases**](../../releases) → download the latest `.xpi` file
2. Open Firefox → drag the `.xpi` file into the browser window
3. Click **Add** when prompted
4. Done! ✅

### Option B — From source

1. Download or clone this repo:
   ```bash
   git clone https://github.com/JunCodera1/dual-transcript-ytb-extensions.git
   ```
2. Open Firefox → type `about:debugging` in URL bar
3. Click **This Firefox** → **Load Temporary Add-on**
4. Select `manifest.json` from the folder
5. Done! ✅

### Option C — Build `.xpi` yourself

```bash
git clone https://github.com/JunCodera1/dual-transcript-ytb-extensions.git
cd dual-transcript-ytb-extensions
bash build.sh
# → yt-bilingual-subtitle-v6.0.xpi created
```
Then drag the `.xpi` into Firefox.

---

## 🚀 How to Use

1. Open any **YouTube video**
2. **Turn on CC** (click the subtitle button on the YouTube player)
3. Translated subtitles appear automatically below the original! 🎉

### Panel Controls

| Action | How |
|---|---|
| **Toggle subtitles** | `Alt+B` or panel toggle switch |
| **Hide panel** | `Alt+H` (click ⬡ to restore) |
| **Collapse panel** | Click ⊟ on panel header |
| **Change language** | Dropdown in panel |
| **Record audio** | Click 🎤 Audio |
| **Export transcript** | Click 💾 Export |

---

## ✨ Features

- **Bilingual captions** — original + translated, inside YouTube's caption frame
- **12+ languages** — 🇻🇳 Vietnamese, 🇬🇧 English, 🇨🇳 Chinese, 🇯🇵 Japanese, 🇰🇷 Korean, 🇫🇷 French, 🇩🇪 German, 🇪🇸 Spanish, 🇧🇷 Portuguese, 🇷🇺 Russian, 🇹🇭 Thai, 🇮🇩 Indonesian
- **No rate limiting** — reads already-rendered captions, zero YouTube API calls
- **Cached translation** — same sentence is never translated twice
- **Audio capture** — record video audio direct from browser (no microphone)
- **Transcript export** — save bilingual log as `.txt` file
- **Customizable** — font size, color, text shadow, panel position

## 🏗 How It Works

```
YouTube plays video → CC subtitles render in DOM
        ↓
Extension polls every 100ms: read .ytp-caption-segment
        ↓
New text detected → Google Translate (cached)
        ↓
Translated text appended inside .ytp-caption-window-bottom
        ↓
Result: both languages shown together, clean and inline
```

**No YouTube API calls** — the extension only reads what YouTube already renders on screen.

## 🔒 Privacy

- All processing happens locally in your browser
- Only network request: `translate.googleapis.com` (for translation)
- No data collection, no analytics, no tracking
- Transcript stays in `localStorage`, never uploaded

## 📁 Files

| File | Purpose |
|---|---|
| `content.js` | Core logic — DOM scraping, translation, rendering, panel UI |
| `background.js` | Service worker |
| `popup.html/js` | Quick toggle popup |
| `manifest.json` | Extension config |
| `build.sh` | Package as `.xpi` |

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

[MIT](LICENSE) © Jun
