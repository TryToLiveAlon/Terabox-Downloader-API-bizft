const COOKIE = "ndus=YT0hxdPpeHuiPK4AVA2qdVFp4xqnmjp-m00o3GfU;" // Replace with your actual cookie

const HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
  "Connection": "keep-alive",
  "DNT": "1",
  "Host": "www.terabox.app",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
  "sec-ch-ua": '"Microsoft Edge";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cookie": COOKIE,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

const DL_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Referer": "https://terabox.com/",
  "DNT": "1",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Cookie": COOKIE,
};

function getSize(sizeBytes) {
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(2)} KB`;
  }
  return `${sizeBytes} bytes`;
}

function findBetween(str, start, end) {
  const startIndex = str.indexOf(start);
  if (startIndex === -1) return "";

  const from = startIndex + start.length;
  const endIndex = str.indexOf(end, from);

  if (endIndex === -1) return "";

  return str.slice(from, endIndex);
}    

async function getFileInfo(link, request) {
  let debug = {
    input_link: link,
    final_url: null,
    surl: null,
    jsToken: null,
    logid: null,
    bdstoken: null,
    step: "init",
  };

  try {
    if (!link) {
      return { error: "Link cannot be empty.", debug };
    }

    debug.step = "fetch_initial";

    let response = await fetch(link, { headers: HEADERS });

    if (!response.ok) {
      return {
        error: `Failed initial fetch: ${response.status}`,
        debug
      };
    }

    const finalUrl = response.url;
    debug.final_url = finalUrl;

    const url = new URL(finalUrl);
    const surl = url.searchParams.get("surl");
    debug.surl = surl;

    if (!surl) {
      return {
        error: "Invalid link (no surl found)",
        debug
      };
    }

    debug.step = "fetch_page_html";

    response = await fetch(finalUrl, { headers: HEADERS });
    const text = await response.text();

    debug.step = "extract_tokens";

    // --- Token Extraction ---
    let jsToken = findBetween(text, 'fn%28%22', '%22%29');
    let logid = findBetween(text, 'dp-logid=', '&');
    let bdstoken = findBetween(text, 'bdstoken":"', '"');

    if (!jsToken) {
      const match = text.match(/"jsToken"\s*:\s*"([^"]+)"/);
      if (match) jsToken = match[1];
    }

    if (!jsToken) {
      const match = text.match(/fn\("([^"]+)"\)/);
      if (match) jsToken = match[1];
    }

    if (!logid) {
      const match = text.match(/dp-logid=([0-9]+)/);
      if (match) logid = match[1];
    }

    debug.jsToken = jsToken;
    debug.logid = logid;
    debug.bdstoken = bdstoken;

    // --- Fetch File List ---
    debug.step = "call_api";

    let data = await fetchFileList(surl, jsToken, finalUrl);

    // fallback (like browser behavior)
    if (!data?.list?.length) {
      debug.step = "fallback_no_token";
      data = await fetchFileList(surl);
    }

    if (!data || !data.list || !data.list.length || data.errno) {
      return {
        error: data?.errmsg || "Failed to retrieve file list",
        debug,
        raw: data
      };
    }

    const fileInfo = data.list[0];

    // 🔥 Save full structure for debugging
    debug.full_list_item = fileInfo;

    // --- SMART DLINK EXTRACTION ---
    let dlink = "";

    // Case 1: direct string
    if (typeof fileInfo.dlink === "string" && fileInfo.dlink) {
      dlink = fileInfo.dlink;
    }

    // Case 2: array format
    else if (Array.isArray(fileInfo.dlink) && fileInfo.dlink.length > 0) {
      dlink = fileInfo.dlink[0]?.dlink || "";
    }

    // Case 3: inside extra
    else if (fileInfo.extra?.dlink) {
      dlink = fileInfo.extra.dlink;
    }

    // Case 4: fallback deep
    else if (data?.list?.[0]?.dlink) {
      dlink = data.list[0].dlink;
    }

    debug.extracted_dlink = dlink;

    debug.step = "success";

    return {
      file_name: fileInfo.server_filename || "",
      download_link: dlink || "",
      thumbnail: fileInfo.thumbs?.url3 || "",
      file_size: getSize(parseInt(fileInfo.size || 0)),
      size_bytes: parseInt(fileInfo.size || 0),
      proxy_url: dlink
        ? `https://${new URL(request.url).host}/proxy?url=${encodeURIComponent(dlink)}&file_name=${encodeURIComponent(fileInfo.server_filename || 'download')}`
        : null,
      debug
    };

  } catch (error) {
    return {
      error: `Exception: ${error.message}`,
      debug
    };
  }
                              }

async function proxyDownload(url, fileName, request) {
  try {
    // Copy headers from the original request
    const headers = new Headers(DL_HEADERS);
    
    // Handle range requests
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      headers.set('Range', rangeHeader);
    }

    const response = await fetch(url, {
      headers,
      redirect: 'follow',
    });

    if (!response.ok && response.status !== 206) {
      return new Response(JSON.stringify({ error: `Failed to fetch download: ${response.status}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Copy response headers for proper streaming and seeking
    const responseHeaders = new Headers({
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Accept-Ranges': 'bytes'
    });
    
    // Copy content range header if it exists (for partial content response)
    if (response.headers.has('Content-Range')) {
      responseHeaders.set('Content-Range', response.headers.get('Content-Range'));
    }
    
    // Copy content length if it exists
    if (response.headers.has('Content-Length')) {
      responseHeaders.set('Content-Length', response.headers.get('Content-Length'));
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: `Proxy error: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Add CORS headers for cross-origin requests
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Range",
  "Access-Control-Expose-Headers": "Content-Length,Content-Range"
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method === "POST" && url.pathname === "/") {
      try {
        const { link } = await request.json();
        if (!link) {
          return new Response(JSON.stringify({ error: "No link provided in the request body." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS }
          });
        }

        const fileInfo = await getFileInfo(link, request);
        return new Response(JSON.stringify(fileInfo), {
          status: fileInfo.error ? 400 : 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: `Invalid request: ${error.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS }
        });
      }
    }    if (request.method === "GET" && url.pathname === "/proxy") {
      const downloadUrl = url.searchParams.get("url");
      const fileName = url.searchParams.get("file_name") || "download";
      if (!downloadUrl) {
        return new Response(JSON.stringify({ error: "No URL provided for proxy." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS }
        });
      }

      const proxyResponse = await proxyDownload(downloadUrl, fileName, request);
      // Ensure CORS headers on proxied download response
      proxyResponse.headers.set("Access-Control-Allow-Origin", "*");
      proxyResponse.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      proxyResponse.headers.set("Access-Control-Allow-Headers", "Content-Type,Range");
      proxyResponse.headers.set("Access-Control-Expose-Headers", "Content-Length,Content-Range");
      return proxyResponse;
    }

    return new Response(JSON.stringify({ error: "Method or path not allowed." }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS }
    });
  },
};
