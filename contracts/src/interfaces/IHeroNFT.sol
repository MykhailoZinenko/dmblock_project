// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {HeroData} from "../libraries/HeroTypes.sol";

interface IHeroNFT {
    event HeroCreated(uint256 indexed heroId, address indexed owner, uint8 faction, uint8 archetype, uint32 seasonId);
    event HeroLeveledUp(uint256 indexed heroId, uint8 newLevel, uint8 statChosen, uint8 traitChosen);
    event SeasonUpdated(uint32 newSeasonId);

    function createHero(uint8 faction, uint8 archetype) external returns (uint256 heroId);
    function levelUp(uint256 heroId, uint8 statChoice, uint8 traitChoice) external;
    function setSeasonId(uint32 newSeasonId) external;

    function getHero(uint256 heroId) external view returns (HeroData memory);
    function getTraitLevel(uint256 heroId, uint8 traitId) external view returns (uint8);
    function getHeroTraits(uint256 heroId) external view returns (uint8[] memory traitIds, uint8[] memory traitLevels);
    function getLevelUpTraitOptions(uint256 heroId) external view returns (uint8 trait1, uint8 trait2);
    function currentSeasonId() external view returns (uint32);
}
