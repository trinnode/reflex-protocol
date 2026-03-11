import type { Metadata } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import Web3Provider from "@/providers/Web3Provider";
import { config } from "@/lib/wagmi";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "REFLEX Protocol — Autonomous DeFi Protection",
  description:
    "Autonomous DeFi Position Protection powered by Somnia Reactivity. Real-time collateral monitoring with sub-second response.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read wagmi connection state from cookies so it survives page navigation.
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";
  const initialState = cookieToInitialState(config, cookie);

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Animated Background */}
        <div className="appBackground" aria-hidden="true">
          <div className="orbPurple" />
          <div className="orbBlue" />
          <div className="orbPink" />
        </div>
        <div className="gridOverlay" aria-hidden="true" />

        <Web3Provider initialState={initialState}>{children}</Web3Provider>
      </body>
    </html>
  );
}
