// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CardData, CardStats, Ability} from "../libraries/CardTypes.sol";

interface IGameConfig {
    event CardAdded(uint256 indexed cardId, string name, uint8 cardType);
    event CardStatsUpdated(uint256 indexed cardId);
    event CardAbilitiesUpdated(uint256 indexed cardId);
    event CardIpfsHashUpdated(uint256 indexed cardId, string newHash);
    event StarterDeckUpdated(uint256[] cardIds);
    event StartingTraitUpdated(uint8 indexed faction, uint8 indexed archetype, uint8 traitId);

    function addCard(
        string calldata name,
        CardStats calldata stats,
        Ability[] calldata abilities,
        string calldata ipfsHash
    ) external returns (uint256 cardId);

    function updateCardStats(uint256 cardId, CardStats calldata newStats) external;
    function updateCardAbilities(uint256 cardId, Ability[] calldata newAbilities) external;
    function updateCardIpfsHash(uint256 cardId, string calldata newHash) external;

    function setStarterDeck(uint256[] calldata cardIds) external;
    function getStarterDeck() external view returns (uint256[] memory);
    function setStartingTrait(uint8 faction, uint8 archetype, uint8 traitId) external;
    function getStartingTrait(uint8 faction, uint8 archetype) external view returns (uint8);

    function getCard(uint256 cardId) external view returns (CardData memory);
    function getCardStats(uint256 cardId) external view returns (CardStats memory);
    function getCardCount() external view returns (uint256);
}
