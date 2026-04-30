# Technical Concerns & Risks

## 1. Browser Compatibility
- The **File System Access API** is currently only supported in Chromium-based browsers (Chrome, Edge, Opera). It is **not supported** in Firefox or Safari, which limits the user base.

## 2. Concurrency Issues
- The Excel file is a single source of truth. If multiple users edit the same file (e.g., on a shared network drive), there is a high risk of "last write wins" data loss. There is no built-in concurrency control or row-level locking.

## 3. Security
- Authentication is client-side. The Excel file contains the user list and password hashes. Anyone with access to the Excel file can modify roles, passwords, or bypass the application entirely.

## 4. Performance at Scale
- xlsx parses the entire file into memory. As the number of activities grows over years, loading and saving the Excel file will become slower and consume more browser memory.

## 5. Persistence Fragility
- IndexedDB file handles can expire or be revoked if the file is moved, renamed, or if the browser clears site data. The application must gracefully handle reconnecting to the file.
