const api = typeof browser !== "undefined" ? browser : chrome;

const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const langLabel = document.getElementById('langLabel');
const logCount = document.getElementById('logCount');
const toggleBtn = document.getElementById('toggleBtn');

function updateUI(data) {
    if (data.enabled) {
        statusBadge.className = 'status-badge active';
        statusText.textContent = 'Active';
    } else {
        statusBadge.className = 'status-badge inactive';
        statusText.textContent = 'Paused';
    }
    langLabel.textContent = data.targetLang || 'vi';
    logCount.textContent = data.transcriptCount ?? 0;
}

// Get current status from content script
api.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (!tabs[0]?.id) return;
    api.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' }).then((res) => {
        if (res) updateUI(res);
    }).catch(() => { });
}).catch(() => { });

// Toggle
toggleBtn.addEventListener('click', () => {
    api.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (!tabs[0]?.id) return;
        api.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE' }).then((res) => {
            if (res) updateUI({ ...res, targetLang: langLabel.textContent, transcriptCount: logCount.textContent });
        }).catch(() => { });
    }).catch(() => { });
});
