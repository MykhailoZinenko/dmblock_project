// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {CardData, CardStats, Ability} from "../src/libraries/CardTypes.sol";
import {IGameConfig} from "../src/interfaces/IGameConfig.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract GameConfigTest is Test {
    GameConfig public config;
    address public admin = address(1);
    address public nonAdmin = address(2);

    function setUp() public {
        GameConfig impl = new GameConfig();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            admin,
            abi.encodeCall(GameConfig.initialize, (admin))
        );
        config = GameConfig(address(proxy));
    }

    function _sampleUnitStats() internal pure returns (CardStats memory) {
        return CardStats({
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
    }

    function _sampleSpellStats() internal pure returns (CardStats memory) {
        return CardStats({
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
    }

    function _sampleAbility() internal pure returns (Ability memory) {
        return Ability({
            abilityType: 0,
            triggerType: 0,
            targetType: 1,
            value: 5,
            cooldown: 2,
            aoeShape: "",
            schoolType: 0
        });
    }

    function test_Initialize() public view {
        assertEq(config.owner(), admin);
    }

    function test_AddUnitCard() public {
        Ability[] memory abilities = new Ability[](0);

        vm.prank(admin);
        uint256 cardId = config.addCard("Peasant", _sampleUnitStats(), abilities, "QmPeasantHash");

        assertEq(cardId, 0);
        assertEq(config.getCardCount(), 1);

        CardData memory card = config.getCard(cardId);
        assertEq(card.name, "Peasant");
        assertEq(card.stats.attack, 6);
        assertEq(card.stats.hp, 35);
        assertEq(card.stats.cardType, 0);
        assertEq(card.ipfsHash, "QmPeasantHash");
        assertTrue(card.exists);
    }

    function test_AddSpellCard() public {
        Ability[] memory abilities = new Ability[](0);

        vm.prank(admin);
        uint256 cardId = config.addCard("Fireball", _sampleSpellStats(), abilities, "QmFireballHash");

        CardData memory card = config.getCard(cardId);
        assertEq(card.stats.cardType, 1);
        assertEq(card.stats.spellPower, 15);
        assertEq(card.stats.successChance, 90);
        assertEq(card.stats.school, 1);
    }

    function test_AddCardWithAbilities() public {
        Ability[] memory abilities = new Ability[](1);
        abilities[0] = _sampleAbility();

        vm.prank(admin);
        uint256 cardId = config.addCard("Knight", _sampleUnitStats(), abilities, "QmKnightHash");

        CardData memory card = config.getCard(cardId);
        assertEq(card.abilities.length, 1);
        assertEq(card.abilities[0].value, 5);
        assertEq(card.abilities[0].cooldown, 2);
    }

    function test_UpdateCardStats() public {
        Ability[] memory abilities = new Ability[](0);

        vm.prank(admin);
        uint256 cardId = config.addCard("Peasant", _sampleUnitStats(), abilities, "QmHash");

        CardStats memory newStats = _sampleUnitStats();
        newStats.attack = 10;
        newStats.hp = 50;

        vm.prank(admin);
        config.updateCardStats(cardId, newStats);

        CardData memory card = config.getCard(cardId);
        assertEq(card.stats.attack, 10);
        assertEq(card.stats.hp, 50);
    }

    function test_UpdateCardAbilities() public {
        Ability[] memory abilities = new Ability[](1);
        abilities[0] = _sampleAbility();

        vm.prank(admin);
        uint256 cardId = config.addCard("Knight", _sampleUnitStats(), abilities, "QmHash");

        Ability[] memory newAbilities = new Ability[](2);
        newAbilities[0] = _sampleAbility();
        newAbilities[1] = Ability({
            abilityType: 1,
            triggerType: 3,
            targetType: 0,
            value: 10,
            cooldown: 3,
            aoeShape: "",
            schoolType: 6
        });

        vm.prank(admin);
        config.updateCardAbilities(cardId, newAbilities);

        CardData memory card = config.getCard(cardId);
        assertEq(card.abilities.length, 2);
        assertEq(card.abilities[1].value, 10);
        assertEq(card.abilities[1].schoolType, 6);
    }

    function test_UpdateCardIpfsHash() public {
        Ability[] memory abilities = new Ability[](0);

        vm.prank(admin);
        uint256 cardId = config.addCard("Peasant", _sampleUnitStats(), abilities, "QmOldHash");

        vm.prank(admin);
        config.updateCardIpfsHash(cardId, "QmNewHash");

        CardData memory card = config.getCard(cardId);
        assertEq(card.ipfsHash, "QmNewHash");
    }

    function test_CardAddedEvent() public {
        Ability[] memory abilities = new Ability[](0);

        vm.expectEmit(true, false, false, true);
        emit IGameConfig.CardAdded(0, "Peasant", 0);

        vm.prank(admin);
        config.addCard("Peasant", _sampleUnitStats(), abilities, "QmHash");
    }

    function test_CardStatsUpdatedEvent() public {
        Ability[] memory abilities = new Ability[](0);

        vm.prank(admin);
        uint256 cardId = config.addCard("Peasant", _sampleUnitStats(), abilities, "QmHash");

        vm.expectEmit(true, false, false, false);
        emit IGameConfig.CardStatsUpdated(cardId);

        vm.prank(admin);
        config.updateCardStats(cardId, _sampleUnitStats());
    }

    function test_OnlyOwnerCanAddCard() public {
        Ability[] memory abilities = new Ability[](0);

        vm.prank(nonAdmin);
        vm.expectRevert();
        config.addCard("Peasant", _sampleUnitStats(), abilities, "QmHash");
    }

    function test_OnlyOwnerCanUpdateStats() public {
        Ability[] memory abilities = new Ability[](0);

        vm.prank(admin);
        uint256 cardId = config.addCard("Peasant", _sampleUnitStats(), abilities, "QmHash");

        vm.prank(nonAdmin);
        vm.expectRevert();
        config.updateCardStats(cardId, _sampleUnitStats());
    }

    function test_UpdateNonexistentCard() public {
        vm.prank(admin);
        vm.expectRevert("Card does not exist");
        config.updateCardStats(999, _sampleUnitStats());
    }

    function test_GetNonexistentCard() public {
        vm.expectRevert("Card does not exist");
        config.getCard(999);
    }

    function test_GetCardCount() public {
        Ability[] memory abilities = new Ability[](0);
        CardStats memory stats = _sampleUnitStats();

        vm.startPrank(admin);
        config.addCard("Card1", stats, abilities, "Qm1");
        config.addCard("Card2", stats, abilities, "Qm2");
        config.addCard("Card3", stats, abilities, "Qm3");
        vm.stopPrank();

        assertEq(config.getCardCount(), 3);
    }

    // --- Starter Deck tests ---

    function test_SetStarterDeck() public {
        Ability[] memory abilities = new Ability[](0);
        vm.startPrank(admin);
        config.addCard("Peasant", _sampleUnitStats(), abilities, "Qm1");
        config.addCard("Imp", _sampleUnitStats(), abilities, "Qm2");

        uint256[] memory deck = new uint256[](4);
        deck[0] = 0;
        deck[1] = 0;
        deck[2] = 1;
        deck[3] = 1;
        config.setStarterDeck(deck);
        vm.stopPrank();

        uint256[] memory result = config.getStarterDeck();
        assertEq(result.length, 4);
        assertEq(result[0], 0);
        assertEq(result[2], 1);
    }

    function test_SetStarterDeck_OnlyOwner() public {
        uint256[] memory deck = new uint256[](0);
        vm.prank(nonAdmin);
        vm.expectRevert();
        config.setStarterDeck(deck);
    }

    function test_SetStarterDeck_InvalidCard_Reverts() public {
        uint256[] memory deck = new uint256[](1);
        deck[0] = 999;
        vm.prank(admin);
        vm.expectRevert("Card does not exist");
        config.setStarterDeck(deck);
    }

    function test_SetStarterDeck_EmitsEvent() public {
        Ability[] memory abilities = new Ability[](0);
        vm.startPrank(admin);
        config.addCard("Peasant", _sampleUnitStats(), abilities, "Qm1");

        uint256[] memory deck = new uint256[](1);
        deck[0] = 0;

        vm.expectEmit(false, false, false, true);
        emit IGameConfig.StarterDeckUpdated(deck);

        config.setStarterDeck(deck);
        vm.stopPrank();
    }

    // --- Starting Trait tests ---

    function test_SetStartingTrait() public {
        vm.prank(admin);
        config.setStartingTrait(0, 0, 5);

        assertEq(config.getStartingTrait(0, 0), 5);
    }

    function test_SetStartingTrait_OnlyOwner() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        config.setStartingTrait(0, 0, 5);
    }

    function test_SetStartingTrait_InvalidFaction_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("Invalid faction");
        config.setStartingTrait(5, 0, 5);
    }

    function test_SetStartingTrait_InvalidArchetype_Reverts() public {
        vm.prank(admin);
        vm.expectRevert("Invalid archetype");
        config.setStartingTrait(0, 5, 5);
    }

    function test_SetStartingTrait_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IGameConfig.StartingTraitUpdated(0, 0, 5);

        vm.prank(admin);
        config.setStartingTrait(0, 0, 5);
    }
}
