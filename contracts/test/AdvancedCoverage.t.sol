// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {CardNFT} from "../src/CardNFT.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {CardData, CardStats, Ability} from "../src/libraries/CardTypes.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract AdvancedCoverageTest is Test {
    GameConfig config;
    CardNFT nft;
    Marketplace market;

    address deployer;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        deployer = address(this);

        GameConfig impl = new GameConfig();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            deployer,
            abi.encodeCall(GameConfig.initialize, (deployer))
        );
        config = GameConfig(address(proxy));
        nft = new CardNFT(address(proxy), deployer, 250); // 2.5% royalty
        market = new Marketplace(address(nft), address(0));

        Ability[] memory noAbilities = new Ability[](0);

        // cardId 0: unit (Peasant)
        config.addCard(
            "Peasant",
            CardStats({
                cardType: 0, faction: 0, rarity: 0,
                attack: 5, defense: 3, hp: 30, initiative: 5, speed: 3,
                ammo: 0, manaCost: 1, size: 1, magicResistance: 0,
                schoolImmunity: 0, effectImmunity: 0,
                spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
            }),
            noAbilities,
            "ipfsHash"
        );

        // cardId 1: spell (Healing)
        config.addCard(
            "Healing",
            CardStats({
                cardType: 1, faction: 0, rarity: 0,
                attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
                ammo: 0, manaCost: 3, size: 0, magicResistance: 0,
                schoolImmunity: 0, effectImmunity: 0,
                spellPower: 15, duration: 0, spellTargetType: 0, successChance: 95, school: 0
            }),
            noAbilities,
            "ipfsHash2"
        );

        // cardId 2: ranged unit (Archer)
        config.addCard(
            "Archer",
            CardStats({
                cardType: 0, faction: 0, rarity: 1,
                attack: 12, defense: 8, hp: 50, initiative: 7, speed: 3,
                ammo: 5, manaCost: 4, size: 1, magicResistance: 0,
                schoolImmunity: 0, effectImmunity: 0,
                spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
            }),
            noAbilities,
            "ipfsHash3"
        );

        // Authorize this contract as minter
        nft.setAuthorizedMinter(address(this), true);
    }

    // ──────────────────────────────────────────────────────────────
    //  CardNFT Tests
    // ──────────────────────────────────────────────────────────────

    function test_TokenURI_SpellCard() public {
        uint256 tokenId = nft.mint(alice, 1); // spell card
        string memory uri = nft.tokenURI(tokenId);
        // Should start with the base64 data URI prefix
        assertTrue(bytes(uri).length > 0, "URI should not be empty");
        // Verify it starts with data:application/json;base64,
        bytes memory prefix = bytes("data:application/json;base64,");
        bytes memory uriBytes = bytes(uri);
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(uriBytes[i], prefix[i], "URI prefix mismatch");
        }
    }

    function test_TokenURI_UnitWithAmmo() public {
        uint256 tokenId = nft.mint(alice, 2); // Archer with ammo=5
        string memory uri = nft.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0, "URI should not be empty");
        // The URI is base64-encoded JSON. Just verify it doesn't revert
        // and has content (the ammo branch in _buildUnitAttributesTail is exercised).
        bytes memory prefix = bytes("data:application/json;base64,");
        bytes memory uriBytes = bytes(uri);
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(uriBytes[i], prefix[i], "URI prefix mismatch");
        }
    }

    function test_TokenURI_NonexistentToken_Reverts() public {
        vm.expectRevert(); // ERC721NonexistentToken
        nft.tokenURI(999);
    }

    function test_Mint_InvalidCardId_Reverts() public {
        vm.expectRevert(CardNFT.CardDoesNotExist.selector);
        nft.mint(alice, 999);
    }

    function test_Mint_OnlyAuthorized() public {
        vm.prank(bob);
        vm.expectRevert(CardNFT.UnauthorizedMinter.selector);
        nft.mint(bob, 0);
    }

    function testFuzz_BatchMint_VariousCardIds(uint8 count) public {
        count = uint8(bound(count, 1, 10));
        uint256[] memory cardIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cardIds[i] = i % 3; // cycle through cardId 0, 1, 2
        }
        uint256 firstTokenId = nft.batchMint(alice, cardIds);
        // Verify all tokens minted
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = firstTokenId + i;
            assertEq(nft.ownerOf(tokenId), alice, "Wrong owner");
            assertEq(nft.tokenCardId(tokenId), cardIds[i], "Wrong cardId");
        }
        assertEq(nft.totalSupply(), count, "Wrong total supply");
    }

    // ──────────────────────────────────────────────────────────────
    //  GameConfig Tests
    // ──────────────────────────────────────────────────────────────

    function test_UpdateCardAbilities_ReplacesOld() public {
        // Add a card with one ability
        Ability[] memory abilities = new Ability[](1);
        abilities[0] = Ability({
            abilityType: 0, triggerType: 0, targetType: 1,
            value: 10, cooldown: 2, aoeShape: "", schoolType: 0
        });
        uint256 cardId = config.addCard(
            "Warrior",
            CardStats({
                cardType: 0, faction: 1, rarity: 0,
                attack: 10, defense: 5, hp: 40, initiative: 4, speed: 2,
                ammo: 0, manaCost: 2, size: 1, magicResistance: 0,
                schoolImmunity: 0, effectImmunity: 0,
                spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
            }),
            abilities,
            "ipfsWarrior"
        );

        // Verify initial ability
        CardData memory card = config.getCard(cardId);
        assertEq(card.abilities.length, 1, "Should have 1 ability");
        assertEq(card.abilities[0].value, 10, "Wrong initial ability value");

        // Update with two new abilities
        Ability[] memory newAbilities = new Ability[](2);
        newAbilities[0] = Ability({
            abilityType: 1, triggerType: 1, targetType: 2,
            value: 20, cooldown: 1, aoeShape: "", schoolType: 0
        });
        newAbilities[1] = Ability({
            abilityType: 2, triggerType: 3, targetType: 0,
            value: 5, cooldown: 0, aoeShape: "", schoolType: 1
        });
        config.updateCardAbilities(cardId, newAbilities);

        // Verify old abilities are gone, new ones are present
        CardData memory updated = config.getCard(cardId);
        assertEq(updated.abilities.length, 2, "Should have 2 abilities");
        assertEq(updated.abilities[0].value, 20, "Wrong first ability value");
        assertEq(updated.abilities[1].value, 5, "Wrong second ability value");
    }

    function test_SetStarterDeck_EmptyDeck() public {
        // First set a non-empty deck
        uint256[] memory deck = new uint256[](2);
        deck[0] = 0;
        deck[1] = 1;
        config.setStarterDeck(deck);
        assertEq(config.getStarterDeck().length, 2, "Deck should have 2 cards");

        // Now set empty deck
        uint256[] memory emptyDeck = new uint256[](0);
        config.setStarterDeck(emptyDeck);
        assertEq(config.getStarterDeck().length, 0, "Deck should be empty");
    }

    function test_SetStartingTrait_BoundaryValues() public {
        // Max valid values: faction=3, archetype=3
        config.setStartingTrait(3, 3, 42);
        assertEq(config.getStartingTrait(3, 3), 42, "Trait not set for max boundary");

        // Also verify faction=0, archetype=0
        config.setStartingTrait(0, 0, 7);
        assertEq(config.getStartingTrait(0, 0), 7, "Trait not set for min boundary");

        // Verify faction > 3 reverts
        vm.expectRevert("Invalid faction");
        config.setStartingTrait(4, 0, 1);

        // Verify archetype > 3 reverts
        vm.expectRevert("Invalid archetype");
        config.setStartingTrait(0, 4, 1);
    }

    function test_GetCard_InvalidId_Reverts() public {
        uint256 count = config.getCardCount();
        vm.expectRevert("Card does not exist");
        config.getCard(count); // id == cardCount means non-existent

        vm.expectRevert("Card does not exist");
        config.getCard(999);
    }

    function testFuzz_AddCard_IncrementCount(uint8 count) public {
        count = uint8(bound(count, 1, 5));
        uint256 initialCount = config.getCardCount();
        Ability[] memory noAbilities = new Ability[](0);

        for (uint256 i = 0; i < count; i++) {
            config.addCard(
                "FuzzCard",
                CardStats({
                    cardType: 0, faction: 0, rarity: 0,
                    attack: 1, defense: 1, hp: 1, initiative: 1, speed: 1,
                    ammo: 0, manaCost: 1, size: 1, magicResistance: 0,
                    schoolImmunity: 0, effectImmunity: 0,
                    spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
                }),
                noAbilities,
                "fuzzHash"
            );
        }

        assertEq(config.getCardCount(), initialCount + count, "Card count mismatch");
    }

    // ──────────────────────────────────────────────────────────────
    //  Marketplace Tests
    // ──────────────────────────────────────────────────────────────

    function test_Buy_RoyaltyCapAtPrice() public {
        // Set royalty to 100% (10000 bps)
        nft.setDefaultRoyalty(deployer, 10000);

        uint256 tokenId = nft.mint(alice, 0);
        uint96 price = 1 ether;

        vm.startPrank(alice);
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
        vm.stopPrank();

        uint256 sellerBefore = alice.balance;
        uint256 royaltyReceiverBefore = deployer.balance;

        vm.deal(bob, price);
        vm.prank(bob);
        market.buy{value: price}(tokenId);

        // Royalty capped at price, seller gets 0
        assertEq(nft.ownerOf(tokenId), bob, "Buyer should own NFT");
        assertEq(deployer.balance - royaltyReceiverBefore, price, "Royalty receiver should get full price");
        assertEq(alice.balance - sellerBefore, 0, "Seller should get 0");
    }

    function test_Buy_ZeroRoyalty() public {
        // Set royalty to 0 bps
        nft.setDefaultRoyalty(deployer, 0);

        uint256 tokenId = nft.mint(alice, 0);
        uint96 price = 1 ether;

        vm.startPrank(alice);
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
        vm.stopPrank();

        uint256 sellerBefore = alice.balance;

        vm.deal(bob, price);
        vm.prank(bob);
        market.buy{value: price}(tokenId);

        assertEq(nft.ownerOf(tokenId), bob, "Buyer should own NFT");
        // With 0 royalty, the else branch fires: sellerProceeds = listing.priceWei
        assertEq(alice.balance - sellerBefore, price, "Seller should get full price");
    }

    function test_List_ZeroPrice_Reverts() public {
        uint256 tokenId = nft.mint(alice, 0);

        vm.startPrank(alice);
        nft.approve(address(market), tokenId);
        vm.expectRevert(Marketplace.ZeroPrice.selector);
        market.list(tokenId, 0);
        vm.stopPrank();
    }

    function test_Buy_WrongPrice_Reverts() public {
        uint256 tokenId = nft.mint(alice, 0);
        uint96 price = 1 ether;

        vm.startPrank(alice);
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
        vm.stopPrank();

        vm.deal(bob, 2 ether);
        vm.prank(bob);
        vm.expectRevert(Marketplace.WrongPrice.selector);
        market.buy{value: 0.5 ether}(tokenId);
    }

    function testFuzz_Buy_CorrectSplit(uint256 price) public {
        price = bound(price, 0.001 ether, 10 ether);
        // Ensure price fits in uint96
        require(price <= type(uint96).max);

        // Use 2.5% royalty (default from setUp)
        uint256 tokenId = nft.mint(alice, 0);

        vm.startPrank(alice);
        nft.approve(address(market), tokenId);
        market.list(tokenId, uint96(price));
        vm.stopPrank();

        uint256 sellerBefore = alice.balance;
        uint256 royaltyReceiverBefore = deployer.balance;

        vm.deal(bob, price);
        vm.prank(bob);
        market.buy{value: price}(tokenId);

        uint256 sellerGot = alice.balance - sellerBefore;
        uint256 royaltyGot = deployer.balance - royaltyReceiverBefore;

        // royalty + seller proceeds must equal total price
        assertEq(sellerGot + royaltyGot, price, "Royalty + seller must equal price");

        // Verify royalty is approximately 2.5% (within rounding)
        uint256 expectedRoyalty = (price * 250) / 10000;
        assertEq(royaltyGot, expectedRoyalty, "Royalty amount mismatch");
    }

    // ──────────────────────────────────────────────────────────────
    //  Additional edge-case coverage
    // ──────────────────────────────────────────────────────────────

    /// @dev Exercises all faction name branches (0-3 and default)
    function test_TokenURI_AllFactions() public {
        Ability[] memory noAbilities = new Ability[](0);

        // faction=1 (Inferno)
        config.addCard("Imp", CardStats({
            cardType: 0, faction: 1, rarity: 0,
            attack: 4, defense: 2, hp: 20, initiative: 6, speed: 3,
            ammo: 0, manaCost: 1, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "ipfs4");

        // faction=2 (Necropolis)
        config.addCard("Skeleton", CardStats({
            cardType: 0, faction: 2, rarity: 0,
            attack: 3, defense: 1, hp: 15, initiative: 4, speed: 2,
            ammo: 0, manaCost: 1, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "ipfs5");

        // faction=3 (Dungeon)
        config.addCard("Troglodyte", CardStats({
            cardType: 0, faction: 3, rarity: 0,
            attack: 6, defense: 4, hp: 25, initiative: 5, speed: 2,
            ammo: 0, manaCost: 1, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "ipfs6");

        // Mint and call tokenURI on each to exercise all faction branches
        uint256 t1 = nft.mint(alice, 3); // Imp (faction 1)
        uint256 t2 = nft.mint(alice, 4); // Skeleton (faction 2)
        uint256 t3 = nft.mint(alice, 5); // Troglodyte (faction 3)

        assertTrue(bytes(nft.tokenURI(t1)).length > 0);
        assertTrue(bytes(nft.tokenURI(t2)).length > 0);
        assertTrue(bytes(nft.tokenURI(t3)).length > 0);
    }

    /// @dev Exercises all rarity name branches
    function test_TokenURI_AllRarities() public {
        Ability[] memory noAbilities = new Ability[](0);

        // rarity=2 (Epic)
        config.addCard("EpicUnit", CardStats({
            cardType: 0, faction: 0, rarity: 2,
            attack: 20, defense: 15, hp: 80, initiative: 8, speed: 4,
            ammo: 0, manaCost: 6, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "ipfsEpic");

        // rarity=3 (Legendary)
        config.addCard("LegendaryUnit", CardStats({
            cardType: 0, faction: 0, rarity: 3,
            attack: 30, defense: 20, hp: 100, initiative: 10, speed: 5,
            ammo: 0, manaCost: 8, size: 2, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "ipfsLegendary");

        uint256 cardCount = config.getCardCount();
        uint256 t1 = nft.mint(alice, cardCount - 2); // Epic
        uint256 t2 = nft.mint(alice, cardCount - 1); // Legendary

        assertTrue(bytes(nft.tokenURI(t1)).length > 0);
        assertTrue(bytes(nft.tokenURI(t2)).length > 0);
    }

    /// @dev Exercises all spell school name branches
    function test_TokenURI_AllSchools() public {
        Ability[] memory noAbilities = new Ability[](0);

        // Schools 1-6
        for (uint8 schoolId = 1; schoolId <= 6; schoolId++) {
            config.addCard("SpellSchoolTest", CardStats({
                cardType: 1, faction: 0, rarity: 0,
                attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
                ammo: 0, manaCost: 2, size: 0, magicResistance: 0,
                schoolImmunity: 0, effectImmunity: 0,
                spellPower: 10, duration: 1, spellTargetType: 0, successChance: 80, school: schoolId
            }), noAbilities, "ipfsSchool");
        }

        uint256 cardCount = config.getCardCount();
        for (uint256 i = 0; i < 6; i++) {
            uint256 tokenId = nft.mint(alice, cardCount - 6 + i);
            assertTrue(bytes(nft.tokenURI(tokenId)).length > 0);
        }
    }

    /// @dev Cancel a listing and verify NFT returns to seller
    function test_Cancel_ReturnNFT() public {
        uint256 tokenId = nft.mint(alice, 0);

        vm.startPrank(alice);
        nft.approve(address(market), tokenId);
        market.list(tokenId, 1 ether);
        assertEq(nft.ownerOf(tokenId), address(market), "Market should hold NFT");

        market.cancel(tokenId);
        vm.stopPrank();

        assertEq(nft.ownerOf(tokenId), alice, "Alice should have NFT back");
    }

    /// @dev Cancel by non-seller reverts
    function test_Cancel_NotSeller_Reverts() public {
        uint256 tokenId = nft.mint(alice, 0);

        vm.startPrank(alice);
        nft.approve(address(market), tokenId);
        market.list(tokenId, 1 ether);
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(Marketplace.NotSeller.selector);
        market.cancel(tokenId);
    }

    /// @dev Buy an unlisted token reverts
    function test_Buy_NotListed_Reverts() public {
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(Marketplace.NotListed.selector);
        market.buy{value: 1 ether}(999);
    }

    /// @dev List without approval reverts
    function test_List_NotApproved_Reverts() public {
        uint256 tokenId = nft.mint(alice, 0);

        vm.prank(alice);
        vm.expectRevert(Marketplace.NotApproved.selector);
        market.list(tokenId, 1 ether);
    }

    /// @dev List by non-owner reverts
    function test_List_NotOwner_Reverts() public {
        uint256 tokenId = nft.mint(alice, 0);

        vm.prank(bob);
        vm.expectRevert(Marketplace.NotOwner.selector);
        market.list(tokenId, 1 ether);
    }

    /// @dev Receive ETH so this contract can receive royalties
    receive() external payable {}
}
