// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {CardData, CardStats, Ability} from "./libraries/CardTypes.sol";
import {IGameConfig} from "./interfaces/IGameConfig.sol";

contract GameConfig is OwnableUpgradeable, IGameConfig {
    /// @custom:storage-location erc7201:arcanaarena.storage.GameConfig
    struct GameConfigStorage {
        mapping(uint256 => CardData) cards;
        uint256 cardCount;
    }

    // keccak256(abi.encode(uint256(keccak256("arcanaarena.storage.GameConfig")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_LOCATION =
        0x0126a79965d2e929ad86240b6d8517798ad7784de5da8624be2b082bba552d00;

    function _getStorage() private pure returns (GameConfigStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
    }

    function addCard(
        string calldata name,
        CardStats calldata stats,
        Ability[] calldata abilities,
        string calldata ipfsHash
    ) external onlyOwner returns (uint256 cardId) {
        GameConfigStorage storage s = _getStorage();
        cardId = s.cardCount;

        CardData storage card = s.cards[cardId];
        card.name = name;
        card.stats = stats;
        card.ipfsHash = ipfsHash;
        card.exists = true;

        for (uint256 i = 0; i < abilities.length; i++) {
            card.abilities.push(abilities[i]);
        }

        s.cardCount = cardId + 1;

        emit CardAdded(cardId, name, stats.cardType);
    }

    function updateCardStats(uint256 cardId, CardStats calldata newStats) external onlyOwner {
        GameConfigStorage storage s = _getStorage();
        require(s.cards[cardId].exists, "Card does not exist");
        s.cards[cardId].stats = newStats;
        emit CardStatsUpdated(cardId);
    }

    function updateCardAbilities(uint256 cardId, Ability[] calldata newAbilities) external onlyOwner {
        GameConfigStorage storage s = _getStorage();
        require(s.cards[cardId].exists, "Card does not exist");

        delete s.cards[cardId].abilities;
        for (uint256 i = 0; i < newAbilities.length; i++) {
            s.cards[cardId].abilities.push(newAbilities[i]);
        }

        emit CardAbilitiesUpdated(cardId);
    }

    function updateCardIpfsHash(uint256 cardId, string calldata newHash) external onlyOwner {
        GameConfigStorage storage s = _getStorage();
        require(s.cards[cardId].exists, "Card does not exist");
        s.cards[cardId].ipfsHash = newHash;
        emit CardIpfsHashUpdated(cardId, newHash);
    }

    function getCard(uint256 cardId) external view returns (CardData memory) {
        GameConfigStorage storage s = _getStorage();
        require(s.cards[cardId].exists, "Card does not exist");
        return s.cards[cardId];
    }

    function getCardStats(uint256 cardId) external view returns (CardStats memory) {
        GameConfigStorage storage s = _getStorage();
        require(s.cards[cardId].exists, "Card does not exist");
        return s.cards[cardId].stats;
    }

    function getCardCount() external view returns (uint256) {
        return _getStorage().cardCount;
    }
}
