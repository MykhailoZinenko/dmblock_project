// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {GameConfig} from "../src/GameConfig.sol";
import {CardNFT} from "../src/CardNFT.sol";
import {HeroNFT} from "../src/HeroNFT.sol";
import {TraitConstants} from "../src/libraries/HeroTypes.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DeployPhase2 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address gameConfigProxy = vm.envAddress("GAME_CONFIG_PROXY");
        address cardNFTAddress = vm.envAddress("CARD_NFT");
        address proxyAdminAddress = vm.envAddress("PROXY_ADMIN");

        vm.startBroadcast(deployerKey);

        // 1. Upgrade GameConfig to new implementation
        GameConfig newImpl = new GameConfig();
        console.log("GameConfig new impl:", address(newImpl));

        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(gameConfigProxy),
            address(newImpl),
            ""
        );
        console.log("GameConfig proxy upgraded");

        GameConfig config = GameConfig(gameConfigProxy);
        CardNFT cardNFT = CardNFT(cardNFTAddress);

        // 2. Deploy HeroNFT
        HeroNFT heroNFT = new HeroNFT(gameConfigProxy, cardNFTAddress);
        console.log("HeroNFT:", address(heroNFT));

        // 3. Register HeroNFT as authorized minter on CardNFT
        cardNFT.setAuthorizedMinter(address(heroNFT), true);
        console.log("HeroNFT authorized as minter");

        // 4. Configure starter deck: 4x each of the 5 common cards = 20
        uint256[] memory starterDeck = new uint256[](20);
        uint256[5] memory commons = [uint256(0), 1, 7, 10, 17]; // Peasant, Militiaman, Torchbearer, Healing, Tower
        for (uint256 i = 0; i < 5; i++) {
            for (uint256 j = 0; j < 4; j++) {
                starterDeck[i * 4 + j] = commons[i];
            }
        }
        config.setStarterDeck(starterDeck);
        console.log("Starter deck configured (4x each of 5 commons)");

        // 5. Configure starting traits (4 factions x 4 archetypes)
        // Castle: Attack(0), Power(2), Defense(1), Vitality(6)
        config.setStartingTrait(0, 0, TraitConstants.ATTACK);
        config.setStartingTrait(0, 1, TraitConstants.POWER);
        config.setStartingTrait(0, 2, TraitConstants.DEFENSE);
        config.setStartingTrait(0, 3, TraitConstants.VITALITY);
        // Inferno: CriticalStrike(3), SpellFocus(8), ArmorPen(4), DamageReduction(5)
        config.setStartingTrait(1, 0, TraitConstants.CRITICAL_STRIKE);
        config.setStartingTrait(1, 1, TraitConstants.SPELL_FOCUS);
        config.setStartingTrait(1, 2, TraitConstants.ARMOR_PENETRATION);
        config.setStartingTrait(1, 3, TraitConstants.DAMAGE_REDUCTION);
        // Necropolis: Vitality(6), Wisdom(7), SpellFocus(8), Defense(1)
        config.setStartingTrait(2, 0, TraitConstants.VITALITY);
        config.setStartingTrait(2, 1, TraitConstants.WISDOM);
        config.setStartingTrait(2, 2, TraitConstants.SPELL_FOCUS);
        config.setStartingTrait(2, 3, TraitConstants.DEFENSE);
        // Dungeon: ArmorPen(4), Wisdom(7), CriticalStrike(3), DamageReduction(5)
        config.setStartingTrait(3, 0, TraitConstants.ARMOR_PENETRATION);
        config.setStartingTrait(3, 1, TraitConstants.WISDOM);
        config.setStartingTrait(3, 2, TraitConstants.CRITICAL_STRIKE);
        config.setStartingTrait(3, 3, TraitConstants.DAMAGE_REDUCTION);
        console.log("Starting traits configured (16 faction x archetype combos)");

        vm.stopBroadcast();

        console.log("--- Phase 2 Deployment Summary ---");
        console.log("GameConfig proxy (unchanged):", gameConfigProxy);
        console.log("GameConfig new impl:", address(newImpl));
        console.log("CardNFT (unchanged):", cardNFTAddress);
        console.log("HeroNFT:", address(heroNFT));
        console.log("Owner:", deployer);
    }
}
