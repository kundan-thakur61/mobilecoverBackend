# mongodb-memory-server: install & troubleshooting

This project can use `mongodb-memory-server` for fast, isolated tests. The package downloads MongoDB server binaries during installation which sometimes fails on Windows or in restricted CI environments. The notes below explain common problems and fixes.

Quick install (from `backend/`):

```pwsh
npm install --save-dev mongodb-memory-server --legacy-peer-deps
```

If the install fails, try these steps in order:

- Run PowerShell as Administrator and retry the install (permissions can block postinstall binary extraction).
- Clean up partial installs and npm cache first:

```pwsh
cd C:\Users\kundan\Desktop\copadMob\backend
Remove-Item -Recurse -Force node_modules\\mongodb-memory-server* -ErrorAction SilentlyContinue
npm cache clean --force
npm install --save-dev mongodb-memory-server --legacy-peer-deps
```

- Network/firewall issues: the package downloads a large MongoDB binary (~500+ MB). Ensure the host can reach the download servers and that proxy/firewall rules allow the download.

- CI environments: prefer one of the following strategies:
  - Pre-cache the MongoDB binary on the runner or use a cached `~/.mongodb-memory-server` folder between runs.
  - Use the `--downloadDir` and `MONGOMS_DOWNLOAD_DIR` environment variable to point to a prepopulated directory.
  - Set up the runner with `npm ci` on a machine that can download the binary, then cache `node_modules` or the binary directory.

- If you must skip the postinstall binary download (advanced):
  - `npm install --ignore-scripts` will skip downloads but you'll need to provide the MongoDB binaries manually at runtime or via `MONGOMS_DOWNLOAD_DIR`.

After a successful install, run tests:

```pwsh
npm test
```

If you still see failures related to `jwt malformed`, `429 Too Many Requests`, or duplicate DB connections during tests, ensure:

- The app is loaded from `app.js` and `index.js` only starts the server and connects to the DB when `NODE_ENV !== 'test'`.
- Rate limiting middleware is disabled under `NODE_ENV === 'test'` to avoid intermittent `429` responses.

If you'd like, I can add CI caching steps or a short `make`/PowerShell helper script to pre-download and cache the MongoDB binary for faster CI installs.

---
Created to help contributors and CI prevent common `mongodb-memory-server` install issues.
