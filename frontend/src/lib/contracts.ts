// REFLEX Protocol — Contract addresses & ABIs
// Network: Somnia Testnet (chainId 50312)

export const CHAIN_ID = 50312;

// ── Addresses ────────────────────────────────────────────
// NOTE: When redeploying, update PriceOracle, REFLEXVault, and REFLEXInsurance
//       addresses below to match the latest deployment.

export const CONTRACTS = {
  PriceOracle: "0xE85e5ac4F5Ac9987E28304d8f427f1ca6746a3E0",
  REFLEXVault: "0x34C72450cC4a34Cf0BD4c24dDa64310c96CFd001",
  REFLEXInsurance: "0xDd49a6BbB1b84b5BE744b3Ef7618783F41f0EBAD",
  SomniaReactivityPrecompile: "0x0000000000000000000000000000000000000100",
} as const;

export const VAULT_ADDRESS: `0x${string}` = CONTRACTS.REFLEXVault;
export const INSURANCE_ADDRESS: `0x${string}` = CONTRACTS.REFLEXInsurance;
// Point this at whichever oracle is deployed.
export const ORACLE_ADDRESS: `0x${string}` = CONTRACTS.PriceOracle;

export const EXPLORER_BASE = "https://shannon-explorer.somnia.network";

export const EXPLORER_LINKS = {
  PriceOracle: `${EXPLORER_BASE}/address/${CONTRACTS.PriceOracle}#code`,
  REFLEXVault: `${EXPLORER_BASE}/address/${CONTRACTS.REFLEXVault}#code`,
  REFLEXInsurance: `${EXPLORER_BASE}/address/${CONTRACTS.REFLEXInsurance}#code`,
} as const;

// ── Price topic hash ─────────────────────────────────────

export const PRICE_UPDATED_TOPIC =
  "0xb556fac599c3c70efb9ab1fa725ecace6c81cc48d1455f886607def065f3e0c0"; // keccak256("PriceUpdated(address,uint256,uint256)")

// ── REFLEXVault ABI (frontend-used entries only) ─────────

export const VAULT_ABI = [
  // read
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "collateral", type: "uint256" },
      { name: "debt", type: "uint256" },
      { name: "openedAt", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "subscriptionId", type: "uint256" },
      { name: "protectionRatio", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "priceOracle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getSharedSubscriptionStatus",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "subscriptionId", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  // write
  {
    type: "function",
    name: "openPosition",
    stateMutability: "payable",
    inputs: [
      { name: "debt", type: "uint256" },
      { name: "protectionRatio", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "closePosition",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "topUpCollateral",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  // events
  {
    type: "event",
    name: "PositionOpened",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "collateral", type: "uint256", indexed: false },
      { name: "debt", type: "uint256", indexed: false },
      { name: "subscriptionId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PositionClosed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "returned", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProtectionTriggered",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "ratio", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EmergencyExit",
    inputs: [
      { name: "user", type: "address", indexed: true },
    ],
  },
] as const;

// ── Oracle ABI (shared by MockPriceOracle & PriceOracle) ─

export const ORACLE_ABI = [
  {
    type: "function",
    name: "getPrice",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "lastUpdatedAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "prices",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "updatedAt",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "PRICE_UPDATED_TOPIC",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "event",
    name: "PriceUpdated",
    inputs: [
      { name: "asset", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

// ── REFLEXInsurance ABI (frontend-used entries only) ─────

export const INSURANCE_ABI = [
  // read
  {
    type: "function",
    name: "insured",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "coverageAmount",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "poolBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // write
  {
    type: "function",
    name: "purchaseCoverage",
    stateMutability: "payable",
    inputs: [{ name: "coverage", type: "uint256" }],
    outputs: [],
  },
  // events
  {
    type: "event",
    name: "InsurancePaid",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
