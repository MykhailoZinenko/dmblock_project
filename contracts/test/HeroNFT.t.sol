// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {CardNFT} from "../src/CardNFT.sol";
import {HeroNFT} from "../src/HeroNFT.sol";
import {IHeroNFT} from "../src/interfaces/IHeroNFT.sol";
import {IGameConfig} from "../src/interfaces/IGameConfig.sol";
import {CardStats, Ability} from "../src/libraries/CardTypes.sol";
import {HeroData, TraitConstants} from "../src/libraries/HeroTypes.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract HeroNFTTest is Test {
    GameConfig public config;
    CardNFT public cardNFT;
    HeroNFT public heroNFT;

    address public admin = address(1);
    address public player1 = address(0xA);
    address public player2 = address(0xB);

    function setUp() public {
        vm.startPrank(admin);

        GameConfig impl = new GameConfig();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl), admin, abi.encodeCall(GameConfig.initialize, (admin))
        );
        config = GameConfig(address(proxy));

        cardNFT = new CardNFT(address(proxy), admin, 250);

        heroNFT = new HeroNFT(address(proxy), address(cardNFT));
        cardNFT.setAuthorizedMinter(address(heroNFT), true);

        _registerCards();
        _configureStarterDeck();
        _configureStartingTraits();

        vm.stopPrank();
    }

    function _sampleUnitStats() internal pure returns (CardStats memory) {
        return CardStats({
            cardType: 0, faction: 0, rarity: 0,
            attack: 6, defense: 4, hp: 35, initiative: 5, speed: 3,
            ammo: 0, manaCost: 2, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        });
    }

    function _registerCards() internal {
        Ability[] memory abilities = new Ability[](0);
        CardStats memory peasant = _sampleUnitStats();
        CardStats memory imp = _sampleUnitStats();
        imp.faction = 1;
        imp.attack = 8;
        imp.defense = 3;
        imp.hp = 30;

        config.addCard("Peasant", peasant, abilities, "QmPeasant");
        config.addCard("Imp", imp, abilities, "QmImp");
    }

    function _configureStarterDeck() internal {
        uint256[] memory deck = new uint256[](20);
        for (uint256 i = 0; i < 10; i++) deck[i] = 0;
        for (uint256 i = 10; i < 20; i++) deck[i] = 1;
        config.setStarterDeck(deck);
    }

    function _configureStartingTraits() internal {
        for (uint8 f = 0; f < 4; f++) {
            for (uint8 a = 0; a < 4; a++) {
                config.setStartingTrait(f, a, f + a);
            }
        }
    }

    // --- Hero Creation ---

    function test_CreateHero_Basic() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0); // Castle Warrior

        assertEq(heroId, 0);
        assertEq(heroNFT.ownerOf(heroId), player1);

        HeroData memory hero = heroNFT.getHero(heroId);
        assertEq(hero.faction, 0);
        assertEq(hero.archetype, 0);
        assertEq(hero.level, 1);
        assertEq(hero.seasonId, 1);
        assertTrue(hero.exists);
    }

    function test_CreateHero_WarriorBaseStats() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);
        HeroData memory hero = heroNFT.getHero(heroId);

        // Warrior primary = attack (exact 4), others ±1
        assertEq(hero.attack, 4);
        assertGe(hero.defense, 1);
        assertLe(hero.defense, 3);
        assertLe(hero.spellPower, 2); // base 1, can be 0-2
        assertLe(hero.knowledge, 2);
    }

    function test_CreateHero_MageBaseStats() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(1, 1); // Inferno Mage
        HeroData memory hero = heroNFT.getHero(heroId);

        assertEq(hero.spellPower, 3); // primary, no variance
        assertLe(hero.attack, 2);
        // defense base 0, can only stay 0 or go to 1
        assertLe(hero.defense, 1);
    }

    function test_CreateHero_SentinelBaseStats() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(2, 3); // Necropolis Sentinel
        HeroData memory hero = heroNFT.getHero(heroId);

        assertEq(hero.defense, 4); // primary, no variance
        assertLe(hero.spellPower, 3);
        assertLe(hero.knowledge, 3);
    }

    function test_CreateHero_RangerAllVariance() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(3, 2); // Dungeon Ranger
        HeroData memory hero = heroNFT.getHero(heroId);

        // Ranger: all stats get variance (base 2/2/2/2)
        assertGe(hero.attack, 1);
        assertLe(hero.attack, 3);
        assertGe(hero.defense, 1);
        assertLe(hero.defense, 3);
        assertGe(hero.spellPower, 1);
        assertLe(hero.spellPower, 3);
        assertGe(hero.knowledge, 1);
        assertLe(hero.knowledge, 3);
    }

    function test_CreateHero_MintsStarterDeck() public {
        vm.prank(player1);
        heroNFT.createHero(0, 0);

        assertEq(cardNFT.balanceOf(player1), 20);
    }

    function test_CreateHero_StarterDeckComposition() public {
        vm.prank(player1);
        heroNFT.createHero(0, 0);

        uint256 peasantCount;
        uint256 impCount;
        for (uint256 i = 0; i < 20; i++) {
            uint256 cardId = cardNFT.tokenCardId(i);
            if (cardId == 0) peasantCount++;
            else if (cardId == 1) impCount++;
        }
        assertEq(peasantCount, 10);
        assertEq(impCount, 10);
    }

    function test_CreateHero_StartingTrait() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0); // trait = 0+0 = 0

        assertEq(heroNFT.getTraitLevel(heroId, 0), 1);

        (uint8[] memory ids, uint8[] memory levels) = heroNFT.getHeroTraits(heroId);
        assertEq(ids.length, 1);
        assertEq(ids[0], 0);
        assertEq(levels[0], 1);
    }

    function test_CreateHero_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IHeroNFT.HeroCreated(0, player1, 0, 0, 1);

        vm.prank(player1);
        heroNFT.createHero(0, 0);
    }

    function test_CreateHero_InvalidFaction_Reverts() public {
        vm.prank(player1);
        vm.expectRevert(HeroNFT.InvalidFaction.selector);
        heroNFT.createHero(5, 0);
    }

    function test_CreateHero_InvalidArchetype_Reverts() public {
        vm.prank(player1);
        vm.expectRevert(HeroNFT.InvalidArchetype.selector);
        heroNFT.createHero(0, 4);
    }

    function test_CreateHero_NoStarterDeck_Reverts() public {
        vm.startPrank(admin);
        GameConfig impl2 = new GameConfig();
        TransparentUpgradeableProxy proxy2 = new TransparentUpgradeableProxy(
            address(impl2), admin, abi.encodeCall(GameConfig.initialize, (admin))
        );
        CardNFT cardNFT2 = new CardNFT(address(proxy2), admin, 250);
        HeroNFT heroNFT2 = new HeroNFT(address(proxy2), address(cardNFT2));
        cardNFT2.setAuthorizedMinter(address(heroNFT2), true);
        vm.stopPrank();

        vm.prank(player1);
        vm.expectRevert(HeroNFT.StarterDeckNotConfigured.selector);
        heroNFT2.createHero(0, 0);
    }

    // --- Level Up ---

    function test_LevelUp_Basic() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        HeroData memory heroBefore = heroNFT.getHero(heroId);
        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);

        vm.prank(player1);
        heroNFT.levelUp(heroId, 0, t1); // +1 attack, pick first trait

        HeroData memory heroAfter = heroNFT.getHero(heroId);
        assertEq(heroAfter.level, 2);
        assertEq(heroAfter.attack, heroBefore.attack + 1);
    }

    function test_LevelUp_AllStatChoices() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);
        HeroData memory h = heroNFT.getHero(heroId);

        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);
        vm.prank(player1);
        heroNFT.levelUp(heroId, 1, t1); // defense
        HeroData memory h2 = heroNFT.getHero(heroId);
        assertEq(h2.defense, h.defense + 1);

        (t1,) = heroNFT.getLevelUpTraitOptions(heroId);
        vm.prank(player1);
        heroNFT.levelUp(heroId, 2, t1); // spellPower
        HeroData memory h3 = heroNFT.getHero(heroId);
        assertEq(h3.spellPower, h2.spellPower + 1);

        (t1,) = heroNFT.getLevelUpTraitOptions(heroId);
        vm.prank(player1);
        heroNFT.levelUp(heroId, 3, t1); // knowledge
        HeroData memory h4 = heroNFT.getHero(heroId);
        assertEq(h4.knowledge, h3.knowledge + 1);
    }

    function test_LevelUp_OnlyOwner() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);

        vm.prank(player2);
        vm.expectRevert(HeroNFT.NotHeroOwner.selector);
        heroNFT.levelUp(heroId, 0, t1);
    }

    function test_LevelUp_MaxLevel_Reverts() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        for (uint8 i = 0; i < 49; i++) {
            (uint8 t1, uint8 t2) = heroNFT.getLevelUpTraitOptions(heroId);
            uint8 pick = t1;
            if (heroNFT.getTraitLevel(heroId, t1) >= TraitConstants.maxTraitLevel(t1)) {
                pick = t2;
            }
            vm.prank(player1);
            heroNFT.levelUp(heroId, 0, pick);
        }

        HeroData memory hero = heroNFT.getHero(heroId);
        assertEq(hero.level, 50);

        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);
        vm.prank(player1);
        vm.expectRevert(HeroNFT.HeroMaxLevel.selector);
        heroNFT.levelUp(heroId, 0, t1);
    }

    function test_LevelUp_InvalidStatChoice_Reverts() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);

        vm.prank(player1);
        vm.expectRevert(HeroNFT.InvalidStatChoice.selector);
        heroNFT.levelUp(heroId, 5, t1);
    }

    function test_LevelUp_InvalidTraitChoice_Reverts() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        (uint8 t1, uint8 t2) = heroNFT.getLevelUpTraitOptions(heroId);

        uint8 invalidTrait = 0;
        for (uint8 i = 0; i < TraitConstants.TOTAL_TRAITS; i++) {
            if (i != t1 && i != t2) { invalidTrait = i; break; }
        }

        vm.prank(player1);
        vm.expectRevert(HeroNFT.InvalidTraitChoice.selector);
        heroNFT.levelUp(heroId, 0, invalidTrait);
    }

    function test_LevelUp_TraitDeterministic() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        (uint8 t1a, uint8 t2a) = heroNFT.getLevelUpTraitOptions(heroId);
        (uint8 t1b, uint8 t2b) = heroNFT.getLevelUpTraitOptions(heroId);

        assertEq(t1a, t1b);
        assertEq(t2a, t2b);
    }

    function test_LevelUp_TraitStacking() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);
        vm.prank(player1);
        heroNFT.levelUp(heroId, 0, t1);

        uint8 levelAfterFirst = heroNFT.getTraitLevel(heroId, t1);

        // Level up again — if same trait appears, it should stack
        (uint8 t1b, uint8 t2b) = heroNFT.getLevelUpTraitOptions(heroId);
        uint8 pick;
        if (t1b == t1) pick = t1b;
        else if (t2b == t1) pick = t2b;
        else return; // trait didn't reappear, test is vacuous but valid

        vm.prank(player1);
        heroNFT.levelUp(heroId, 0, pick);
        assertEq(heroNFT.getTraitLevel(heroId, t1), levelAfterFirst + 1);
    }

    function test_LevelUp_EmitsEvent() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);

        vm.expectEmit(true, false, false, true);
        emit IHeroNFT.HeroLeveledUp(heroId, 2, 0, t1);

        vm.prank(player1);
        heroNFT.levelUp(heroId, 0, t1);
    }

    // --- Views ---

    function test_GetLevelUpTraitOptions_TwoDistinct() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        (uint8 t1, uint8 t2) = heroNFT.getLevelUpTraitOptions(heroId);
        assertTrue(t1 != t2);
        assertTrue(t1 < TraitConstants.TOTAL_TRAITS);
        assertTrue(t2 < TraitConstants.TOTAL_TRAITS);
    }

    function test_GetHeroTraits_Enumeration() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0); // starting trait = 0

        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);
        vm.prank(player1);
        heroNFT.levelUp(heroId, 0, t1);

        (uint8[] memory ids, uint8[] memory levels) = heroNFT.getHeroTraits(heroId);

        if (t1 == 0) {
            // Starting trait was 0, leveling same trait doesn't add new entry
            assertEq(ids.length, 1);
            assertEq(levels[0], 2);
        } else {
            assertEq(ids.length, 2);
        }
    }

    function test_GetHero_NonexistentReverts() public {
        vm.expectRevert(HeroNFT.HeroDoesNotExist.selector);
        heroNFT.getHero(999);
    }

    // --- Season ---

    function test_SetSeasonId() public {
        vm.prank(admin);
        heroNFT.setSeasonId(2);

        assertEq(heroNFT.currentSeasonId(), 2);
    }

    function test_SetSeasonId_OnlyOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        heroNFT.setSeasonId(2);
    }

    function test_SetSeasonId_AffectsNewHeroes() public {
        vm.prank(admin);
        heroNFT.setSeasonId(5);

        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);

        HeroData memory hero = heroNFT.getHero(heroId);
        assertEq(hero.seasonId, 5);
    }

    function test_SetSeasonId_EmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit IHeroNFT.SeasonUpdated(3);

        vm.prank(admin);
        heroNFT.setSeasonId(3);
    }

    // --- Archetype Base Stats ---

    function test_ArchetypeBaseStats_Warrior() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 0);
        HeroData memory h = heroNFT.getHero(heroId);
        assertEq(h.attack, 4); // primary, no variance
    }

    function test_ArchetypeBaseStats_Mage() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 1);
        HeroData memory h = heroNFT.getHero(heroId);
        assertEq(h.spellPower, 3); // primary
    }

    function test_ArchetypeBaseStats_Sentinel() public {
        vm.prank(player1);
        uint256 heroId = heroNFT.createHero(0, 3);
        HeroData memory h = heroNFT.getHero(heroId);
        assertEq(h.defense, 4); // primary
    }

    function test_TotalSupply() public {
        assertEq(heroNFT.totalSupply(), 0);

        vm.prank(player1);
        heroNFT.createHero(0, 0);

        assertEq(heroNFT.totalSupply(), 1);
    }
}
