// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {GameConfig} from "../src/GameConfig.sol";

contract UpdateTowerIpfsHash is Script {
    uint256 private constant TOWER_CARD_ID = 17;
    string private constant TOWER_IPFS_HASH = "bafybeihcbr4qtm336tiz3w6fahrbz7apqag7cvthbjw3agacryamccru3y";

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address gameConfigProxy = vm.envAddress("GAME_CONFIG_PROXY");

        vm.startBroadcast(deployerKey);
        GameConfig(gameConfigProxy).updateCardIpfsHash(TOWER_CARD_ID, TOWER_IPFS_HASH);
        vm.stopBroadcast();

        console.log("Updated Tower card IPFS hash");
        console.log("GameConfig:", gameConfigProxy);
        console.log("Card ID:", TOWER_CARD_ID);
        console.log("Tower IPFS:", TOWER_IPFS_HASH);
    }
}
