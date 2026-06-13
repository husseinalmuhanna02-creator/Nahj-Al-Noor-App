var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_vite = require("vite");
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_stream = require("stream");
var import_meta = {};
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.get("/api/proxy", async (req, res) => {
    let targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).send("URL is required");
    }
    try {
      let response;
      let retries = 3;
      let lastError;
      let gdriveCookie = null;
      const driveMatch = targetUrl.match(/drive\.google\.com\/uc.*[?&]id=([^&]+)/) || targetUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      if (driveMatch) {
        const fileId = driveMatch[1];
        try {
          console.log(`[Proxy] Detected Google Drive file ID: ${fileId}. Handling "Download anyway" bypass...`);
          const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          const initRes = await fetch(initialUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
          });
          if (initRes.ok) {
            const contentType2 = initRes.headers.get("content-type") || "";
            if (contentType2.includes("html")) {
              const html = await initRes.text();
              const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
              if (confirmMatch) {
                const confirmToken = confirmMatch[1];
                console.log(`[Proxy] Found Google Drive confirm token: ${confirmToken}`);
                const finalUrl = `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${fileId}`;
                const setCookie = initRes.headers.get("set-cookie");
                if (setCookie) {
                  gdriveCookie = setCookie;
                }
                targetUrl = finalUrl;
              } else {
                console.log("[Proxy] No confirm token found in HTML, proceeding with initial response/url.");
              }
            } else {
              console.log("[Proxy] Google Drive did not return HTML, proceeding directly.");
            }
          }
        } catch (err) {
          console.warn("[Proxy] Failed to pre-fetch Google Drive bypass, falling back to standard fetch:", err.message);
        }
      }
      while (retries > 0) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3e4);
        try {
          const fetchHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          };
          if (gdriveCookie) {
            fetchHeaders["Cookie"] = gdriveCookie;
          }
          response = await fetch(targetUrl, {
            signal: controller.signal,
            headers: fetchHeaders
          });
          clearTimeout(timeout);
          if (response.ok) break;
          if (response.status === 403 || response.status === 429) {
            await new Promise((resolve) => setTimeout(resolve, 2e3));
          } else {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
          }
        } catch (err) {
          lastError = err;
          console.warn(`Fetch attempt failed (${retries} retries left):`, err.message);
          retries--;
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1e3 * (4 - retries)));
          }
        }
      }
      if (!response || !response.ok) {
        throw lastError || new Error(`Failed to fetch after retries: ${response?.status} ${response?.statusText}`);
      }
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (response.body) {
        import_stream.Readable.fromWeb(response.body).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to proxy request");
    }
  });
  app.get("/api/proxy-audio", async (req, res) => {
    const audioUrl = req.query.url;
    if (!audioUrl) {
      return res.status(400).send("URL is required");
    }
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (response.body) {
        import_stream.Readable.fromWeb(response.body).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to proxy audio");
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
