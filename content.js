chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlight") {
    highlightSelectedText();
  }
});

function createHighlightSpan(text, groupId) {
  const span = document.createElement("span");
  span.style.backgroundColor = "#FEFEC5";
  span.className = "text-highlighter-highlight";
  span.style.position = 'relative';
  span.textContent = text;
  span.dataset.groupId = groupId; // Store groupId on the element

  const deleteBtn = document.createElement("span");
  deleteBtn.textContent = "x";
  deleteBtn.style.position = "absolute";
  deleteBtn.style.top = "0";
  deleteBtn.style.right = "0";
  deleteBtn.style.color = "red";
  deleteBtn.style.cursor = "pointer";
  deleteBtn.style.display = "none";
  deleteBtn.className = "text-highlighter-delete-btn";

  span.addEventListener("mouseover", () => {
    deleteBtn.style.display = "inline";
  });

  span.addEventListener("mouseout", () => {
    deleteBtn.style.display = "none";
  });

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteHighlight(span);
  });

  span.appendChild(deleteBtn);
  return span;
}

function deleteHighlight(highlightSpan) {
  const groupId = highlightSpan.dataset.groupId;
  const url = window.location.href;

  chrome.storage.local.get({ highlights: {} }, (data) => {
    let highlights = data.highlights;
    if (highlights[url]) {
      highlights[url] = highlights[url].filter(h => h.groupId !== groupId);
      if (highlights[url].length === 0) {
        delete highlights[url];
      }
    }
    chrome.storage.local.set({ highlights: highlights }, () => {
      // Remove all spans with the same group id
      const spans = document.querySelectorAll(`.text-highlighter-highlight[data-group-id='${groupId}']`);
      spans.forEach(span => {
        const parent = span.parentNode;
        parent.replaceChild(document.createTextNode(span.textContent.slice(0,-1)), span);
      });
    });
  });
}

function highlightSelectedText() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return;

  const groupId = Date.now().toString();
  const url = window.location.href;
  const newHighlights = [];

  // This is a more complex way to handle multi-node selections
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    (node) => {
      return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  );

  const nodes = [];
  while(walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach(node => {
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(node);

    const intersection = range.cloneRange();
    intersection.intersectNode(nodeRange);

    const text = intersection.toString();
    if (text.trim() === "") return;

    const highlightSpan = createHighlightSpan(text, groupId);
    intersection.deleteContents();
    intersection.insertNode(highlightSpan);

    newHighlights.push({
      text: text,
      url: url,
      date: new Date().toISOString(),
      groupId: groupId
    });
  });

  if (newHighlights.length > 0) {
    chrome.storage.local.get({ highlights: {} }, (data) => {
      const highlights = data.highlights;
      if (!highlights[url]) {
        highlights[url] = [];
      }
      highlights[url].push(...newHighlights);
      chrome.storage.local.set({ highlights: highlights });
    });
  }
}


function applyHighlights() {
  const url = window.location.href;
  chrome.storage.local.get({ highlights: {} }, (data) => {
    const highlights = data.highlights[url];
    if (highlights) {
      highlights.forEach(highlight => {
        findAndHighlight(highlight.text, highlight.groupId);
      });
    }
  });
}

function findAndHighlight(searchText, groupId) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        const index = node.nodeValue.indexOf(searchText);
        if (index !== -1) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + searchText.length);

            // Check if this text is already highlighted
            if (range.startContainer.parentElement.className === 'text-highlighter-highlight') {
                continue;
            }

            const highlightSpan = createHighlightSpan(searchText, groupId);

            range.deleteContents();
            range.insertNode(highlightSpan);
            return;
        }
    }
}

window.addEventListener("load", applyHighlights);
