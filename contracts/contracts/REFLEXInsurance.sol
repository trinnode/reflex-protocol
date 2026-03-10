// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SomniaEventHandler} from "./base/SomniaEventHandler.sol";

/// @notice Autonomous insurance pool for REFLEX positions.
///         This contract subscribes — via Somnia Reactivity — to the vault's
///         ProtectionTriggered event. When the vault's reactive handler fires
///         and emits ProtectionTriggered, the Reactivity Precompile fires THIS
///         contract's handler in the same block. No keeper. No offchain relay.
contract REFLEXInsurance is SomniaEventHandler, ReentrancyGuard, Ownable {
    // ─── Events ──────────────────────────────────────────────────────────────

    event CoveragePurchased(address indexed user, uint256 coverageAmount, uint256 premium);
    event InsurancePaid(address indexed user, uint256 payout);
    event UninsuredProtection(address indexed user);

    // ─── Constants ───────────────────────────────────────────────────────────

    // Topic hash of REFLEXVault.ProtectionTriggered(address,uint256,uint256).
    // This is what the Reactivity subscription filters on so we only wake on
    // relevant events, not every log from the vault.
    bytes32 public constant PROTECTION_TRIGGERED_TOPIC =
        keccak256("ProtectionTriggered(address,uint256,uint256)");

    // Premium is 1% of the requested coverage amount.
    uint256 private constant PREMIUM_BPS = 100; // 100 bps = 1%

    // Cap single payout at 10% of pool so one large claim can't drain reserves.
    uint256 private constant MAX_PAYOUT_POOL_FRACTION = 10;

    // ─── State ───────────────────────────────────────────────────────────────

    address public vault;

    mapping(address => uint256) public premiumsPaid;
    mapping(address => bool)    public insured;
    mapping(address => uint256) public coverageAmount;

    uint256 public poolBalance;
    bool    public subscriptionInitialized;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _vault                REFLEXVault address whose events we watch.
    /// @param _reactivityPrecompile Somnia Reactivity Precompile address
    ///                              (0x0100 on mainnet; mock address in tests).
    constructor(address _vault, address _reactivityPrecompile)
        SomniaEventHandler(_reactivityPrecompile)
        Ownable(msg.sender)
    {
        vault = _vault;
    }

    // ─── Subscription setup ──────────────────────────────────────────────────

    /// @notice Records the live Reactivity subscription created by the
    ///         protocol operator for insurance payouts.
    function configureSubscription(uint256 subId) external onlyOwner {
        require(subId > 0, "Invalid subscription");
        subscriptionIds[subId] = true;
        subscriptionInitialized = true;
    }

    // ─── External — coverage ─────────────────────────────────────────────────

    /// @notice Purchase insurance coverage for your vault position.
    /// @param  coverage The maximum STT amount this policy will pay out.
    function purchaseCoverage(uint256 coverage) external payable nonReentrant {
        require(coverage > 0, "Coverage must be non-zero");

        uint256 requiredPremium = (coverage * PREMIUM_BPS) / 10_000;
        require(msg.value >= requiredPremium, "Insufficient premium");

        insured[msg.sender]        = true;
        coverageAmount[msg.sender] = coverage;
        premiumsPaid[msg.sender]  += msg.value;
        poolBalance               += msg.value;

        emit CoveragePurchased(msg.sender, coverage, msg.value);
    }

    // ─── Owner — pool management ──────────────────────────────────────────────

    function depositPool() external payable onlyOwner {
        poolBalance += msg.value;
    }

    /// @notice Safety valve — owner can withdraw excess pool funds.
    function withdrawPool(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= poolBalance, "Exceeds pool balance");
        poolBalance -= amount;

        (bool ok, ) = owner().call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // ─── Reactive handler ────────────────────────────────────────────────────

    /// CRITICAL: This function must NEVER revert.
    /// It is invoked by the Reactivity Precompile as part of the same atomic
    /// block execution triggered by the vault's ProtectionTriggered event.
    /// A revert here would propagate up through the Reactivity chain and could
    /// unwind the vault's own _onEvent handler — silently breaking protection
    /// for all users. Every failure path must be an early return, not a revert.
    function _onEvent(
        address emitter,
        bytes32[] calldata topics,
        bytes calldata /* data — ratio and price not needed for payout */
    ) internal override {
        if (!subscriptionInitialized || emitter != vault) return;

        // ProtectionTriggered(address indexed user, uint256 ratio, uint256 price)
        // The indexed 'user' lives in topics[1], NOT in the data payload.
        // topics[0] = event signature hash (already matched by subscription filter)
        // topics[1] = abi-encoded indexed user address
        if (topics.length < 2) return;
        address user = address(uint160(uint256(topics[1])));

        if (!insured[user]) {
            emit UninsuredProtection(user);
            return;
        }

        uint256 coverage = coverageAmount[user];
        if (poolBalance < coverage) return; // pool too low — silent, not a revert

        // Cap at 10% of pool to prevent a single claim from draining reserves.
        uint256 cap    = poolBalance / MAX_PAYOUT_POOL_FRACTION;
        uint256 payout = coverage < cap ? coverage : cap;

        // Checks-effects-interactions: update state before the external call.
        poolBalance              -= payout;
        insured[user]             = false; // one payout per trigger
        coverageAmount[user]      = 0;

        (bool ok, ) = user.call{value: payout}("");
        if (!ok) {
            // Restore state if transfer failed — do not revert, just undo.
            poolBalance          += payout;
            insured[user]         = true;
            coverageAmount[user]  = coverage;
            return;
        }

        emit InsurancePaid(user, payout);
    }
}
