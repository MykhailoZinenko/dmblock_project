// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {CardNFT} from "../src/CardNFT.sol";
import {PackOpening} from "../src/PackOpening.sol";
import {CardStats, Ability} from "../src/libraries/CardTypes.sol";
import {VRFV2PlusClient} from "../src/libraries/VRFV2PlusClient.sol";

contract MockVrfCoordinator {
    uint256 public nextRequestId = 1;
    VRFV2PlusClient.RandomWordsRequest public lastRequest;

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req) external returns (uint256 requestId) {
        lastRequest = req;
        requestId = nextRequestId++;
    }

    function lastSubId() external view returns (uint256) {
        return lastRequest.subId;
    }

    function lastNumWords() external view returns (uint32) {
        return lastRequest.numWords;
    }

    function fulfill(address consumer, uint256 requestId, uint256 randomWord) external {
        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        (bool ok,) =
            consumer.call(abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, words));
        require(ok, "fulfill failed");
    }
}

contract PackOpeningTest is Test {
    GameConfig public config;
    CardNFT public nft;
    PackOpening public packs;
    MockVrfCoordinator public vrf;

    address public admin = address(0xA11CE);
    address public player = address(0xB0B);

    function setUp() public {
        GameConfig configImpl = new GameConfig();
        TransparentUpgradeableProxy configProxy =
            new TransparentUpgradeableProxy(address(configImpl), admin, abi.encodeCall(GameConfig.initialize, (admin)));
        config = GameConfig(address(configProxy));

        vm.startPrank(admin);
        nft = new CardNFT(address(config), admin, 250);
        config.addCard("Peasant", _stats(0), new Ability[](0), "Qm0");
        config.addCard("Marksman", _stats(1), new Ability[](0), "Qm1");
        config.addCard("Archmage", _stats(2), new Ability[](0), "Qm2");
        config.addCard("Titan", _stats(3), new Ability[](0), "Qm3");
        vm.stopPrank();

        vrf = new MockVrfCoordinator();
        PackOpening packImpl = new PackOpening();
        TransparentUpgradeableProxy packProxy = new TransparentUpgradeableProxy(
            address(packImpl),
            admin,
            abi.encodeCall(
                PackOpening.initialize,
                (admin, address(nft), address(config), address(vrf), bytes32(uint256(123)), uint256(456))
            )
        );
        packs = PackOpening(address(packProxy));

        vm.startPrank(admin);
        nft.setAuthorizedMinter(address(packs), true);

        uint256[] memory pool = new uint256[](4);
        pool[0] = 0;
        pool[1] = 1;
        pool[2] = 2;
        pool[3] = 3;
        packs.setTierPool(PackOpening.PackTier.Common, pool);
        packs.setTierPool(PackOpening.PackTier.Rare, pool);
        packs.setTierPool(PackOpening.PackTier.Epic, pool);
        packs.setTierPool(PackOpening.PackTier.Legendary, pool);

        packs.setCardPrice(0, 0.001 ether, 0, 0);
        packs.setCardPrice(1, 0.005 ether, 0, 0);
        packs.setCardPrice(2, 0.02 ether, 0, 0);
        packs.setCardPrice(3, 0.08 ether, 0, 0);
        vm.stopPrank();

        vm.deal(player, 1 ether);
    }

    function _stats(uint8 rarity) internal pure returns (CardStats memory) {
        return CardStats({
            cardType: 0,
            faction: 0,
            rarity: rarity,
            attack: 5,
            defense: 3,
            hp: 30,
            initiative: 5,
            speed: 3,
            ammo: 0,
            manaCost: 1,
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

    function test_BuyPack_RequestsVrf() public {
        vm.prank(player);
        uint256 requestId = packs.buyPack{value: 0.002 ether}(PackOpening.PackTier.Common);

        assertEq(requestId, 1);
        assertEq(address(packs).balance, 0.002 ether);

        (address requester, PackOpening.PackTier tier, bool fulfilled) = packs.requests(requestId);
        assertEq(requester, player);
        assertEq(uint256(tier), uint256(PackOpening.PackTier.Common));
        assertFalse(fulfilled);

        assertEq(vrf.lastSubId(), 456);
        assertEq(vrf.lastNumWords(), 1);
    }

    function test_BuyPack_WrongPaymentReverts() public {
        vm.prank(player);
        vm.expectRevert(PackOpening.WrongPayment.selector);
        packs.buyPack{value: 0.001 ether}(PackOpening.PackTier.Common);
    }

    function test_Fulfill_MintsCards() public {
        vm.prank(player);
        uint256 requestId = packs.buyPack{value: 0.002 ether}(PackOpening.PackTier.Common);

        vrf.fulfill(address(packs), requestId, 99);

        assertEq(nft.balanceOf(player), 4);
        assertEq(nft.totalSupply(), 4);

        (,, bool fulfilled) = packs.requests(requestId);
        assertTrue(fulfilled);
    }

    function test_RarePack_GuaranteesRareOrHigherFirstCard() public {
        vm.prank(player);
        uint256 requestId = packs.buyPack{value: 0.0075 ether}(PackOpening.PackTier.Rare);

        vrf.fulfill(address(packs), requestId, 1);

        uint256 firstCardId = nft.tokenCardId(0);
        assertGe(config.getCardStats(firstCardId).rarity, 1);
        assertEq(nft.balanceOf(player), 5);
    }

    function test_OnlyCoordinatorCanFulfill() public {
        vm.prank(player);
        uint256 requestId = packs.buyPack{value: 0.002 ether}(PackOpening.PackTier.Common);

        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        vm.prank(player);
        vm.expectRevert(PackOpening.OnlyCoordinator.selector);
        packs.rawFulfillRandomWords(requestId, words);
    }

    function test_EffectivePrice_UsesTwapAfterTenTrades() public {
        assertEq(packs.effectivePriceWei(1), 0.005 ether);

        vm.prank(admin);
        packs.setCardPrice(1, 0.005 ether, 0.004 ether, 10);

        assertEq(packs.effectivePriceWei(1), 0.004 ether);
    }

    function test_EffectivePrice_FallsBackBeforeTenTrades() public {
        vm.prank(admin);
        packs.setCardPrice(1, 0.005 ether, 0.004 ether, 9);

        assertEq(packs.effectivePriceWei(1), 0.005 ether);
    }
}
