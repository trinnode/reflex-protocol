<p align="center">
  <img src="frontend/public/logo.svg" width="64" alt="REFLEX Protocol" />
</p>

<h1 align="center">REFLEX Protocol</h1>

<p align="center">
  <strong>Autonomous DeFi position protection powered by Somnia Reactivity</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Somnia_Testnet-50312-7B2FBE" alt="Somnia Testnet" />
  <img src="https://img.shields.io/badge/Solidity-0.8.24-363636" alt="Solidity" />
  <img src="https://img.shields.io/badge/Next.js-14-000000" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

## The Problem

DeFi users lose billions in collateral every year to liquidations that could have been prevented. The root cause is not bad protocol design. It is the reliance on external infrastructure. Keeper bots, off chain watchers, and third party relayers sit between users and their funds, introducing delays, single points of failure, and opportunities for MEV extraction. No blockchain has offered a native, trustless way for smart contracts to react to on chain events without an external actor triggering the response. Somnia changes that.

## How REFLEX Works

Somnia introduced the Reactivity Precompile at address `0x0100`. This is a protocol level primitive that allows smart contracts to subscribe to on chain events and execute handler logic within the same block that the event fires. It is not a cron job. It is not conditional execution. It is reactive computation baked into the protocol layer itself.

REFLEX uses this primitive to build vaults that protect themselves. Here is the flow:

1. A user opens a position by depositing collateral and setting a protection ratio
2. The vault contract calls `subscribe()` on the Reactivity Precompile, registering the price oracle's `PriceUpdated` event as a trigger
3. When the oracle emits a new price, the precompile invokes the vault's `handleEvent()` in that same block
4. The vault reads the updated price, computes the user's collateral ratio, and if it has fallen below the protection threshold, exits the position and returns the remaining collateral

A second contract, REFLEXInsurance, subscribes to the vault's own `ProtectionTriggered` event. This creates a recursive reactivity chain: oracle update triggers vault protection, which triggers insurance payout. All of this happens within one block, with zero external dependencies.

## Architecture

```
                         ┌──────────────┐
                         │  PriceOracle │
                         └──────┬───────┘
                                │ emits PriceUpdated
                                ▼
                 ┌──────────────────────────────┐
                 │  Reactivity Precompile 0x0100 │
                 └──────────────┬───────────────┘
                                │ triggers handleEvent()
                                ▼
                        ┌───────────────┐
           ┌────────────│  REFLEXVault  │────────────┐
           │            └───────┬───────┘            │
           │                    │ emits               │
           │                    │ ProtectionTriggered │
           │                    ▼                     │
           │     ┌──────────────────────────────┐     │
           │     │  Reactivity Precompile 0x0100 │    │
           │     └──────────────┬───────────────┘     │
           │                    │ triggers             │
           │                    ▼                      │
           │         ┌───────────────────┐            │
           │         │ REFLEXInsurance   │            │
           │         │ pays user coverage│            │
           │         └──────────────────┘             │
           │                                          │
      User opens ◄──────── Collateral returned ──────┘
      position
```

Everything executes in the same block as the oracle price update. No keeper. No delay. No MEV.

## Deployed Contracts

All contracts are deployed and verified on Somnia Shannon Testnet (Chain ID 50312).

| Contract | Address | Explorer |
|----------|---------|----------|
| PriceOracle | `0xE85e5ac4F5Ac9987E28304d8f427f1ca6746a3E0` | [View](https://shannon-explorer.somnia.network/address/0xE85e5ac4F5Ac9987E28304d8f427f1ca6746a3E0#code) |
| REFLEXVault | `0x34C72450cC4a34Cf0BD4c24dDa64310c96CFd001` | [View](https://shannon-explorer.somnia.network/address/0x34C72450cC4a34Cf0BD4c24dDa64310c96CFd001#code) |
| REFLEXInsurance | `0xDd49a6BbB1b84b5BE744b3Ef7618783F41f0EBAD` | [View](https://shannon-explorer.somnia.network/address/0xDd49a6BbB1b84b5BE744b3Ef7618783F41f0EBAD#code) |


## Frontend Application

The frontend is a full featured Next.js 14 application with multiple pages:

**Landing Page** at `/` provides an overview of the protocol, its features, how it works, and links to all deployed contracts.

**Dashboard** at `/dashboard` gives you a real time view of your position status, live price feeds streamed through Somnia's WebSocket RPC, reactive event logs, and insurance status.

**Positions** at `/positions` is where you open, manage, and close positions. It shows your collateral health ratio with a visual bar, lets you add collateral or support the shared monitoring pool, and displays detailed position metadata including your monitoring ID and the timestamp when you opened.

**Insurance** at `/insurance` lets you browse coverage tiers and purchase insurance. When your position triggers protection, the payout is sent to your wallet automatically.

**Documentation** at `/docs` explains the protocol architecture, how reactivity works, position management, insurance mechanics, and security considerations. All in one place.

## Quick Start

```bash
git clone https://github.com/reflex-protocol/reflex-protocol.git
cd reflex-protocol
pnpm install
cp packages/contracts/.env.example packages/contracts/.env.local
# Add your PRIVATE_KEY and SOMNIA_TESTNET_RPC_URL
pnpm deploy:testnet
pnpm dev:frontend
```

## Running the Demo

```bash
pnpm demo:testnet
```

This script runs the full REFLEX flow against Somnia Testnet. It opens a leveraged position with 50 STT collateral and 10 STT debt, then simulates a price drop that brings the ratio below the protection threshold. The Reactivity handler fires automatically, the vault detects the ratio drop, and emits ProtectionTriggered. A second price drop triggers an emergency exit, and the remaining collateral is returned.

Open the frontend dashboard while the script runs. Price updates appear in the live feed, and the position panel updates in real time through the WebSocket connection.

## Security

The contracts include ReentrancyGuard on all state changing functions across both the vault and insurance contracts. The `handleEvent()` function is restricted to the Reactivity Precompile address through the `onlyPrecompile` modifier, ensuring only protocol level reactive calls can trigger position logic. The owner can pause the vault in an emergency through the `pause()` function.

**Important:** This is hackathon code that has not been formally audited. Do not deploy with real funds or use in a production environment.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.24, Hardhat 2.28, OpenZeppelin 5.0 |
| Reactive Execution | Somnia Reactivity Precompile (`0x0100`) |
| Frontend | Next.js 14, TypeScript, CSS Modules |
| Wallet Integration | RainbowKit 2.2, wagmi 2.19, viem 2.46 |
| Testnet | Somnia Shannon (Chain ID 50312) |
| Deployment | hardhat deploy, pnpm monorepo |

Built by **Isah Dauda** ([@trinnode](https://github.com/trinnode) / [@_trinnex](https://twitter.com/_trinnex)) for the Somnia Reactivity Hackathon on DoraHacks.
