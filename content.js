(() => {
    /* ─────────────────────────────────────────────
       YT BILINGUAL SUBTITLE  v6.0
       DOM scraping + Google Translate + Audio Capture
       Zero YouTube API calls — no rate limiting
    ───────────────────────────────────────────── */

    const STORAGE_KEY = "__yt_bilingual_config";
    const POS_KEY = "__yt_bilingual_pos";
    const LOG_KEY = "__yt_bilingual_log";

    if (window.__ytBilingualActive) return;
    window.__ytBilingualActive = true;
    window.__ytBilingualStop?.();

    const DEFAULTS = {
        enabled: true, fontScale: 1.1, color: "#00ffcc",
        shadow: true, targetLang: "vi", collapsed: false, opacity: 0.92,
    };
    const state = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    const transcript = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    const saveLog = () => localStorage.setItem(LOG_KEY, JSON.stringify(transcript.slice(-500)));
    const transCache = new Map();

    let lastText = "", lastVI = "";
    let processing = false;
    let queue = [];

    /* ═══════════════════════════════════════
       DOM Scraping — read YouTube's rendered CC
    ═══════════════════════════════════════ */

    function getEN() {
        return Array.from(document.querySelectorAll(".ytp-caption-segment"))
            .map(s => s.innerText.trim()).filter(Boolean).join(" ");
    }

    /* ═══════════════════════════════════════
       Translation — Google Translate (cached)
    ═══════════════════════════════════════ */

    async function googleTranslate(text) {
        const key = `${state.targetLang}:${text}`;
        if (transCache.has(key)) return transCache.get(key);
        const url = "https://translate.googleapis.com/translate_a/single"
            + `?client=gtx&sl=auto&tl=${state.targetLang}&dt=t&q=` + encodeURIComponent(text);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const out = data[0].map(x => x[0]).join("");
        transCache.set(key, out);
        return out;
    }

    async function processQueue() {
        if (processing || queue.length === 0) return;
        processing = true;
        while (queue.length > 0) {
            const text = queue.pop();
            queue = [];
            try {
                const vi = await googleTranslate(text);
                // Only display if this is still the current caption
                if (lastText === text) {
                    lastVI = vi;
                    attachTranslation();
                    transcript.push({ ts: new Date().toISOString(), en: text, tl: vi });
                    saveLog();
                }
            } catch (e) {
                console.warn("[bilingual] translate error:", e.message);
            }
        }
        processing = false;
    }

    /* ═══════════════════════════════════════
       Rendering — INSIDE YouTube's caption window
    ═══════════════════════════════════════ */

    function applyStyle(el) {
        el.style.fontSize = `${state.fontScale * 100}%`;
        el.style.color = state.color;
        el.style.textShadow = state.shadow
            ? "1px 1px 8px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,.7)" : "none";
    }

    function attachTranslation() {
        if (!lastVI || !state.enabled) return;

        const container = document.querySelector(".ytp-caption-window-bottom")
            || document.querySelector(".caption-window")
            || document.querySelector("[class*='caption-window']");
        if (!container) return;

        // Find or create our element INSIDE the caption window
        let el = container.querySelector("#__yt_vi_line");
        if (!el) {
            el = document.createElement("span");
            el.id = "__yt_vi_line";
            Object.assign(el.style, {
                display: "block",
                textAlign: "center",
                lineHeight: "1.4",
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                pointerEvents: "none",
                marginTop: "2px",
                padding: "0",
            });
            container.appendChild(el);
        }

        applyStyle(el);
        el.textContent = lastVI;
    }

    /* ═══════════════════════════════════════
       Main poll loop — 250ms
    ═══════════════════════════════════════ */

    const pollInterval = setInterval(() => {
        if (!state.enabled) return;

        const text = getEN();

        // Caption disappeared
        if (!text) {
            if (lastText || lastVI) {
                lastVI = "";
                lastText = "";
                const el = document.getElementById("__yt_vi_line");
                if (el) el.remove();
            }
            return;
        }

        // Same caption — just re-attach in case YouTube rebuilt the window
        if (text === lastText) {
            if (lastVI) attachTranslation();
            return;
        }

        // NEW caption — clear old translation immediately
        lastText = text;
        lastVI = "";
        const el = document.getElementById("__yt_vi_line");
        if (el) el.remove();

        queue.push(text);
        processQueue();
    }, 100);

    /* ═══════════════════════════════════════
       Audio Capture — captureStream() for Firefox
    ═══════════════════════════════════════ */

    let audioCtx = null;
    let audioSource = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let audioActive = false;

    function startAudioCapture() {
        const video = document.querySelector("video");
        if (!video) { toast("⚠ No video found"); return; }

        try {
            // Get MediaStream from video element
            const stream = video.captureStream
                ? video.captureStream()
                : video.mozCaptureStream();

            // Firefox workaround: captureStream() mutes the video
            // Route audio through AudioContext to keep it audible
            audioCtx = new AudioContext();
            audioSource = audioCtx.createMediaStreamSource(stream);
            audioSource.connect(audioCtx.destination);

            // Create a new stream from AudioContext for recording
            const dest = audioCtx.createMediaStreamDestination();
            audioSource.connect(dest);

            // Record 5-second chunks
            mediaRecorder = new MediaRecorder(dest.stream, {
                mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                    ? "audio/webm;codecs=opus" : "audio/webm"
            });

            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunks.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                if (audioChunks.length > 0) {
                    const blob = new Blob(audioChunks, { type: "audio/webm" });
                    downloadAudioBlob(blob);
                    audioChunks = [];
                }
            };

            mediaRecorder.start(5000); // 5-second chunks
            audioActive = true;
            updateStatus("🎤 Recording audio...");
            toast("🎤 Audio capture started");
            console.log("[bilingual] 🎤 Audio capture started via captureStream()");

        } catch (e) {
            console.warn("[bilingual] Audio capture failed:", e);
            toast("⚠ Audio capture failed: " + e.message);
            updateStatus("⚠ Audio capture not available");
        }
    }

    function stopAudioCapture() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        if (audioCtx) {
            audioCtx.close().catch(() => { });
            audioCtx = null;
        }
        audioSource = null;
        mediaRecorder = null;
        audioActive = false;
        updateStatus("⏹ Audio stopped");
    }

    function downloadAudioBlob(blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `yt_audio_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast("💾 Audio saved");
    }

    /* ═══════════════════════════════════════
       UI Helpers
    ═══════════════════════════════════════ */

    function updateStatus(msg) {
        const el = panel?.querySelector("#statusInfo");
        if (el) el.textContent = msg;
    }

    const LANGS = [
        ["vi", "Tiếng Việt"], ["en", "English"], ["zh-CN", "中文(简)"], ["ja", "日本語"],
        ["ko", "한국어"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"],
        ["pt", "Português"], ["ru", "Русский"], ["th", "ภาษาไทย"], ["id", "Bahasa Indonesia"],
    ];

    function toast(msg) {
        const t = document.createElement("div");
        Object.assign(t.style, {
            position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,255,180,.15)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(0,255,180,.4)", color: "#00ffcc",
            padding: "8px 18px", borderRadius: "999px", fontSize: "13px",
            fontFamily: "system-ui,sans-serif", zIndex: "10001",
            transition: "opacity .4s", pointerEvents: "none",
        });
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 1800);
    }

    function exportTranscript() {
        if (!transcript.length) { toast("📭 Empty"); return; }
        const lines = transcript.map(r => `[${r.ts.slice(11, 19)}]\n${r.en}\n→ ${r.tl}\n`).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([lines], { type: "text/plain" }));
        a.download = `bilingual_${Date.now()}.txt`;
        a.click();
    }

    /* ═══════════════════════════════════════
       Hotkeys & Controls
    ═══════════════════════════════════════ */

    const hotkey = (e) => {
        if (!e.altKey) return;
        if (e.key === "b" || e.key === "B") {
            state.enabled = !state.enabled; save();
            if (!state.enabled) {
                const el = document.getElementById("__yt_vi_line");
                if (el) el.remove();
            }
            toast(state.enabled ? "✅ Enabled" : "⏸ Disabled"); updateTrackUI();
        }
        if (e.key === "h" || e.key === "H") togglePanelVisible();
    };
    document.addEventListener("keydown", hotkey);

    function updateTrackUI() {
        const t = panel?.querySelector("#toggleTrack"), b = panel?.querySelector("#toggleThumb");
        if (t) t.style.background = state.enabled ? "#00ffcc" : "#444";
        if (b) b.style.left = state.enabled ? "17px" : "3px";
    }

    /* ═══════════════════════════════════════
       Panel
    ═══════════════════════════════════════ */

    const panel = document.createElement("div");
    const savedPos = JSON.parse(localStorage.getItem(POS_KEY) || "{}");
    Object.assign(panel.style, {
        position: "fixed", top: savedPos.top || "90px", right: savedPos.right || "20px",
        left: savedPos.left || "auto", zIndex: "10000",
        background: `rgba(10,10,15,${state.opacity})`, backdropFilter: "blur(14px) saturate(160%)",
        color: "#e8e8f0", padding: "12px 14px", borderRadius: "16px",
        fontSize: "12.5px", width: "252px",
        boxShadow: "0 12px 40px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.07)",
        border: "1px solid rgba(255,255,255,.1)", fontFamily: "system-ui, sans-serif", userSelect: "none",
    });

    const langOpts = LANGS.map(([v, l]) => `<option value="${v}"${v === state.targetLang ? " selected" : ""}>${l}</option>`).join("");

    panel.innerHTML = `
<div id="hdr" style="display:flex;align-items:center;justify-content:space-between;cursor:move;margin-bottom:10px;">
  <span style="font-weight:700;font-size:13px;letter-spacing:.5px;">
    <span style="color:#00ffcc;">⬡</span> Bilingual Sub <span style="font-size:10px;color:#888;margin-left:4px;">v6</span>
  </span>
  <span id="collapseBtn" title="Alt+H" style="cursor:pointer;font-size:16px;line-height:1;color:#888;">⊟</span>
</div>
<div id="body">
  <div style="margin-bottom:8px;padding:4px 8px;background:rgba(0,255,204,.06);border:1px solid rgba(0,255,204,.15);border-radius:8px;">
    <span id="statusInfo" style="font-size:11px;color:#00ffcc;">Ready — turn on YouTube CC</span>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
      <div id="toggleTrack" style="width:34px;height:18px;border-radius:9px;position:relative;cursor:pointer;background:${state.enabled ? "#00ffcc" : "#444"};transition:background .25s;">
        <div id="toggleThumb" style="position:absolute;top:3px;width:12px;height:12px;border-radius:50%;background:#fff;transition:left .25s;left:${state.enabled ? "17px" : "3px"};"></div>
      </div>
      <span>Enable <kbd style="font-size:10px;opacity:.5;border:1px solid #555;border-radius:3px;padding:0 3px;">Alt+B</kbd></span>
    </label>
  </div>
  <div style="margin-bottom:8px;">
    <label style="color:#aaa;font-size:11px;">Target language</label>
    <select id="lang" style="width:100%;margin-top:4px;background:#1a1a2e;border:1px solid #333;color:#e8e8f0;border-radius:8px;padding:4px 6px;font-size:12px;">${langOpts}</select>
  </div>
  <div style="margin-bottom:6px;">
    <div style="display:flex;justify-content:space-between;color:#aaa;font-size:11px;">
      <span>Font size</span><span id="fsVal">${Math.round(state.fontScale * 100)}%</span>
    </div>
    <input type="range" id="fs" min="0.5" max="3" step="0.05" value="${state.fontScale}" style="width:100%;accent-color:#00ffcc;">
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
    <label style="color:#aaa;font-size:11px;">Color</label>
    <input type="color" id="cl" value="${state.color}" style="width:36px;height:24px;border:none;background:none;cursor:pointer;">
    <span id="clHex" style="font-size:11px;color:#888;">${state.color}</span>
  </div>
  <div style="display:flex;gap:12px;margin-bottom:10px;">
    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;">
      <input type="checkbox" id="sh" ${state.shadow ? "checked" : ""} style="accent-color:#00ffcc;"> Shadow
    </label>
  </div>
  <div style="display:flex;gap:6px;">
    <button id="exportBtn" style="flex:1;padding:6px;border-radius:8px;border:1px solid #333;background:#1a1a2e;color:#aaa;cursor:pointer;font-size:11px;">💾 Export</button>
    <button id="clearLog" style="flex:1;padding:6px;border-radius:8px;border:1px solid #333;background:#1a1a2e;color:#aaa;cursor:pointer;font-size:11px;">🗑 Clear</button>
    <button id="audioBtn" style="flex:1;padding:6px;border-radius:8px;border:1px solid rgba(255,180,0,.3);background:rgba(255,180,0,.08);color:#ffb400;cursor:pointer;font-size:11px;">🎤 Audio</button>
  </div>
  <div style="margin-top:8px;font-size:10px;color:#555;text-align:center;">Alt+B toggle · Alt+H hide · No API call to YouTube</div>
</div>`;

    document.body.appendChild(panel);

    /* ── Collapse ── */
    const bodyEl = panel.querySelector("#body");
    function toggleCollapse() {
        state.collapsed = !state.collapsed; save();
        bodyEl.style.display = state.collapsed ? "none" : "block";
        panel.querySelector("#collapseBtn").textContent = state.collapsed ? "⊞" : "⊟";
    }
    if (state.collapsed) { bodyEl.style.display = "none"; panel.querySelector("#collapseBtn").textContent = "⊞"; }
    panel.querySelector("#collapseBtn").onclick = toggleCollapse;

    /* ── Mini button (shown when panel is hidden) ── */
    const miniBtn = document.createElement("div");
    miniBtn.id = "__yt_bilingual_mini";
    Object.assign(miniBtn.style, {
        position: "fixed", top: "10px", right: "10px", zIndex: "10000",
        width: "32px", height: "32px", borderRadius: "50%",
        background: "rgba(10,10,15,0.85)", backdropFilter: "blur(8px)",
        border: "1px solid rgba(0,255,204,.3)",
        display: "none", cursor: "pointer", userSelect: "none",
        textAlign: "center", lineHeight: "32px", fontSize: "16px",
        color: "#00ffcc", transition: "opacity .2s",
        boxShadow: "0 4px 12px rgba(0,0,0,.5)",
    });
    miniBtn.textContent = "⬡";
    miniBtn.title = "Alt+H — Show panel";
    miniBtn.onclick = () => togglePanelVisible();
    document.body.appendChild(miniBtn);

    let panelHidden = false;
    function togglePanelVisible() {
        panelHidden = !panelHidden;
        panel.style.display = panelHidden ? "none" : "block";
        miniBtn.style.display = panelHidden ? "block" : "none";
    }

    /* ── Toggle ── */
    panel.querySelector("#toggleTrack").onclick = () => {
        state.enabled = !state.enabled; save(); updateTrackUI();
        if (!state.enabled) {
            const el = document.getElementById("__yt_vi_line");
            if (el) el.remove();
        }
    };

    /* ── Controls ── */
    const qs = id => panel.querySelector(id);

    qs("#lang").onchange = e => {
        state.targetLang = e.target.value; save();
        transCache.clear(); lastText = ""; lastVI = "";
        toast(`🌐 → ${LANGS.find(l => l[0] === state.targetLang)?.[1] || state.targetLang}`);
    };
    qs("#fs").oninput = e => {
        state.fontScale = +e.target.value;
        qs("#fsVal").textContent = Math.round(state.fontScale * 100) + "%";
        attachTranslation(); save();
    };
    qs("#cl").oninput = e => {
        state.color = e.target.value; qs("#clHex").textContent = state.color;
        attachTranslation(); save();
    };
    qs("#sh").onchange = e => { state.shadow = e.target.checked; attachTranslation(); save(); };
    qs("#exportBtn").onclick = exportTranscript;
    qs("#clearLog").onclick = () => { transcript.length = 0; localStorage.removeItem(LOG_KEY); toast("🗑 Cleared"); };

    qs("#audioBtn").onclick = () => {
        if (audioActive) {
            stopAudioCapture();
            qs("#audioBtn").textContent = "🎤 Audio";
            qs("#audioBtn").style.color = "#ffb400";
            qs("#audioBtn").style.borderColor = "rgba(255,180,0,.3)";
            qs("#audioBtn").style.background = "rgba(255,180,0,.08)";
        } else {
            startAudioCapture();
            qs("#audioBtn").textContent = "⏹ Stop";
            qs("#audioBtn").style.color = "#ff6060";
            qs("#audioBtn").style.borderColor = "rgba(255,80,80,.3)";
            qs("#audioBtn").style.background = "rgba(255,60,60,.08)";
        }
    };

    /* ── Drag ── */
    let ox, oy;
    qs("#hdr").onmousedown = e => {
        if (e.target.id === "collapseBtn") return;
        ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
        document.onmousemove = ev => { panel.style.left = ev.clientX - ox + "px"; panel.style.top = ev.clientY - oy + "px"; panel.style.right = "auto"; };
        document.onmouseup = () => { document.onmousemove = null; localStorage.setItem(POS_KEY, JSON.stringify({ top: panel.style.top, left: panel.style.left, right: panel.style.right })); };
    };

    /* ── Popup messages ── */
    try {
        const rt = typeof browser !== "undefined" ? browser.runtime : chrome.runtime;
        rt?.onMessage?.addListener((msg, _, send) => {
            if (msg.type === "GET_STATUS") send({ enabled: state.enabled, targetLang: state.targetLang, transcriptCount: transcript.length });
            if (msg.type === "TOGGLE") {
                state.enabled = !state.enabled; save(); updateTrackUI();
                if (!state.enabled) { const el = document.getElementById("__yt_vi_line"); if (el) el.remove(); }
                send({ enabled: state.enabled });
            }
            return true;
        });
    } catch { }

    window.__ytBilingualStop = () => {
        clearInterval(pollInterval);
        stopAudioCapture();
        document.removeEventListener("keydown", hotkey);
        document.getElementById("__yt_vi_line")?.remove();
        miniBtn.remove();
        panel.remove();
        window.__ytBilingualActive = false;
    };

    console.log("✅ YT Bilingual Subtitle v6.0 loaded — DOM only, no YouTube API");
})();
