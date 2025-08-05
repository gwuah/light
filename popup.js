document.addEventListener("DOMContentLoaded", () => {
  loadAndRenderHighlights();
});

function loadAndRenderHighlights() {
  chrome.storage.local.get({ highlights: {} }, (data) => {
    renderHighlights(data.highlights);
  });
}

function getmultipagedomains(highlightsByUrl) {
  const urls = {}
  Object.keys(highlightsByUrl).forEach(url => {
    const hostname = new URL(url).hostname
    if (!urls[hostname]) {
      urls[hostname] = 1
    } else {
      urls[hostname]++
    }
  })


  return (url) => {
    return urls[new URL(url).hostname] > 1
  }
}

function getLongestString(strings) {
  if (!Array.isArray(strings) || strings.length === 0) {
    return null; // or throw an error depending on use case
  }

  return strings.reduce((longest, current) => {
    return current.length > longest.length ? current : longest;
  }, "");
}


function renderHighlights(highlightsByUrl) {
  const multipageChecker = getmultipagedomains(highlightsByUrl)
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
    urlItem.textContent = multipageChecker(url) ? new URL(url).href : new URL(url).hostname; 

    const highlightsForUrl = document.createElement("div");
    highlightsForUrl.className = "highlights-for-url";

    highlights.forEach(highlight => {
      const highlightDiv = document.createElement("div");
      highlightDiv.className = "highlight-text";

      const highlightText = document.createElement("p");
      highlightText.textContent = `${highlight.repr}`; // Use the repr field
      highlightText.addEventListener("dblclick", (ev) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "scrollToHighlight", groupID: highlight.groupID }, (response) => {
            console.log("Response from content script:", response);
          });
        });
      })

      const deleteBtn = document.createElement("span");
      deleteBtn.textContent = " x";
      deleteBtn.style.color = "red";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteHighlightFromPopup(url, highlight.groupID); // Pass groupID
      });

      highlightText.appendChild(deleteBtn);
      highlightDiv.appendChild(highlightText);
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

function deleteHighlightFromPopup(url, groupID) {
  chrome.storage.local.get({ highlights: {} }, (data) => {
    let highlights = data.highlights;
    if (highlights[url]) {
      highlights[url] = highlights[url].filter(h => h.groupID !== groupID);
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
