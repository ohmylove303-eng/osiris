import type { Metadata, Viewport } from "next";
import ErrorBoundary from '@/components/ErrorBoundary';
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://grew-gym-arrow-workflow.trycloudflare.com";
const SITE_NAME = "번개의 눈동자";
const SITE_TITLE = "번개의 눈동자 (LIGHTNING EYE) — 전 세계 실시간 관제 · OSINT";
const SITE_DESCRIPTION = "항공기·위성·함정·CCTV·OSINT 피드를 한 지도에서 관측하는 실시간 관제 HUD.";

export const viewport: Viewport = {
  themeColor: "#FFD700",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | 번개의 눈동자",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    // OSINT Tools - Primary focus
    "OSINT tools", "free OSINT tools", "online OSINT toolkit", "OSINT framework",
    "nmap online", "nmap scanner online", "free nmap scan", "port scanner online",
    "DNS lookup tool", "WHOIS lookup", "reverse DNS", "DNS records",
    "SSL certificate checker", "certificate transparency", "cert lookup",
    "BGP routing lookup", "ASN lookup", "IP geolocation",
    "threat intelligence", "threat intel lookup", "IP reputation check",
    "network reconnaissance", "recon tools", "penetration testing tools",
    "cybersecurity tools", "infosec tools", "security scanner",
    "linux OSINT tools", "kali linux tools online", "OSINT browser tools",
    
    // Intelligence Platform
    "OSINT", "open source intelligence", "intelligence platform", "global intelligence",
    "geospatial intelligence", "GEOINT", "SIGINT", "real-time tracking",
    "palantir alternative", "open source palantir", "intelligence dashboard",
    
    // Tracking & Data
    "flight tracker", "aircraft tracking", "ADS-B tracker", "live flight radar",
    "satellite tracking", "ISS tracker", "space station tracker",
    "CCTV cameras live", "security cameras worldwide", "live cameras",
    "earthquake monitor", "seismic activity", "USGS earthquake",
    "wildfire tracker", "NASA FIRMS", "active fires",
    "nuclear facilities map", "nuclear power plants",
    "severe weather alerts", "weather radar",
    "cyber threats dashboard", "CVE tracker",
    "space weather", "solar storm", "GPS jamming",
    "defense stocks", "commodities tracker",
    
    // Brand
    "번개의 눈동자", "lightning eye", "lightningeye",
  ],
  authors: [{ name: "번개의 눈동자", url: SITE_URL }],
  creator: "번개의 눈동자",
  publisher: "번개의 눈동자",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg?v=lightning_v5", type: "image/svg+xml" },
      { url: "/favicon-32x32.png?v=lightning_v5", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png?v=lightning_v5", type: "image/png", sizes: "16x16" },
      { url: "/android-chrome-192x192.png?v=lightning_v5", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png?v=lightning_v5", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=lightning_v5", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico?v=lightning_v5",
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/apple-touch-icon.png?v=lightning_v5",
      },
    ],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "번개의 눈동자 (LIGHTNING EYE) — 실시간 관제 · OSINT",
    description: "Live flights, satellites & CCTV with browser OSINT tools. Observational intel HUD.",
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-image.png?v=lightning_v5`,
        width: 1024,
        height: 1024,
        alt: "번개의 눈동자 (LIGHTNING EYE) — 실시간 관제·OSINT 플랫폼",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "번개의 눈동자 (LIGHTNING EYE) — 실시간 관제 · OSINT",
    description: "Live flights, satellites & CCTV with browser OSINT tools. Observational intel HUD.",
    creator: "@lightningeye",
    site: "@lightningeye",
    images: [`${SITE_URL}/og-image.png?v=lightning_v5`],
  },
  category: "technology",
  classification: "Intelligence & Security",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "번개의 눈동자",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#06060C",
    "msapplication-config": "none",
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "번개의 눈동자 (LIGHTNING EYE) — OSINT Toolkit & Intelligence Platform",
  alternateName: ["번개의 눈동자", "Lightning Eye", "Lightning Eye Intelligence"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires a modern web browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  featureList: [
    "Nmap port scanning from the browser — no install required",
    "DNS record lookup (A, AAAA, MX, NS, TXT, CNAME)",
    "WHOIS domain registration lookup",
    "SSL/TLS certificate transparency search",
    "BGP routing & ASN lookup",
    "IP geolocation & threat intelligence",
    "Real-time flight tracking (10,000+ aircraft via ADS-B)",
    "Satellite tracking (2,000+ objects including ISS)",
    "Worldwide CCTV camera monitoring (1,400+ feeds)",
    "Earthquake monitoring (USGS live feed)",
    "Wildfire detection (NASA FIRMS satellite data)",
    "Nuclear facility mapping (worldwide)",
    "Severe weather alerts & tracking",
    "Cyber threat & CVE intelligence",
    "Space weather & solar storm monitoring",
    "GPS jamming detection",
    "Defense & commodity market tracking",
    "SIGINT news aggregation feed",
    "Interactive 3D globe with day/night cycle",
    "Region intelligence dossier reports",
  ],
  screenshot: `${SITE_URL}/og-image.png`,
  author: {
    "@type": "Organization",
    name: "번개의 눈동자",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" dir="ltr" className="notranslate" translate="no" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=lightning_v3" />
        <link rel="icon" href="/favicon.ico?v=lightning_v3" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=lightning_v3" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=lightning_v3" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=lightning_v3" />
        <link rel="canonical" href={SITE_URL} />
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ErrorBoundary name="번개의 눈동자 코어">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
