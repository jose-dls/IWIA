/* === popup.js === */
const updateIcon = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = getDomain(tab.url);

  chrome.storage.local.get(
    { hideWatched: true, extensionEnabled: true, disabledSites: [] },
    ({ hideWatched, extensionEnabled, disabledSites }) => {
      let iconPath = 'green.png'; // Default to green

      if (!extensionEnabled) {
        iconPath = 'green.png'; // Green if the extension is disabled
      } else if (disabledSites.includes(domain)) {
        iconPath = 'yellow.png'; // Yellow if the site is disabled
      } else if (hideWatched) {
        iconPath = 'red.png'; // Red if "Hide Watched from Pages" is active
      }

      chrome.action.setIcon({ path: iconPath });
    }
  );
};

const getDomain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const saveVideos = (videos, rerender = true) => {
  chrome.storage.local.set({ videos }, () => {
    if (rerender) renderSettings();
  });
};

const renderSettings = () => {
  chrome.storage.local.get({
    hideWatched: true,
    extensionEnabled: true,
    disabledSites: [],
    videos: []
  }, async ({ hideWatched, extensionEnabled, disabledSites, videos }) => {
    document.getElementById('hideToggle').checked = hideWatched;
    document.getElementById('enableExtensionToggle').checked = extensionEnabled;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = getDomain(tab.url);
    document.getElementById('disableSiteToggle').checked = disabledSites.includes(domain);

    const container = document.getElementById('videos');
    container.innerHTML = '';

    // Group videos by status
    const groupedVideos = {
      planning: [],
      watching: [],
      watched: []
    };
    videos.forEach(video => {
      groupedVideos[video.status]?.push(video);
    });

    // Helper function to create a section
    const createSection = (title, videos) => {
      const sectionContainer = document.createElement('div');
      sectionContainer.className = 'section-container';

      const header = document.createElement('div');
      header.className = 'section-header';
      header.innerHTML = `
          <h3>${title}</h3><h3 class="toggle-section opened"></h3>
        `;
      sectionContainer.appendChild(header);

      const sectionContent = document.createElement('div');
      sectionContent.className = 'section-content';
      sectionContent.style.display = 'block'; // Default to open

      videos.forEach((video) => {
        const div = document.createElement('div');
        div.className = 'video-entry';
        div.innerHTML = `
            <input type="text" value="${video.title}" data-id="${video.addedAt}" class="edit-title"><br>
            <input type="text" value="${video.url || ''}" placeholder="Link" data-id="${video.addedAt}" class="edit-link"><br>
            <select data-id="${video.addedAt}" class="edit-status">
              <option value="planning" ${video.status === 'planning' ? 'selected' : ''}>Planning</option>
              <option value="watching" ${video.status === 'watching' ? 'selected' : ''}>Watching</option>
              <option value="watched" ${video.status === 'watched' ? 'selected' : ''}>Watched</option>
            </select><br>
            <button class="delete" data-id="${video.addedAt}">Remove</button>
          `;
        sectionContent.appendChild(div);
      });

      sectionContainer.appendChild(sectionContent);

      // Add toggle functionality
      header.addEventListener('click', () => {
        const isVisible = sectionContent.style.display === 'block';
        sectionContent.style.display = isVisible ? 'none' : 'block';

        const toggleSpan = header.querySelector('.toggle-section');
        toggleSpan.classList.toggle('opened', !isVisible);
        toggleSpan.classList.toggle('closed', isVisible);
      });

      return sectionContainer;
    };

    // Append sections for each status
    container.appendChild(createSection('Planning', groupedVideos.planning));
    container.appendChild(createSection('Watching', groupedVideos.watching));
    container.appendChild(createSection('Watched', groupedVideos.watched));

    // Add event listeners
    document.querySelectorAll('.edit-title').forEach(input => {
      input.addEventListener('input', e => {
        const id = e.target.dataset.id; // Use data-id (addedAt) as the unique identifier
        const video = videos.find(v => v.addedAt === id); // Find the correct video
        if (video) {
          video.title = e.target.value; // Update the title
          saveVideos(videos, false); // Save changes without re-rendering
        }
      });
    });

    document.querySelectorAll('.edit-link').forEach(input => {
      input.addEventListener('input', e => {
        const id = e.target.dataset.id; // Use data-id (addedAt) as the unique identifier
        const video = videos.find(v => v.addedAt === id); // Find the correct video
        if (video) {
          video.url = e.target.value; // Update the URL
          saveVideos(videos, false); // Save changes without re-rendering
        }
      });
    });

    document.querySelectorAll('.edit-status').forEach(select => {
      select.addEventListener('change', e => {
        const id = e.target.dataset.id; // Use data-id (addedAt) as the unique identifier
        const video = videos.find(v => v.addedAt === id); // Find the correct video
        if (video) {
          video.status = e.target.value; // Update the status
          saveVideos(videos); // Save changes and re-render
        }
      });
    });

    document.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.target.dataset.id; // Use data-id (addedAt) as the unique identifier
        const index = videos.findIndex(v => v.addedAt === id); // Find the correct index
        if (index !== -1) {
          videos.splice(index, 1); // Remove the video from the array
          saveVideos(videos); // Save changes and re-render
        }
      });
    });
  });
};

document.getElementById('hideToggle').addEventListener('change', (e) => {
  chrome.storage.local.set({ hideWatched: e.target.checked }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'toggleHideWatched',
        hide: e.target.checked
      });
      updateIcon();
    });
  });
});

document.getElementById('enableExtensionToggle').addEventListener('change', (e) => {
  chrome.storage.local.set({ extensionEnabled: e.target.checked }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'toggleExtension',
        enabled: e.target.checked
      });
      updateIcon();
    });
  });
});

document.getElementById('disableSiteToggle').addEventListener('change', async (e) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = getDomain(tab.url);
  chrome.storage.local.get({ disabledSites: [] }, ({ disabledSites }) => {
    const updated = e.target.checked
      ? [...new Set([...disabledSites, domain])]
      : disabledSites.filter(d => d !== domain);
    chrome.storage.local.set({ disabledSites: updated }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'updateDisabledSites',
          disabledSites: updated
        });
        updateIcon();
      });
    });
  });
});

document.getElementById('addManual').addEventListener('click', () => {
  const titleInput = document.getElementById('titleInput');
  const linkInput = document.getElementById('linkInput');
  const statusInput = document.getElementById('statusInput');

  const title = titleInput.value.trim();
  const url = linkInput.value.trim();
  const status = statusInput.value; // Get the selected status

  if (title) {
    chrome.storage.local.get({ videos: [] }, ({ videos }) => {
      videos.push({
        title,
        url: url || null,
        status: status || 'planning', // Default to 'planning' if no status is selected
        auto: false,
        addedAt: new Date().toISOString() // Use ISO timestamp as unique ID
      });
      saveVideos(videos);

      // Clear the input fields
      titleInput.value = '';
      linkInput.value = '';
      statusInput.value = 'planning'; // Reset the dropdown to default
    });
  }
});

document.getElementById('mainTabButton').addEventListener('click', () => {
  document.getElementById('mainTab').style.display = 'block';
  document.getElementById('videosTab').style.display = 'none';
  document.getElementById('mainTabButton').classList.add('active');
  document.getElementById('videosTabButton').classList.remove('active');
});

document.getElementById('mainTabButton').click();

document.getElementById('videosTabButton').addEventListener('click', () => {
  document.getElementById('mainTab').style.display = 'none';
  document.getElementById('videosTab').style.display = 'block';
  document.getElementById('mainTabButton').classList.remove('active');
  document.getElementById('videosTabButton').classList.add('active');
});

renderSettings();