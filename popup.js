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
    totalHighlights: 0,
  };

  const highlightsList = document.getElementById("highlights-list");
  const totalWebsitesSpan = document.getElementById("total-websites");
  const totalHighlightsSpan = document.getElementById("total-highlights");

  // Clear the list before rendering
  highlightsList.innerHTML = "";

  const urls = Object.keys(highlightsByUrl);
  stats.totalWebsites = urls.length;

  urls.forEach(url => {
    const highlights = highlightsByUrl[url];
    stats.totalHighlights += highlights.length;

    const urlItem = document.createElement("div");
    urlItem.className = "url-item";
    urlItem.textContent = new URL(url).hostname;

    const highlightsForUrl = document.createElement("div");
    highlightsForUrl.className = "highlights-for-url";

    highlights.forEach(highlight => {
      const highlightDiv = document.createElement("div");
      highlightDiv.className = "highlight-text";

      const highlightText = document.createElement("span");
      highlightText.textContent = `"${highlight.text}"`;

      const deleteBtn = document.createElement("span");
      deleteBtn.textContent = " x";
      deleteBtn.style.color = "red";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteHighlightFromPopup(url, highlight.text);
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

function deleteHighlightFromPopup(url, text) {
  chrome.storage.local.get({ highlights: {} }, (data) => {
    let highlights = data.highlights;
    if (highlights[url]) {
      highlights[url] = highlights[url].filter(h => h.text !== text);
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
