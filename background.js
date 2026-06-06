chrome.runtime.onInstalled.addListener(() => {
  console.log("[MCP Auto-Allow] Extension installed/reloaded. Injecting content scripts...");
  
  // Inject content.js into all matching open tabs automatically so F5 is not required after installation/reload
  chrome.tabs.query({
    url: [
      "*://chatgpt.com/*",
      "*://*.chatgpt.com/*",
      "*://chat.openai.com/*",
      "*://*.chat.openai.com/*"
    ]
  }, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id) continue;
      
      // Skip injecting if it's a restricted Chrome URL
      if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("brave://") || tab.url.startsWith("about:"))) {
        continue;
      }
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      }).then(() => {
        console.log(`[MCP Auto-Allow] Successfully injected content script into tab ${tab.id}`);
      }).catch(err => {
        console.warn(`[MCP Auto-Allow] Failed to inject content script into tab ${tab.id}:`, err);
      });
    }
  });
});
