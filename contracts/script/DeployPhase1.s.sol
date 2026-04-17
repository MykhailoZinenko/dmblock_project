// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {CardNFT} from "../src/CardNFT.sol";
import {CardStats, Ability} from "../src/libraries/CardTypes.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DeployPhase1 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        string memory peasantIpfs = vm.envOr("PEASANT_IPFS", string(""));
        string memory impIpfs = vm.envOr("IMP_IPFS", string(""));

        vm.startBroadcast(deployerKey);

        // 1. Deploy GameConfig (upgradeable)
        GameConfig impl = new GameConfig();
        console.log("GameConfig impl:", address(impl));

        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            deployer,
            abi.encodeCall(GameConfig.initialize, (deployer))
        );
        console.log("GameConfig proxy:", address(proxy));

        GameConfig config = GameConfig(address(proxy));

        // 2. Deploy CardNFT (immutable, 2.5% royalties)
        CardNFT nft = new CardNFT(address(proxy), deployer, 250);
        console.log("CardNFT:", address(nft));

        // 3. Register sample cards
        Ability[] memory noAbilities = new Ability[](0);

        config.addCard(
            "Peasant",
            CardStats({
                cardType: 0,
                faction: 0,  // Castle
                rarity: 0,   // Common
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
            }),
            noAbilities,
            peasantIpfs
        );
        console.log("Card 0 (Peasant) registered");

        config.addCard(
            "Imp",
            CardStats({
                cardType: 0,
                faction: 1,  // Inferno
                rarity: 0,   // Common
                attack: 8,
                defense: 3,
                hp: 30,
                initiative: 7,
                speed: 4,
                ammo: 0,
                manaCost: 3,
                size: 1,
                magicResistance: 10,
                schoolImmunity: 0x01, // Fire immune
                effectImmunity: 0,
                spellPower: 0,
                duration: 0,
                spellTargetType: 0,
                successChance: 0,
                school: 0
            }),
            noAbilities,
            impIpfs
        );
        console.log("Card 1 (Imp) registered");

        vm.stopBroadcast();
    }
}
