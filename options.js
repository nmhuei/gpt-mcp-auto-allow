const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "auto",
  delayMs: 1200,
  allowTools: ["*"],
  allowPhrases: ["*"],
  allowCommandRegex: [".*"],
  denyRegex: []
};

// Toast notification helper
function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = "block";
  
  setTimeout(() => {
    toast.style.display = "none";
  }, duration);
}

// Convert newline string to array
function linesToArray(value) {
  return value
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);
}

// Convert array to newline string
function arrayToLines(arr) {
  return Array.isArray(arr) ? arr.join("\n") : "";
}

// Load logs
function loadLogs() {
  chrome.storage.local.get({ logs: [] }, (data) => {
    const logArea = document.getElementById("logArea");
    if (!logArea) return;
    const logs = data.logs || [];
    if (logs.length === 0) {
      logArea.textContent = "Chưa có bản ghi hoạt động nào.";
      return;
    }
    logArea.textContent = logs.map(log => `[${log.time}] ${log.text}`).join("\n");
    logArea.scrollTop = logArea.scrollHeight;
  });
}

// Bind settings values to form elements
function applySettingsToForm(settings) {
  document.getElementById("enabled").checked = settings.enabled !== false;
  document.getElementById("mode").value = settings.mode || "partial";
  document.getElementById("delayMs").value = settings.delayMs || 1200;
  document.getElementById("allowTools").value = arrayToLines(settings.allowTools);
  document.getElementById("allowPhrases").value = arrayToLines(settings.allowPhrases);
  document.getElementById("allowCommandRegex").value = arrayToLines(settings.allowCommandRegex);
  document.getElementById("denyRegex").value = arrayToLines(settings.denyRegex);
}

// Fetch settings from chrome storage sync
function load() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
    applySettingsToForm(data);
  });
  loadLogs();
}

// Save settings to storage
function save(notify = true) {
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
    if (notify) {
      showToast("🌸 Đã lưu thay đổi cấu hình thành công!");
    }
  });
}

// Sidebar Tab switching
const navButtons = document.querySelectorAll(".side-nav-btn");
const contentPanes = document.querySelectorAll(".content-pane");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetPaneId = btn.getAttribute("data-pane");
    
    // Switch navigation button states
    navButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    // Switch content pane visibility
    contentPanes.forEach(pane => {
      if (pane.id === targetPaneId) {
        pane.classList.add("active");
      } else {
        pane.classList.remove("active");
      }
    });
  });
});

// Settings Save Trigger
document.getElementById("save").addEventListener("click", () => save(true));

// Close button
document.getElementById("back-btn").addEventListener("click", () => {
  window.close();
});

// Clear log trigger
document.getElementById("clearLogs").addEventListener("click", () => {
  if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhật ký không?")) {
    chrome.storage.local.set({ logs: [] }, () => {
      loadLogs();
      showToast("🗑 Đã xóa toàn bộ lịch sử hoạt động.");
    });
  }
});

// Reset to Default settings
document.getElementById("reset-btn").addEventListener("click", () => {
  if (confirm("Khôi phục cấu hình mặc định ban đầu? Các tùy chỉnh hiện tại của bạn sẽ bị ghi đè.")) {
    applySettingsToForm(DEFAULT_SETTINGS);
    save(false);
    showToast("🔄 Đã khôi phục cài đặt gốc.");
  }
});

// Export rules to JSON file download
document.getElementById("export-btn").addEventListener("click", () => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (data) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "mcp_auto_allow_rules.json";
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("💾 Xuất file cấu hình thành công!");
  });
});

// Import trigger via file chooser
document.getElementById("import-trigger-btn").addEventListener("click", () => {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsedData = JSON.parse(e.target.result);
      // Basic validating schema
      const mergedSettings = Object.assign({}, DEFAULT_SETTINGS, parsedData);
      applySettingsToForm(mergedSettings);
      
      chrome.storage.sync.set(mergedSettings, () => {
        showToast("📤 Đã nhập cấu hình từ file thành công!");
      });
    } catch (err) {
      showToast("❌ Định dạng file JSON không hợp lệ.");
      console.error(err);
    }
  };
  reader.readAsText(file);
});


/* ==========================================================
   🌸 Falling Sakura Petals Animation (Canvas)
   ========================================================== */
const canvas = document.getElementById("sakura-canvas");
const ctx = canvas.getContext("2d");

let petals = [];
const maxPetals = 45;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

class Petal {
  constructor() {
    this.reset();
    this.y = Math.random() * canvas.height; // Spread initially
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = -20;
    this.size = Math.random() * 8 + 6; // 6px to 14px size
    this.speedY = Math.random() * 0.8 + 0.6; // Downward speed
    this.speedX = Math.random() * 0.8 - 0.3; // Horizontal wind drift
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 0.8 - 0.4;
    this.opacity = Math.random() * 0.4 + 0.4; // Soft opacity
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.rotation += this.rotationSpeed;

    // Check bounds
    if (this.y > canvas.height + 20 || this.x < -20 || this.x > canvas.width + 20) {
      this.reset();
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.globalAlpha = this.opacity;

    // Sakura Petal Bezier Curves Drawing
    ctx.beginPath();
    ctx.fillStyle = "#FFB7C5"; // Base petal pink
    ctx.strokeStyle = "#FF8DA1"; // Edge highlight
    ctx.lineWidth = 0.5;

    ctx.moveTo(0, 0);
    // Left curve
    ctx.bezierCurveTo(-this.size/2, -this.size/2, -this.size, this.size/3, 0, this.size);
    // Right curve
    ctx.bezierCurveTo(this.size, this.size/3, this.size/2, -this.size/2, 0, 0);

    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// Initialise petals
for (let i = 0; i < maxPetals; i++) {
  petals.push(new Petal());
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Subtle gradient highlight on canvas background
  const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 10, canvas.width/2, canvas.height/2, canvas.width);
  grad.addColorStop(0, "rgba(255, 245, 246, 0)");
  grad.addColorStop(1, "rgba(255, 183, 197, 0.05)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let petal of petals) {
    petal.update();
    petal.draw();
  }
  requestAnimationFrame(animate);
}

// Launch animation loop & fetch initial options values
animate();
load();
