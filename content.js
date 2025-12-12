chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlight") {
    highlightSelectedText();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log(request)
  if (request.action === "scrollToHighlight") {
    const element = document.querySelector(
      `span[data-group-id='${request.groupID}']`
    );
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    sendResponse({ info: "Here is your data!" });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleHighlight") {
    const highlights = document.querySelectorAll(`.text-highlighter-highlight`);
    for (const highlight of highlights) {
      toggleHighlight(highlight);
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "a") {
    highlightSelectedText();
  }
});

function toggleHighlight(el) {
  if (el.style.backgroundColor) {
    el.style.backgroundColor = "";
    el.style.position = "";
  } else {
    el.style.backgroundColor = "rgb(254, 254, 197)";
    el.style.position = "relative";
  }
}

function getHighlight() {
  let getChildren = (node, collection) => {
    let children = Array.from(node.childNodes);
    if (children.length == 0) {
      collection.push(node);
      return;
    }
    children.forEach((child) => getChildren(child, collection));
  };

  const chunks = [];
  const components = [];

  const selectedText = window.getSelection().getRangeAt(0).cloneContents();
  getChildren(selectedText, components);

  components.forEach((component) => chunks.push(component.textContent));

  return {
    representation: selectedText.textContent,
    chunks: chunks.filter((c) => c.trim() !== ""), // filter out empty chunks
  };
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
      reapplyHighlightSequence(highlight);
    });
  });
}

function attachButton(span) {
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

function createHighlightSpan(text, groupId) {
  const span = document.createElement("span");
  span.style.backgroundColor = "#FEFEC5";
  span.style.color = "black";
  // span.style.padding = "1px";
  span.className = "text-highlighter-highlight";
  span.style.position = "relative";
  span.textContent = text;
  span.dataset.groupId = groupId; // Store groupId on the element

  return span;
}

function deleteHighlight(highlightSpan) {
  const groupId = highlightSpan.dataset.groupId;
  const url = window.location.href;

  chrome.storage.local.get({ highlights: {} }, (data) => {
    let highlights = data.highlights;
    if (highlights[url]) {
      highlights[url] = highlights[url].filter(
        (h) => h.groupID.toString() !== groupId
      );
      if (highlights[url].length === 0) {
        delete highlights[url];
      }
    }
    chrome.storage.local.set({ highlights: highlights }, () => {
      const spans = document.querySelectorAll(
        `.text-highlighter-highlight[data-group-id='${groupId}']`
      );
      spans.forEach((span) => {
        const parent = span.parentNode;
        parent.replaceChild(
          document.createTextNode(span.textContent.slice(0, -1)),
          span
        );
      });
    });
  });
}

// during apply, sometimes urls can get fucked up
// so an exact match wouldn't work, so we match on hostname level.
// in future, we can properly store hostname -> subroutes -> highlights
async function applyHighlightWithRetry(db, url) {
  const applyHighlightsForURL = async (db, url) => {
    const expectedHost = new URL(url).hostname;

    Object.keys(db).forEach(async (key) => {
      const gotHost = new URL(key).hostname;
      if (gotHost != expectedHost) return;

      console.log(db[key], "dbbbb");

      db[key].forEach(async function (highlight) {
        highlight.chunks.forEach(async function (chunk) {
          // await findAndHighlight(chunk, highlight.groupID);
          await reapplyHighlightSequence(highlight);
        });
      });
    });
  };

  for (let i = 0; i < 7; i++) {
    console.log(`paint attempt ${i}`);
    await applyHighlightsForURL(db, url);
    await new Promise((r) => setTimeout(r, 800));
  }
}

function run() {
  chrome.storage.local.get({ highlights: {} }, async (data) => {
    await applyHighlightWithRetry(data.highlights, window.location.href);
  });
}

window.addEventListener("load", run);

async function reapplyHighlightSequence(highlight) {
  const chunks = highlight.chunks || [];
  if (!chunks.length) return;

  const full = chunks.join("");

  // 1) Linearize all eligible text
  const { textNodes, bigText, cumLengths, nodeToIndex } = collectTextStream(
    document.body
  );

  // 2) Search for the full sequence (contiguous, in order)
  const matchStart = bigText.indexOf(full);
  if (matchStart === -1) {
    console.warn("Sequence not found; DOM may have changed.");
    return;
  }

  // 3) Build DOM ranges (start/end node+offset) per chunk
  const chunkBoundaries = [];
  let offset = 0;
  for (const c of chunks) {
    const startIdx = matchStart + offset;
    const endIdx = startIdx + c.length;
    const startPos = indexToDomPosition(startIdx, textNodes, cumLengths);
    const endPos = indexToDomPosition(endIdx, textNodes, cumLengths);
    chunkBoundaries.push({ startPos, endPos });
    offset += c.length;
  }

  // Optional: skip if everything is already highlighted
  if (
    chunkBoundaries.every(({ startPos, endPos }) =>
      isWithinSameHighlight(startPos.node, endPos.node)
    )
  ) {
    return;
  }

  // 4) Apply highlights per chunk from right to left, wrapping only text nodes
  for (let i = chunkBoundaries.length - 1; i >= 0; i--) {
    const { startPos, endPos } = chunkBoundaries[i];
    wrapChunkByTextNodes({
      startNode: startPos.node,
      startOffset: startPos.offset,
      endNode: endPos.node,
      endOffset: endPos.offset,
      groupId: highlight.groupID,
      textNodes,
      nodeToIndex,
    });
  }
}

function collectTextStream(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
      if (hasHighlightAncestor(n)) return NodeFilter.FILTER_REJECT;
      const p = n.parentNode;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tn = p.nodeName.toLowerCase();
      if (tn === "script" || tn === "style" || tn === "noscript")
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  const parts = textNodes.map((n) => n.nodeValue);
  const bigText = parts.join("");

  const cumLengths = new Array(textNodes.length + 1);
  cumLengths[0] = 0;
  for (let i = 0; i < textNodes.length; i++) {
    cumLengths[i + 1] = cumLengths[i] + textNodes[i].nodeValue.length;
  }

  const nodeToIndex = new Map(textNodes.map((n, i) => [n, i]));

  return { textNodes, bigText, cumLengths, nodeToIndex };
}

function indexToDomPosition(globalIdx, textNodes, cumLengths) {
  // binary search cumLengths for idx
  let lo = 0,
    hi = textNodes.length - 1,
    mid;
  while (lo <= hi) {
    mid = (lo + hi) >> 1;
    if (cumLengths[mid + 1] <= globalIdx) lo = mid + 1;
    else if (cumLengths[mid] > globalIdx) hi = mid - 1;
    else break;
  }
  return { node: textNodes[mid], offset: globalIdx - cumLengths[mid] };
}

function hasHighlightAncestor(node) {
  for (let el = node.parentNode; el; el = el.parentNode) {
    if (
      el.nodeType === 1 &&
      el.classList &&
      el.classList.contains("text-highlighter-highlight")
    )
      return true;
  }
  return false;
}

function isWithinSameHighlight(a, b) {
  const ha = ancestorHighlight(a);
  const hb = ancestorHighlight(b);
  return ha && hb && ha === hb;
}

function ancestorHighlight(node) {
  for (
    let el = node.nodeType === 1 ? node : node.parentNode;
    el;
    el = el.parentNode
  ) {
    if (
      el.nodeType === 1 &&
      el.classList &&
      el.classList.contains("text-highlighter-highlight")
    )
      return el;
  }
  return null;
}

/**
 * Wrap only the text slices that intersect [startNode@startOffset, endNode@endOffset)
 * Never encloses block elements; it splits text nodes and wraps the middle slice with a <span>.
 */
function wrapChunkByTextNodes({
  startNode,
  startOffset,
  endNode,
  endOffset,
  groupId,
  textNodes,
  nodeToIndex,
}) {
  let iStart = nodeToIndex.get(startNode);
  let iEnd = nodeToIndex.get(endNode);

  // If DOM changed since we built the list, bail quietly
  if (iStart == null || iEnd == null) return;

  // Same node case
  if (iStart === iEnd) {
    wrapTextSlice(startNode, startOffset, endOffset, groupId);
    return;
  }

  // First node: from startOffset to end of node
  wrapTextSlice(
    textNodes[iStart],
    startOffset,
    textNodes[iStart].nodeValue.length,
    groupId
  );

  // Middle nodes: whole text
  for (let i = iStart + 1; i < iEnd; i++) {
    const n = textNodes[i];
    wrapTextSlice(n, 0, n.nodeValue.length, groupId);
  }

  // Last node: from 0 to endOffset
  wrapTextSlice(textNodes[iEnd], 0, endOffset, groupId);
}

/**
 * Splits a text node into [before][<span>middle</span>][after]
 * If the entire slice is already inside an existing highlight span, it skips.
 */
function wrapTextSlice(textNode, startOffset, endOffset, groupId) {
  if (!textNode || startOffset >= endOffset) return;

  // If the whole node is already inside a highlight, skip
  if (hasHighlightAncestor(textNode)) return;

  const text = textNode.nodeValue;
  const before = text.slice(0, startOffset);
  const middle = text.slice(startOffset, endOffset);
  const after = text.slice(endOffset);

  const frag = document.createDocumentFragment();
  if (before) frag.appendChild(document.createTextNode(before));

  if (middle) {
    let span = createHighlightSpan("", groupId);
    span.textContent = middle;
    span = attachButton(span);
    frag.appendChild(span);
  }

  if (after) frag.appendChild(document.createTextNode(after));

  textNode.parentNode.replaceChild(frag, textNode);
}
