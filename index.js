(() => {
    /* ─────────────────────────────────────────────
       YT BILINGUAL SUBTITLE  v2.0
       Upgrades: queue, retry, hotkey, language picker,
                 panel collapse, transcript export,
                 position persistence, better UI
    ───────────────────────────────────────────── */

    const STORAGE_KEY = "__yt_bilingual_config";
    const POS_KEY = "__yt_bilingual_pos";
    const LOG_KEY = "__yt_bilingual_log";

    window.__ytBilingualStop?.();

    /* ── Default config ── */
    const DEFAULTS = {
        enabled: true,
        fontScale: 1.1,
        marginTop: 8,
        color: "#00ffcc",
        shadow: true,
        pauseOnly: false,
        targetLang: "vi",
        collapsed: false,
        opacity: 0.92,
    };

    const state = Object.assign({}, DEFAULTS,
        JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));

    const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    /* ── Translation cache & transcript log ── */
    const cache = new Map();
    const transcript = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    const saveLog = () => localStorage.setItem(LOG_KEY, JSON.stringify(transcript.slice(-500)));

    /* ── Queue ── */
    let queue = [];
    let processing = false;
    let lastText = "";

    async function fetchTranslation(text, lang, retries = 3) {
        const url =
            "https://translate.googleapis.com/translate_a/single" +
            `?client=gtx&sl=auto&tl=${lang}&dt=t&q=` + encodeURIComponent(text);

        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                return data[0].map(x => x[0]).join("");
            } catch (e) {
                if (i === retries - 1) throw e;
                await new Promise(r => setTimeout(r, 600 * (i + 1)));
            }
        }
    }

    async function translate(text) {
        const key = `${state.targetLang}:${text}`;
        if (cache.has(key)) return cache.get(key);
        const out = await fetchTranslation(text, state.targetLang);
        cache.set(key, out);
        return out;
    }

    async function processQueue() {
        if (processing || queue.length === 0) return;
        processing = true;
        while (queue.length > 0) {
            const text = queue.pop();      // take latest, discard stale
            queue = [];
            try {
                const vi = await translate(text);
                renderTranslation(vi, text);
                transcript.push({ ts: new Date().toISOString(), en: text, tl: vi });
                saveLog();
            } catch (e) {
                console.warn("[bilingual] translate error:", e);
            }
        }
        processing = false;
    }

    /* ── DOM helpers ── */
    function getEN() {
        return Array.from(document.querySelectorAll(".ytp-caption-segment"))
            .map(s => s.innerText.trim())
            .filter(Boolean)
            .join(" ");
    }

    function applyStyle(el) {
        el.style.fontSize = `${state.fontScale * 100}%`;
        el.style.marginTop = `${state.marginTop}px`;
        el.style.color = state.color;
        el.style.textShadow = state.shadow ? "1px 1px 8px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,.7)" : "none";
    }

    function renderTranslation(vi, en) {
        const container = document.querySelector(".ytp-caption-window-bottom");
        if (!container) return;

        let viLine = document.getElementById("__yt_vi_line");
        if (!viLine) {
            viLine = document.createElement("div");
            viLine.id = "__yt_vi_line";
            Object.assign(viLine.style, {
                textAlign: "center",
                lineHeight: "1.5",
                whiteSpace: "normal",
                fontFamily: "inherit",
                transition: "opacity .25s, color .3s",
                opacity: "0",
            });
            container.appendChild(viLine);
        }

        applyStyle(viLine);
        viLine.innerText = vi;
        viLine.title = `EN: ${en}`;
        // fade in
        requestAnimationFrame(() => { viLine.style.opacity = "1"; });
    }

    /* ── Observer ── */
    const observer = new MutationObserver(() => {
        if (!state.enabled) return;
        const vid = document.querySelector("video");
        if (state.pauseOnly && vid && !vid.paused) return;

        const text = getEN();
        if (!text || text === lastText) return;
        lastText = text;

        queue.push(text);
        processQueue();
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    /* ── Hotkey  Alt+B = toggle, Alt+H = hide panel ── */
    const hotkey = (e) => {
        if (!e.altKey) return;
        if (e.key === "b" || e.key === "B") {
            state.enabled = !state.enabled;
            save();
            const enCb = panel.querySelector("#en");
            if (enCb) enCb.checked = state.enabled;
            const viLine = document.getElementById("__yt_vi_line");
            if (viLine) viLine.style.opacity = state.enabled ? "1" : "0";
            toast(state.enabled ? "✅ Enabled" : "⏸ Disabled");
        }
        if (e.key === "h" || e.key === "H") toggleCollapse();
    };
    document.addEventListener("keydown", hotkey);

    /* ── Language list ── */
    const LANGS = [
        ["vi", "Tiếng Việt"], ["en", "English"], ["zh-CN", "中文(简)"], ["ja", "日本語"],
        ["ko", "한국어"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"],
        ["pt", "Português"], ["ru", "Русский"], ["th", "ภาษาไทย"], ["id", "Bahasa Indonesia"],
    ];

    /* ── Toast ── */
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

    /* ── Export transcript ── */
    function exportTranscript() {
        if (!transcript.length) { toast("📭 No transcript yet"); return; }
        const lines = transcript.map(r => `[${r.ts.slice(11, 19)}]\nEN: ${r.en}\n→  ${r.tl}\n`).join("\n");
        const blob = new Blob([lines], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `bilingual_${Date.now()}.txt`;
        a.click();
    }

    /* ── Panel ── */
    const panel = document.createElement("div");

    const savedPos = JSON.parse(localStorage.getItem(POS_KEY) || "{}");
    Object.assign(panel.style, {
        position: "fixed",
        top: savedPos.top || "90px",
        right: savedPos.right || "20px",
        left: savedPos.left || "auto",
        zIndex: "10000",
        background: `rgba(10,10,15,${state.opacity})`,
        backdropFilter: "blur(14px) saturate(160%)",
        color: "#e8e8f0",
        padding: "12px 14px",
        borderRadius: "16px",
        fontSize: "12.5px",
        width: "252px",
        boxShadow: "0 12px 40px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.07)",
        border: "1px solid rgba(255,255,255,.1)",
        fontFamily: "system-ui, sans-serif",
        transition: "height .25s, opacity .25s",
        userSelect: "none",
    });

    const langOptions = LANGS.map(([v, l]) =>
        `<option value="${v}"${v === state.targetLang ? " selected" : ""}>${l}</option>`
    ).join("");

    panel.innerHTML = `
<div id="hdr" style="display:flex;align-items:center;justify-content:space-between;cursor:move;margin-bottom:10px;">
  <span style="font-weight:700;font-size:13px;letter-spacing:.5px;">
    <span style="color:#00ffcc;">⬡</span> Bilingual Sub
    <span style="font-size:10px;color:#888;margin-left:4px;">v2</span>
  </span>
  <span id="collapseBtn" title="Alt+H" style="cursor:pointer;font-size:16px;line-height:1;color:#888;">⊟</span>
</div>

<div id="body">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
      <div id="toggleTrack" style="
        width:34px;height:18px;border-radius:9px;position:relative;cursor:pointer;
        background:${state.enabled ? "#00ffcc" : "#444"};transition:background .25s;">
        <div id="toggleThumb" style="
          position:absolute;top:3px;width:12px;height:12px;border-radius:50%;
          background:#fff;transition:left .25s;
          left:${state.enabled ? "17px" : "3px"};"></div>
      </div>
      <span>Enable <kbd style="font-size:10px;opacity:.5;border:1px solid #555;border-radius:3px;padding:0 3px;">Alt+B</kbd></span>
    </label>
  </div>

  <div style="margin-bottom:8px;">
    <label style="color:#aaa;font-size:11px;">Target language</label>
    <select id="lang" style="
      width:100%;margin-top:4px;background:#1a1a2e;border:1px solid #333;
      color:#e8e8f0;border-radius:8px;padding:4px 6px;font-size:12px;">
      ${langOptions}
    </select>
  </div>

  <div style="margin-bottom:6px;">
    <div style="display:flex;justify-content:space-between;color:#aaa;font-size:11px;">
      <span>Font size</span><span id="fsVal">${Math.round(state.fontScale * 100)}%</span>
    </div>
    <input type="range" id="fs" min="0.5" max="3" step="0.05"
      value="${state.fontScale}" style="width:100%;accent-color:#00ffcc;">
  </div>

  <div style="margin-bottom:6px;">
    <div style="display:flex;justify-content:space-between;color:#aaa;font-size:11px;">
      <span>Margin top</span><span id="mtVal">${state.marginTop}px</span>
    </div>
    <input type="range" id="mt" min="0" max="60" step="1"
      value="${state.marginTop}" style="width:100%;accent-color:#00ffcc;">
  </div>

  <div style="margin-bottom:8px;">
    <div style="display:flex;justify-content:space-between;color:#aaa;font-size:11px;">
      <span>Panel opacity</span><span id="opVal">${Math.round(state.opacity * 100)}%</span>
    </div>
    <input type="range" id="op" min="0.3" max="1" step="0.05"
      value="${state.opacity}" style="width:100%;accent-color:#00ffcc;">
  </div>

  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
    <label style="color:#aaa;font-size:11px;">Color</label>
    <input type="color" id="cl" value="${state.color}"
      style="width:36px;height:24px;border:none;background:none;cursor:pointer;">
    <span id="clHex" style="font-size:11px;color:#888;">${state.color}</span>
  </div>

  <div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;">
      <input type="checkbox" id="sh" ${state.shadow ? "checked" : ""} style="accent-color:#00ffcc;"> Shadow
    </label>
    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;">
      <input type="checkbox" id="po" ${state.pauseOnly ? "checked" : ""} style="accent-color:#00ffcc;"> Pause-only
    </label>
  </div>

  <div style="display:flex;gap:6px;">
    <button id="exportBtn" style="
      flex:1;padding:6px;border-radius:8px;border:1px solid #333;
      background:#1a1a2e;color:#aaa;cursor:pointer;font-size:11px;">
      💾 Export
    </button>
    <button id="clearLog" style="
      flex:1;padding:6px;border-radius:8px;border:1px solid #333;
      background:#1a1a2e;color:#aaa;cursor:pointer;font-size:11px;">
      🗑 Clear log
    </button>
    <button id="stop" style="
      flex:1;padding:6px;border-radius:8px;border:1px solid rgba(255,80,80,.4);
      background:rgba(255,60,60,.08);color:#ff6060;cursor:pointer;font-size:11px;">
      ⛔ Stop
    </button>
  </div>

  <div style="margin-top:8px;font-size:10px;color:#555;text-align:center;">
    Alt+B toggle · Alt+H hide panel
  </div>
</div>
`;

    document.body.appendChild(panel);

    /* ── Toggle collapse ── */
    const bodyEl = panel.querySelector("#body");
    function toggleCollapse() {
        state.collapsed = !state.collapsed;
        save();
        bodyEl.style.display = state.collapsed ? "none" : "block";
        panel.querySelector("#collapseBtn").textContent = state.collapsed ? "⊞" : "⊟";
    }
    if (state.collapsed) { bodyEl.style.display = "none"; panel.querySelector("#collapseBtn").textContent = "⊞"; }

    panel.querySelector("#collapseBtn").onclick = toggleCollapse;

    /* ── Toggle switch ── */
    const track = panel.querySelector("#toggleTrack");
    const thumb = panel.querySelector("#toggleThumb");
    track.onclick = () => {
        state.enabled = !state.enabled;
        save();
        track.style.background = state.enabled ? "#00ffcc" : "#444";
        thumb.style.left = state.enabled ? "17px" : "3px";
        const viLine = document.getElementById("__yt_vi_line");
        if (viLine) viLine.style.opacity = state.enabled ? "1" : "0";
    };

    /* ── Controls ── */
    const qs = id => panel.querySelector(id);

    qs("#lang").onchange = e => {
        state.targetLang = e.target.value;
        cache.clear();
        save();
        toast(`🌐 → ${LANGS.find(l => l[0] === state.targetLang)?.[1] || state.targetLang}`);
    };

    qs("#fs").oninput = e => {
        state.fontScale = +e.target.value;
        qs("#fsVal").textContent = Math.round(state.fontScale * 100) + "%";
        const v = document.getElementById("__yt_vi_line");
        if (v) applyStyle(v);
        save();
    };

    qs("#mt").oninput = e => {
        state.marginTop = +e.target.value;
        qs("#mtVal").textContent = state.marginTop + "px";
        const v = document.getElementById("__yt_vi_line");
        if (v) applyStyle(v);
        save();
    };

    qs("#op").oninput = e => {
        state.opacity = +e.target.value;
        qs("#opVal").textContent = Math.round(state.opacity * 100) + "%";
        panel.style.background = `rgba(10,10,15,${state.opacity})`;
        save();
    };

    qs("#cl").oninput = e => {
        state.color = e.target.value;
        qs("#clHex").textContent = state.color;
        const v = document.getElementById("__yt_vi_line");
        if (v) applyStyle(v);
        save();
    };

    qs("#sh").onchange = e => { state.shadow = e.target.checked; save(); };
    qs("#po").onchange = e => { state.pauseOnly = e.target.checked; save(); };

    qs("#exportBtn").onclick = exportTranscript;
    qs("#clearLog").onclick = () => {
        transcript.length = 0;
        localStorage.removeItem(LOG_KEY);
        toast("🗑 Log cleared");
    };
    qs("#stop").onclick = () => window.__ytBilingualStop();

    /* ── Drag (header only) ── */
    let ox, oy;
    qs("#hdr").onmousedown = e => {
        if (e.target.id === "collapseBtn") return;
        ox = e.clientX - panel.offsetLeft;
        oy = e.clientY - panel.offsetTop;
        document.onmousemove = ev => {
            panel.style.left = ev.clientX - ox + "px";
            panel.style.top = ev.clientY - oy + "px";
            panel.style.right = "auto";
        };
        document.onmouseup = () => {
            document.onmousemove = null;
            localStorage.setItem(POS_KEY, JSON.stringify({
                top: panel.style.top, left: panel.style.left, right: panel.style.right
            }));
        };
    };

    /* ── Stop ── */
    window.__ytBilingualStop = () => {
        observer.disconnect();
        document.removeEventListener("keydown", hotkey);
        document.getElementById("__yt_vi_line")?.remove();
        panel.remove();
        console.log("⛔ bilingual subtitle stopped");
    };

    console.log("✅ YT Bilingual Subtitle v2.0 loaded — Alt+B toggle, Alt+H hide");
})();