chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlight") {
    highlightSelectedText();
  }
});

function getHighlight() {
    let getChildren = (node, collection) => {
        let children = Array.from(node.childNodes)
        if (children.length == 0) {
            collection.push(node)
            return
        }
        children.forEach(child => getChildren(child, collection))
    }

    const chunks = []
    const components = []

    const selectedText = window.getSelection().getRangeAt(0).cloneContents()
    getChildren(selectedText,components)

    components.forEach(component => chunks.push(component.textContent))

    return {
        representation: selectedText.textContent,
        chunks: chunks.filter(c => c.trim() !== ''), // filter out empty chunks
    }
}

function highlightSelectedText() {
  const { representation, chunks } = getHighlight();
  if (representation.trim() === "") return;

  const groupID = Date.now();
  const url = window.location.href;

  const highlight = {
    groupID: groupID,
    repr: representation,
    chunks: chunks,
    url: url,
    date: new Date().toISOString(),
  };

  chrome.storage.local.get({ highlights: {} }, (data) => {
    const highlights = data.highlights;
    if (!highlights[url]) {
      highlights[url] = [];
    }
    highlights[url].push(highlight);
    chrome.storage.local.set({ highlights: highlights }, () => {
        // Now apply the highlights to the page
        chunks.forEach(chunk => {
            findAndHighlight(chunk, groupID);
        });
    });
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
      // Find the highlight to delete by groupID
      highlights[url] = highlights[url].filter(h => h.groupID.toString() !== groupId);
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

function applyHighlights() {
  const url = window.location.href;
  chrome.storage.local.get({ highlights: {} }, (data) => {
    const highlights = data.highlights[url];
    if (highlights) {
      highlights.forEach(highlight => {
        highlight.chunks.forEach(chunk => {
            findAndHighlight(chunk, highlight.groupID);
        });
      });
    }
  });
}

window.addEventListener("load", applyHighlights);
