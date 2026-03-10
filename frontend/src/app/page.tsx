"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { CONTRACTS, EXPLORER_LINKS } from "@/lib/contracts";
import styles from "./page.module.css";

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: "Sub Second Reactivity",
    description:
      "Somnia's reactive primitives let REFLEX respond to price changes in under a second. No keepers, no bots, no delays. Your position is protected the moment conditions change.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Autonomous Protection",
    description:
      "Set your protection ratio once and walk away. The protocol watches your collateral ratio around the clock and triggers protective actions without any manual intervention.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
    title: "Built In Insurance",
    description:
      "Optional coverage protects you even when markets move faster than expected. Purchase a policy and receive automatic payouts if your position triggers emergency protection.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
        <polyline points="16,7 22,7 22,13" />
      </svg>
    ),
    title: "Live Price Feeds",
    description:
      "Watch real time price data stream directly into your dashboard through Somnia's reactive event system. Every price update is transparent, verifiable, and instant.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12,6 12,12 16,14" />
      </svg>
    ),
    title: "Zero Downtime Monitoring",
    description:
      "There is no off switch. Your positions are monitored continuously through on chain reactive subscriptions that persist across blocks, sessions, and network conditions.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56" />
        <path d="M21 3v6h-6" />
      </svg>
    ),
    title: "Fully On Chain Logic",
    description:
      "Every decision, from monitoring to triggering protection, happens entirely on chain. No off chain infrastructure, no centralized servers, no trust assumptions beyond the smart contracts.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Connect Your Wallet",
    description:
      "Link your wallet to the Somnia Testnet. REFLEX works with any EVM compatible wallet including MetaMask, Rabby, and WalletConnect enabled wallets.",
  },
  {
    number: "02",
    title: "Open a Position",
    description:
      "Deposit collateral and set your desired protection ratio. The protocol-wide monitoring subscription is already funded, so your full deposit stays in your position.",
  },
  {
    number: "03",
    title: "Stay Protected Automatically",
    description:
      "REFLEX watches your collateral ratio in real time. If the ratio drops below your threshold, the protocol triggers protective action autonomously, no manual steps required.",
  },
];

const COMPARISONS = [
  {
    aspect: "Response Time",
    traditional: "Seconds to minutes depending on gas, mempool, and keeper availability",
    reflex: "Sub second. Reactive handler fires in the same block as the price update",
  },
  {
    aspect: "Trust Model",
    traditional: "Requires trusting keeper operators, their uptime, and their funding",
    reflex: "Trustless. The blockchain protocol itself triggers the protection logic",
  },
  {
    aspect: "MEV Exposure",
    traditional: "Keeper transactions are visible in the mempool and can be frontrun",
    reflex: "No mempool. Reactive execution is part of block production itself",
  },
  {
    aspect: "Infrastructure",
    traditional: "Off chain bots, servers, monitoring scripts, and funding wallets",
    reflex: "Zero off chain infrastructure. Everything lives in the smart contract",
  },
  {
    aspect: "Composability",
    traditional: "Each protocol needs its own separate keeper network",
    reflex: "Reactive events can chain across contracts within a single block",
  },
];

const ARCHITECTURE_FLOW = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
        <polyline points="16,7 22,7 22,13" />
      </svg>
    ),
    label: "Price Oracle",
    description: "Emits PriceUpdated events when the asset price changes on chain",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    label: "Reactivity Precompile",
    description: "Detects the event and triggers the vault's handler in the same block",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3" />
      </svg>
    ),
    label: "REFLEX Vault",
    description: "Checks your collateral ratio and triggers protection if below threshold",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: "Insurance Payout",
    description: "Reactive chain fires again and sends insurance coverage to your wallet",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={styles.landing}>
      {/* Navigation Bar */}
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <div className={styles.navBrand}>
            <div className={styles.logoMark}>
              <Image src="/logo.svg" alt="REFLEX" width={28} height={28} priority />
            </div>
            <div className={styles.logoText}>
              <span className={styles.brandName}>REFLEX</span>
              <span className={styles.brandTag}>PROTOCOL</span>
            </div>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#how-it-works" className={styles.navLink}>How It Works</a>
            <a href="#architecture" className={styles.navLink}>Architecture</a>
            <a href="#contracts" className={styles.navLink}>Contracts</a>
            <a href="/docs" className={styles.navLink}>Docs</a>
          </div>
          <div className={styles.navActions}>
            {mounted && isConnected ? (
              <button className={styles.btnLaunch} onClick={() => router.push("/dashboard")}>
                Launch App
              </button>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted: rkMounted, authenticationStatus }) => {
                  const ready = rkMounted && authenticationStatus !== "loading";
                  const canOpen = ready && !!openConnectModal;
                  return (
                    <button
                      className={styles.btnLaunch}
                      onClick={() => openConnectModal?.()}
                      disabled={!canOpen}
                      style={{ opacity: canOpen ? 1 : 0.5 }}
                    >
                      Connect Wallet
                    </button>
                  );
                }}
              </ConnectButton.Custom>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Built on Somnia Reactivity
          </div>
          <h1 className={styles.heroTitle}>
            Autonomous DeFi
            <br />
            <span className={styles.heroTitleAccent}>Position Protection</span>
          </h1>
          <p className={styles.heroSubtitle}>
            REFLEX monitors your collateral positions in real time and triggers protective
            actions autonomously when conditions change. Powered by Somnia&apos;s
            sub second reactive primitives, your assets are always watched, always protected, without charging a separate monitoring deposit per position.
          </p>
          <div className={styles.heroCtas}>
            {mounted && isConnected ? (
              <button className={styles.btnPrimary} onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </button>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted: rkMounted, authenticationStatus }) => {
                  const ready = rkMounted && authenticationStatus !== "loading";
                  const canOpen = ready && !!openConnectModal;
                  return (
                    <button
                      className={styles.btnPrimary}
                      onClick={() => openConnectModal?.()}
                      disabled={!canOpen}
                      style={{ opacity: canOpen ? 1 : 0.6 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <path d="M22 10H2" />
                        <path d="M6 14h2" />
                      </svg>
                      Connect Wallet
                    </button>
                  );
                }}
              </ConnectButton.Custom>
            )}
            <a href="/docs" className={styles.btnSecondary}>
              Read the Docs
            </a>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>{"<1s"}</span>
              <span className={styles.heroStatLabel}>Response Time</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>100%</span>
              <span className={styles.heroStatLabel}>On Chain</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>24/7</span>
              <span className={styles.heroStatLabel}>Monitoring</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>0</span>
              <span className={styles.heroStatLabel}>Trust Assumptions</span>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroRingOuter} />
          <div className={styles.heroRingMiddle} />
          <div className={styles.heroRingInner} />
          <div className={styles.heroLogoWrap}>
            <Image src="/logo.svg" alt="REFLEX" width={64} height={64} priority />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Core Capabilities</span>
            <h2 className={styles.sectionTitle}>
              Protection That Never Sleeps
            </h2>
            <p className={styles.sectionSubtitle}>
              REFLEX combines Somnia&apos;s reactive event system with battle tested DeFi
              primitives to deliver protection that works even when you are not watching.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={styles.featureCard}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className={styles.howItWorks} id="how-it-works">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Getting Started</span>
            <h2 className={styles.sectionTitle}>
              Three Steps to Full Protection
            </h2>
            <p className={styles.sectionSubtitle}>
              Getting started with REFLEX takes just a few minutes. Once your position is open,
              the protocol handles everything else.
            </p>
          </div>
          <div className={styles.stepsGrid}>
            {STEPS.map((step, i) => (
              <div
                key={step.number}
                className={styles.stepCard}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span className={styles.stepNumber}>{step.number}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Flow Section */}
      <section className={styles.architecture} id="architecture">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Under The Hood</span>
            <h2 className={styles.sectionTitle}>
              Reactive Protection Pipeline
            </h2>
            <p className={styles.sectionSubtitle}>
              When a price changes on chain, REFLEX responds in the same block through a
              chain of reactive contract calls. No external actors are involved at any stage.
            </p>
          </div>
          <div className={styles.archFlow}>
            {ARCHITECTURE_FLOW.map((step, i) => (
              <div key={step.label} className={styles.archStep} style={{ animationDelay: `${i * 150}ms` }}>
                <div className={styles.archIcon}>{step.icon}</div>
                <div className={styles.archInfo}>
                  <span className={styles.archLabel}>{step.label}</span>
                  <span className={styles.archDesc}>{step.description}</span>
                </div>
                {i < ARCHITECTURE_FLOW.length - 1 && (
                  <div className={styles.archArrow}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12,5 19,12 12,19" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className={styles.archNote}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span>All four steps execute within a single block. Total latency is under one second.</span>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className={styles.comparison} id="comparison">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>The Difference</span>
            <h2 className={styles.sectionTitle}>
              Traditional Keepers vs REFLEX Reactivity
            </h2>
            <p className={styles.sectionSubtitle}>
              Most DeFi protocols rely on external keeper networks to monitor and liquidate positions.
              REFLEX eliminates every one of those dependencies.
            </p>
          </div>
          <div className={styles.compTable}>
            <div className={styles.compHeader}>
              <span className={styles.compHeaderCell}>Aspect</span>
              <span className={styles.compHeaderCell}>Traditional Keepers</span>
              <span className={styles.compHeaderCell}>REFLEX Protocol</span>
            </div>
            {COMPARISONS.map((row, i) => (
              <div key={row.aspect} className={styles.compRow} style={{ animationDelay: `${i * 80}ms` }}>
                <span className={styles.compAspect}>{row.aspect}</span>
                <span className={styles.compTraditional}>{row.traditional}</span>
                <span className={styles.compReflex}>{row.reflex}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contracts Section */}
      <section className={styles.contracts} id="contracts">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Deployed and Verified</span>
            <h2 className={styles.sectionTitle}>
              Smart Contracts on Somnia Testnet
            </h2>
            <p className={styles.sectionSubtitle}>
              All contracts are deployed, verified, and open source. You can inspect every
              line of code on the Shannon Explorer.
            </p>
          </div>
          <div className={styles.contractsGrid}>
            {Object.entries(CONTRACTS).map(([name, address]) => (
              <div key={name} className={styles.contractCard}>
                <span className={styles.contractName}>{name}</span>
                <span className={styles.contractAddress}>
                  {address.slice(0, 10)}...{address.slice(-8)}
                </span>
                {EXPLORER_LINKS[name as keyof typeof EXPLORER_LINKS] && (
                  <a
                    href={EXPLORER_LINKS[name as keyof typeof EXPLORER_LINKS]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.contractLink}
                  >
                    View on Explorer
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15,3 21,3 21,9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <div className={styles.ctaGlow} />
          <h2 className={styles.ctaTitle}>
            Ready to Protect Your Positions?
          </h2>
          <p className={styles.ctaText}>
            Connect your wallet and open your first position in minutes.
            REFLEX will take care of the rest.
          </p>
          <div className={styles.ctaActions}>
            {mounted && isConnected ? (
              <button className={styles.btnPrimary} onClick={() => router.push("/dashboard")}>
                Launch Dashboard
              </button>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted: rkMounted, authenticationStatus }) => {
                  const ready = rkMounted && authenticationStatus !== "loading";
                  const canOpen = ready && !!openConnectModal;
                  return (
                    <button
                      className={styles.btnPrimary}
                      onClick={() => openConnectModal?.()}
                      disabled={!canOpen}
                      style={{ opacity: canOpen ? 1 : 0.6 }}
                    >
                      Connect Wallet to Start
                    </button>
                  );
                }}
              </ConnectButton.Custom>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogoRow}>
                <Image src="/logo.svg" alt="REFLEX" width={24} height={24} />
                <span className={styles.footerBrandText}>REFLEX Protocol</span>
              </div>
              <p className={styles.footerTagline}>
                Autonomous DeFi position protection powered by Somnia Reactivity.
                No keepers. No bots. No delays.
              </p>
            </div>
            <div className={styles.footerColGroup}>
              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>Product</span>
                <a href="/dashboard" className={styles.footerLink}>Dashboard</a>
                <a href="/positions" className={styles.footerLink}>Positions</a>
                <a href="/insurance" className={styles.footerLink}>Insurance</a>
              </div>
              <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>Resources</span>
                <a href="/docs" className={styles.footerLink}>Documentation</a>
                <a href="https://github.com/trinnode/reflex-protocol" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Source Code</a>
                <a href="https://shannon-explorer.somnia.network" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Block Explorer</a>
              </div>
              {/* <div className={styles.footerCol}>
                <span className={styles.footerColTitle}>Built With</span>
                <span className={styles.footerTech}>Solidity 0.8.24</span>
                <span className={styles.footerTech}>Next.js 14</span>
                <span className={styles.footerTech}>Somnia Shannon</span>
              </div> */}
            </div>
          </div>
          <div className={styles.footerDivider} />
          <div className={styles.footerBottom}>
            <p className={styles.footerCopy}>
              Somnia Reactivity.
            </p>
            <div className={styles.footerSocials}>
              <a href="https://github.com/trinnode" target="_blank" rel="noopener noreferrer" className={styles.footerSocial} title="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a href="https://twitter.com/_trinnex" target="_blank" rel="noopener noreferrer" className={styles.footerSocial} title="Twitter">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
