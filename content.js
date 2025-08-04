chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlight") {
    highlightSelectedText();
  }
});

function highlightSelectedText() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();

  if (selectedText.trim() === "") return;

  const span = document.createElement("span");
  span.style.backgroundColor = "yellow";
  span.className = "text-highlighter-highlight"; // Add a class for easy identification
  span.textContent = selectedText;

  // This is a simplified way to highlight.
  // A more robust solution would handle cases where the selection spans multiple nodes.
  range.deleteContents();
  range.insertNode(span);

  const url = window.location.href;
  const highlight = {
    text: selectedText,
    url: url,
    date: new Date().toISOString(),
  };

  chrome.storage.local.get({ highlights: {} }, (data) => {
    const highlights = data.highlights;
    if (!highlights[url]) {
      highlights[url] = [];
    }
    highlights[url].push(highlight);
    chrome.storage.local.set({ highlights: highlights });
  });
}

function applyHighlights() {
  const url = window.location.href;
  chrome.storage.local.get({ highlights: {} }, (data) => {
    const highlights = data.highlights[url];
    if (highlights) {
      const body = document.body;
      highlights.forEach(highlight => {
        // This is a very basic way to re-apply highlights and can be brittle.
        // It won't work well with dynamic content or if the text appears multiple times.
        // A more robust solution would involve storing more context about the highlight's location.
        findAndReplace(highlight.text, `<span style="background-color: yellow;" class="text-highlighter-highlight">${highlight.text}</span>`);
      });
    }
  });
}

function findAndReplace(searchText, replacementNode) {
    // This is a simplified find and replace. It's not perfect.
    // It uses TreeWalker to find text nodes and replace their content.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        const index = node.nodeValue.indexOf(searchText);
        if (index !== -1) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + searchText.length);

            const highlightSpan = document.createElement('span');
            highlightSpan.style.backgroundColor = 'yellow';
            highlightSpan.className = 'text-highlighter-highlight';
            highlightSpan.textContent = searchText;

            range.deleteContents();
            range.insertNode(highlightSpan);

            // Since we modified the DOM, the walker might be in an invalid state.
            // It's safer to restart the process for the remaining highlights.
            // This is inefficient but safer. A better implementation would handle this more gracefully.
            return;
        }
    }
}


window.addEventListener("load", applyHighlights);
