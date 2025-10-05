
# 📁 Terabox Video Downloader API by Telegram: @bizft — Cloudflare Worker

A lightweight Cloudflare Worker that extracts direct download links from Terabox (formerly Dubox) shared URLs and serves them via a proxy endpoint for seamless playback or download.

**Made By [BIZ FACTORY](https://t.me/bizft)** 🚀

---

## 🚀 Features

- Extract file info (name, size, thumbnail, direct link) from Terabox share links.
- Proxy the actual download through your own domain (bypasses CORS and cookie restrictions).
- Supports **range requests** → enables video seeking and partial downloads.
- Fully CORS-enabled for frontend integration.
- Built with security & performance in mind.

---

## 🛠️ Setup Guide

### 1. **Get Your Terabox Cookie**

1. Log in to [Terabox](https://www.terabox.com) in your browser.
2. Open DevTools (`F12`) → **Application** → **Cookies** → `https://www.terabox.com`.
3. Copy the full **Cookie** string (contains `BDUSS`, `STOKEN`, etc.).
4. **⚠️ Keep this private! Never commit it to public repos.**

### 2. **Deploy to Cloudflare Workers**

#### Option A: Using Wrangler (Recommended)

1. Install [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/):
   ```bash
   npm install -g wrangler
   ```

2. Clone or create a new Worker project:
   ```bash
   wrangler init terabox-downloader
   cd terabox-downloader
   ```

3. Replace `src/index.js` with the provided code.

4. Set your cookie as a **secret** (never hardcode it!):
   ```bash
   wrangler secret put ENTE_YOUR_TERABOX_COOKIES
   ```
   → Paste your full Terabox cookie when prompted.

5. Deploy:
   ```bash
   wrangler deploy
   ```

#### Option B: Cloudflare Dashboard

1. Go to [Cloudflare Dashboard → Workers](https://dash.cloudflare.com/?to=/:account/workers).
2. Create a new Worker.
3. Paste the code into the editor.
4. **Replace** this line:
   ```js
   const COOKIE = "ENTE_YOUR_TERABOX_COOKIES"
   ```
   with your actual cookie **OR** (better) use environment variables:
   - In the Worker settings → **Environment variables** → **Secrets**
   - Add a secret named `TERABOX_COOKIE` with your cookie value.
   - Then update the code to:
     ```js
     const COOKIE = env.TERABOX_COOKIE; // if using env
     ```
     *(Note: You’ll need to pass `env` into the `fetch` handler — see Wrangler docs for module syntax.)*

---

## 📡 API Endpoints

### 🔗 POST `/` — Get File Info

**Request:**
```json
{
  "link": "https://terabox.com/s/your-share-link"
}
```

**Response:**
```json
{
  "file_name": "example.mp4",
  "file_size": "1.25 GB",
  "size_bytes": 1342177280,
  "thumbnail": "https://.../thumb.jpg",
  "download_link": "https://.../file.mp4?auth=...",
  "proxy_url": "https://your-worker.your-subdomain.workers.dev/proxy?url=...&file_name=example.mp4"
}
```

> ✅ Use `proxy_url` in your frontend for direct playback/download without CORS issues.

---

### 🌐 GET `/proxy` — Stream/Download File

**Query Params:**
- `url` *(required)*: The direct Terabox download link (`dlink`)
- `file_name` *(optional)*: Filename for `Content-Disposition`

**Example:**
```
GET /proxy?url=https://.../file.mp4&file_name=my_video.mp4
```

> Supports **byte-range requests** → works with `<video>` tags and download managers.

---

## 🛡️ Security Notes

- Your Terabox cookie grants full access to your account. **Treat it like a password.**
- Never expose the raw `dlink` publicly — always use the `/proxy` endpoint.
- The Worker includes CORS headers for safe cross-origin usage.

---

## 🧪 Example Usage (Frontend)

```html
<video controls src="https://your-worker.proxy/proxy?url=ENCODED_DLINK&file_name=video.mp4"></video>
```

Or fetch file info:
```js
const res = await fetch('https://your-worker.proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ link: 'https://terabox.com/s/abc123' })
});
const data = await res.json();
console.log(data.proxy_url); // Use this for download/playback
```

---

## ❓ Troubleshooting

| Issue | Solution |
|------|--------|
| `Invalid link` | Ensure the Terabox link is public and valid |
| `Failed to extract tokens` | Cookie may be expired — re-login and update it |
| Video won’t seek | Ensure your player supports range requests (most do) |
| 403 Forbidden | Terabox may block non-browser User-Agents — try updating `User-Agent` |

---
