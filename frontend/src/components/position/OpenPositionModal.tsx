"use client";

import { useState, useCallback, useEffect } from "react";
import styles from "./OpenPositionModal.module.css";

// ── Types ────────────────────────────────────────────────

interface OpenPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (collateral: string, debt: string, protectionRatio: number) => void;
  isLoading: boolean;
  error: string | null;
}

// ── Presets ──────────────────────────────────────────────

const PRESETS = [
  { label: "Conservative", value: 150, color: "#10B981", icon: "🛡️" },
  { label: "Balanced", value: 135, color: "#F59E0B", icon: "⚖️" },
  { label: "Aggressive", value: 125, color: "#F97316", icon: "⚡" },
] as const;

const MIN_SUB_FUNDING = 2;
const MIN_TOTAL_COLLATERAL = 2.01;
const MIN_OPEN_RATIO = 140;
const RECOMMENDED_GAS_BUFFER = 0.05;
const QUICK_FILL_COLLATERAL = "2.85";
const QUICK_FILL_DEBT = "0.55";
const QUICK_FILL_RATIO = 150;

// ── Component ────────────────────────────────────────────

export default function OpenPositionModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  error,
}: OpenPositionModalProps) {
  const [collateral, setCollateral] = useState("");
  const [debt, setDebt] = useState("");
  const [protectionRatio, setProtectionRatio] = useState(150);

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
  const netCollateralNum = Math.max(collateralNum - MIN_SUB_FUNDING, 0);
  const maxDebtAtThreshold =
    netCollateralNum > 0 ? (netCollateralNum * 100) / protectionRatio : 0;
  const computedRatio =
    debtNum > 0 ? Math.round((netCollateralNum / debtNum) * 100) : 0;

  const collateralError =
    collateral && collateralNum < MIN_TOTAL_COLLATERAL
      ? `Minimum ${MIN_TOTAL_COLLATERAL} STT required`
      : null;

  const debtError =
    debt && debtNum > 0 && computedRatio < MIN_OPEN_RATIO
      ? `Opening ratio ${computedRatio}% is below safe minimum (${MIN_OPEN_RATIO}%)`
      : null;

  const hasErrors = !!(collateralError || debtError);
  const isValid =
    collateralNum >= MIN_TOTAL_COLLATERAL &&
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
                min={String(MIN_TOTAL_COLLATERAL)}
                placeholder="0.00"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <span className={styles.hint}>
              Min {MIN_TOTAL_COLLATERAL} STT total (includes {MIN_SUB_FUNDING} STT for reactive subscription)
            </span>
            <span className={styles.hint}>
              Minimum usable collateral after subscription: {(MIN_TOTAL_COLLATERAL - MIN_SUB_FUNDING).toFixed(2)} STT
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
            {collateralNum >= MIN_TOTAL_COLLATERAL && (
              <div className={styles.ratioPreview}>
                <span>Usable Collateral</span>
                <span className={styles.ratioPreviewValue}>{netCollateralNum.toFixed(2)} STT</span>
              </div>
            )}
            {collateralNum >= MIN_TOTAL_COLLATERAL && (
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
          <div className={styles.minimumSummary}>
            Minimum you can use now: {MIN_TOTAL_COLLATERAL} STT total ({(MIN_TOTAL_COLLATERAL - MIN_SUB_FUNDING).toFixed(2)} STT usable after subscription)
          </div>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!isValid || isLoading}
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
