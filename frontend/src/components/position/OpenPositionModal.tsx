"use client";

import { useState, useCallback, useEffect } from "react";
import { useGasPrice } from "wagmi";
import { formatGwei } from "viem";
import styles from "./OpenPositionModal.module.css";

// ── Types ────────────────────────────────────────────────

interface OpenPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (collateral: string, debt: string, protectionRatio: number) => void;
  isLoading: boolean;
  error: string | null;
  monitoringActive?: boolean;
}

// ── Presets ──────────────────────────────────────────────

const PRESETS = [
  { label: "Conservative", value: 150, color: "#10B981", icon: "🛡️" },
  { label: "Balanced", value: 135, color: "#F59E0B", icon: "⚖️" },
  { label: "Aggressive", value: 125, color: "#F97316", icon: "⚡" },
] as const;

const MIN_COLLATERAL = 0.01;
const MIN_OPEN_RATIO = 140;
const RECOMMENDED_GAS_BUFFER = 0.05;
const QUICK_FILL_COLLATERAL = "2.85";
const QUICK_FILL_DEBT = "1.50";
const QUICK_FILL_RATIO = 150;

// ── Component ────────────────────────────────────────────

export default function OpenPositionModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  error,
  monitoringActive = true,
}: OpenPositionModalProps) {
  const [collateral, setCollateral] = useState("");
  const [debt, setDebt] = useState("");
  const [protectionRatio, setProtectionRatio] = useState(150);

  // Gas price estimation
  const { data: gasPrice } = useGasPrice({ query: { refetchInterval: 15_000 } });
  const gasPriceFormatted = gasPrice ? formatGwei(gasPrice) : null;
  // Estimate tx cost: ~250k gas for openPosition (conservative upper bound)
  const estimatedGasCost = gasPrice ? (gasPrice * 250_000n) : null;
  const gasCostSTT = estimatedGasCost
    ? (Number(estimatedGasCost) / 1e18).toFixed(6)
    : null;

  useEffect(() => {
    if (isOpen) {
      setCollateral("");
      setDebt("");
      setProtectionRatio(150);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ── Validation ─────────────────────────────────────────

  const collateralNum = parseFloat(collateral) || 0;
  const debtNum = parseFloat(debt) || 0;
  const maxDebtAtThreshold =
    collateralNum > 0 ? (collateralNum * 100) / protectionRatio : 0;
  const computedRatio =
    debtNum > 0 ? Math.round((collateralNum / debtNum) * 100) : 0;

  const collateralError =
    collateral && collateralNum < MIN_COLLATERAL
      ? `Minimum ${MIN_COLLATERAL} STT collateral required`
      : null;

  const debtError =
    debt && debtNum > 0 && computedRatio < MIN_OPEN_RATIO
      ? `Opening ratio ${computedRatio}% is below safe minimum (${MIN_OPEN_RATIO}%)`
      : null;

  const hasErrors = !!(collateralError || debtError);
  const isValid =
    collateralNum >= MIN_COLLATERAL &&
    debtNum > 0 &&
    computedRatio >= MIN_OPEN_RATIO &&
    !hasErrors;

  // ── Handlers ───────────────────────────────────────────

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isLoading) onClose();
    },
    [isLoading, onClose]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid || isLoading) return;
      onSubmit(collateral, debt, protectionRatio);
    },
    [isValid, isLoading, collateral, debt, protectionRatio, onSubmit]
  );

  const ratioColor =
    computedRatio >= 200
      ? "var(--color-success)"
      : computedRatio >= MIN_OPEN_RATIO
      ? "var(--color-warn)"
      : computedRatio > 0
      ? "var(--color-danger)"
      : "var(--color-text-muted)";

  // ── Render ─────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        {/* Gradient border decoration */}
        <div className={styles.modalBorder} />

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Open Position</h2>
            <p className={styles.subtitle}>Configure your collateralized position</p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Collateral */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Collateral Amount
              <span className={styles.labelUnit}>STT</span>
            </label>
            <div className={styles.quickFillRow}>
              <button
                type="button"
                className={styles.quickFillBtn}
                onClick={() => {
                  setCollateral(QUICK_FILL_COLLATERAL);
                  setDebt(QUICK_FILL_DEBT);
                  setProtectionRatio(QUICK_FILL_RATIO);
                }}
                disabled={isLoading}
              >
                Quick Fill (3 STT wallet)
              </button>
              <span className={styles.quickFillMeta}>
                {QUICK_FILL_COLLATERAL} collateral / {QUICK_FILL_DEBT} debt / {QUICK_FILL_RATIO}%
              </span>
            </div>
            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                type="number"
                step="0.01"
                min={String(MIN_COLLATERAL)}
                placeholder="0.00"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <span className={styles.hint}>
              Min {MIN_COLLATERAL} STT collateral
            </span>
            <span className={styles.hint}>
              Protocol-funded monitoring means your full deposit stays as collateral
            </span>
            <span className={styles.hint}>
              Recommended: keep at least {RECOMMENDED_GAS_BUFFER.toFixed(2)} STT in wallet for gas
            </span>
            {collateralError && (
              <span className={styles.errorMsg}>{collateralError}</span>
            )}
          </div>

          {/* Debt */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Debt Amount
              <span className={styles.labelUnit}>STT</span>
            </label>
            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={debt}
                onChange={(e) => setDebt(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {debtNum > 0 && (
              <div className={styles.ratioPreview}>
                <span>Opening Ratio</span>
                <span className={styles.ratioPreviewValue} style={{ color: ratioColor }}>
                  {computedRatio}%
                </span>
              </div>
            )}
            {collateralNum >= MIN_COLLATERAL && (
              <div className={styles.ratioPreview}>
                <span>Active Collateral</span>
                <span className={styles.ratioPreviewValue}>{collateralNum.toFixed(2)} STT</span>
              </div>
            )}
            {collateralNum >= MIN_COLLATERAL && (
              <div className={styles.ratioPreview}>
                <span>Max Debt at {protectionRatio}%</span>
                <span className={styles.ratioPreviewValue}>{maxDebtAtThreshold.toFixed(2)} STT</span>
              </div>
            )}
            {debtError && (
              <span className={styles.errorMsg}>{debtError}</span>
            )}
          </div>

          {/* Protection Threshold */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Protection Threshold
              <span className={styles.thresholdValue}>{protectionRatio}%</span>
            </label>

            <div className={styles.sliderWrap}>
              <input
                className={styles.slider}
                type="range"
                min={121}
                max={180}
                step={1}
                value={protectionRatio}
                onChange={(e) => setProtectionRatio(Number(e.target.value))}
                disabled={isLoading}
                style={{
                  background: `linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent) ${((protectionRatio - 121) / (180 - 121)) * 100}%, rgba(255,255,255,0.06) ${((protectionRatio - 121) / (180 - 121)) * 100}%, rgba(255,255,255,0.06) 100%)`,
                }}
              />
            </div>

            <div className={styles.presets}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={
                    protectionRatio === preset.value
                      ? styles.presetActive
                      : styles.preset
                  }
                  onClick={() => setProtectionRatio(preset.value)}
                  disabled={isLoading}
                >
                  <span className={styles.presetIcon}>{preset.icon}</span>
                  <span className={styles.presetLabel}>{preset.label}</span>
                  <span className={styles.presetVal}>{preset.value}%</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          {!monitoringActive && (
            <div className={styles.formError} style={{ borderColor: 'rgba(249, 115, 22, 0.3)', background: 'rgba(249, 115, 22, 0.08)', color: '#F97316' }}>
              Monitoring subscription is not yet configured by the protocol operator. Position opening is temporarily unavailable.
            </div>
          )}

          {/* Gas estimate */}
          {gasPriceFormatted && (
            <div className={styles.ratioPreview} style={{ marginBottom: 4 }}>
              <span>Gas Price</span>
              <span className={styles.ratioPreviewValue} style={{ fontSize: '0.75rem' }}>
                {parseFloat(gasPriceFormatted).toFixed(2)} Gwei
              </span>
            </div>
          )}
          {gasCostSTT && (
            <div className={styles.ratioPreview} style={{ marginBottom: 8 }}>
              <span>Est. Gas Fee</span>
              <span className={styles.ratioPreviewValue} style={{ fontSize: '0.75rem', color: 'var(--color-accent-secondary)' }}>
                ~{gasCostSTT} STT
              </span>
            </div>
          )}

          <div className={styles.minimumSummary}>
            Monitoring is funded by the protocol, so 100% of your deposit is used as collateral.
          </div>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!isValid || isLoading || !monitoringActive}
          >
            {isLoading ? (
              <span className={styles.spinner} />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Open Position
              </>
            )}
          </button>

          {error && <div className={styles.formError}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
