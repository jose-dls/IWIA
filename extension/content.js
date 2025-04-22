/* === content.js === */

function haveSimilarClasses(list1, list2) {
    // Convert to arrays for easier handling
    const a = Array.from(list1);
    const b = Array.from(list2);

    // Look for shared class prefixes
    const shared = a.filter(cls1 =>
        b.some(cls2 =>
            getClassBase(cls1) === getClassBase(cls2)
        )
    );

    // If most classes share the same base, consider them similar
    return shared.length >= Math.min(a.length, b.length) * 0.5;
}

function getClassBase(cls) {
    // Remove last dash/underscore segment (e.g., 'card-item-2' → 'card-item')
    return cls.replace(/[-_][^-_]+$/, '');
}

chrome.storage.local.get(["videos", "hideWatched", "extensionEnabled", "disabledSites"], ({ videos = [], hideWatched = true, extensionEnabled = true, disabledSites = [] }) => {
    const watchedTitles = new Set(videos.filter(v => v.status === "watched").map(v => v.title.toLowerCase()));

    // Store changes for the current page and tab
    const hiddenNodes = new Map();

    const checkAndHide = (node) => {
        // Stop if extension is disabled, hide watched is disabled, or node is empty
        if (!extensionEnabled || !hideWatched || !node.innerText) return;

        // Stop if site is disabled
        const domain = location.hostname.replace(/^www\./, '');
        if (disabledSites.includes(domain)) return;

        const title = node.innerText.trim().toLowerCase();
        if (!title || !watchedTitles.has(title)) return;

        let container = node;
        for (let i = 0; i < 20 && container.parentElement; i++) {
            container = container.parentElement;
            const parent = container.parentElement;
            if (!parent) return;

            const siblings = Array.from(parent.children);
            const similar = siblings.filter(sib =>
                sib !== container &&
                sib.tagName === container.tagName &&
                haveSimilarClasses(sib.classList, container.classList) &&
                sib.id === container.id
            );

            if (similar.length > 0) {
                console.log('Hiding full block for:', title);

                // Store the node and its previous display style
                if (!hiddenNodes.has(container)) {
                    hiddenNodes.set(container, container.style.display);
                }

                console.log('Setting display to none for:', container);

                container.style.display = 'none';
                return;
            }
        }
    };

    const restoreHiddenNodes = () => {
        hiddenNodes.forEach((prevDisplay, node) => {
            node.style.display = prevDisplay; // Restore the previous display style
        });
        hiddenNodes.clear(); // Clear the list after restoring
    };

    const processNewNodes = (root) => {
        if (root.nodeType === 1) {
            root.querySelectorAll('*:not(:has(*))').forEach(checkAndHide);
        }
    };

    // Initial scan
    document.querySelectorAll('*:not(:has(*))').forEach(checkAndHide);

    // Continuous scanning via MutationObserver
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => m.addedNodes.forEach(processNewNodes));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Listen to popup toggle
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'toggleHideWatched') {
            hideWatched = msg.hide;
            restoreHiddenNodes(); // Restore all hidden nodes first
            if (extensionEnabled && hideWatched) {
                document.querySelectorAll('*:not(:has(*))').forEach(checkAndHide);
            }
        } else if (msg.type === 'toggleExtension') {
            extensionEnabled = msg.enabled;
            restoreHiddenNodes(); // Restore all hidden nodes first
            if (extensionEnabled && hideWatched) {
                document.querySelectorAll('*:not(:has(*))').forEach(checkAndHide);
            }
        } else if (msg.type === 'updateDisabledSites') {
            disabledSites = msg.disabledSites;
            const domain = location.hostname.replace(/^www\./, '');
            restoreHiddenNodes(); // Restore all hidden nodes first
            if (!disabledSites.includes(domain) && extensionEnabled && hideWatched) {
                document.querySelectorAll('*:not(:has(*))').forEach(checkAndHide);
            }
        }
    });

    // Listen for changes to the videos array in storage
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.videos) {
            const newVideos = changes.videos.newValue || [];
            watchedTitles.clear();
            newVideos.filter(v => v.status === "watched").forEach(v => watchedTitles.add(v.title.toLowerCase()));

            // Reapply hiding logic
            restoreHiddenNodes(); // Restore all hidden nodes first
            if (extensionEnabled && hideWatched) {
                document.querySelectorAll('*:not(:has(*))').forEach(checkAndHide);
            }
        }
    });
});