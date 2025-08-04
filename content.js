chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlight") {
    highlightSelectedText();
  }
});

function createHighlightSpan(text) {
  const span = document.createElement("span");
  span.style.backgroundColor = "#FEFEC5";
  span.className = "text-highlighter-highlight";
  span.style.position = 'relative'; // For positioning the delete button
  span.textContent = text;

  const deleteBtn = document.createElement("span");
  deleteBtn.textContent = "x";
  deleteBtn.style.position = "absolute";
  deleteBtn.style.top = "0";
  deleteBtn.style.right = "0";
  deleteBtn.style.color = "red";
  deleteBtn.style.cursor = "pointer";
  deleteBtn.style.display = "none"; // Hidden by default
  deleteBtn.className = "text-highlighter-delete-btn";

  span.addEventListener("mouseover", () => {
    deleteBtn.style.display = "inline";
  });

  span.addEventListener("mouseout", () => {
    deleteBtn.style.display = "none";
  });

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent the click from propagating to the parent
    deleteHighlight(span);
  });

  span.appendChild(deleteBtn);
  return span;
}

function deleteHighlight(highlightSpan) {
  const text = highlightSpan.textContent.slice(0, -1); // Remove the 'x'
  const url = window.location.href;

  chrome.storage.local.get({ highlights: {} }, (data) => {
    let highlights = data.highlights;
    if (highlights[url]) {
      highlights[url] = highlights[url].filter(h => h.text !== text);
      if (highlights[url].length === 0) {
        delete highlights[url];
      }
    }
    chrome.storage.local.set({ highlights: highlights }, () => {
      // Replace the span with its text content
      const parent = highlightSpan.parentNode;
      parent.replaceChild(document.createTextNode(text), highlightSpan);
    });
  });
}

function highlightSelectedText() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return;

  // Check if the selection spans multiple nodes
  if (range.commonAncestorContainer.nodeType !== Node.TEXT_NODE && range.toString().trim() !== range.commonAncestorContainer.textContent.trim()) {
      const container = range.commonAncestorContainer;
      if (container.nodeType !== 1) { // if it's not an element node
          alert("Highlighting across multiple elements is not supported.");
          return;
      }
      const selectedNodes = Array.from(container.childNodes).filter(node => selection.containsNode(node, true));
      if(selectedNodes.length > 1){
          alert("Highlighting across multiple elements is not supported.");
          return;
      }
  }


  const selectedText = range.toString();
  if (selectedText.trim() === "") return;

  const highlightSpan = createHighlightSpan(selectedText);

  range.deleteContents();
  range.insertNode(highlightSpan);

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
      highlights.forEach(highlight => {
        findAndHighlight(highlight.text);
      });
    }
  });
}

function findAndHighlight(searchText) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        const index = node.nodeValue.indexOf(searchText);
        if (index !== -1) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + searchText.length);

            const highlightSpan = createHighlightSpan(searchText);

            range.deleteContents();
            range.insertNode(highlightSpan);
            return;
        }
    }
}

window.addEventListener("load", applyHighlights);
