// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CardData, CardStats, Ability} from "../libraries/CardTypes.sol";

interface IGameConfig {
    event CardAdded(uint256 indexed cardId, string name, uint8 cardType);
    event CardStatsUpdated(uint256 indexed cardId);
    event CardAbilitiesUpdated(uint256 indexed cardId);
    event CardIpfsHashUpdated(uint256 indexed cardId, string newHash);

    function addCard(
        string calldata name,
        CardStats calldata stats,
        Ability[] calldata abilities,
        string calldata ipfsHash
    ) external returns (uint256 cardId);

    function updateCardStats(uint256 cardId, CardStats calldata newStats) external;
    function updateCardAbilities(uint256 cardId, Ability[] calldata newAbilities) external;
    function updateCardIpfsHash(uint256 cardId, string calldata newHash) external;

    function getCard(uint256 cardId) external view returns (CardData memory);
    function getCardStats(uint256 cardId) external view returns (CardStats memory);
    function getCardCount() external view returns (uint256);
}
