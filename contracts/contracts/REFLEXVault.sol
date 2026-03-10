// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SomniaEventHandler} from "./base/SomniaEventHandler.sol";

contract REFLEXVault is SomniaEventHandler, ReentrancyGuard, Ownable, Pausable {
    // ─── Events ──────────────────────────────────────────────────────────────

    event PositionOpened(
        address indexed user,
        uint256 collateral,
        uint256 debt,
        uint256 subscriptionId
    );
    event PositionClosed(address indexed user, uint256 returned);
    event ProtectionTriggered(address indexed user, uint256 ratio, uint256 price);
    event PositionAtRisk(address indexed user, uint256 ratio);
    event EmergencyExit(address indexed user, uint256 collateralReturned);
    event SharedSubscriptionConfigured(uint256 subscriptionId);

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant MIN_COLLATERAL_RATIO = 120;
    uint256 public constant MIN_POSITION_COLLATERAL = 0.01 ether;
    uint256 public constant PROTOCOL_FEE_BPS    = 10; // 0.1% — 10 basis points
    uint256 public constant PRICE_PRECISION      = 1e18;

    // Upper bound prevents nonsensical thresholds that would never trigger.
    uint256 private constant MAX_PROTECTION_RATIO = 500;

    // ─── State ───────────────────────────────────────────────────────────────

    struct Position {
        uint256 collateral;      // user collateral in wei
        uint256 debt;            // borrowed amount in wei
        uint256 openedAt;        // block.timestamp at open
        bool    active;
        uint256 subscriptionId;  // shared protocol subscription ID protecting this position
        uint256 protectionRatio; // user-set threshold, e.g. 130 = 130%
    }

    mapping(address => Position)  public positions;

    address[] public activeUsers;
    mapping(address => uint256) private activeUserIndexPlusOne;

    address public priceOracle;
    bytes32 public priceUpdateTopic;
    uint256 public sharedSubscriptionId;
    bool    public subscriptionInitialized;

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        address _priceOracle,
        bytes32 _priceUpdateTopic,
        address _precompileAddress
    ) SomniaEventHandler(_precompileAddress)
        Ownable(msg.sender)
    {
        priceOracle      = _priceOracle;
        priceUpdateTopic = _priceUpdateTopic;
    }

    /// @notice Records the shared subscription created by the protocol operator.
    ///         On live Somnia, subscriptions are created directly on the
    ///         Reactivity precompile and target this contract's `onEvent` handler.
    function configureSharedSubscription(uint256 subscriptionId) external onlyOwner {
        require(subscriptionId > 0, "Invalid subscription");

        sharedSubscriptionId = subscriptionId;
        subscriptionInitialized = true;
        subscriptionIds[subscriptionId] = true;

        emit SharedSubscriptionConfigured(subscriptionId);
    }

    // ─── External — position lifecycle ───────────────────────────────────────

    /// @notice Open a leveraged position protected by the protocol-wide shared
    ///         Reactivity subscription.
    /// @param  debt            The amount of debt being taken on (in wei).
    /// @param  protectionRatio The collateral-ratio floor at which the vault
    ///                         should intervene, e.g. 150 = 150%.
    function openPosition(uint256 debt, uint256 protectionRatio)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(subscriptionInitialized, "Monitoring inactive");
        require(!positions[msg.sender].active, "Position already active");
        require(debt > 0, "Debt must be non-zero");
        require(
            protectionRatio > MIN_COLLATERAL_RATIO && protectionRatio <= MAX_PROTECTION_RATIO,
            "protectionRatio out of range [121,500]"
        );
        require(msg.value >= MIN_POSITION_COLLATERAL, "Collateral too low");

        uint256 collateral = msg.value;

        positions[msg.sender] = Position({
            collateral:      collateral,
            debt:            debt,
            openedAt:        block.timestamp,
            active:          true,
            subscriptionId:  sharedSubscriptionId,
            protectionRatio: protectionRatio
        });

        _addActiveUser(msg.sender);

        emit PositionOpened(msg.sender, collateral, debt, sharedSubscriptionId);
    }

    /// @notice Close a position, cancel the Reactivity subscription, and
    ///         return collateral minus the protocol fee.
    function closePosition() external nonReentrant whenNotPaused {
        Position storage pos = positions[msg.sender];
        require(pos.active, "No active position");

        _closeAndRefund(msg.sender, pos);
    }

    /// @notice Add collateral to an existing position to improve its ratio.
    function topUpCollateral() external payable nonReentrant whenNotPaused {
        Position storage pos = positions[msg.sender];
        require(pos.active, "No active position");
        require(msg.value > 0, "Zero value");

        pos.collateral += msg.value;
    }

    function getSharedSubscriptionStatus()
        external
        view
        returns (uint256 subscriptionId, bool active)
    {
        return (sharedSubscriptionId, subscriptionInitialized);
    }

    // ─── Owner ───────────────────────────────────────────────────────────────

    /// @notice Update the oracle address that subscriptions filter on.
    function setPriceOracle(address _oracle) external onlyOwner {
        priceOracle = _oracle;
    }

    function setPriceUpdateTopic(bytes32 _topic) external onlyOwner {
        priceUpdateTopic = _topic;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Reactive handler ────────────────────────────────────────────────────

    /// @dev Invoked by the Reactivity Precompile when a price update matching
    ///      our subscription criteria is emitted by the oracle.
    ///      subscriptionId lets us resolve which user this event concerns.
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        if (!subscriptionInitialized) {
            return;
        }

        if (emitter != priceOracle) {
            return;
        }

        if (eventTopics.length == 0 || eventTopics[0] != priceUpdateTopic) {
            return;
        }

        (uint256 newPrice, ) = abi.decode(data, (uint256, uint256));

        uint256 i = 0;
        while (i < activeUsers.length) {
            address user = activeUsers[i];
            Position storage pos = positions[user];

            if (!pos.active) {
                _removeActiveUser(user);
                continue;
            }

            // Multiply before dividing to preserve precision.
            uint256 ratio = (pos.collateral * newPrice * 100) / (pos.debt * PRICE_PRECISION);

            if (ratio < pos.protectionRatio) {
                emit ProtectionTriggered(user, ratio, newPrice);

                if (ratio < MIN_COLLATERAL_RATIO) {
                    _emergencyExit(user);
                    continue;
                } else {
                    emit PositionAtRisk(user, ratio);
                }
            }

            unchecked { ++i; }
        }
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    /// @dev Unwind a position: cancel subscription, collect fee, send remainder.
    ///      Called from both closePosition() and _emergencyExit().
    ///      The nonReentrant guard on callers protects against re-entrance here.
    function _closeAndRefund(address user, Position storage pos) internal {
        // Mark inactive before any external call (checks-effects-interactions).
        pos.active = false;
        _removeActiveUser(user);

        uint256 fee      = (pos.collateral * PROTOCOL_FEE_BPS) / 10_000;
        uint256 returned = pos.collateral - fee;

        // Reset collateral in storage before the transfer.
        pos.collateral = 0;

        (bool ok, ) = user.call{value: returned}("");
        require(ok, "Transfer failed");

        emit PositionClosed(user, returned);
    }

    /// @dev Force-close a position when the price has fallen below the hard
    ///      liquidation floor. Must not revert — it is called from _onEvent
    ///      which itself must not bubble errors back into the Reactivity chain.
    function _emergencyExit(address user) internal {
        Position storage pos = positions[user];
        uint256 returned = pos.collateral;

        pos.active     = false;
        pos.collateral = 0;
        _removeActiveUser(user);

        if (returned > 0) {
            (bool ok, ) = user.call{value: returned}("");
            // Deliberately not reverting on failed transfer inside an emergency exit:
            // a reverted _emergencyExit would leave the position half-dismantled.
            if (!ok) {
                // Re-credit collateral so a subsequent manual close can recover it.
                pos.collateral = returned;
                pos.active     = true;
                return;
            }
        }

        emit EmergencyExit(user, returned);
    }

    function _addActiveUser(address user) internal {
        if (activeUserIndexPlusOne[user] != 0) return;
        activeUsers.push(user);
        activeUserIndexPlusOne[user] = activeUsers.length;
    }

    function _removeActiveUser(address user) internal {
        uint256 indexPlusOne = activeUserIndexPlusOne[user];
        if (indexPlusOne == 0) return;

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = activeUsers.length - 1;

        if (index != lastIndex) {
            address swappedUser = activeUsers[lastIndex];
            activeUsers[index] = swappedUser;
            activeUserIndexPlusOne[swappedUser] = index + 1;
        }

        activeUsers.pop();
        delete activeUserIndexPlusOne[user];
    }
}
