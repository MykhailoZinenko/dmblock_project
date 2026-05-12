// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {PackOpening} from "../src/PackOpening.sol";

contract DeployPhase4 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address cardNFT = vm.envAddress("CARD_NFT");
        // Optional — if provided, Marketplace will report trade stats to PackOpening
        // and we'll also authorize the marketplace on the PackOpening side.
        address packOpening = vm.envOr("PACK_OPENING_PROXY", address(0));

        vm.startBroadcast(deployerKey);

        Marketplace marketplace = new Marketplace(cardNFT, packOpening);
        console.log("Marketplace:", address(marketplace));

        if (packOpening != address(0)) {
            PackOpening(packOpening).setMarketplace(address(marketplace));
            console.log("PackOpening.marketplace =", address(marketplace));
        }

        vm.stopBroadcast();

        console.log("--- Phase 4 Deployment Summary ---");
        console.log("CardNFT (referenced):", cardNFT);
        console.log("PackOpening (referenced):", packOpening);
        console.log("Marketplace:", address(marketplace));
    }
}
