# Contributing to YT Bilingual Subtitle

Thanks for your interest in contributing! This is a simple Firefox extension — here's how to get involved.

## 🚀 Getting Started

1. **Fork & clone** the repository
2. Load the extension in Firefox: `about:debugging` → **Load Temporary Add-on** → select `manifest.json`
3. Open a YouTube video with CC enabled to test

## 📁 Project Structure

```
content.js      ← Main content script (all logic here)
background.js   ← Service worker
popup.html/js   ← Browser action popup
manifest.json   ← Extension manifest
icon.png        ← Icon
```

Most changes will be in `content.js` — it contains translation, rendering, audio capture, and the panel UI.

## 🔧 Development

- **No build step** — edit files directly, reload extension in `about:debugging`
- **Testing** — open YouTube, enable CC, watch the console (`F12`)
- **Key constraint** — never call YouTube's `timedtext` API to avoid rate limiting

### Architecture Rules

1. **DOM scraping only** — read `.ytp-caption-segment`, never fetch YouTube APIs
2. **Render inside caption window** — append to `.ytp-caption-window-bottom`, re-attach every poll cycle
3. **Cache translations** — never translate the same sentence twice
4. **No external dependencies** — vanilla JS only

## 📝 Pull Request Guidelines

- **One feature per PR** — keep changes focused
- **Test on YouTube** — verify subtitles display correctly
- **Check console** — no errors or warnings from the extension
- **Describe your change** — what it does and why

## 💡 Ideas for Contribution

- [ ] Support more subtitle selectors for YouTube layout changes
- [ ] Add more target languages
- [ ] Offline translation (e.g., WASM-based model)
- [ ] Settings sync via `browser.storage`
- [ ] Dark/light theme toggle for panel
- [ ] Whisper-based audio transcription

## 🐛 Reporting Bugs

Open an issue with:
1. YouTube video URL
2. Browser version
3. Console output (`F12` → Console tab)
4. Screenshot if relevant

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
