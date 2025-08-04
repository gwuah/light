document.addEventListener("DOMContentLoaded", () => {
  const stats = {
    totalWebsites: 0,
    totalHighlights: 0,
  };

  const highlightsList = document.getElementById("highlights-list");
  const totalWebsitesSpan = document.getElementById("total-websites");
  const totalHighlightsSpan = document.getElementById("total-highlights");

  chrome.storage.local.get({ highlights: {} }, (data) => {
    const highlightsByUrl = data.highlights;
    const urls = Object.keys(highlightsByUrl);

    stats.totalWebsites = urls.length;

    urls.forEach(url => {
      const highlights = highlightsByUrl[url];
      stats.totalHighlights += highlights.length;

      const urlItem = document.createElement("div");
      urlItem.className = "url-item";
      urlItem.textContent = new URL(url).hostname; // Show hostname for cleaner UI

      const highlightsForUrl = document.createElement("div");
      highlightsForUrl.className = "highlights-for-url";

      highlights.forEach(highlight => {
        const highlightDiv = document.createElement("div");
        highlightDiv.className = "highlight-text";
        highlightDiv.textContent = `"${highlight.text}"`;
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
  });
});
