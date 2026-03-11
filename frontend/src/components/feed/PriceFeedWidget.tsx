"use client";

import { useEffect, useRef } from "react";
import { formatEther } from "viem";
import styles from "./PriceFeedWidget.module.css";

export interface PriceEntry {
  asset: string;
  price: bigint;
  updatedAt: number;
  changed: "up" | "down" | "same";
}

interface PriceFeedWidgetProps {
  prices: PriceEntry[];
}

function formatPrice(wei: bigint): string {
  const num = parseFloat(formatEther(wei));
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const CHANGE_ICON = { up: "▲", down: "▼", same: "—" } as const;

export default function PriceFeedWidget({ prices }: PriceFeedWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Flash row on price change
  useEffect(() => {
    if (!containerRef.current) return;
    const rows = containerRef.current.querySelectorAll("[data-flash]");
    rows.forEach((row) => {
      row.classList.remove(styles.flashGreen, styles.flashRed);
      const change = row.getAttribute("data-flash");
      if (change === "up") {
        void (row as HTMLElement).offsetWidth; // reflow
        row.classList.add(styles.flashGreen);
      } else if (change === "down") {
        void (row as HTMLElement).offsetWidth;
        row.classList.add(styles.flashRed);
      }
    });
  }, [prices]);

  if (prices.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
            <polyline points="16,7 22,7 22,13" />
          </svg>
        </div>
        <span>No price data available yet</span>
        <span style={{ fontSize: '0.625rem', color: 'var(--color-text-dim)', textAlign: 'center', maxWidth: 260 }}>
          The oracle updates when a price is set on-chain. Connect to Somnia Testnet and ensure the oracle has been initialized.
        </span>
      </div>
    );
  }

  return (
    <div className={styles.widget} ref={containerRef}>
      <div className={styles.headerRow}>
        <span>Asset</span>
        <span>Price</span>
        <span>Change</span>
        <span>Updated</span>
      </div>
      {prices.map((entry) => (
        <div
          key={entry.asset}
          className={styles.row}
          data-flash={entry.changed}
        >
          <span className={styles.asset}>{entry.asset}</span>
          <span className={styles.price}>{formatPrice(entry.price)}</span>
          <span className={`${styles.change} ${styles[entry.changed]}`}>
            {CHANGE_ICON[entry.changed]}
          </span>
          <span className={styles.time}>{timeAgo(entry.updatedAt)}</span>
        </div>
      ))}
    </div>
  );
}
