// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Marketplace} from "../src/Marketplace.sol";

contract DeployPhase4 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address cardNFT = vm.envAddress("CARD_NFT");

        vm.startBroadcast(deployerKey);

        Marketplace marketplace = new Marketplace(cardNFT);
        console.log("Marketplace:", address(marketplace));

        vm.stopBroadcast();

        console.log("--- Phase 4 Deployment Summary ---");
        console.log("CardNFT (referenced):", cardNFT);
        console.log("Marketplace:", address(marketplace));
    }
}
