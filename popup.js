const COMMONPLACE_API = "http://localhost:5678";

document.addEventListener("DOMContentLoaded", () => {
  loadAndRenderHighlights();
});

const toggleBtn = document.getElementById("toggle");
toggleBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "toggleHighlight" },
      (response) => {}
    );
  });
});

const exportBtn = document.getElementById("export");
exportBtn.addEventListener("click", () => {
  chrome.storage.local.get({ highlights: {} }, (data) => {
    navigator.clipboard
      .writeText(JSON.stringify(data.highlights))
      .then(() => {
        showSyncStatus("Copied to clipboard!", "success");
        setTimeout(hideSyncStatus, 1500);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
        showSyncStatus("Failed to copy", "error");
        setTimeout(hideSyncStatus, 2000);
      });
  });
});

const syncBtn = document.getElementById("sync");
syncBtn.addEventListener("click", () => {
  syncToCommonplace();
});

function showSyncStatus(message, type) {
  const statusEl = document.getElementById("sync-status");
  statusEl.textContent = message;
  statusEl.className = `sync-status barlow-regular ${type}`;
  statusEl.style.display = "block";
}

function hideSyncStatus() {
  const statusEl = document.getElementById("sync-status");
  statusEl.style.display = "none";
}

async function syncToCommonplace() {
  const statusEl = document.getElementById("sync-status");

  showSyncStatus("Syncing...", "syncing");

  chrome.storage.local.get({ highlights: {} }, async (data) => {
    const highlights = data.highlights;

    if (Object.keys(highlights).length === 0) {
      showSyncStatus("No highlights to sync", "error");
      setTimeout(hideSyncStatus, 2000);
      return;
    }

    try {
      const response = await fetch(`${COMMONPLACE_API}/light/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ highlights }),
      });

      console.log("Response from sync:", response);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const { resources_created, annotations_created, annotations_skipped } =
        result.data;

      const message = `+${annotations_created} new, ${annotations_skipped} skipped`;
      showSyncStatus(message, "success");

      // Store last sync timestamp
      chrome.storage.local.set({ lastSync: new Date().toISOString() });

      setTimeout(hideSyncStatus, 3000);
    } catch (err) {
      console.error("Sync failed:", err);
      showSyncStatus(`Sync failed: ${err.message}`, "error");
      setTimeout(hideSyncStatus, 3000);
    }
  });
}

function loadAndRenderHighlights() {
  chrome.storage.local.get({ highlights: {} }, (data) => {
    renderHighlights(data.highlights);
  });
}

function getmultipagedomains(highlightsByUrl) {
  const urls = {};
  Object.keys(highlightsByUrl).forEach((url) => {
    const hostname = new URL(url).hostname;
    if (!urls[hostname]) {
      urls[hostname] = 1;
    } else {
      urls[hostname]++;
    }
  });

  return (url) => {
    return urls[new URL(url).hostname] > 1;
  };
}

function getLongestString(strings) {
  if (!Array.isArray(strings) || strings.length === 0) {
    return null; // or throw an error depending on use case
  }

  return strings.reduce((longest, current) => {
    return current.length > longest.length ? current : longest;
  }, "");
}

function cleanUrl(url) {
  try {
    const urlObj = new URL(url);
    const searchParams = new URLSearchParams(urlObj.search);

    // Remove UTM parameters
    const utmParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ];
    utmParams.forEach((param) => searchParams.delete(param));

    // Reconstruct the URL with cleaned parameters
    const cleanedSearch = searchParams.toString();
    return urlObj.pathname + (cleanedSearch ? "?" + cleanedSearch : "");
  } catch (e) {
    return url;
  }
}

function getLatestTimestamp(highlights) {
  return Math.max(...highlights.map((h) => new Date(h.date).getTime()));
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function renderHighlights(highlightsByUrl) {
  const stats = {
    totalWebsites: 0,
    totalHighlights: 0,
  };

  const highlightsList = document.getElementById("highlights-list");
  const totalWebsitesSpan = document.getElementById("total-websites");
  const totalHighlightsSpan = document.getElementById("total-highlights");

  // Clear the list before rendering
  highlightsList.innerHTML = "";

  // Group URLs by domain
  const domainGroups = {};
  Object.keys(highlightsByUrl).forEach((url) => {
    const hostname = new URL(url).hostname;
    if (!domainGroups[hostname]) {
      domainGroups[hostname] = {};
    }
    domainGroups[hostname][url] = highlightsByUrl[url];
  });

  // Sort domains by latest highlight timestamp
  const sortedDomains = Object.keys(domainGroups).sort((a, b) => {
    const latestA = Math.max(
      ...Object.values(domainGroups[a])
        .flat()
        .map((h) => new Date(h.date).getTime())
    );
    const latestB = Math.max(
      ...Object.values(domainGroups[b])
        .flat()
        .map((h) => new Date(h.date).getTime())
    );
    return latestB - latestA;
  });

  stats.totalWebsites = sortedDomains.length;

  sortedDomains.forEach((domain) => {
    const urlsInDomain = domainGroups[domain];

    // Count total highlights for this domain
    const totalHighlightsInDomain = Object.values(urlsInDomain).reduce(
      (sum, highlights) => sum + highlights.length,
      0
    );
    stats.totalHighlights += totalHighlightsInDomain;

    // Get latest timestamp for this domain
    const latestTimestamp = Math.max(
      ...Object.values(urlsInDomain)
        .flat()
        .map((h) => new Date(h.date).getTime())
    );
    const formattedDate = formatDate(latestTimestamp);

    // Create domain header
    const domainItem = document.createElement("div");
    domainItem.className = "url-item";
    domainItem.style.display = "flex";
    domainItem.style.justifyContent = "space-between";
    domainItem.style.alignItems = "center";

    const domainText = document.createElement("span");
    domainText.textContent = domain;

    const dateText = document.createElement("span");
    dateText.textContent = formattedDate;
    dateText.style.fontSize = "12px";
    dateText.style.color = "#666";

    domainItem.appendChild(domainText);
    domainItem.appendChild(dateText);

    const domainContent = document.createElement("div");
    domainContent.className = "domain-content";
    domainContent.style.display = "none";

    // Sort URLs within domain by latest highlight timestamp
    const sortedUrls = Object.keys(urlsInDomain).sort((a, b) => {
      const latestA = getLatestTimestamp(urlsInDomain[a]);
      const latestB = getLatestTimestamp(urlsInDomain[b]);
      return latestB - latestA;
    });

    sortedUrls.forEach((url) => {
      const highlights = urlsInDomain[url];
      const cleanPath = cleanUrl(url);

      const pathItem = document.createElement("div");
      pathItem.className = "url-item";
      pathItem.style.paddingLeft = "20px";
      pathItem.textContent = cleanPath;

      const highlightsForUrl = document.createElement("div");
      highlightsForUrl.className = "highlights-for-url";
      highlightsForUrl.style.display = "none";
      highlightsForUrl.style.paddingLeft = "30px";

      highlights.forEach((highlight) => {
        const highlightDiv = document.createElement("div");
        highlightDiv.className = "highlight-text";

        const highlightText = document.createElement("p");
        highlightText.textContent = `${highlight.repr}`;
        highlightText.addEventListener("dblclick", (ev) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(
              tabs[0].id,
              { action: "scrollToHighlight", groupID: highlight.groupID },
              (response) => {
                console.log("Response from content script:", response);
              }
            );
          });
        });

        const deleteBtn = document.createElement("span");
        deleteBtn.textContent = " x";
        deleteBtn.style.color = "red";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteHighlightFromPopup(url, highlight.groupID);
        });

        highlightText.appendChild(deleteBtn);
        highlightDiv.appendChild(highlightText);
        highlightsForUrl.appendChild(highlightDiv);
      });

      pathItem.addEventListener("click", () => {
        const isDisplayed = highlightsForUrl.style.display === "block";
        highlightsForUrl.style.display = isDisplayed ? "none" : "block";
      });

      domainContent.appendChild(pathItem);
      domainContent.appendChild(highlightsForUrl);
    });

    domainItem.addEventListener("click", () => {
      const isDisplayed = domainContent.style.display === "block";
      domainContent.style.display = isDisplayed ? "none" : "block";
    });

    highlightsList.appendChild(domainItem);
    highlightsList.appendChild(domainContent);
  });

  totalWebsitesSpan.textContent = stats.totalWebsites;
  totalHighlightsSpan.textContent = stats.totalHighlights;
}

function deleteHighlightFromPopup(url, groupID) {
  chrome.storage.local.get({ highlights: {} }, (data) => {
    let highlights = data.highlights;
    if (highlights[url]) {
      highlights[url] = highlights[url].filter((h) => h.groupID !== groupID);
      if (highlights[url].length === 0) {
        delete highlights[url];
      }
    }
    chrome.storage.local.set({ highlights: highlights }, () => {
      // Re-render the highlights
      renderHighlights(highlights);
    });
  });
}
