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
            <input type="text" value="${video.title}" data-id="${video.id}" class="edit-title"><br>
            <input type="text" value="${video.url || ''}" placeholder="Link" data-id="${video.id}" class="edit-link"><br>
            <select data-id="${video.id}" class="edit-status">
              <option value="planning" ${video.status === 'planning' ? 'selected' : ''}>Planning</option>
              <option value="watching" ${video.status === 'watching' ? 'selected' : ''}>Watching</option>
              <option value="watched" ${video.status === 'watched' ? 'selected' : ''}>Watched</option>
            </select><br>
            <button class="delete" data-id="${video.id}">Remove</button>
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
        const id = e.target.dataset.id; // Use data-id (id) as the unique identifier
        const video = videos.find(v => v.id === id); // Find the correct video
        if (video) {
          video.title = e.target.value; // Update the title
          saveVideos(videos, false); // Save changes without re-rendering
        }
      });
    });

    document.querySelectorAll('.edit-link').forEach(input => {
      input.addEventListener('input', e => {
        const id = e.target.dataset.id; // Use data-id (id) as the unique identifier
        const video = videos.find(v => v.id === id); // Find the correct video
        if (video) {
          video.url = e.target.value; // Update the URL
          saveVideos(videos, false); // Save changes without re-rendering
        }
      });
    });

    document.querySelectorAll('.edit-status').forEach(select => {
      select.addEventListener('change', e => {
        const id = e.target.dataset.id; // Use data-id (id) as the unique identifier
        const video = videos.find(v => v.id === id); // Find the correct video
        if (video) {
          video.status = e.target.value; // Update the status
          saveVideos(videos); // Save changes and re-render
        }
      });
    });

    document.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.target.dataset.id; // Use data-id (id) as the unique identifier
        const index = videos.findIndex(v => v.id === id); // Find the correct index
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

function generateUUID() {
  // RFC4122 version 4 compliant UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
        id: generateUUID(),
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

// Export videos as CSV
document.getElementById('exportCSV').addEventListener('click', () => {
  chrome.storage.local.get({ videos: [] }, ({ videos }) => {
    const header = ['id', 'title', 'url', 'status', 'auto', 'addedAt'];
    const rows = videos.map(v =>
      header.map(key => `"${(v[key] ?? '').toString().replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iwia_videos.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

// Import videos from CSV
document.getElementById('importCSV').addEventListener('click', () => {
  document.getElementById('csvFileInput').click();
});

document.getElementById('csvFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return;
    const header = lines[0].split(',').map(h => h.replace(/(^"|"$)/g, ''));
    const videos = lines.slice(1).map(line => {
      const values = [];
      let inQuotes = false, value = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') {
          value += '"'; i++;
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(value); value = '';
        } else {
          value += char;
        }
      }
      values.push(value);
      const obj = {};
      header.forEach((h, idx) => obj[h] = values[idx] || '');
      return {
        id: obj.id || generateUUID(),
        title: obj.title || '',
        url: obj.url || '',
        status: obj.status || 'planning',
        auto: obj.auto === 'true',
        addedAt: obj.addedAt || new Date().toISOString()
      };
    }).filter(v => v.title);

    // Merge with existing videos, deduplicate by id
    chrome.storage.local.get({ videos: [] }, ({ videos: existing }) => {
      const map = new Map(existing.map(v => [v.id, v]));
      videos.forEach(v => map.set(v.id, v));
      saveVideos(Array.from(map.values()));
    });
  };
  reader.readAsText(file);
  e.target.value = '';
});