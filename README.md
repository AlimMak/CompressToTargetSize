# CompressToTargetSize

Privacy-first web app to compress images to a target file size directly in the browser.

## Setup

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
npm run preview
```

## Privacy & Security

- Files never leave your device.
- No backend is used for compression.
- No analytics, tracking, or third-party beacons are included.
- Metadata is stripped by default through canvas re-encoding.
- A restrictive Content Security Policy is set in `/index.html`.

## Offline behavior

- Service worker + manifest are included.
- After first load, the app can be opened offline for previously cached assets.

## Git remote fallback

If your remote is not configured:

```bash
git remote add origin https://github.com/AlimMak/CompressToTargetSize.git
git branch -M main
git push -u origin main
```
