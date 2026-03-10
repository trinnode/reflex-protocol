"use client";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { CONTRACTS, EXPLORER_LINKS, EXPLORER_BASE } from "@/lib/contracts";
import styles from "./page.module.css";

const SECTIONS = [
  {
    id: "overview",
    title: "What is REFLEX?",
    content: `REFLEX Protocol is an autonomous DeFi position protection system built on the Somnia blockchain. It uses Somnia's unique Reactivity framework to monitor collateral positions in real time and trigger protective actions the moment conditions change, all without requiring any manual intervention, keeper bots, or off chain infrastructure.

  REFLEX now uses a protocol-funded shared monitoring subscription. When you open a position, your entire deposit stays as collateral instead of being split between collateral and a separate monitoring fee. If the price moves in a way that puts your collateral ratio at risk, the protocol automatically closes your position and returns your remaining collateral. This happens in under a second, faster than any traditional DeFi monitoring solution.`,
  },
  {
    id: "reactivity",
    title: "Somnia Reactivity",
    content: `Somnia Reactivity is a new blockchain primitive that allows smart contracts to subscribe to on chain events and react to them automatically. Unlike traditional EVM blockchains where all execution must be triggered by an external transaction, Somnia lets contracts register subscriptions that fire callbacks when specific events occur.

REFLEX uses this by subscribing once to the PriceUpdated event emitted by the PriceOracle contract. Every time the oracle price changes, the REFLEXVault contract is notified through the reactive callback. It then checks every active position to see if the collateral ratio has fallen below the user's protection threshold. If it has, the vault triggers an emergency exit and returns collateral to the user's wallet.

This approach eliminates the need for keeper networks, off chain monitoring scripts, and centralized infrastructure. Everything happens on chain with sub second latency.`,
  },
  {
    id: "positions",
    title: "Opening and Managing Positions",
    content: `To open a position, connect your wallet and navigate to the Positions page. You will need to provide three things: the collateral amount (in STT), the debt amount, and the protection ratio percentage.

The collateral is the amount of STT tokens you deposit as backing. The debt represents the amount you are borrowing against your collateral. The protection ratio is the threshold at which the protocol will automatically close your position to protect you from further losses. For example, a protection ratio of 130 means the protocol will trigger protection if your collateral to debt ratio drops below 130%.

Once your position is open, you can add more collateral at any time to improve your health ratio. If you want to help keep monitoring funded for all users, you can contribute to the shared monitoring pool from the Positions page. When you are ready to close your position, you can do so manually and receive your remaining collateral back.`,
  },
  {
    id: "insurance",
    title: "Insurance Coverage",
    content: `REFLEX also offers an optional insurance module. By purchasing coverage through the REFLEXInsurance contract, you can receive an additional payout if your position is closed due to a protection trigger.

Insurance coverage works on a per user basis. You choose a coverage amount and pay a premium. If your position triggers emergency protection, the insurance contract automatically sends the covered amount to your wallet on top of whatever collateral is returned.

Coverage is active immediately after purchase and remains valid as long as your position is open. There are no claim forms to fill out and no approval processes. The payout is fully automatic and happens in the same transaction as the protection trigger.`,
  },
  {
    id: "architecture",
    title: "Technical Architecture",
    content: `The protocol consists of three smart contracts working together:

PriceOracle: Production on chain price feed contract. It emits PriceUpdated events whenever the price changes and includes heartbeat, deviation, and updater controls for safer operation.

REFLEXVault: The core vault contract. It holds user collateral, manages positions, and handles the protocol-wide reactive subscription logic. When it receives a reactive callback from the price oracle, it iterates through active positions and checks their health ratios against the current price. Positions below their protection threshold are automatically closed.

REFLEXInsurance: An optional companion contract. Users can purchase coverage by calling purchaseCoverage with their desired amount. The insurance contract subscribes to the vault's ProtectionTriggered events and pays covered users automatically when protection fires.

All three contracts are verified on the Shannon Explorer and their source code is publicly available.`,
  },
  {
    id: "frontend",
    title: "Frontend Application",
    content: `The frontend is built with Next.js 14 using the App Router. It connects to the Somnia Testnet through RainbowKit and wagmi for wallet management, and uses viem for contract interactions.

The dashboard shows a real time view of your position status, price feeds, and reactive events. Price data streams in through a WebSocket connection to the Somnia RPC endpoint, giving you live visibility into every price update and reactive event as it happens.

The application uses a glass morphism design system with animated backgrounds, smooth transitions, and responsive layouts that work on desktop and mobile devices.`,
  },
  {
    id: "security",
    title: "Security Considerations",
    content: `REFLEX has been designed with several security measures in place:

Reentrancy Protection: All state changes happen before external calls. The vault follows the checks, effects, interactions pattern throughout.

Access Control: Only authorized contracts can trigger reactive callbacks. The vault validates the sender address before processing any reactive event.

Overflow Protection: All arithmetic uses Solidity 0.8's built in overflow checks. There are no unchecked blocks in critical financial calculations.

Emergency Controls: The contract owner can pause the protocol in case of emergency. This is a safeguard for the testnet deployment only.

Note: This is a hackathon project deployed on testnet. While we have taken security seriously, the contracts have not been formally audited and should not be used with real funds.`,
  },
];

export default function DocsPage() {
  return (
    <div className={styles.shell}>
      <Sidebar activeNav="Docs" />
      <div className={styles.main}>
        <TopBar />
        <div className={styles.content}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Documentation</h1>
            <p className={styles.pageDesc}>
              Everything you need to know about REFLEX Protocol, from getting started
              to understanding the technical architecture.
            </p>
          </div>

          {/* Table of Contents */}
          <div className={styles.tocCard}>
            <h3 className={styles.tocTitle}>Contents</h3>
            <nav className={styles.tocNav}>
              {SECTIONS.map((section) => (
                <a key={section.id} href={`#${section.id}`} className={styles.tocLink}>
                  {section.title}
                </a>
              ))}
              <a href="#contracts" className={styles.tocLink}>Deployed Contracts</a>
            </nav>
          </div>

          {/* Content Sections */}
          {SECTIONS.map((section, i) => (
            <article
              key={section.id}
              id={section.id}
              className={styles.article}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <h2 className={styles.articleTitle}>{section.title}</h2>
              <div className={styles.articleContent}>
                {section.content.split("\n\n").map((paragraph, j) => (
                  <p key={j} className={styles.articleParagraph}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}

          {/* Deployed Contracts */}
          <article id="contracts" className={styles.article}>
            <h2 className={styles.articleTitle}>Deployed Contracts</h2>
            <p className={styles.articleParagraph}>
              All contracts are deployed and verified on the Somnia Shannon Testnet (Chain ID: 50312).
            </p>
            <div className={styles.contractsTable}>
              <div className={styles.contractRow} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <span className={styles.contractHeader}>Contract</span>
                <span className={styles.contractHeader}>Address</span>
                <span className={styles.contractHeader}>Explorer</span>
              </div>
              {Object.entries(CONTRACTS).map(([name, address]) => (
                <div key={name} className={styles.contractRow}>
                  <span className={styles.contractName}>{name}</span>
                  <span className={styles.contractAddr}>
                    {address.slice(0, 10)}...{address.slice(-8)}
                  </span>
                  {EXPLORER_LINKS[name as keyof typeof EXPLORER_LINKS] ? (
                    <a
                      href={EXPLORER_LINKS[name as keyof typeof EXPLORER_LINKS]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.contractLink}
                    >
                      View Source
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                        <polyline points="15,3 21,3 21,9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  ) : (
                    <span className={styles.contractAddr}>Precompile</span>
                  )}
                </div>
              ))}
            </div>
          </article>

          {/* Quick Links */}
          <div className={styles.quickLinks}>
            <a href="/dashboard" className={styles.quickLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Go to Dashboard
            </a>
            <a href="/positions" className={styles.quickLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Manage Positions
            </a>
            <a href="/insurance" className={styles.quickLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Get Insurance
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.quickLink}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
              </svg>
              Source Code
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
