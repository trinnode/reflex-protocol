"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Badge from "@/components/ui/Badge";
import styles from "./PositionPanel.module.css";
import { formatEther } from "viem";

// ── Types ────────────────────────────────────────────────

export interface PositionData {
  collateral: bigint;
  debt: bigint;
  ratio: number;
  protectionRatio: number;
  active: boolean;
  subscriptionId: bigint;
}

interface PositionPanelProps {
  position: PositionData | null;
  subscriptionBalance?: bigint;
  onTopUp: () => void;
  onClose: () => void;
}

interface PositionEmptyProps {
  onOpen: () => void;
}

// ── Constants ────────────────────────────────────────────

const MIN_COLLATERAL_RATIO = 120;
const BAR_MIN = 100;
const BAR_MAX = 300;

// ── Helpers ──────────────────────────────────────────────

function getRatioColor(ratio: number, protectionRatio: number): string {
  if (ratio < MIN_COLLATERAL_RATIO) return "var(--color-danger)";
  if (ratio < protectionRatio) return "var(--color-warn)";
  return "var(--color-success)";
}

function getRatioGradient(ratio: number, protectionRatio: number): string {
  if (ratio < MIN_COLLATERAL_RATIO)
    return "linear-gradient(90deg, #EF4444, #DC2626)";
  if (ratio < protectionRatio)
    return "linear-gradient(90deg, #F59E0B, #D97706)";
  return "linear-gradient(90deg, #10B981, #059669)";
}

function getStatusData(ratio: number, protectionRatio: number) {
  if (!ratio || ratio < MIN_COLLATERAL_RATIO)
    return { badge: <Badge variant="danger" glow>LIQUIDATED</Badge>, label: "Position at risk" };
  if (ratio < protectionRatio)
    return { badge: <Badge variant="warn" glow>AT RISK</Badge>, label: "Below protection threshold" };
  return { badge: <Badge variant="success" glow>HEALTHY</Badge>, label: "Position is safe" };
}

function ratioToPercent(ratio: number): number {
  const clamped = Math.max(BAR_MIN, Math.min(BAR_MAX, ratio));
  return ((clamped - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100;
}

function formatSTT(wei: bigint): string {
  const num = parseFloat(formatEther(wei));
  if (num === 0) return "0";
  if (num < 0.001) return "<0.001";
  return num.toFixed(3);
}

// ── PositionPanel ────────────────────────────────────────

export default function PositionPanel({
  position,
  subscriptionBalance,
  onTopUp,
  onClose,
}: PositionPanelProps) {
  const [displayedRatio, setDisplayedRatio] = useState(position?.ratio ?? 0);

  useEffect(() => {
    if (!position) return;
    const target = position.ratio;
    const start = displayedRatio;
    const duration = 900;
    const startTime = performance.now();
    let rafId: number;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedRatio(Math.round(start + (target - start) * eased));
      if (progress < 1) rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.ratio]);

  if (!position || !position.active) return null;

  const color = getRatioColor(displayedRatio, position.protectionRatio);
  const gradient = getRatioGradient(displayedRatio, position.protectionRatio);
  const status = getStatusData(displayedRatio, position.protectionRatio);
  const fillPercent = ratioToPercent(displayedRatio);
  const minPct = ratioToPercent(MIN_COLLATERAL_RATIO);
  const protPct = ratioToPercent(position.protectionRatio);

  return (
    <div className={styles.panel}>
      {/* Gradient border effect */}
      <div className={styles.panelBorder} />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerLabel}>Your Position</span>
          <span className={styles.headerSub}>{status.label}</span>
        </div>
        {status.badge}
      </div>

      {/* Ratio hero */}
      <div className={styles.ratioHero}>
        <span className={styles.ratioNumber} style={{ color }}>
          {displayedRatio}
        </span>
        <div className={styles.ratioMeta}>
          <span className={styles.ratioPercent} style={{ color }}>%</span>
          <span className={styles.ratioTag}>Collateral Ratio</span>
        </div>
      </div>

      {/* Health bar */}
      <div className={styles.healthSection}>
        <div className={styles.healthLabels}>
          <span className={styles.healthLabelDanger}>120% Liquidation</span>
          <span className={styles.healthLabelAccent}>{position.protectionRatio}% Protection</span>
        </div>
        <div className={styles.healthTrack}>
          <div
            className={styles.healthFill}
            style={{ width: `${fillPercent}%`, background: gradient }}
          />
          <div className={styles.healthGlow} style={{ width: `${fillPercent}%`, background: gradient }} />
          <div className={styles.markerLiquidation} style={{ left: `${minPct}%` }} />
          <div className={styles.markerProtection} style={{ left: `${protPct}%` }} />
        </div>
      </div>

      {/* Stats grid */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Collateral</span>
            <span className={styles.statValue}>{formatSTT(position.collateral)} <span className={styles.statUnit}>STT</span></span>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a4 4 0 00-8 0v2" />
            </svg>
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Debt</span>
            <span className={styles.statValue}>{formatSTT(position.debt)} <span className={styles.statUnit}>STT</span></span>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Protection</span>
            <span className={styles.statValue}>{position.protectionRatio}<span className={styles.statUnit}>%</span></span>
          </div>
        </div>

        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Monitoring Pool</span>
            <span className={styles.statValue}>
              {subscriptionBalance !== undefined ? `${formatSTT(subscriptionBalance)} STT` : "Active"}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.btnTopUp} onClick={onTopUp}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Top Up Collateral
        </button>
        <button className={styles.btnClose} onClick={onClose}>
          Close Position
        </button>
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────

export function PositionEmpty({ onOpen }: PositionEmptyProps) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyVisual}>
        <div className={styles.emptyRing} />
        <div className={styles.emptyRingOuter} />
        <Image src="/logo.svg" alt="RX" width={40} height={40} className={styles.emptyLogo} />
      </div>
      <div className={styles.emptyContent}>
        <span className={styles.emptyTitle}>No Active Position</span>
        <span className={styles.emptyDesc}>
          Open a position to enable autonomous on-chain protection powered by Somnia Reactivity.
        </span>
      </div>
      <button className={styles.btnOpen} onClick={onOpen}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Open Position
      </button>
    </div>
  );
}
