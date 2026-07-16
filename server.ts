/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy endpoint to bypass CORS
  app.get("/api/proxy", async (req, res) => {
    let targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      let response;
      let retries = 3;
      let lastError;
      let gdriveCookie: string | null = null;

      // Handle Google Drive Large File "Download Anyway" Bypass
      const driveMatch = targetUrl.match(/drive\.google\.com\/uc.*[?&]id=([^&]+)/) || targetUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      if (driveMatch) {
        const fileId = driveMatch[1];
        try {
          console.log(`[Proxy] Detected Google Drive file ID: ${fileId}. Handling "Download anyway" bypass...`);
          const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          const initRes = await fetch(initialUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });

          if (initRes.ok) {
            const contentType = initRes.headers.get("content-type") || "";
            if (contentType.includes("html")) {
              const html = await initRes.text();
              const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
              if (confirmMatch) {
                const confirmToken = confirmMatch[1];
                console.log(`[Proxy] Found Google Drive confirm token: ${confirmToken}`);
                const finalUrl = `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${fileId}`;
                const setCookie = initRes.headers.get('set-cookie');
                if (setCookie) {
                  gdriveCookie = setCookie;
                }
                
                // Set targetUrl to finalUrl to download the actual file
                targetUrl = finalUrl;
              } else {
                console.log("[Proxy] No confirm token found in HTML, proceeding with initial response/url.");
              }
            } else {
              console.log("[Proxy] Google Drive did not return HTML, proceeding directly.");
            }
          }
        } catch (err: any) {
          console.warn("[Proxy] Failed to pre-fetch Google Drive bypass, falling back to standard fetch:", err.message);
        }
      }

      while (retries > 0) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        
        try {
          const fetchHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          };
          if (gdriveCookie) {
            fetchHeaders['Cookie'] = gdriveCookie;
          }

          response = await fetch(targetUrl, {
            signal: controller.signal as any,
            headers: fetchHeaders
          });
          clearTimeout(timeout);
          if (response.ok) break;
          
          if (response.status === 403 || response.status === 429) {
            // Probably rate limited or forbidden, wait and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Fetch attempt failed (${retries} retries left):`, err.message);
          retries--;
          if (retries > 0) {
             await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential-ish backoff
          }
        }
      }

      if (!response || !response.ok) {
        throw lastError || new Error(`Failed to fetch after retries: ${response?.status} ${response?.statusText}`);
      }

      // Forward headers
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Stream the response body
      if (response.body) {
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to proxy request");
    }
  });

  // Proxy endpoint to bypass CORS for audio downloads
  app.get("/api/proxy-audio", async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      // Forward headers
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Pipe the audio stream to the client
      if (response.body) {
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to proxy audio");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
