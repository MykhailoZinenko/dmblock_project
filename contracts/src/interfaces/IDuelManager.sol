// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct Duel {
    address player1;
    address player2;
    uint256 player1Bet;
    uint256 player2Bet;
    uint256 lockedBet;
    uint256 createdAt;
    uint256 settledAt;
    uint8 status; // 0=Open, 1=Active, 2=Settled, 3=Cancelled, 4=Expired
    address winner;
}

interface IDuelManager {
    event DuelCreated(uint256 indexed duelId, address indexed player1, uint256 bet);
    event DuelAccepted(uint256 indexed duelId, address indexed player2, uint256 lockedBet);
    event DuelSettled(uint256 indexed duelId, address indexed winner, uint256 payout, uint256 fee);
    event DuelCancelled(uint256 indexed duelId);
    event DuelExpired(uint256 indexed duelId);
    event EloUpdated(address indexed player, uint256 newElo, uint256 matchCount);

    function createDuel() external payable returns (uint256 duelId);
    function acceptDuel(uint256 duelId) external payable;
    function cancelDuel(uint256 duelId) external;
    function settleDuel(uint256 duelId, address winner, bytes calldata sig1, bytes calldata sig2) external;
    function claimExpired(uint256 duelId) external;

    function getDuel(uint256 duelId) external view returns (Duel memory);
    function getElo(address player) external view returns (uint256);
    function getMatchCount(address player) external view returns (uint256);
    function isCalibrated(address player) external view returns (bool);
}
