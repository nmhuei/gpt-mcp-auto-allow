const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "auto",
  delayMs: 1200,

  allowTools: [
    "*"
  ],

  allowPhrases: [
    "*"
  ],

  allowCommandRegex: [
    ".*"
  ],

  denyRegex: []
};

function linesToArray(value) {
  return value
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);
}

function arrayToLines(arr) {
  return Array.isArray(arr) ? arr.join("\n") : "";
}

function loadLogs() {
  chrome.storage.local.get({ logs: [] }, (data) => {
    const logArea = document.getElementById("logArea");
    if (!logArea) return;
    const logs = data.logs || [];
    if (logs.length === 0) {
      logArea.textContent = "No logs yet.";
      return;
    }
    logArea.textContent = logs.map(log => `[${log.time}] ${log.text}`).join("\n");
    logArea.scrollTop = logArea.scrollHeight;
  });
}

function load() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
    document.getElementById("enabled").checked = data.enabled !== false;
    document.getElementById("mode").value = data.mode || "partial";
    document.getElementById("delayMs").value = data.delayMs || 1200;
    document.getElementById("allowTools").value = arrayToLines(data.allowTools);
    document.getElementById("allowPhrases").value = arrayToLines(data.allowPhrases);
    document.getElementById("allowCommandRegex").value = arrayToLines(data.allowCommandRegex);
    document.getElementById("denyRegex").value = arrayToLines(data.denyRegex);
  });
  loadLogs();
}

function save() {
  const data = {
    enabled: document.getElementById("enabled").checked,
    mode: document.getElementById("mode").value,
    delayMs: Number(document.getElementById("delayMs").value || 1200),
    allowTools: linesToArray(document.getElementById("allowTools").value),
    allowPhrases: linesToArray(document.getElementById("allowPhrases").value),
    allowCommandRegex: linesToArray(document.getElementById("allowCommandRegex").value),
    denyRegex: linesToArray(document.getElementById("denyRegex").value)
  };

  chrome.storage.sync.set(data, () => {
    window.close();
  });
}

document.getElementById("save").addEventListener("click", save);
document.getElementById("open-options").addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});
document.getElementById("clearLogs").addEventListener("click", () => {
  chrome.storage.local.set({ logs: [] }, () => {
    loadLogs();
  });
});

// Tab switching logic
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    
    // Toggle active button
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Toggle active pane
    tabPanes.forEach(pane => {
      if (pane.id === targetId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  });
});

load();
