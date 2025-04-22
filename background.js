/* === background.js === */
const updateIcon = async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    let domain = '';
    if (tabs.length && tabs[0].url) {
      try {
        domain = new URL(tabs[0].url).hostname.replace(/^www\./, '');
      } catch { }
    }
    chrome.storage.local.get(
      { hideWatched: true, extensionEnabled: true, disabledSites: [] },
      ({ hideWatched, extensionEnabled, disabledSites }) => {
        let iconPath = 'green.png';
        if (!extensionEnabled) {
          iconPath = 'green.png';
        } else if (disabledSites.includes(domain)) {
          iconPath = 'yellow.png';
        } else if (hideWatched) {
          iconPath = 'red.png';
        }
        chrome.action.setIcon({ path: iconPath });
      }
    );
  });
};

chrome.runtime.onStartup.addListener(updateIcon);
chrome.runtime.onInstalled.addListener(updateIcon);

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['videos'], ({ videos = [] }) => {
    chrome.storage.local.set({ videos });
  });
});