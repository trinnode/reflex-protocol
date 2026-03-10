// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEventHandler {
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external;
}

/// @dev Deployed at 0x0100 in tests (via hardhat_setCode) to stand in for the
///      Somnia Reactivity Precompile. Records every subscribe/unsubscribe call
///      and exposes triggerHandler() so tests can simulate the precompile firing.
contract MockReactivityPrecompile {
    event SubscribeCall(
        uint256 indexed subscriptionId,
        address emitter,
        bytes32 topic,
        address handler
    );
    event UnsubscribeCall(uint256 indexed subscriptionId);

    struct SubscriptionData {
        bytes32[4] eventTopics;
        address origin;
        address caller;
        address emitter;
        address handlerContractAddress;
        bytes4 handlerFunctionSelector;
        uint64 priorityFeePerGas;
        uint64 maxFeePerGas;
        uint64 gasLimit;
        bool isGuaranteed;
        bool isCoalesced;
    }

    struct Subscription {
        SubscriptionData data;
        address owner;
        bool active;
    }

    // Storage slot 0 — starts at 0, first returned subId is 1 (pre-increment).
    uint256 private _nextSubId;

    mapping(uint256 => Subscription) public subscriptions;

    function subscribe(SubscriptionData calldata subscriptionData)
        external
        returns (uint256 subscriptionId)
    {
        subscriptionId = ++_nextSubId;
        subscriptions[subscriptionId] = Subscription({
            data: subscriptionData,
            owner: msg.sender,
            active: true
        });
        emit SubscribeCall(
            subscriptionId,
            subscriptionData.emitter,
            subscriptionData.eventTopics[0],
            subscriptionData.handlerContractAddress
        );
    }

    function unsubscribe(uint256 subscriptionId) external {
        subscriptions[subscriptionId].active = false;
        emit UnsubscribeCall(subscriptionId);
    }

    function getSubscriptionInfo(uint256 subscriptionId)
        external
        view
        returns (SubscriptionData memory subscriptionData, address owner)
    {
        Subscription storage s = subscriptions[subscriptionId];
        return (s.data, s.owner);
    }

    /// @dev Test helper — simulates the precompile calling handleEvent on a
    ///      handler contract. Because this contract IS deployed at PRECOMPILE_ADDRESS
    ///      (0x0100), msg.sender inside handleEvent passes the onlyPrecompile guard.
    function triggerHandler(
        address handler,
        address emitter,
        bytes32[] calldata topics,
        bytes calldata data
    ) external {
        IEventHandler(handler).onEvent(emitter, topics, data);
    }
}
