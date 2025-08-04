document.addEventListener("DOMContentLoaded", () => {
  loadAndRenderHighlights();
});

function loadAndRenderHighlights() {
  chrome.storage.local.get({ highlights: {} }, (data) => {
    renderHighlights(data.highlights);
  });
}

function renderHighlights(highlightsByUrl) {
  const stats = {
    totalWebsites: 0,
    totalHighlights: 0, // This will now count groups of highlights
  };

  const highlightsList = document.getElementById("highlights-list");
  const totalWebsitesSpan = document.getElementById("total-websites");
  const totalHighlightsSpan = document.getElementById("total-highlights");

  highlightsList.innerHTML = "";

  const urls = Object.keys(highlightsByUrl);
  stats.totalWebsites = urls.length;

  urls.forEach(url => {
    const highlights = highlightsByUrl[url];
    const groupedHighlights = groupHighlights(highlights);
    stats.totalHighlights += Object.keys(groupedHighlights).length;

    const urlItem = document.createElement("div");
    urlItem.className = "url-item";
    urlItem.textContent = new URL(url).hostname;

    const highlightsForUrl = document.createElement("div");
    highlightsForUrl.className = "highlights-for-url";

    Object.values(groupedHighlights).forEach(group => {
      const highlightDiv = document.createElement("div");
      highlightDiv.className = "highlight-text";

      const highlightText = document.createElement("span");
      highlightText.textContent = `"${group.text}"`;

      const deleteBtn = document.createElement("span");
      deleteBtn.textContent = " x";
      deleteBtn.style.color = "red";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteHighlightFromPopup(url, group.groupId);
      });

      highlightDiv.appendChild(highlightText);
      highlightDiv.appendChild(deleteBtn);
      highlightsForUrl.appendChild(highlightDiv);
    });

    urlItem.addEventListener("click", () => {
      const isDisplayed = highlightsForUrl.style.display === "block";
      highlightsForUrl.style.display = isDisplayed ? "none" : "block";
    });

    highlightsList.appendChild(urlItem);
    highlightsList.appendChild(highlightsForUrl);
  });

  totalWebsitesSpan.textContent = stats.totalWebsites;
  totalHighlightsSpan.textContent = stats.totalHighlights;
}

function groupHighlights(highlights) {
  const grouped = {};
  highlights.forEach(h => {
    if (!grouped[h.groupId]) {
      grouped[h.groupId] = {
        text: "",
        groupId: h.groupId,
        date: h.date, // a bit arbitrary which date we use
      };
    }
    grouped[h.groupId].text += h.text;
  });
  return grouped;
}

function deleteHighlightFromPopup(url, groupId) {
  chrome.storage.local.get({ highlights: {} }, (data) => {
    let highlights = data.highlights;
    if (highlights[url]) {
      highlights[url] = highlights[url].filter(h => h.groupId !== groupId);
      if (highlights[url].length === 0) {
        delete highlights[url];
      }
    }
    chrome.storage.local.set({ highlights: highlights }, () => {
      renderHighlights(highlights);
    });
  });
}
