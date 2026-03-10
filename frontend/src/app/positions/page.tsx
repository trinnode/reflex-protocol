"use client";

import { useState, useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import Image from "next/image";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Badge from "@/components/ui/Badge";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import OpenPositionModal from "@/components/position/OpenPositionModal";

import { useReactivitySubscription } from "@/hooks/useReactivitySubscription";
import { usePosition } from "@/hooks/usePosition";
import { VAULT_ADDRESS } from "@/lib/contracts";
import { somniaTestnet } from "@/lib/wagmi";
import styles from "./page.module.css";

export default function PositionsPage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { toasts, show: showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isCorrectChain = chain?.id === somniaTestnet.id;

  const { events, isConnected: wsConnected } = useReactivitySubscription({
    emitterFilter: VAULT_ADDRESS,
    enabled: !!address && isCorrectChain,
  });

  const {
    position,
    isLoading: positionLoading,
    openPosition,
    closePosition,
    topUpCollateral,
    monitoring,
    isPending,
    txError,
  } = usePosition(events);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");

  useEffect(() => {
    if (txError) {
      showToast(txError.slice(0, 120), "error");
    }
  }, [txError, showToast]);

  const ratio = position
    ? position.debt > 0n
      ? Number((position.collateral * 100n) / position.debt)
      : 999
    : 0;

  const collateralFormatted = position ? formatEther(position.collateral) : "0";
  const debtFormatted = position ? formatEther(position.debt) : "0";

  function handleOpenPosition(collateral: string, debt: string, protectionRatio: number) {
    openPosition(collateral, debt, protectionRatio);
    setIsModalOpen(false);
    showToast("Open position transaction submitted", "info");
  }

  function handleClosePosition() {
    closePosition();
    showToast("Close position transaction submitted", "info");
  }

  function handleTopUpCollateral() {
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    topUpCollateral(topUpAmount);
    setTopUpAmount("");
    showToast("Collateral top up submitted", "info");
  }

  function getRatioColor(): string {
    if (!position) return "var(--color-text-muted)";
    if (ratio >= 150) return "var(--color-success)";
    if (ratio >= 130) return "var(--color-warn)";
    return "var(--color-danger)";
  }

  function getRatioLabel(): string {
    if (!position) return "No Active Position";
    if (ratio >= 150) return "Healthy";
    if (ratio >= 130) return "Warning";
    return "Critical";
  }

  // Guard: not connected
  if (mounted && !isConnected) {
    return (
      <div className={styles.shell}>
        <Sidebar activeNav="Positions" />
        <div className={styles.guard}>
          <div className={styles.guardVisual}>
            <div className={styles.guardRing} />
            <Image src="/logo.svg" alt="REFLEX" width={40} height={40} priority />
          </div>
          <h2 className={styles.guardTitle}>Connect Your Wallet</h2>
          <p className={styles.guardText}>
            Connect your wallet to view and manage your collateral positions.
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

  // Guard: wrong chain
  if (!isCorrectChain) {
    return (
      <div className={styles.shell}>
        <Sidebar activeNav="Positions" />
        <div className={styles.guard}>
          <div className={styles.guardVisual}>
            <div className={styles.guardRing} />
            <Image src="/logo.svg" alt="REFLEX" width={40} height={40} priority />
          </div>
          <h2 className={styles.guardTitle}>Wrong Network</h2>
          <p className={styles.guardText}>
            Please switch to Somnia Testnet to manage your positions.
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
      <Sidebar activeNav="Positions" />
      <div className={styles.main}>
        <TopBar />
        <div className={styles.content}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Positions</h1>
              <p className={styles.pageDesc}>
                Manage your collateral positions, monitor health ratios, and support the shared protocol monitoring pool.
              </p>
            </div>
            {!position && (
              <button className={styles.btnOpen} onClick={() => setIsModalOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Open Position
              </button>
            )}
          </div>

          {positionLoading ? (
            <div className={styles.loadingGrid}>
              <div className={styles.skeletonCard}>
                <div className={styles.skeletonLine} style={{ width: "60%" }} />
                <div className={styles.skeletonLine} style={{ width: "40%" }} />
                <div className={styles.skeletonLine} style={{ width: "80%" }} />
              </div>
              <div className={styles.skeletonCard}>
                <div className={styles.skeletonLine} style={{ width: "50%" }} />
                <div className={styles.skeletonLine} style={{ width: "70%" }} />
              </div>
            </div>
          ) : position ? (
            <>
              {/* Status Cards */}
              <div className={styles.statusGrid}>
                <div className={styles.statusCard}>
                  <span className={styles.statusLabel}>Collateral Deposited</span>
                  <span className={styles.statusValue}>{parseFloat(collateralFormatted).toFixed(4)} STT</span>
                  <span className={styles.statusFooter}>Total locked collateral</span>
                </div>
                <div className={styles.statusCard}>
                  <span className={styles.statusLabel}>Outstanding Debt</span>
                  <span className={styles.statusValue}>{parseFloat(debtFormatted).toFixed(4)} STT</span>
                  <span className={styles.statusFooter}>Total borrowed amount</span>
                </div>
                <div className={styles.statusCard}>
                  <span className={styles.statusLabel}>Health Ratio</span>
                  <span className={styles.statusValue} style={{ color: getRatioColor() }}>
                    {ratio}%
                  </span>
                  <span className={styles.statusFooter}>
                    <Badge
                      variant={ratio >= 150 ? "success" : ratio >= 130 ? "neutral" : "neutral"}
                      glow={ratio >= 150}
                    >
                      {getRatioLabel()}
                    </Badge>
                  </span>
                </div>
                <div className={styles.statusCard}>
                  <span className={styles.statusLabel}>Protection Threshold</span>
                  <span className={styles.statusValue}>{Number(position.protectionRatio)}%</span>
                  <span className={styles.statusFooter}>Auto trigger ratio</span>
                </div>
              </div>

              {/* Ratio Visual Bar */}
              <div className={styles.ratioCard}>
                <div className={styles.ratioHeader}>
                  <span className={styles.ratioTitle}>Collateral Health</span>
                  <div className={styles.ratioLegend}>
                    <span className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: "var(--color-danger)" }} />
                      Critical
                    </span>
                    <span className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: "var(--color-warn)" }} />
                      Warning
                    </span>
                    <span className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: "var(--color-success)" }} />
                      Healthy
                    </span>
                  </div>
                </div>
                <div className={styles.ratioBarWrap}>
                  <div className={styles.ratioBarBg}>
                    <div
                      className={styles.ratioBarFill}
                      style={{
                        width: `${Math.min(ratio / 2, 100)}%`,
                        background: getRatioColor(),
                      }}
                    />
                  </div>
                  <div className={styles.ratioMarkers}>
                    <span className={styles.ratioMarker} style={{ left: `${Number(position.protectionRatio) / 2}%` }}>
                      {Number(position.protectionRatio)}%
                    </span>
                    <span className={styles.ratioMarker} style={{ left: "65%" }}>130%</span>
                    <span className={styles.ratioMarker} style={{ left: "75%" }}>150%</span>
                  </div>
                </div>
                <div className={styles.ratioCurrent}>
                  Current Ratio: <strong style={{ color: getRatioColor() }}>{ratio}%</strong>
                </div>
              </div>

              {/* Actions Grid */}
              <div className={styles.actionsGrid}>
                {/* Top Up Collateral */}
                <div className={styles.actionCard}>
                  <h3 className={styles.actionTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Collateral
                  </h3>
                  <p className={styles.actionDesc}>
                    Increase your collateral to improve your health ratio and reduce liquidation risk.
                  </p>
                  <div className={styles.actionInput}>
                    <input
                      type="number"
                      placeholder="Amount in STT"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className={styles.input}
                      min="0"
                      step="0.01"
                    />
                    <button
                      className={styles.btnAction}
                      onClick={handleTopUpCollateral}
                      disabled={isPending}
                    >
                      {isPending ? "Processing..." : "Top Up"}
                    </button>
                  </div>
                </div>

                <div className={styles.actionCard}>
                  <h3 className={styles.actionTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                      <path d="M21 3v6h-6" />
                    </svg>
                    Shared Monitoring
                  </h3>
                  <p className={styles.actionDesc}>
                    Monitoring is managed through a protocol-wide Somnia subscription configured by the operator.
                  </p>
                  {monitoring && (
                    <p className={styles.actionDesc}>
                      Shared monitor #{monitoring.subscriptionId.toString()} is {monitoring.active ? "active" : "inactive"}.
                    </p>
                  )}
                </div>

                {/* Close Position */}
                <div className={styles.actionCardDanger}>
                  <h3 className={styles.actionTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    Close Position
                  </h3>
                  <p className={styles.actionDesc}>
                    Close your current position and withdraw all remaining collateral back to your wallet.
                  </p>
                  <button
                    className={styles.btnDanger}
                    onClick={handleClosePosition}
                    disabled={isPending}
                  >
                    {isPending ? "Processing..." : "Close Position"}
                  </button>
                </div>
              </div>

              {/* Position Details */}
              <div className={styles.detailsCard}>
                <h3 className={styles.detailsTitle}>Position Details</h3>
                <div className={styles.detailsGrid}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Status</span>
                    <Badge variant="success" glow>ACTIVE</Badge>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Wallet</span>
                    <span className={styles.detailValue}>{address?.slice(0, 8)}...{address?.slice(-6)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Monitoring ID</span>
                    <span className={styles.detailValue}>{position.subscriptionId.toString()}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Opened At</span>
                    <span className={styles.detailValue}>
                      {new Date(Number(position.openedAt) * 1000).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Monitoring</span>
                    <span className={styles.detailValue}>
                      {wsConnected && monitoring?.active ? (
                        <Badge variant="success" glow>Live</Badge>
                      ) : (
                        <Badge variant="neutral">Connecting...</Badge>
                      )}
                    </span>
                  </div>
                  {monitoring && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Subscription State</span>
                      <span className={styles.detailValue}>{monitoring.active ? "Configured" : "Inactive"}</span>
                    </div>
                  )}
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Reactive Events</span>
                    <span className={styles.detailValue}>{events.length} received</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className={styles.emptyState}>
              <div className={styles.emptyVisual}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2 className={styles.emptyTitle}>No Active Position</h2>
              <p className={styles.emptyText}>
                You don&apos;t have an active position yet. Open one to start earning with
                autonomous protection powered by Somnia Reactivity.
              </p>
              <button className={styles.btnOpen} onClick={() => setIsModalOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Open Your First Position
              </button>
            </div>
          )}
        </div>
      </div>

      <OpenPositionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleOpenPosition}
        isLoading={isPending}
        error={txError}
      />
      <ToastContainer toasts={toasts} />
    </div>
  );
}
