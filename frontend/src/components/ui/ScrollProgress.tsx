"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./ScrollProgress.module.css";

/**
 * A thin progress bar fixed at the very top of the viewport.
 * Tracks how far the user has scrolled on the current page.
 * Only renders when the page actually has scrollable content.
 */
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const scrollable = docHeight - winHeight;

    if (scrollable <= 10) {
      // Page doesn't need scrolling — hide the bar
      setVisible(false);
      setProgress(0);
      return;
    }

    setVisible(true);
    const pct = Math.min(Math.max((scrollTop / scrollable) * 100, 0), 100);
    setProgress(pct);
  }, []);

  useEffect(() => {
    // Initial check
    updateProgress();

    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateProgress);
    };

    // Also recheck on resize (content reflow can change scrollable area)
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateProgress);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateProgress]);

  if (!visible) return null;

  return (
    <div className={styles.track} role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={styles.bar}
        style={{ width: `${progress}%` }}
      />
      {progress > 0 && (
        <span className={styles.label}>{Math.round(progress)}%</span>
      )}
    </div>
  );
}
