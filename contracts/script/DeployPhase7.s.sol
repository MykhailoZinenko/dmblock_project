// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {DuelManager} from "../src/DuelManager.sol";
import {FreedomRecord} from "../src/FreedomRecord.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DeployPhase7 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy DuelManager (upgradeable)
        DuelManager impl = new DuelManager();
        console.log("DuelManager impl:", address(impl));

        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            deployer,
            abi.encodeCall(DuelManager.initialize, (deployer, deployer, 500, 0.001 ether))
        );
        console.log("DuelManager proxy:", address(proxy));

        // 2. Deploy FreedomRecord (immutable, linked to DuelManager proxy)
        FreedomRecord freedom = new FreedomRecord(address(proxy));
        console.log("FreedomRecord:", address(freedom));

        vm.stopBroadcast();

        console.log("--- Phase 7 Deployment Summary ---");
        console.log("DuelManager proxy:", address(proxy));
        console.log("FreedomRecord:", address(freedom));
        console.log("Treasury:", deployer);
        console.log("Protocol fee: 5% (500 bps)");
        console.log("Minimum bet: 0.001 ETH");
    }
}
