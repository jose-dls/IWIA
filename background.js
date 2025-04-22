/* === background.js === */
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['videos'], ({ videos = [] }) => {
      chrome.storage.local.set({ videos });
    });
  });