// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HelloWorld} from "../src/HelloWorld.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        HelloWorld hello = new HelloWorld("Hello, Arcana Arena!");
        console.log("HelloWorld deployed at:", address(hello));

        vm.stopBroadcast();
    }
}
