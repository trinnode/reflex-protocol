"use client";

import { useCallback, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { VAULT_ABI, VAULT_ADDRESS } from "@/lib/contracts";
import type { ReactivityEvent } from "./useReactivitySubscription";

// ── Types ────────────────────────────────────────────────

export interface PositionData {
  collateral: bigint;
  debt: bigint;
  openedAt: bigint;
  active: boolean;
  subscriptionId: bigint;
  protectionRatio: bigint;
}

export interface MonitoringData {
  subscriptionId: bigint;
  active: boolean;
}

export interface UsePositionReturn {
  position: PositionData | null;
  isLoading: boolean;
  openPosition: (
    collateral: string,
    debt: string,
    protectionRatio: number
  ) => void;
  closePosition: () => void;
  topUpCollateral: (amount: string) => void;
  monitoring: MonitoringData | null;
  isPending: boolean;
  txError: string | null;
  refetch: () => void;
}

// ── Hook ─────────────────────────────────────────────────

export function usePosition(
  reactivityEvents?: ReactivityEvent[]
): UsePositionReturn {
  const { address } = useAccount();

  // ── Read position ──────────────────────────────────────
  const {
    data: rawPosition,
    isLoading,
    refetch,
  } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "positions",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10_000, // 10s polling
    },
  });

  const { data: rawMonitoring } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getSharedSubscriptionStatus",
    query: {
      enabled: true,
      refetchInterval: 10_000,
    },
  });

  // ── Refetch on new reactivity events ───────────────────
  const eventsLength = reactivityEvents?.length ?? 0;
  useEffect(() => {
    if (eventsLength > 0) {
      refetch();
    }
  }, [eventsLength, refetch]);

  // ── Parse position data ────────────────────────────────
  const position: PositionData | null = (() => {
    if (!rawPosition) return null;
    // wagmi returns tuple as array for struct
    const raw = rawPosition as readonly [
      bigint,
      bigint,
      bigint,
      boolean,
      bigint,
      bigint
    ];
    const parsed: PositionData = {
      collateral: raw[0],
      debt: raw[1],
      openedAt: raw[2],
      active: raw[3],
      subscriptionId: raw[4],
      protectionRatio: raw[5],
    };
    return parsed.active ? parsed : null;
  })();

  const monitoring: MonitoringData | null = (() => {
    if (!rawMonitoring) return null;

    const raw = rawMonitoring as readonly [bigint, boolean];
    return {
      subscriptionId: raw[0],
      active: raw[1],
    };
  })();

  // ── Write functions ────────────────────────────────────
  const {
    writeContract,
    isPending,
    error: writeError,
  } = useWriteContract();

  const txError = writeError ? writeError.message : null;

  const openPosition = useCallback(
    (collateral: string, debt: string, protectionRatio: number) => {
      const debtWei = parseEther(debt);
      writeContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "openPosition",
        args: [debtWei, BigInt(protectionRatio)],
        value: parseEther(collateral),
      });
    },
    [writeContract]
  );

  const closePosition = useCallback(() => {
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "closePosition",
    });
  }, [writeContract]);

  const topUpCollateral = useCallback(
    (amount: string) => {
      writeContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "topUpCollateral",
        value: parseEther(amount),
      });
    },
    [writeContract]
  );

  return {
    position,
    isLoading,
    openPosition,
    closePosition,
    topUpCollateral,
    monitoring,
    isPending,
    txError,
    refetch,
  };
}
