# Light Extension ↔ Commonplace Sync Implementation

**Goal**: Add a synchronize button to the [Light browser extension](https://github.com/gwuah/light) that syncs its local highlight database to the Commonplace API periodically.

---

## Data Mapping

### Light Extension Format

```json
{
  "https://example.com/article": [
    {
      "chunks": ["highlighted text..."],
      "date": "2025-12-19T13:01:41.308Z",
      "groupID": 1766149301308,
      "repr": "highlighted text...",
      "url": "https://example.com/article"
    }
  ]
}
```

### Commonplace Mapping

| Light Field                        | Commonplace Entity | Field                      |
| ---------------------------------- | ------------------ | -------------------------- |
| URL (key)                          | `Resource`         | `title` (type = 'website') |
| `repr`                             | `Annotation`       | `text`                     |
| `groupID`, `date`, `chunks`, `url` | `Annotation`       | `boundary` (JSON)          |

---

## Tasks

### Backend (Rust - Light Module)

> **Note**: The sync logic lives in `src/light/` as a separate module, keeping `commonplace` as a generic library.

- [x] **1. Add helper methods to `commonplace/lib.rs`**

  - [x] `find_resource_by_title(title: &str)` - Find resource by URL

- [x] **2. Create `src/light/` module with sync handler**

  - [x] Define `LightHighlight` struct (chunks, date, groupID, repr, url)
  - [x] Define `SyncRequest` struct (HashMap<String, Vec<LightHighlight>>)
  - [x] Define `SyncResponse` struct (resources_created, annotations_created, annotations_skipped)
  - [x] Implement `sync_highlights` handler:
    - Find or create Resource for each URL
    - Check if annotation exists (by groupID)
    - Create new annotations, skip existing ones
    - Return sync statistics

- [x] **3. Add sync route to `src/light/routes.rs`**

  - [x] Add `POST /sync` endpoint

- [x] **4. Enable CORS in `main.rs`**
  - [x] Add `tower_http::cors::CorsLayer`
  - [x] Allow requests from browser extension

---

### Frontend (JavaScript - Light Extension)

- [ ] **5. Update `manifest.json`**

  - [ ] Add `alarms` permission (for periodic sync)
  - [ ] Add `host_permissions` for localhost/API URL

- [ ] **6. Update `popup.html`**

  - [ ] Add sync button
  - [ ] Add status display element
  - [ ] Add settings input for API URL (optional)

- [ ] **7. Update `popup.css`**

  - [ ] Style sync button
  - [ ] Style status messages (syncing, success, error states)

- [ ] **8. Update `popup.js`**

  - [ ] Add `COMMONPLACE_API` configuration constant
  - [ ] Implement `syncToCommonplace()` function:
    - Get all highlights from `chrome.storage.local`
    - POST to `/light/sync`
    - Display results/errors
    - Store last sync timestamp
  - [ ] Add click handler for sync button

- [ ] **9. Add periodic sync (optional)**
  - [ ] Set up `chrome.alarms` for periodic sync (e.g., every 30 minutes)
  - [ ] Add alarm listener to trigger sync

---

## File Changes Summary

### Backend (Completed)

| File                     | Type   | Changes                          |
| ------------------------ | ------ | -------------------------------- |
| `src/commonplace/lib.rs` | Modify | Add `find_resource_by_title`     |
| `src/light/mod.rs`       | Create | Light module declaration         |
| `src/light/handler.rs`   | Create | DTOs + `sync_highlights` handler |
| `src/light/routes.rs`    | Create | `/sync` POST route               |
| `src/lib.rs`             | Modify | Register `light` module          |
| `src/main.rs`            | Modify | Mount light routes + add CORS    |
| `Cargo.toml`             | Modify | Add `cors` feature to tower-http |

### Frontend (Pending)

| File                  | Type   | Changes                  |
| --------------------- | ------ | ------------------------ |
| `light/manifest.json` | Modify | Add permissions          |
| `light/popup.html`    | Modify | Add sync button + status |
| `light/popup.css`     | Modify | Add sync styles          |
| `light/popup.js`      | Modify | Add sync logic           |

---

## API Contract

### `POST /light/sync`

**Request:**

```json
{
  "highlights": {
    "https://example.com/page1": [
      {
        "chunks": ["text snippet 1", "text snippet 2"],
        "date": "2025-12-19T13:01:41.308Z",
        "groupID": 1766149301308,
        "repr": "full highlighted text",
        "url": "https://example.com/page1"
      }
    ],
    "https://example.com/page2": [...]
  }
}
```

**Response:**

```json
{
  "data": {
    "resources_created": 2,
    "annotations_created": 15,
    "annotations_skipped": 3
  }
}
```

---

## Testing Checklist

- [ ] Manual sync works via button click
- [ ] Duplicate annotations are skipped (idempotent)
- [ ] New highlights create new annotations
- [ ] New URLs create new resources
- [ ] Error states display correctly
- [ ] Periodic sync triggers correctly (if implemented)
- [ ] CORS allows extension requests

---

## Notes

- The `groupID` from Light serves as a unique identifier for each highlight
- Resources are matched by exact URL (title field)
- All highlights are stored with `color: "yellow"` by default
- The boundary JSON preserves all original Light metadata for potential future use
