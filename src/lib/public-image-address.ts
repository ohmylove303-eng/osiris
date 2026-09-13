import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";
import type { LookupFunction } from "node:net";

const ERROR_DETAILS = {
  invalid: [400, "Invalid image URL"],
  destination: [403, "Image URL is not allowed"],
  size: [413, "Image response exceeds the size limit"],
  content: [415, "Unsupported image response"],
  aborted: [499, "Image request cancelled"],
  upstream: [502, "Image could not be retrieved"],
  timeout: [504, "Image request timed out"],
} as const;

export class PublicImageError extends Error {
  readonly name = "PublicImageError";
  readonly status: number;

  constructor(reason: keyof typeof ERROR_DETAILS) {
    const [status, message] = ERROR_DETAILS[reason];
    super(message);
    this.status = status;
  }
}

type PublicAddress = {
  readonly address: string;
  readonly family: 4 | 6;
};

export type PublicImageTarget = {
  readonly url: URL;
  readonly hostname: string;
  readonly lookup: LookupFunction;
};

// Special-purpose ranges are excluded even when an individual anycast has an exception.
// https://www.iana.org/assignments/iana-ipv4-special-registry/
const IPV4_EXCLUSIONS = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const;

// Requiring global unicast also rejects mapped IPv4, NAT64, ULA and link-local forms.
// https://www.iana.org/assignments/iana-ipv6-special-registry/
const IPV6_EXCLUSIONS = [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16],
  ["3ffe::", 16], ["3fff::", 20],
] as const;

const excludedAddresses = new BlockList();
const globalIpv6Addresses = new BlockList();
for (const [address, prefix] of IPV4_EXCLUSIONS) {
  excludedAddresses.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of IPV6_EXCLUSIONS) {
  excludedAddresses.addSubnet(address, prefix, "ipv6");
}
globalIpv6Addresses.addSubnet("2000::", 3, "ipv6");

function parsePublicAddress(candidate: LookupAddress): PublicAddress {
  const family = isIP(candidate.address);
  if ((family !== 4 && family !== 6) || family !== candidate.family) {
    throw new PublicImageError("destination");
  }
  const type = family === 4 ? "ipv4" : "ipv6";
  if (excludedAddresses.check(candidate.address, type) ||
      (family === 6 && !globalIpv6Addresses.check(candidate.address, "ipv6"))) {
    throw new PublicImageError("destination");
  }
  return { address: candidate.address, family };
}

export function publicImageAbortError(signal: AbortSignal): PublicImageError {
  return signal.reason instanceof PublicImageError
    ? signal.reason
    : new PublicImageError("aborted");
}

async function lookupPublicAddresses(hostname: string, signal: AbortSignal): Promise<readonly PublicAddress[]> {
  if (signal.aborted) throw publicImageAbortError(signal);
  // OS lookup cannot be cancelled; settle the caller promptly and never use a late result.
  const pending = lookup(hostname, { all: true, verbatim: true });
  const records = await new Promise<readonly LookupAddress[]>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(publicImageAbortError(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    pending.then(
      (addresses) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) reject(publicImageAbortError(signal));
        else resolve(addresses);
      },
      () => {
        signal.removeEventListener("abort", onAbort);
        reject(new PublicImageError("upstream"));
      },
    );
    if (signal.aborted) onAbort();
  });
  return records.map(parsePublicAddress);
}

export async function resolvePublicImageTarget(rawUrl: string, signal: AbortSignal): Promise<PublicImageTarget> {
  if (signal.aborted) throw publicImageAbortError(signal);
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    if (error instanceof TypeError) throw new PublicImageError("invalid");
    throw error;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username || url.password || url.port) {
    throw new PublicImageError("invalid");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [parsePublicAddress({ address: hostname, family: literalFamily })]
    : await lookupPublicAddresses(hostname, signal);
  const selected = addresses.find((address) => address.family === 4) ?? addresses[0];
  if (!selected) throw new PublicImageError("upstream");
  if (signal.aborted) throw publicImageAbortError(signal);
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, [...addresses]);
    else callback(null, selected.address, selected.family);
  };
  return { url, hostname, lookup: pinnedLookup };
}
