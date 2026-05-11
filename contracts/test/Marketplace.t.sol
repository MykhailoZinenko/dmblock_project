// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {CardNFT} from "../src/CardNFT.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {CardStats, Ability} from "../src/libraries/CardTypes.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract MarketplaceTest is Test {
    GameConfig public config;
    CardNFT public nft;
    Marketplace public market;

    address public admin = address(0xA1);
    address public seller = address(0xB1);
    address public buyer = address(0xC1);
    address public other = address(0xD1);

    uint96 constant ROYALTY_BPS = 250; // 2.5%
    uint96 constant PRICE = 1 ether;

    function setUp() public {
        GameConfig impl = new GameConfig();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            admin,
            abi.encodeCall(GameConfig.initialize, (admin))
        );
        config = GameConfig(address(proxy));

        vm.prank(admin);
        nft = new CardNFT(address(proxy), admin, ROYALTY_BPS);

        vm.prank(admin);
        config.addCard("Peasant", _sampleUnitStats(), new Ability[](0), "QmHash");

        // Mint two tokens to seller (id 0 and 1).
        vm.startPrank(admin);
        nft.mint(seller, 0);
        nft.mint(seller, 0);
        vm.stopPrank();

        market = new Marketplace(address(nft));

        vm.deal(buyer, 10 ether);
        vm.deal(other, 10 ether);
    }

    function _sampleUnitStats() internal pure returns (CardStats memory) {
        return CardStats({
            cardType: 0, faction: 0, rarity: 0,
            attack: 5, defense: 3, hp: 30,
            initiative: 5, speed: 3, ammo: 0,
            manaCost: 1, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0,
            successChance: 0, school: 0
        });
    }

    function _approveAndList(uint256 tokenId, uint96 priceWei) internal {
        vm.startPrank(seller);
        nft.approve(address(market), tokenId);
        market.list(tokenId, priceWei);
        vm.stopPrank();
    }

    // ---------- list ----------

    function test_List_HappyPath() public {
        _approveAndList(0, PRICE);

        Marketplace.Listing memory l = market.getListing(0);
        assertEq(l.seller, seller);
        assertEq(uint256(l.priceWei), uint256(PRICE));
        assertTrue(market.isListed(0));
    }

    function test_List_ApprovedForAll_Works() public {
        vm.startPrank(seller);
        nft.setApprovalForAll(address(market), true);
        market.list(0, PRICE);
        vm.stopPrank();

        assertTrue(market.isListed(0));
    }

    function test_List_ZeroPrice_Reverts() public {
        vm.prank(seller);
        nft.approve(address(market), 0);

        vm.prank(seller);
        vm.expectRevert(Marketplace.ZeroPrice.selector);
        market.list(0, 0);
    }

    function test_List_NotOwner_Reverts() public {
        vm.prank(other);
        vm.expectRevert(Marketplace.NotOwner.selector);
        market.list(0, PRICE);
    }

    function test_List_NotApproved_Reverts() public {
        vm.prank(seller);
        vm.expectRevert(Marketplace.NotApproved.selector);
        market.list(0, PRICE);
    }

    function test_List_AlreadyListed_Reverts() public {
        _approveAndList(0, PRICE);

        vm.prank(seller);
        vm.expectRevert(Marketplace.AlreadyListed.selector);
        market.list(0, PRICE);
    }

    function test_List_EmitsEvent() public {
        vm.prank(seller);
        nft.approve(address(market), 0);

        vm.expectEmit(true, true, false, true);
        emit Marketplace.Listed(0, seller, PRICE);

        vm.prank(seller);
        market.list(0, PRICE);
    }

    // ---------- cancel ----------

    function test_Cancel_HappyPath() public {
        _approveAndList(0, PRICE);

        vm.prank(seller);
        market.cancel(0);

        assertFalse(market.isListed(0));
    }

    function test_Cancel_NotListed_Reverts() public {
        vm.prank(seller);
        vm.expectRevert(Marketplace.NotListed.selector);
        market.cancel(0);
    }

    function test_Cancel_NonSeller_Reverts() public {
        _approveAndList(0, PRICE);

        vm.prank(other);
        vm.expectRevert(Marketplace.NotSeller.selector);
        market.cancel(0);
    }

    // ---------- buy ----------

    function test_Buy_HappyPath_SplitsRoyalty() public {
        _approveAndList(0, PRICE);

        uint256 sellerBefore = seller.balance;
        uint256 adminBefore = admin.balance; // admin is royalty receiver

        vm.prank(buyer);
        market.buy{value: PRICE}(0);

        uint256 expectedRoyalty = (uint256(PRICE) * ROYALTY_BPS) / 10000;
        uint256 expectedSeller = uint256(PRICE) - expectedRoyalty;

        assertEq(nft.ownerOf(0), buyer);
        assertEq(seller.balance, sellerBefore + expectedSeller);
        assertEq(admin.balance, adminBefore + expectedRoyalty);
        assertFalse(market.isListed(0));
    }

    function test_Buy_WrongPrice_Reverts() public {
        _approveAndList(0, PRICE);

        vm.prank(buyer);
        vm.expectRevert(Marketplace.WrongPrice.selector);
        market.buy{value: PRICE - 1}(0);
    }

    function test_Buy_NotListed_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert(Marketplace.NotListed.selector);
        market.buy{value: PRICE}(0);
    }

    function test_Buy_StaleListing_Reverts_WhenSellerTransfersOut() public {
        _approveAndList(0, PRICE);

        // Seller transfers NFT out directly, bypassing marketplace.
        vm.prank(seller);
        nft.transferFrom(seller, other, 0);

        vm.prank(buyer);
        vm.expectRevert(Marketplace.StaleListing.selector);
        market.buy{value: PRICE}(0);
    }

    function test_Buy_EmitsSoldEvent() public {
        _approveAndList(0, PRICE);

        uint256 expectedRoyalty = (uint256(PRICE) * ROYALTY_BPS) / 10000;

        vm.expectEmit(true, true, true, true);
        emit Marketplace.Sold(0, seller, buyer, PRICE, admin, expectedRoyalty);

        vm.prank(buyer);
        market.buy{value: PRICE}(0);
    }

    function test_Buy_ZeroRoyaltyReceiver_AllToSeller() public {
        // Set royalty receiver to address(0) (admin path).
        vm.prank(admin);
        nft.setDefaultRoyalty(address(0), ROYALTY_BPS);

        _approveAndList(0, PRICE);

        uint256 sellerBefore = seller.balance;

        vm.prank(buyer);
        market.buy{value: PRICE}(0);

        assertEq(nft.ownerOf(0), buyer);
        assertEq(seller.balance, sellerBefore + uint256(PRICE));
    }

    // ---------- cleanupStale ----------

    function test_CleanupStale_HappyPath() public {
        _approveAndList(0, PRICE);

        vm.prank(seller);
        nft.transferFrom(seller, other, 0);

        vm.prank(buyer); // anyone can clean up
        market.cleanupStale(0);

        assertFalse(market.isListed(0));
    }

    function test_CleanupStale_FreshListing_Reverts() public {
        _approveAndList(0, PRICE);

        vm.prank(buyer);
        vm.expectRevert(Marketplace.ListingFresh.selector);
        market.cleanupStale(0);
    }

    function test_CleanupStale_NotListed_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert(Marketplace.NotListed.selector);
        market.cleanupStale(0);
    }

    // ---------- reentrancy ----------

    function test_Buy_ReentrantSeller_Reverts() public {
        // Deploy malicious seller that tries to re-enter buy() on its receive().
        ReentrantSeller attacker = new ReentrantSeller(market);

        // Move token 1 to attacker so it's the seller.
        vm.prank(seller);
        nft.transferFrom(seller, address(attacker), 1);

        // Royalty receiver should NOT be the attacker — set it to a benign EOA so
        // the attacker contract only gets reached on the seller-payout call.
        vm.prank(admin);
        nft.setDefaultRoyalty(other, ROYALTY_BPS);

        // Attacker approves + lists.
        attacker.approveAndList(address(nft), 1, PRICE);

        // Buyer tries to buy. Attacker reverts on receive (re-entry blocked), seller
        // payout fails, whole tx reverts with PayoutFailed.
        vm.prank(buyer);
        vm.expectRevert(Marketplace.PayoutFailed.selector);
        market.buy{value: PRICE}(1);

        // Listing must still be present (since buy reverted in full).
        // Note: technically delete is inside the same reverted tx, so state is rolled back.
        assertTrue(market.isListed(1));
        assertEq(nft.ownerOf(1), address(attacker));
    }
}

/// @dev Helper attacker contract used by reentrancy test.
contract ReentrantSeller {
    Marketplace public immutable market;

    constructor(Marketplace m) {
        market = m;
    }

    function approveAndList(address nftAddr, uint256 tokenId, uint96 price) external {
        // Approve marketplace and list, all initiated by this contract.
        (bool ok1, ) = nftAddr.call(abi.encodeWithSignature("approve(address,uint256)", address(market), tokenId));
        require(ok1, "approve failed");
        market.list(tokenId, price);
    }

    receive() external payable {
        // Attempt re-entry into buy() — ReentrancyGuard must block this, which
        // causes the inner call to revert and the outer payout to fail.
        market.buy{value: msg.value}(0);
    }
}
