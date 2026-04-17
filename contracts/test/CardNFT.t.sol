// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {CardNFT} from "../src/CardNFT.sol";
import {CardData, CardStats, Ability} from "../src/libraries/CardTypes.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract CardNFTTest is Test {
    GameConfig public config;
    CardNFT public nft;
    address public admin = address(1);
    address public user = address(2);
    address public minter = address(3);

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

        Ability[] memory abilities = new Ability[](0);
        CardStats memory stats = _sampleUnitStats();

        vm.prank(admin);
        config.addCard("Peasant", stats, abilities, "QmPeasantHash123");
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

    function test_Mint() public {
        vm.prank(admin);
        uint256 tokenId = nft.mint(user, 0);

        assertEq(tokenId, 0);
        assertEq(nft.ownerOf(0), user);
        assertEq(nft.tokenCardId(0), 0);
    }

    function test_BatchMint() public {
        uint256[] memory cardIds = new uint256[](3);
        cardIds[0] = 0;
        cardIds[1] = 0;
        cardIds[2] = 0;

        vm.prank(admin);
        uint256 firstId = nft.batchMint(user, cardIds);

        assertEq(firstId, 0);
        assertEq(nft.ownerOf(0), user);
        assertEq(nft.ownerOf(1), user);
        assertEq(nft.ownerOf(2), user);
        assertEq(nft.totalSupply(), 3);
    }

    function test_TokenURI_ReturnsDataURI() public {
        vm.prank(admin);
        nft.mint(user, 0);

        string memory uri = nft.tokenURI(0);
        // Should start with data:application/json;base64,
        assertTrue(bytes(uri).length > 35);
        // Check prefix
        bytes memory prefix = "data:application/json;base64,";
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(bytes(uri)[i], prefix[i]);
        }
    }

    function test_Royalties() public {
        vm.prank(admin);
        nft.mint(user, 0);

        (address receiver, uint256 amount) = nft.royaltyInfo(0, 10000);
        assertEq(receiver, admin);
        assertEq(amount, 250); // 2.5% of 10000
    }

    function test_SetDefaultRoyalty() public {
        address newReceiver = address(99);

        vm.prank(admin);
        nft.setDefaultRoyalty(newReceiver, 300);

        vm.prank(admin);
        nft.mint(user, 0);

        (address receiver, uint256 amount) = nft.royaltyInfo(0, 10000);
        assertEq(receiver, newReceiver);
        assertEq(amount, 300); // 3%
    }

    function test_OnlyAuthorizedCanMint() public {
        vm.prank(user);
        vm.expectRevert(CardNFT.UnauthorizedMinter.selector);
        nft.mint(user, 0);
    }

    function test_SetAuthorizedMinter() public {
        vm.prank(admin);
        nft.setAuthorizedMinter(minter, true);

        vm.prank(minter);
        nft.mint(user, 0);

        assertEq(nft.ownerOf(0), user);
    }

    function test_RevokeAuthorizedMinter() public {
        vm.prank(admin);
        nft.setAuthorizedMinter(minter, true);

        vm.prank(admin);
        nft.setAuthorizedMinter(minter, false);

        vm.prank(minter);
        vm.expectRevert(CardNFT.UnauthorizedMinter.selector);
        nft.mint(user, 0);
    }

    function test_MintNonexistentCardReverts() public {
        vm.prank(admin);
        vm.expectRevert(CardNFT.CardDoesNotExist.selector);
        nft.mint(user, 999);
    }

    function test_SupportsInterface() public view {
        // ERC721
        assertTrue(nft.supportsInterface(0x80ac58cd));
        // ERC2981
        assertTrue(nft.supportsInterface(0x2a55205a));
        // ERC165
        assertTrue(nft.supportsInterface(0x01ffc9a7));
    }

    function test_TokenCardId_NonexistentToken() public {
        vm.expectRevert();
        nft.tokenCardId(999);
    }

    function test_TotalSupply() public {
        assertEq(nft.totalSupply(), 0);

        vm.prank(admin);
        nft.mint(user, 0);
        assertEq(nft.totalSupply(), 1);
    }

    function test_AuthorizedMinterSetEvent() public {
        vm.expectEmit(true, false, false, true);
        emit CardNFT.AuthorizedMinterSet(minter, true);

        vm.prank(admin);
        nft.setAuthorizedMinter(minter, true);
    }
}
