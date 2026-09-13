import { request as httpRequest } from "node:http";
import type { ClientRequest, IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import type { RequestOptions } from "node:https";
import { isIP } from "node:net";
import type { TcpSocketConnectOpts } from "node:net";
import {
  PublicImageError,
  publicImageAbortError,
  resolvePublicImageTarget,
} from "./public-image-address";
import type { PublicImageTarget } from "./public-image-address";

export { PublicImageError } from "./public-image-address";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TOTAL_TIMEOUT_MS = 10_000;
const IMAGE_CONTENT_TYPES = new Set<string>([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif",
  "image/apng", "image/bmp", "image/x-ms-bmp", "image/x-icon",
  "image/vnd.microsoft.icon", "image/tiff", "image/svg+xml",
]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type PublicImage = { readonly body: Uint8Array; readonly contentType: string };
type HopResult =
  | { readonly kind: "image"; readonly image: PublicImage }
  | { readonly kind: "redirect"; readonly location: string };

function requestImage(target: PublicImageTarget, signal: AbortSignal): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    let request: ClientRequest | undefined;
    let response: IncomingMessage | undefined;
    let settled = false;
    // A growing buffer bounds memory even when a peer sends millions of tiny chunks.
    let body = new Uint8Array(0);
    let size = 0;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const fail = (error: PublicImageError) => {
      if (settled) return;
      settled = true;
      cleanup();
      response?.destroy();
      request?.destroy();
      reject(error);
    };
    const onAbort = () => fail(publicImageAbortError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    const options: RequestOptions & Pick<TcpSocketConnectOpts, "autoSelectFamily"> = {
      method: "GET",
      agent: false,
      autoSelectFamily: true,
      lookup: target.lookup,
      signal,
      rejectUnauthorized: true,
      ...(isIP(target.hostname) === 0 ? { servername: target.hostname } : {}),
      maxHeaderSize: 16 * 1024,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Referer: target.url.origin,
        "Accept-Encoding": "identity",
        Connection: "close",
      },
    };
    const receive = (incoming: IncomingMessage) => {
      response = incoming;
      incoming.on("error", () => fail(new PublicImageError("upstream")));
      incoming.once("aborted", () => fail(new PublicImageError("upstream")));
      incoming.once("close", () => {
        if (!settled) fail(new PublicImageError("upstream"));
      });
      if (settled || signal.aborted) {
        if (!settled) onAbort();
        incoming.destroy();
        return;
      }
      const status = incoming.statusCode ?? 0;
      if (REDIRECT_STATUSES.has(status)) {
        const location = incoming.headers.location;
        if (!location) {
          fail(new PublicImageError("upstream"));
          return;
        }
        settled = true;
        cleanup();
        incoming.destroy();
        request?.destroy();
        resolve({ kind: "redirect", location });
        return;
      }
      if (status < 200 || status >= 300) {
        fail(new PublicImageError("upstream"));
        return;
      }
      const contentType = incoming.headers["content-type"];
      const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
      const encoding = incoming.headers["content-encoding"]?.trim().toLowerCase();
      if (!contentType || !mediaType || !IMAGE_CONTENT_TYPES.has(mediaType) || (encoding && encoding !== "identity")) {
        fail(new PublicImageError("content"));
        return;
      }
      const lengthHeader = incoming.headers["content-length"];
      const expectedSize = lengthHeader === undefined ? undefined : Number(lengthHeader);
      if (lengthHeader !== undefined && (!/^\d+$/.test(lengthHeader) || !Number.isSafeInteger(expectedSize))) {
        fail(new PublicImageError("upstream"));
        return;
      }
      if (expectedSize !== undefined && expectedSize > MAX_IMAGE_BYTES) {
        fail(new PublicImageError("size"));
        return;
      }
      incoming.on("data", (chunk: unknown) => {
        if (settled) return;
        if (!(chunk instanceof Uint8Array)) {
          fail(new PublicImageError("upstream"));
          return;
        }
        if (chunk.byteLength > MAX_IMAGE_BYTES - size) {
          fail(new PublicImageError("size"));
          return;
        }
        if (size + chunk.byteLength > body.byteLength) {
          const capacity = Math.min(MAX_IMAGE_BYTES, Math.max(64 * 1024, body.byteLength * 2, size + chunk.byteLength));
          const expanded = new Uint8Array(capacity);
          expanded.set(body.subarray(0, size));
          body = expanded;
        }
        body.set(chunk, size);
        size += chunk.byteLength;
      });
      incoming.once("end", () => {
        if (settled) return;
        if (size === 0) {
          fail(new PublicImageError("content"));
          return;
        }
        if (expectedSize !== undefined && size !== expectedSize) {
          fail(new PublicImageError("upstream"));
          return;
        }
        settled = true;
        cleanup();
        resolve({ kind: "image", image: { body: body.subarray(0, size), contentType } });
      });
    };
    try {
      request = target.url.protocol === "https:"
        ? httpsRequest(target.url, options, receive)
        : httpRequest(target.url, options, receive);
      request.on("error", () => fail(new PublicImageError("upstream")));
      request.once("close", () => {
        if (!response) fail(new PublicImageError("upstream"));
      });
      if (settled) request.destroy();
      else request.end();
    } catch (error) {
      fail(error instanceof PublicImageError ? error : new PublicImageError("upstream"));
    }
  });
}

export async function fetchPublicImage(rawUrl: string, signal: AbortSignal): Promise<PublicImage> {
  if (signal.aborted) throw new PublicImageError("aborted");
  const controller = new AbortController();
  const onAbort = () => controller.abort(new PublicImageError("aborted"));
  signal.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(new PublicImageError("timeout")), TOTAL_TIMEOUT_MS);
  let nextUrl = rawUrl;
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const target = await resolvePublicImageTarget(nextUrl, controller.signal);
      const result = await requestImage(target, controller.signal);
      switch (result.kind) {
        case "image":
          return result.image;
        case "redirect":
          if (redirects === MAX_REDIRECTS) throw new PublicImageError("upstream");
          nextUrl = new URL(result.location, target.url).href;
          break;
        default: {
          const unreachable: never = result;
          return unreachable;
        }
      }
    }
    throw new PublicImageError("upstream");
  } catch (error) {
    if (controller.signal.aborted) throw publicImageAbortError(controller.signal);
    if (error instanceof PublicImageError) throw error;
    throw new PublicImageError("upstream");
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", onAbort);
  }
}
