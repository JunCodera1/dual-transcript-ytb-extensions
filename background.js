/* ─────────────────────────────────────────────
   Background Script — YT Bilingual Sub
   Handles translation fetch as fallback
   (Firefox content scripts can fetch directly,
    but this is available as backup)
───────────────────────────────────────────── */

const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "TRANSLATE") {
        const { text, lang } = msg;
        const url =
            "https://translate.googleapis.com/translate_a/single" +
            `?client=gtx&sl=auto&tl=${lang}&dt=t&q=` + encodeURIComponent(text);

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                const translated = data[0].map(x => x[0]).join("");
                sendResponse({ ok: true, translated });
            })
            .catch(err => {
                sendResponse({ ok: false, error: err.message });
            });

        // Return true to indicate async sendResponse
        return true;
    }
});

console.log("[bilingual] Background script loaded");
