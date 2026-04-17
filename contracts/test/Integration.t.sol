// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {CardNFT} from "../src/CardNFT.sol";
import {HeroNFT} from "../src/HeroNFT.sol";
import {CardData, CardStats, Ability} from "../src/libraries/CardTypes.sol";
import {HeroData, TraitConstants} from "../src/libraries/HeroTypes.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract IntegrationTest is Test {
    GameConfig public config;
    CardNFT public nft;
    address public admin = address(1);
    address public player = address(2);

    function setUp() public {
        GameConfig impl = new GameConfig();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            admin,
            abi.encodeCall(GameConfig.initialize, (admin))
        );
        config = GameConfig(address(proxy));

        vm.prank(admin);
        nft = new CardNFT(address(proxy), admin, 250);
    }

    function test_FullFlow_AddCard_Mint_VerifyTokenURI() public {
        Ability[] memory abilities = new Ability[](0);
        CardStats memory stats = CardStats({
            cardType: 0,
            faction: 0,
            rarity: 0,
            attack: 6,
            defense: 4,
            hp: 35,
            initiative: 5,
            speed: 3,
            ammo: 0,
            manaCost: 2,
            size: 1,
            magicResistance: 0,
            schoolImmunity: 0,
            effectImmunity: 0,
            spellPower: 0,
            duration: 0,
            spellTargetType: 0,
            successChance: 0,
            school: 0
        });

        vm.prank(admin);
        config.addCard("Peasant", stats, abilities, "QmTestPeasantHash");

        vm.prank(admin);
        uint256 tokenId = nft.mint(player, 0);

        string memory uri = nft.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0);

        // Verify it's a valid data URI
        bytes memory prefix = "data:application/json;base64,";
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(bytes(uri)[i], prefix[i]);
        }
    }

    function test_MultipleTokensSameCardId() public {
        Ability[] memory abilities = new Ability[](0);
        CardStats memory stats = CardStats({
            cardType: 0,
            faction: 1,
            rarity: 0,
            attack: 8,
            defense: 3,
            hp: 30,
            initiative: 7,
            speed: 4,
            ammo: 0,
            manaCost: 3,
            size: 1,
            magicResistance: 0,
            schoolImmunity: 0,
            effectImmunity: 0,
            spellPower: 0,
            duration: 0,
            spellTargetType: 0,
            successChance: 0,
            school: 0
        });

        vm.prank(admin);
        config.addCard("Imp", stats, abilities, "QmTestImpHash");

        vm.startPrank(admin);
        nft.mint(player, 0);
        nft.mint(player, 0);
        nft.mint(player, 0);
        vm.stopPrank();

        assertEq(nft.tokenCardId(0), 0);
        assertEq(nft.tokenCardId(1), 0);
        assertEq(nft.tokenCardId(2), 0);

        // All tokens should produce valid URIs
        assertTrue(bytes(nft.tokenURI(0)).length > 0);
        assertTrue(bytes(nft.tokenURI(1)).length > 0);
        assertTrue(bytes(nft.tokenURI(2)).length > 0);
    }

    function test_GameConfigUpdate_ReflectsInTokenURI() public {
        Ability[] memory abilities = new Ability[](0);
        CardStats memory stats = CardStats({
            cardType: 0,
            faction: 0,
            rarity: 0,
            attack: 6,
            defense: 4,
            hp: 35,
            initiative: 5,
            speed: 3,
            ammo: 0,
            manaCost: 2,
            size: 1,
            magicResistance: 0,
            schoolImmunity: 0,
            effectImmunity: 0,
            spellPower: 0,
            duration: 0,
            spellTargetType: 0,
            successChance: 0,
            school: 0
        });

        vm.prank(admin);
        config.addCard("Peasant", stats, abilities, "QmHash");

        vm.prank(admin);
        nft.mint(player, 0);

        string memory uriBefore = nft.tokenURI(0);

        // Update stats
        stats.attack = 20;
        stats.hp = 80;
        vm.prank(admin);
        config.updateCardStats(0, stats);

        string memory uriAfter = nft.tokenURI(0);

        // URIs should differ because stats changed
        assertTrue(keccak256(bytes(uriBefore)) != keccak256(bytes(uriAfter)));
    }

    function test_SpellCard_FullFlow() public {
        Ability[] memory abilities = new Ability[](0);
        CardStats memory stats = CardStats({
            cardType: 1,
            faction: 0,
            rarity: 1,
            attack: 0,
            defense: 0,
            hp: 0,
            initiative: 0,
            speed: 0,
            ammo: 0,
            manaCost: 4,
            size: 0,
            magicResistance: 0,
            schoolImmunity: 0,
            effectImmunity: 0,
            spellPower: 15,
            duration: 0,
            spellTargetType: 0,
            successChance: 90,
            school: 1
        });

        vm.prank(admin);
        config.addCard("Fireball", stats, abilities, "QmFireball");

        vm.prank(admin);
        nft.mint(player, 0);

        string memory uri = nft.tokenURI(0);
        assertTrue(bytes(uri).length > 0);
    }

    // --- Phase 2 Integration Tests ---

    function _deployPhase2() internal returns (HeroNFT heroNFT) {
        Ability[] memory abilities = new Ability[](0);
        CardStats memory peasant = CardStats({
            cardType: 0, faction: 0, rarity: 0,
            attack: 6, defense: 4, hp: 35, initiative: 5, speed: 3,
            ammo: 0, manaCost: 2, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        });
        CardStats memory imp = peasant;
        imp.faction = 1;
        imp.attack = 8;
        imp.defense = 3;
        imp.hp = 30;

        vm.startPrank(admin);
        config.addCard("Peasant", peasant, abilities, "QmPeasant");
        config.addCard("Imp", imp, abilities, "QmImp");

        heroNFT = new HeroNFT(address(config), address(nft));
        nft.setAuthorizedMinter(address(heroNFT), true);

        uint256[] memory deck = new uint256[](20);
        for (uint256 i = 0; i < 10; i++) deck[i] = 0;
        for (uint256 i = 10; i < 20; i++) deck[i] = 1;
        config.setStarterDeck(deck);

        config.setStartingTrait(0, 0, TraitConstants.ATTACK);
        config.setStartingTrait(1, 1, TraitConstants.SPELL_FOCUS);
        vm.stopPrank();
    }

    function test_Phase2_FullFlow_CreateHero_GetCards_LevelUp() public {
        HeroNFT heroNFT = _deployPhase2();

        vm.prank(player);
        uint256 heroId = heroNFT.createHero(0, 0);

        // Hero exists with correct data
        HeroData memory hero = heroNFT.getHero(heroId);
        assertEq(hero.faction, 0);
        assertEq(hero.archetype, 0);
        assertEq(hero.level, 1);

        // Player received 20 cards
        assertEq(nft.balanceOf(player), 20);

        // Starting trait applied
        assertEq(heroNFT.getTraitLevel(heroId, TraitConstants.ATTACK), 1);

        // Level up
        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);
        vm.prank(player);
        heroNFT.levelUp(heroId, 0, t1);

        HeroData memory heroAfter = heroNFT.getHero(heroId);
        assertEq(heroAfter.level, 2);
        assertEq(heroAfter.attack, hero.attack + 1);
    }

    function test_Phase2_MultipleHeroes_DifferentPlayers() public {
        HeroNFT heroNFT = _deployPhase2();
        address player2 = address(3);

        vm.prank(player);
        uint256 hero1 = heroNFT.createHero(0, 0);

        vm.prank(player2);
        uint256 hero2 = heroNFT.createHero(1, 1);

        // Each player owns their hero
        assertEq(heroNFT.ownerOf(hero1), player);
        assertEq(heroNFT.ownerOf(hero2), player2);

        // Each player received 20 cards
        assertEq(nft.balanceOf(player), 20);
        assertEq(nft.balanceOf(player2), 20);

        // Heroes have different factions/archetypes
        HeroData memory h1 = heroNFT.getHero(hero1);
        HeroData memory h2 = heroNFT.getHero(hero2);
        assertEq(h1.faction, 0);
        assertEq(h2.faction, 1);
    }

    function test_Phase2_HeroNFT_IsTransferable() public {
        HeroNFT heroNFT = _deployPhase2();
        address player2 = address(3);

        vm.prank(player);
        uint256 heroId = heroNFT.createHero(0, 0);

        vm.prank(player);
        heroNFT.transferFrom(player, player2, heroId);

        assertEq(heroNFT.ownerOf(heroId), player2);

        // New owner can level up
        (uint8 t1,) = heroNFT.getLevelUpTraitOptions(heroId);
        vm.prank(player2);
        heroNFT.levelUp(heroId, 0, t1);

        assertEq(heroNFT.getHero(heroId).level, 2);
    }
}
