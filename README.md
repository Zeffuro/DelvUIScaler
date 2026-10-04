# DelvUI / DelvCD Profile Scaler

[Open the scaler](https://zeffuro.github.io/DelvUIScaler/)

Paste a profile or open/drop a file, preview it, then copy or download the export. Profiles stay in your browser.

Scroll to zoom. Space + drag pans. Enable **Edit positions** to drag, align or nudge with arrow keys. Shift takes larger steps. Undo and reset are available beside the preview.

**Source / Scaled** switches layouts. **Resolution bounds** overlays centered 1080p, 1440p and 4K screens. **Scene** changes sample data. **Font scaling** compares text sizes. Loaded fonts affect only the preview.

GitHub Pages publishes from `main`. For local development, run `npm start` and open `http://127.0.0.1:8767`, or open `index.html` directly. Pako loads from a CDN.

`npm test` runs unit checks. Optional `npm run test:browser` needs Playwright and Edge (`TEST_BROWSER=chrome` for Chrome).
