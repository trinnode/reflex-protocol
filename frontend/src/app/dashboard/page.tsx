"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useSwitchChain,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther, formatEther } from "viem";
import Image from "next/image";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Badge from "@/components/ui/Badge";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import PositionPanel, {
  PositionEmpty,
} from "@/components/position/PositionPanel";
import OpenPositionModal from "@/components/position/OpenPositionModal";
import { PriceFeedWidget } from "@/components/feed";
import type { PriceEntry } from "@/components/feed";
import { ReactivityEventLog } from "@/components/feed";
import type { ReactivityEvent as FeedEvent } from "@/components/feed";

import { useReactivitySubscription } from "@/hooks/useReactivitySubscription";
import { usePosition } from "@/hooks/usePosition";
import { useOraclePrice } from "@/hooks/useOraclePrice";
import {
  VAULT_ADDRESS,
  INSURANCE_ADDRESS,
  INSURANCE_ABI,
  PRICE_UPDATED_TOPIC,
} from "@/lib/contracts";
import { somniaTestnet } from "@/lib/wagmi";
import styles from "./page.module.css";

function deriveChange(
  prev: bigint | undefined,
  current: bigint
): "up" | "down" | "same" {
  if (prev === undefined) return "same";
  if (current > prev) return "up";
  if (current < prev) return "down";
  return "same";
}

export default function DashboardPage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { toasts, show: showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isCorrectChain = chain?.id === somniaTestnet.id;

  // ── Reactivity subscription ───────────────────────────
  const { events, isConnected: wsConnected } = useReactivitySubscription({
    emitterFilter: VAULT_ADDRESS,
    enabled: !!address && isCorrectChain,
  });

  // ── Position hook ─────────────────────────────────────
  const {
    position,
    isLoading: positionLoading,
    openPosition,
    closePosition,
    topUpCollateral,
    monitoring,
    isPending,
    txError,
    refetch: refetchPosition,
  } = usePosition(events);

  // ── Insurance reads ───────────────────────────────────
  const { data: isInsured } = useReadContract({
    address: INSURANCE_ADDRESS,
    abi: INSURANCE_ABI,
    functionName: "insured",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isCorrectChain },
  });

  const { data: coverageRaw } = useReadContract({
    address: INSURANCE_ADDRESS,
    abi: INSURANCE_ABI,
    functionName: "coverageAmount",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isCorrectChain },
  });

  const coverage = coverageRaw ? formatEther(coverageRaw as bigint) : "0";

  // ── Oracle price (on-chain) ───────────────────────────
  const oraclePrice = useOraclePrice();

  // ── Insurance write ───────────────────────────────────
  const { writeContract: writeInsurance } = useWriteContract();

  function handleBuyCoverage() {
    writeInsurance({
      address: INSURANCE_ADDRESS,
      abi: INSURANCE_ABI,
      functionName: "purchaseCoverage",
      args: [parseEther("10")],
      value: parseEther("1"),
    });
    showToast("Coverage purchase submitted", "info");
  }

  // ── Tx error toast ────────────────────────────────────
  useEffect(() => {
    if (txError) {
      showToast(txError.slice(0, 120), "error");
    }
  }, [txError, showToast]);

  // ── Derive price entries from oracle + reactivity events ─
  const [prevPrices, setPrevPrices] = useState<Map<string, bigint>>(new Map());

  const priceEntries: PriceEntry[] = useMemo(() => {
    // Always include the on-chain oracle price as the primary source.
    const entries: PriceEntry[] = [];

    if (oraclePrice.priceRaw > 0n) {
      const prev = prevPrices.get("STT/USD");
      entries.push({
        asset: "STT/USD",
        price: oraclePrice.priceRaw,
        updatedAt: oraclePrice.lastUpdatedAt,
        changed: deriveChange(prev, oraclePrice.priceRaw),
      });
    } else {
      // Fallback: derive from reactivity WebSocket events if oracle read fails.
      const priceEvents = events.filter(
        (e) =>
          e.topics[0]?.toLowerCase() === PRICE_UPDATED_TOPIC.toLowerCase()
      );

      const latestMap = new Map<string, { price: bigint; ts: number }>();
      for (const evt of priceEvents) {
        const emitter = evt.emitter;
        if (!latestMap.has(emitter)) {
          try {
            const priceHex =
              evt.data.length >= 66 ? evt.data.slice(0, 66) : evt.data;
            const price = BigInt(priceHex);
            latestMap.set(emitter, { price, ts: evt.timestamp });
          } catch {
            // skip unparseable
          }
        }
      }

      latestMap.forEach(({ price, ts }, emitter) => {
        const prev = prevPrices.get(emitter);
        entries.push({
          asset: "STT/USD",
          price,
          updatedAt: ts,
          changed: deriveChange(prev, price),
        });
      });
    }

    return entries;
  }, [events, prevPrices, oraclePrice.priceRaw, oraclePrice.lastUpdatedAt]);

  useEffect(() => {
    if (priceEntries.length > 0) {
      const map = new Map<string, bigint>();
      priceEntries.forEach((e) => map.set(e.asset, e.price));
      setPrevPrices(map);
    }
  }, [priceEntries]);

  // ── Map reactivity events to feed event format ────────
  const feedEvents: FeedEvent[] = useMemo(() => {
    return events.map((evt) => {
      let type: FeedEvent["type"] = "PRICE_UPDATE";
      if (
        evt.topics[0]?.toLowerCase() === PRICE_UPDATED_TOPIC.toLowerCase()
      ) {
        type = "PRICE_UPDATE";
      }
      return {
        id: evt.id,
        type,
        timestamp: evt.timestamp,
        txHash: null,
        details: `From ${evt.emitter.slice(0, 8)}…`,
      };
    });
  }, [events]);

  // ── Modal state ───────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);

  function handleOpenPosition(
    collateral: string,
    debt: string,
    protectionRatio: number
  ) {
    openPosition(collateral, debt, protectionRatio);
    setIsModalOpen(false);
    showToast("Open position tx submitted", "info");
  }

  function handleClosePosition() {
    closePosition();
    showToast("Close position tx submitted", "info");
  }

  // ── Position panel data ───────────────────────────────
  const ratio = position
    ? position.debt > 0n
      ? Number((position.collateral * 100n) / position.debt)
      : 999
    : 0;

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════

  if (mounted && !isConnected) {
    return (
      <div className={styles.shell}>
        <Sidebar />
        <div className={styles.guard}>
          <div className={styles.guardVisual}>
            <div className={styles.guardRing} />
            <Image
              src="/logo.svg"
              alt="REFLEX"
              width={40}
              height={40}
              priority
            />
          </div>
          <h2 className={styles.guardTitle}>Connect Your Wallet</h2>
          <p className={styles.guardText}>
            Connect your wallet to access the REFLEX dashboard and manage your positions.
          </p>
          <ConnectButton.Custom>
            {({ openConnectModal: openModal, mounted: rkMounted }) => (
              <button
                className={styles.btnConnect}
                onClick={openModal}
                disabled={!rkMounted}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M22 10H2" />
                  <path d="M6 14h2" />
                </svg>
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
          <a href="/" className={styles.guardHomeLink}>Back to Home</a>
        </div>
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div className={styles.shell}>
        <Sidebar />
        <div className={styles.guard}>
          <div className={styles.guardVisual}>
            <div className={styles.guardRing} />
            <Image
              src="/logo.svg"
              alt="REFLEX"
              width={40}
              height={40}
              priority
            />
          </div>
          <h2 className={styles.guardTitle}>Wrong Network</h2>
          <p className={styles.guardText}>
            Please switch to Somnia Testnet to use REFLEX Protocol.
          </p>
          <button
            className={styles.btnSwitch}
            onClick={() => switchChain({ chainId: somniaTestnet.id })}
          >
            Switch to Somnia Testnet
          </button>
          <a href="/" className={styles.guardHomeLink}>Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <Sidebar activeNav="Dashboard" />
      <div className={styles.main}>
        <TopBar />
        <div className={styles.content}>
          {/* ── Stats Row ───────────────────────────────── */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <span className={styles.statCardLabel}>Protocol</span>
              <span className={styles.statCardValue}>
                {wsConnected ? "LIVE" : "OFFLINE"}
              </span>
              <span className={styles.statCardFooter}>
                Somnia Reactivity
              </span>
              <div
                className={styles.statCardAccent}
                style={{
                  background: wsConnected
                    ? "var(--color-success)"
                    : "var(--color-text-muted)",
                }}
              />
            </div>

            <div className={styles.statCard}>
              <span className={styles.statCardLabel}>Position Status</span>
              <span className={styles.statCardValue}>
                {positionLoading
                  ? "..."
                  : position
                  ? "ACTIVE"
                  : "NONE"}
              </span>
              <span className={styles.statCardFooter}>
                {position ? "Shared monitoring active" : "Open a position to start"}
              </span>
              <div
                className={styles.statCardAccent}
                style={{
                  background: position
                    ? "var(--color-accent)"
                    : "var(--color-border)",
                }}
              />
            </div>

            <div className={styles.statCard}>
              <span className={styles.statCardLabel}>Collateral Ratio</span>
              <span
                className={styles.statCardValue}
                style={{
                  color: position
                    ? ratio >= 150
                      ? "var(--color-success)"
                      : ratio >= 130
                      ? "var(--color-warn)"
                      : "var(--color-danger)"
                    : "var(--color-text-primary)",
                }}
              >
                {position ? `${ratio}%` : "—"}
              </span>
              <span className={styles.statCardFooter}>
                {position
                  ? `Protection at ${position.protectionRatio}%`
                  : "No active position"}
              </span>
              <div
                className={styles.statCardAccent}
                style={{
                  background: position
                    ? ratio >= 150
                      ? "var(--color-success)"
                      : ratio >= 130
                      ? "var(--color-warn)"
                      : "var(--color-danger)"
                    : "var(--color-border)",
                }}
              />
            </div>

            <div className={styles.statCard}>
              <span className={styles.statCardLabel}>Insurance</span>
              <span className={styles.statCardValue}>
                {isInsured ? "COVERED" : "NONE"}
              </span>
              <span className={styles.statCardFooter}>
                {isInsured ? `${coverage} STT coverage` : "Get protection coverage"}
              </span>
              <div
                className={styles.statCardAccent}
                style={{
                  background: isInsured
                    ? "var(--color-success)"
                    : "var(--color-border)",
                }}
              />
            </div>
          </div>

          {/* ── Main Grid ──────────────────────────────── */}
          <div className={styles.grid}>
            {/* Left: Position */}
            <div className={styles.colLeft}>
              {positionLoading ? (
                <div className={styles.loadingCard}>
                  <div
                    className={`${styles.skeletonLine} ${styles.skeletonWide}`}
                  />
                  <div
                    className={`${styles.skeletonLine} ${styles.skeletonMed}`}
                  />
                  <div
                    className={`${styles.skeletonLine} ${styles.skeletonNarrow}`}
                  />
                </div>
              ) : position ? (
                <PositionPanel
                  position={{
                    collateral: position.collateral,
                    debt: position.debt,
                    ratio,
                    protectionRatio: Number(position.protectionRatio),
                    active: position.active,
                    subscriptionId: position.subscriptionId,
                  }}
                  onClose={handleClosePosition}
                  onTopUp={() => {
                    topUpCollateral("5");
                    showToast("Top-up tx submitted", "info");
                  }}
                />
              ) : (
                <PositionEmpty onOpen={() => setIsModalOpen(true)} />
              )}
            </div>

            {/* Right: Feeds */}
            <div className={styles.colRight}>
              {/* Price Feed */}
              <div className={styles.card} style={{ animationDelay: "200ms" }}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <span className={styles.cardTitleIcon}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
                        <polyline points="16,7 22,7 22,13" />
                      </svg>
                    </span>
                    Price Feed
                    {oraclePrice.isStale && !oraclePrice.isLoading && (
                      <span style={{ color: "var(--color-warn)", fontSize: "0.75rem", marginLeft: 8 }}>
                        STALE
                      </span>
                    )}
                  </span>
                  {wsConnected && (
                    <span className={styles.liveIndicator}>
                      <span className={styles.liveDot} />
                      {oraclePrice.priceRaw > 0n ? "On-chain" : "Live"}
                    </span>
                  )}
                </div>
                <PriceFeedWidget prices={priceEntries} />
              </div>

              {/* Event Log */}
              <div className={styles.card} style={{ animationDelay: "300ms" }}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <span className={styles.cardTitleIcon}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </span>
                    Reactivity Log
                  </span>
                  <span className={styles.liveIndicator}>
                    <span className={styles.liveDot} />
                    {events.length} events
                  </span>
                </div>
                <ReactivityEventLog events={feedEvents} />
              </div>
            </div>
          </div>

          {/* ── Insurance Bar ──────────────────────────── */}
          <div className={styles.insuranceCard}>
            <div className={styles.insuranceLeft}>
              <div className={styles.insuranceIcon}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className={styles.insuranceInfo}>
                <span className={styles.insuranceLabel}>
                  Insurance Coverage
                </span>
                <div className={styles.insuranceMeta}>
                  {isInsured ? (
                    <Badge variant="success" glow>
                      COVERED
                    </Badge>
                  ) : (
                    <Badge variant="neutral">NOT COVERED</Badge>
                  )}
                  <span>Automated payout on protection trigger</span>
                </div>
              </div>
            </div>

            <div className={styles.insuranceRight}>
              {isInsured && (
                <span className={styles.coverageAmount}>
                  {coverage} STT
                </span>
              )}
              {!isInsured && (
                <button
                  className={styles.btnCoverage}
                  onClick={handleBuyCoverage}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Get Coverage
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <OpenPositionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleOpenPosition}
        isLoading={isPending}
        error={txError}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
