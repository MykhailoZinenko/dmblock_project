// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IFreedomRecord {
    event FreedomRecorded(uint32 indexed seasonId, address indexed winner);

    function recordFreedom(uint32 seasonId, address winner) external;
    function isFreed(address wallet) external view returns (bool);
    function getSeasonWinner(uint32 seasonId) external view returns (address);
}
