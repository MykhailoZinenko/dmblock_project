// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PackOpening} from "../src/PackOpening.sol";
import {CardNFT} from "../src/CardNFT.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {VRFV2PlusClient} from "../src/libraries/VRFV2PlusClient.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

// Local-only mock so anvil deploys work without a real Chainlink subscription.
contract MockVrfCoordinator {
    uint256 public nextRequestId = 1;

    event RandomWordsRequested(uint256 requestId, address consumer);

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata) external returns (uint256 requestId) {
        requestId = nextRequestId++;
        emit RandomWordsRequested(requestId, msg.sender);
    }

    function fulfill(address consumer, uint256 requestId, uint256 randomWord) external {
        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        (bool ok,) =
            consumer.call(abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, words));
        require(ok, "fulfill failed");
    }
}

contract DeployPhase6 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address gameConfigAddr = vm.envAddress("GAME_CONFIG_PROXY");
        address cardNFTAddr = vm.envAddress("CARD_NFT");

        // VRF config — env-driven so the same script works for anvil and Base Sepolia.
        address vrfCoordinator = vm.envOr("VRF_COORDINATOR", address(0));
        bytes32 keyHash = vm.envOr("VRF_KEY_HASH", bytes32(0));
        uint256 subscriptionId = vm.envOr("VRF_SUBSCRIPTION_ID", uint256(0));

        vm.startBroadcast(deployerKey);

        // 1. If no VRF coordinator provided, deploy a mock (local only).
        if (vrfCoordinator == address(0)) {
            MockVrfCoordinator mock = new MockVrfCoordinator();
            vrfCoordinator = address(mock);
            console.log("MockVrfCoordinator deployed (local mode):", vrfCoordinator);
        } else {
            console.log("Using external VRF coordinator:", vrfCoordinator);
        }

        // 2. Deploy PackOpening (upgradeable).
        PackOpening packImpl = new PackOpening();
        console.log("PackOpening impl:", address(packImpl));

        TransparentUpgradeableProxy packProxy = new TransparentUpgradeableProxy(
            address(packImpl),
            deployer,
            abi.encodeCall(
                PackOpening.initialize,
                (deployer, cardNFTAddr, gameConfigAddr, vrfCoordinator, keyHash, subscriptionId)
            )
        );
        PackOpening packs = PackOpening(address(packProxy));
        console.log("PackOpening proxy:", address(packProxy));

        // 3. Authorize PackOpening as minter on CardNFT.
        CardNFT(cardNFTAddr).setAuthorizedMinter(address(packs), true);
        console.log("PackOpening authorized as CardNFT minter");

        // 4. Configure tier pools. All 20 registered cards in every pool — the
        //    contract's guaranteedRarity gate filters the first slot by rarity,
        //    and price-based weights make rarer cards rarer pulls.
        uint256 cardCount = GameConfig(gameConfigAddr).getCardCount();
        require(cardCount > 0, "no cards registered");

        uint256[] memory pool = new uint256[](cardCount);
        for (uint256 i = 0; i < cardCount; i++) {
            pool[i] = i;
        }

        packs.setTierPool(PackOpening.PackTier.Common, pool);
        packs.setTierPool(PackOpening.PackTier.Rare, pool);
        packs.setTierPool(PackOpening.PackTier.Epic, pool);
        packs.setTierPool(PackOpening.PackTier.Legendary, pool);
        console.log("Tier pools set (all cards in all tiers, gated by guaranteedRarity)");

        // 5. Set per-card admin base prices by rarity (drives weights).
        //    Common 0.001 / Rare 0.005 / Epic 0.02 / Legendary 0.08 ETH.
        uint96[4] memory priceByRarity =
            [uint96(0.001 ether), uint96(0.005 ether), uint96(0.02 ether), uint96(0.08 ether)];

        for (uint256 i = 0; i < cardCount; i++) {
            uint8 rarity = GameConfig(gameConfigAddr).getCardStats(i).rarity;
            require(rarity < 4, "unexpected rarity");
            packs.setCardPrice(i, priceByRarity[rarity], 0, 0);
        }
        console.log("Card prices set for", cardCount, "cards");

        vm.stopBroadcast();

        console.log("--- Phase 6 Deployment Summary ---");
        console.log("PackOpening proxy:", address(packProxy));
        console.log("PackOpening impl:", address(packImpl));
        console.log("VRF coordinator:", vrfCoordinator);
        console.log("CardNFT (referenced):", cardNFTAddr);
        console.log("GameConfig (referenced):", gameConfigAddr);
        console.log("Owner:", deployer);
    }
}
