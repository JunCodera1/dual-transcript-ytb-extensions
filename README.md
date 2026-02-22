# ⬡ YT Bilingual Subtitle

Firefox extension that adds **bilingual subtitles** to YouTube videos — translated text appears directly inside YouTube's caption window, right below the original.

![Firefox](https://img.shields.io/badge/Firefox-109%2B-ff7139?logo=firefox)
![Version](https://img.shields.io/badge/version-6.0-00ffcc)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

- **Bilingual subtitles** — original + translated text side-by-side inside YouTube's caption area
- **12+ languages** — Vietnamese, English, Chinese, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Thai, Indonesian
- **Zero YouTube API calls** — reads captions from DOM, no rate limiting
- **Google Translate** — automatic translation with per-sentence caching
- **Audio capture** — record video audio via `captureStream()` (Firefox-native, no mic needed)
- **Customizable** — font size, color, text shadow
- **Transcript export** — save bilingual transcript as `.txt`
- **Keyboard shortcuts** — `Alt+B` toggle, `Alt+H` hide panel
- **Draggable panel** — position anywhere on screen

## 📦 Installation

### Firefox (Developer/Temporary)

1. Clone or download this repository
2. Open Firefox → `about:debugging` → **This Firefox**
3. Click **Load Temporary Add-on**
4. Select `manifest.json` from this folder

### Firefox (Permanent)

1. Zip all files: `zip -r bilingual-sub.xpi manifest.json content.js background.js popup.html popup.js icon.png`
2. Go to `about:addons` → ⚙️ → **Install Add-on From File**
3. Select the `.xpi` file

## 🚀 Usage

1. Open any YouTube video
2. **Turn on YouTube's CC** (click the subtitle button on the player)
3. The extension reads the caption text and adds translated text below it
4. Use the floating panel to change language, font size, color, etc.

### Controls

| Action | Method |
|---|---|
| Toggle subtitles | `Alt+B` or panel toggle |
| Hide/show panel | `Alt+H` or click ⬡ |
| Collapse panel body | Click ⊟ on panel header |
| Change language | Select in panel dropdown |
| Record audio | Click 🎤 Audio button |
| Export transcript | Click 💾 Export button |

## 🏗 Architecture

```
YouTube Video
  ↓
Poll every 100ms: read .ytp-caption-segment (DOM)
  ↓
New text? → Google Translate (cached) → append <span> inside .ytp-caption-window-bottom
  ↓
Result: bilingual subtitle inside YouTube's own caption frame — no overflow, no flash
```

### Files

| File | Purpose |
|---|---|
| `content.js` | Main logic — DOM scraping, translation, rendering, audio capture, panel UI |
| `background.js` | Service worker for extension lifecycle |
| `popup.html/js` | Browser action popup (quick toggle) |
| `manifest.json` | Extension manifest (Manifest V3, Gecko) |
| `icon.png` | Extension icon |

## ⚙️ Configuration

All settings are stored in `localStorage` and persist across sessions:

- **Target language** — default: Vietnamese (`vi`)
- **Font scale** — 50%–300%
- **Color** — any hex color
- **Text shadow** — on/off
- **Panel position** — drag to reposition, saved automatically

## 🔒 Privacy

- **No data collection** — everything runs locally
- **No external servers** — only `translate.googleapis.com` for translation
- **No YouTube API calls** — reads already-rendered captions from the page DOM
- **Transcript stays local** — saved in `localStorage`, never uploaded

## 📄 License

MIT — see [LICENSE](LICENSE)
