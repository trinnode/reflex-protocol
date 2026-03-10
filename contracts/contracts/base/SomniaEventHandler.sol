// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISomniaReactivity} from "../interfaces/ISomniaReactivity.sol";

abstract contract SomniaEventHandler {
    // Immutable set at construction time. On mainnet this is always
    // 0x0000000000000000000000000000000000000100; tests inject a mock address.
    address internal immutable PRECOMPILE_ADDRESS;

    // Subscription IDs this contract has registered — used by inheritors to
    // verify that an incoming handleEvent call belongs to a known subscription.
    mapping(uint256 => bool) public subscriptionIds;

    bytes4 public constant ON_EVENT_SELECTOR =
        bytes4(keccak256("onEvent(address,bytes32[],bytes)"));

    error UnauthorizedCaller(address caller);

    constructor(address _precompileAddress) {
        PRECOMPILE_ADDRESS = _precompileAddress;
    }

    modifier onlyPrecompile() {
        if (msg.sender != PRECOMPILE_ADDRESS) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    // Called by the Reactivity Precompile when a subscribed event fires.
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external onlyPrecompile {
        _onEvent(emitter, eventTopics, data);
    }

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal virtual;
}
