// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IFreedomRecord} from "./interfaces/IFreedomRecord.sol";

contract FreedomRecord is IFreedomRecord {
    address public immutable duelManager;

    mapping(uint32 => address) private _seasonWinners;
    mapping(address => bool) private _freedWallets;

    error OnlyDuelManager();
    error AlreadyRecorded();

    modifier onlyDuelManager() {
        if (msg.sender != duelManager) revert OnlyDuelManager();
        _;
    }

    constructor(address duelManager_) {
        duelManager = duelManager_;
    }

    function recordFreedom(uint32 seasonId, address winner) external onlyDuelManager {
        if (_seasonWinners[seasonId] != address(0)) revert AlreadyRecorded();
        _seasonWinners[seasonId] = winner;
        _freedWallets[winner] = true;
        emit FreedomRecorded(seasonId, winner);
    }

    function isFreed(address wallet) external view returns (bool) {
        return _freedWallets[wallet];
    }

    function getSeasonWinner(uint32 seasonId) external view returns (address) {
        return _seasonWinners[seasonId];
    }
}
