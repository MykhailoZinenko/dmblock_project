// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGameConfig} from "./interfaces/IGameConfig.sol";
import {IHeroNFT} from "./interfaces/IHeroNFT.sol";
import {HeroData, TraitConstants} from "./libraries/HeroTypes.sol";

interface ICardNFT {
    function batchMint(address to, uint256[] calldata cardIds) external returns (uint256);
}

contract HeroNFT is ERC721, Ownable, IHeroNFT {
    IGameConfig public immutable gameConfig;
    ICardNFT public immutable cardNFT;

    uint256 private _nextHeroId;
    uint32 private _currentSeasonId;

    mapping(uint256 => HeroData) private _heroes;
    mapping(uint256 => mapping(uint8 => uint8)) private _heroTraits;
    mapping(uint256 => uint8[]) private _heroTraitIds;
    mapping(address => bool) private _xpGranters;

    uint8 public constant MAX_LEVEL = 50;
    uint8 public constant BASE_HP = 30;
    uint32 public constant XP_PER_LEVEL = 100;

    error InvalidFaction();
    error InvalidArchetype();
    error InvalidStatChoice();
    error InvalidTraitChoice();
    error HeroMaxLevel();
    error TraitMaxLevel();
    error NotHeroOwner();
    error HeroDoesNotExist();
    error StarterDeckNotConfigured();
    error NotXpGranter();
    error InsufficientXp();

    constructor(
        address gameConfigProxy,
        address cardNFTAddress
    ) ERC721("Arcana Arena Heroes", "HERO") Ownable(msg.sender) {
        gameConfig = IGameConfig(gameConfigProxy);
        cardNFT = ICardNFT(cardNFTAddress);
        _currentSeasonId = 1;
    }

    function createHero(uint8 faction, uint8 archetype) external returns (uint256 heroId) {
        if (faction > 3) revert InvalidFaction();
        if (archetype > 3) revert InvalidArchetype();

        uint256[] memory starterDeck = gameConfig.getStarterDeck();
        if (starterDeck.length == 0) revert StarterDeckNotConfigured();

        (uint8 atk, uint8 def, uint8 sp, uint8 know) = _getArchetypeBaseStats(archetype);

        uint256 seed = uint256(keccak256(abi.encodePacked(msg.sender, _currentSeasonId, block.prevrandao)));
        (atk, def, sp, know) = _applyVariance(archetype, atk, def, sp, know, seed);

        heroId = _nextHeroId++;
        _safeMint(msg.sender, heroId);

        _heroes[heroId] = HeroData({
            faction: faction,
            archetype: archetype,
            attack: atk,
            defense: def,
            spellPower: sp,
            knowledge: know,
            level: 1,
            xp: 0,
            seasonId: _currentSeasonId,
            exists: true
        });

        uint8 startingTrait = gameConfig.getStartingTrait(faction, archetype);
        _heroTraits[heroId][startingTrait] = 1;
        _heroTraitIds[heroId].push(startingTrait);

        cardNFT.batchMint(msg.sender, starterDeck);

        emit HeroCreated(heroId, msg.sender, faction, archetype, _currentSeasonId);
    }

    function levelUp(uint256 heroId, uint8 statChoice, uint8 traitChoice) external {
        if (!_heroes[heroId].exists) revert HeroDoesNotExist();
        if (ownerOf(heroId) != msg.sender) revert NotHeroOwner();
        if (_heroes[heroId].level >= MAX_LEVEL) revert HeroMaxLevel();
        if (_heroes[heroId].xp < uint32(_heroes[heroId].level) * XP_PER_LEVEL) revert InsufficientXp();
        if (statChoice > 3) revert InvalidStatChoice();

        (uint8 t1, uint8 t2) = _getLevelUpTraitOptions(heroId);
        if (traitChoice != t1 && traitChoice != t2) revert InvalidTraitChoice();

        uint8 currentLevel = _heroTraits[heroId][traitChoice];
        if (currentLevel >= TraitConstants.maxTraitLevel(traitChoice)) revert TraitMaxLevel();

        HeroData storage hero = _heroes[heroId];

        if (statChoice == 0) hero.attack++;
        else if (statChoice == 1) hero.defense++;
        else if (statChoice == 2) hero.spellPower++;
        else hero.knowledge++;

        if (currentLevel == 0) {
            _heroTraitIds[heroId].push(traitChoice);
        }
        _heroTraits[heroId][traitChoice] = currentLevel + 1;

        hero.level++;

        emit HeroLeveledUp(heroId, hero.level, statChoice, traitChoice);
    }

    function setSeasonId(uint32 newSeasonId) external onlyOwner {
        _currentSeasonId = newSeasonId;
        emit SeasonUpdated(newSeasonId);
    }

    function setXpGranter(address granter, bool allowed) external onlyOwner {
        _xpGranters[granter] = allowed;
    }

    function addXp(uint256 heroId, uint32 amount) external {
        if (!_xpGranters[msg.sender]) revert NotXpGranter();
        if (!_heroes[heroId].exists) revert HeroDoesNotExist();
        _heroes[heroId].xp += amount;
        emit XpGained(heroId, amount, _heroes[heroId].xp);
    }

    function xpRequired(uint8 level) external pure returns (uint32) {
        return uint32(level) * XP_PER_LEVEL;
    }

    function currentSeasonId() external view returns (uint32) {
        return _currentSeasonId;
    }

    function getHero(uint256 heroId) external view returns (HeroData memory) {
        if (!_heroes[heroId].exists) revert HeroDoesNotExist();
        return _heroes[heroId];
    }

    function getTraitLevel(uint256 heroId, uint8 traitId) external view returns (uint8) {
        return _heroTraits[heroId][traitId];
    }

    function getHeroTraits(uint256 heroId) external view returns (uint8[] memory traitIds, uint8[] memory traitLevels) {
        traitIds = _heroTraitIds[heroId];
        traitLevels = new uint8[](traitIds.length);
        for (uint256 i = 0; i < traitIds.length; i++) {
            traitLevels[i] = _heroTraits[heroId][traitIds[i]];
        }
    }

    function getLevelUpTraitOptions(uint256 heroId) external view returns (uint8 trait1, uint8 trait2) {
        if (!_heroes[heroId].exists) revert HeroDoesNotExist();
        return _getLevelUpTraitOptions(heroId);
    }

    function totalSupply() external view returns (uint256) {
        return _nextHeroId;
    }

    function _getArchetypeBaseStats(uint8 archetype) internal pure returns (uint8 atk, uint8 def, uint8 sp, uint8 know) {
        if (archetype == 0) return (4, 2, 1, 1); // Warrior
        if (archetype == 1) return (1, 0, 3, 3); // Mage
        if (archetype == 2) return (2, 2, 2, 2); // Ranger
        return (0, 4, 2, 2);                      // Sentinel
    }

    function _applyVariance(
        uint8 archetype,
        uint8 atk, uint8 def, uint8 sp, uint8 know,
        uint256 seed
    ) internal pure returns (uint8, uint8, uint8, uint8) {
        uint8[4] memory stats = [atk, def, sp, know];

        for (uint8 i = 0; i < 4; i++) {
            if (_isPrimaryStat(archetype, i)) continue;

            uint8 roll = uint8(seed >> (i * 8)) % 3; // 0, 1, 2
            if (roll == 0 && stats[i] > 0) {
                stats[i]--;
            } else if (roll == 2) {
                stats[i]++;
            }
        }

        return (stats[0], stats[1], stats[2], stats[3]);
    }

    function _isPrimaryStat(uint8 archetype, uint8 statIndex) internal pure returns (bool) {
        if (archetype == 0) return statIndex == 0; // Warrior: attack
        if (archetype == 1) return statIndex == 2; // Mage: spellPower
        if (archetype == 3) return statIndex == 1; // Sentinel: defense
        return false;                               // Ranger: no primary
    }

    function _getLevelUpTraitOptions(uint256 heroId) internal view returns (uint8, uint8) {
        HeroData storage hero = _heroes[heroId];
        uint256 seed = uint256(keccak256(abi.encodePacked(ownerOf(heroId), hero.seasonId, hero.level)));

        uint8 trait1 = uint8(seed % TraitConstants.TOTAL_TRAITS);
        uint8 trait2 = uint8((seed >> 8) % TraitConstants.TOTAL_TRAITS);

        if (trait2 == trait1) {
            trait2 = uint8((trait1 + 1) % TraitConstants.TOTAL_TRAITS);
        }

        return (trait1, trait2);
    }
}
