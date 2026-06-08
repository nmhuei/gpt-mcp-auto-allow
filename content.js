console.log("[MCP Auto-Allow] Content script injected successfully!");

const tabSessionId = Math.random().toString(36).substring(2, 6).toUpperCase();

function logDebug(msg) {
  const formattedMsg = `[Tab:${tabSessionId}] ${msg}`;
  console.log("[MCP Auto-Allow]", formattedMsg);
  chrome.storage.local.get({ logs: [] }, (data) => {
    let logs = data.logs || [];
    logs.push({
      time: new Date().toLocaleTimeString(),
      text: formattedMsg
    });
    if (logs.length > 50) {
      logs.shift();
    }
    chrome.storage.local.set({ logs });
  });
}

logDebug("[System] Extension content script loaded.");

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "auto", // manual | partial | auto
  delayMs: 1200,

  allowTools: [
    "*"
  ],

  allowPhrases: [
    "*"
  ],

  // Dùng cho partial mode: chỉ auto nếu popup có dấu hiệu lệnh an toàn
  allowCommandRegex: [
    ".*"
  ],

  // User có thể chỉnh trong popup
  denyRegex: []
};

// Hard deny: luôn luôn chặn, kể cả mode auto
const HARD_DENY_REGEX = [];

let settings = { ...DEFAULT_SETTINGS };
const clicked = new Set();

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
    settings = data;
    console.log("[MCP Auto-Allow] settings loaded:", settings);
  });
}

loadSettings();

chrome.storage.onChanged.addListener(() => {
  loadSettings();
});

function normalizeText(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

function matchesPattern(patterns, text) {
  for (const pattern of patterns || []) {
    try {
      const re = new RegExp(pattern, "i");
      if (re.test(text)) return pattern;
    } catch (e) {
      console.warn("[MCP Auto-Allow] invalid regex:", pattern, e);
    }
  }

  return null;
}

function includesAny(items, text) {
  if (!Array.isArray(items)) return false;
  if (items.includes("*")) return true;

  return items.some(item => {
    if (!item) return false;
    return text.includes(item);
  });
}

function getCandidateButtons() {
  const elements = [...document.querySelectorAll("button, [role='button'], .btn, .button")];
  const candidates = [];
  const seen = new Set();
  
  for (const el of elements) {
    if (seen.has(el)) continue;
    seen.add(el);
    
    if (el.querySelector("button, [role='button']")) {
      continue;
    }

    const text = normalizeText(el.innerText || el.textContent).trim();
    
    if (text === "Cho phép" || text === "Allow") {
      candidates.push(el);
      continue;
    }
    
    const lowerText = text.toLowerCase();
    const isAllow = lowerText === "allow" || lowerText === "cho phép" || 
                    lowerText.endsWith(" allow") || lowerText.endsWith(" cho phép");
                    
    const isDeny = lowerText.includes("don't") || lowerText.includes("dont") || 
                   lowerText.includes("deny") || lowerText.includes("không") || 
                   lowerText.includes("phủ nhận") || lowerText.includes("cancel");
                   
    if (isAllow && !isDeny) {
      candidates.push(el);
    }
  }
  
  return candidates;
}

function getPromptBoxFromButton(button) {
  let el = button;
  const path = [];

  for (let i = 0; i < 20 && el; i++) {
    const text = normalizeText(el.textContent || el.innerText);

    const hasAllowButton =
      text.includes("Cho phép") || text.includes("Allow");

    const hasPromptHint =
      text.includes("Run shell command") ||
      text.includes("Execute a shell command") ||
      text.includes("workspace") ||
      text.includes("MCP") ||
      text.includes("host machine") ||
      text.includes("Chạy lệnh shell") ||
      text.includes("máy chủ") ||
      text.includes("không gian làm việc") ||
      text.includes("công cụ") ||
      text.includes("tool") ||
      text.includes("kết nối") ||
      text.includes("connect") ||
      text.includes("yêu cầu") ||
      text.includes("request") ||
      text.includes("gọi") ||
      text.includes("call") ||
      text.includes("phê duyệt") ||
      text.includes("approve");

    const isDialogElement =
      el.getAttribute("role") === "dialog" ||
      el.getAttribute("aria-modal") === "true" ||
      (el.className && typeof el.className === "string" && (
        el.className.includes("Dialog") ||
        el.className.includes("Modal") ||
        el.className.includes("dialog") ||
        el.className.includes("modal")
      ));

    const matches = text.length > 20 && text.length < 30000 && hasAllowButton && (hasPromptHint || isDialogElement);

    path.push({
      tag: el.tagName,
      className: typeof el.className === "string" ? el.className.substring(0, 100) : "",
      role: el.getAttribute("role"),
      textLen: text.length,
      hasAllowButton,
      hasPromptHint,
      isDialogElement,
      matches
    });

    if (matches) {
      return el;
    }

    el = el.parentElement;
  }

  if (!button.__mcp_diagnostic_logged) {
    button.__mcp_diagnostic_logged = true;
    logDebug(`[Diagnostic] Path for button: ` + JSON.stringify(path));
  }

  return null;
}

function classifyPrompt(text) {
  if (settings.enabled === false) {
    return {
      allow: false,
      reason: "extension is disabled"
    };
  }

  const mode = settings.mode || "partial";

  if (mode === "manual") {
    return {
      allow: false,
      reason: "manual mode"
    };
  }

  const hardDenied = matchesPattern(HARD_DENY_REGEX, text);
  if (hardDenied) {
    return {
      allow: false,
      reason: `hard denied by ${hardDenied}`
    };
  }

  const userDenied = matchesPattern(settings.denyRegex || [], text);
  if (userDenied) {
    return {
      allow: false,
      reason: `denied by ${userDenied}`
    };
  }

  const hasTool = includesAny(settings.allowTools || [], text);
  if (!hasTool) {
    return {
      allow: false,
      reason: "tool not allowlisted"
    };
  }

  const hasPhrase = includesAny(settings.allowPhrases || [], text);
  if (!hasPhrase) {
    return {
      allow: false,
      reason: "phrase not allowlisted"
    };
  }

  if (mode === "auto") {
    return {
      allow: true,
      reason: "auto mode matched"
    };
  }

  if (mode === "partial") {
    const safeMatched = matchesPattern(settings.allowCommandRegex || [], text);

    if (!safeMatched) {
      return {
        allow: false,
        reason: "partial mode: no safe command pattern matched"
      };
    }

    return {
      allow: true,
      reason: `partial mode matched safe pattern: ${safeMatched}`
    };
  }

  return {
    allow: false,
    reason: `unknown mode: ${mode}`
  };
}

function scanAndClick() {
  const buttons = getCandidateButtons();
  
  const unseenButtons = buttons.filter(btn => !btn.__mcp_seen);
  if (unseenButtons.length > 0) {
    unseenButtons.forEach(btn => {
      btn.__mcp_seen = true;
    });
    logDebug(`[Scan] Found ${unseenButtons.length} new candidate button(s)`);
  }

  for (const button of buttons) {
    try {
      const btnText = normalizeText(button.textContent || button.innerText).trim();
      
      const box = getPromptBoxFromButton(button);
      if (!box) {
        if (!button.__mcp_warned) {
          button.__mcp_warned = true;
          logDebug(`[Scan] Button "${btnText}" found, but failed to find parent prompt box (Radix/Dialog container)`);
        }
        continue;
      }

      const text = normalizeText(box.textContent || box.innerText);
      const key = simpleHash(text);

      if (clicked.has(key)) continue;

      logDebug(`[Scan] Prompt box detected (len: ${text.length}). Text snippet: "${text.substring(0, 150)}..."`);
      const result = classifyPrompt(text);

      logDebug(`[Decision] Mode: "${settings.mode}" | Allowed: ${result.allow} | Reason: "${result.reason}"`);

      if (!result.allow) continue;

      clicked.add(key);

      const delay = Number(settings.delayMs) || 1200;
      logDebug(`[Action] Scheduling click on button "${btnText}" in ${delay}ms`);

      setTimeout(() => {
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds total (30 * 100ms)

        const tryClick = () => {
          try {
            if (!document.body.contains(button)) {
              logDebug(`[Action] Error: Button "${btnText}" is no longer in the DOM.`);
              clicked.delete(key);
              return;
            }

            if (button.disabled) {
              attempts++;
              if (attempts < maxAttempts) {
                // Button is disabled (e.g. cooldown/loading), retry in 100ms
                setTimeout(tryClick, 100);
                return;
              } else {
                logDebug(`[Action] Error: Button "${btnText}" remained disabled after 3 seconds.`);
                clicked.delete(key);
                return;
              }
            }

            button.click();
            const evt = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window
            });
            button.dispatchEvent(evt);
            logDebug(`[Action] Click event dispatched successfully to button "${btnText}".`);
          } catch (err) {
            logDebug(`[Action] Error executing click: ${err.message}`);
            clicked.delete(key);
          }
        };

        tryClick();
      }, delay);
    } catch (err) {
      logDebug(`[Scan] Error processing button: ${err.message}`);
    }
  }
}

function checkContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch (e) {
    return false;
  }
}

const observer = new MutationObserver(() => {
  if (!checkContextValid()) {
    observer.disconnect();
    return;
  }
  scanAndClick();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true
});

const scanInterval = setInterval(() => {
  if (!checkContextValid()) {
    clearInterval(scanInterval);
    return;
  }
  scanAndClick();
}, 1000);
