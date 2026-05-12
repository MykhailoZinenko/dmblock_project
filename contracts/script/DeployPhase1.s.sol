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
        string memory towerIpfsHash = "bafybeihcbr4qtm336tiz3w6fahrbz7apqag7cvthbjw3agacryamccru3y";
        string memory barracksIpfsHash = "bafybeifv2zgk6dceytq4a4fp7mm3mot52bq72bu3ayoy2umoy52no3z6qm";

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

        // 3. Register all 20 cards
        Ability[] memory noAbilities = new Ability[](0);

        // --- UNITS ---

        // 00: Peasant (Castle, Common, melee)
        config.addCard("Peasant", CardStats({
            cardType: 0, faction: 0, rarity: 0,
            attack: 5, defense: 3, hp: 30, initiative: 5, speed: 3,
            ammo: 0, manaCost: 1, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeid2pftej3o7qqlhz4ibeiwd645awjzpq32dy5bee4e5hugy4ngtqu");

        // 01: Militiaman (Castle, Common, melee)
        config.addCard("Militiaman", CardStats({
            cardType: 0, faction: 0, rarity: 0,
            attack: 8, defense: 5, hp: 40, initiative: 5, speed: 3,
            ammo: 0, manaCost: 2, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeihqopwtejbprgsq3ejnco5jnvyxxonx35m664ddnuncxo3x55t6iu");

        // 02: Archer (Castle, Rare, ranged)
        config.addCard("Archer", CardStats({
            cardType: 0, faction: 0, rarity: 1,
            attack: 12, defense: 8, hp: 50, initiative: 7, speed: 3,
            ammo: 5, manaCost: 4, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeibtrpg6v5y2p6dy4xelqgl3tcp34uk63kda6ef6y6gjl4cqnylhzu");

        // 03: Sniper (Dungeon, Epic, ranged)
        config.addCard("Sniper", CardStats({
            cardType: 0, faction: 3, rarity: 2,
            attack: 22, defense: 15, hp: 75, initiative: 6, speed: 2,
            ammo: 4, manaCost: 7, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeifknwrqu3wjuy2acwrfg4oyonzypg7jguihgtxwlfgsesbxgidham");

        // 04: Spearman (Castle, Rare, melee)
        config.addCard("Spearman", CardStats({
            cardType: 0, faction: 0, rarity: 1,
            attack: 14, defense: 10, hp: 60, initiative: 6, speed: 4,
            ammo: 0, manaCost: 5, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeibddqljkaalriqq7zeskx64riai5ue353bkrh4xc7dwvte2srznou");

        // 05: Knight (Castle, Epic, melee)
        config.addCard("Knight", CardStats({
            cardType: 0, faction: 0, rarity: 2,
            attack: 20, defense: 18, hp: 85, initiative: 5, speed: 3,
            ammo: 0, manaCost: 7, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeihbhkdsqro2vrtf4yk2l2r32tttdm5jbjmubo6uqxgujvpp4o7pe4");

        // 06: Monk (Castle, Rare, melee)
        config.addCard("Monk", CardStats({
            cardType: 0, faction: 0, rarity: 1,
            attack: 10, defense: 9, hp: 55, initiative: 5, speed: 2,
            ammo: 0, manaCost: 5, size: 1, magicResistance: 10,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeihk4q3mwfroj4qvlaxdsa2q5k65ggaez6bnxxhe7xdfprb4yzrndy");

        // 07: Torchbearer (Inferno, Common, melee)
        config.addCard("Torchbearer", CardStats({
            cardType: 0, faction: 1, rarity: 0,
            attack: 7, defense: 4, hp: 35, initiative: 7, speed: 3,
            ammo: 0, manaCost: 2, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeifjp42otvtw65dx6f3uwqlhkqr4olrgiedem3ctsbvs2kvokf63ma");

        // 08: Pyro-Goblin (Inferno, Rare, ranged)
        config.addCard("Pyro-Goblin", CardStats({
            cardType: 0, faction: 1, rarity: 1,
            attack: 13, defense: 8, hp: 50, initiative: 7, speed: 2,
            ammo: 4, manaCost: 4, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeicnqaqwdla27eh4zpxtgdu2c57hxuyk5yhpv2abyvk3bk4k43rvie");

        // 09: Demolitionist (Inferno, Epic, melee)
        config.addCard("Demolitionist", CardStats({
            cardType: 0, faction: 1, rarity: 2,
            attack: 8, defense: 5, hp: 80, initiative: 4, speed: 3,
            ammo: 0, manaCost: 6, size: 1, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeicbgq2pojejwafyutzibi44aq5wujmlphifn4opzzl4dl33hn4aiu");

        // --- SPELLS ---

        // 10: Healing (Castle, Common) — single target heal, 15 base + 2.0× scaling
        config.addCard("Healing", CardStats({
            cardType: 1, faction: 0, rarity: 0,
            attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
            ammo: 0, manaCost: 3, size: 0, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 15, duration: 0, spellTargetType: 0, successChance: 95, school: 0
        }), noAbilities, "bafybeif2t73evrubh75lhchrsyfntptbks7pep63wepik7zjqnjyvyf4tu");

        // 11: Blast (Inferno, Common) — single target damage, 12 base + 2.5× scaling
        config.addCard("Blast", CardStats({
            cardType: 1, faction: 1, rarity: 0,
            attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
            ammo: 0, manaCost: 3, size: 0, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 12, duration: 0, spellTargetType: 0, successChance: 95, school: 0
        }), noAbilities, "bafybeih52oilwjf64rp7ftxxqxm4igg53gapdmanz5zrsxetn3vurftrk4");

        // 12: Storm (Dungeon, Rare) — single target DOT, 8 base + 1.5× scaling, duration-based
        config.addCard("Storm", CardStats({
            cardType: 1, faction: 3, rarity: 1,
            attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
            ammo: 0, manaCost: 5, size: 0, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 8, duration: 1, spellTargetType: 0, successChance: 85, school: 0
        }), noAbilities, "bafybeifcblocof5vyf6cbdaa7geqxh6dzd6mrmna3m6tqyexukbqozoxtq");

        // 13: Surge (Dungeon, Rare) — single target DOT, 10 base + 2.0× scaling, duration-based
        config.addCard("Surge", CardStats({
            cardType: 1, faction: 3, rarity: 1,
            attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
            ammo: 0, manaCost: 5, size: 0, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 10, duration: 1, spellTargetType: 0, successChance: 85, school: 0
        }), noAbilities, "bafybeiaryq3jvcqgyl2l55pito42gdn2ruthjuhjsiqovtj5c72jsa5xi4");

        // 14: Inferno (Inferno, Epic) — AOE damage, 20 base + 3.0× scaling
        config.addCard("Inferno", CardStats({
            cardType: 1, faction: 1, rarity: 2,
            attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
            ammo: 0, manaCost: 8, size: 0, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 20, duration: 0, spellTargetType: 3, successChance: 75, school: 0
        }), noAbilities, "bafybeiah6snlx5a6sf43fvrmqvkeqyteufr56bjj7qtfjq6ub35qcrbd6q");

        // 15: Polymorph (Dungeon, Epic) — single target disable, duration-based
        config.addCard("Polymorph", CardStats({
            cardType: 1, faction: 3, rarity: 2,
            attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
            ammo: 0, manaCost: 7, size: 0, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 1, spellTargetType: 0, successChance: 75, school: 0
        }), noAbilities, "bafybeigqaypdnkzm7zekpdgi2ghm5d5xgjbczmxki5lbdb5gpq35ufc3tq");

        // 16: Curse (Necropolis, Legendary) — single target debuff, duration-based
        config.addCard("Curse", CardStats({
            cardType: 1, faction: 2, rarity: 3,
            attack: 0, defense: 0, hp: 0, initiative: 0, speed: 0,
            ammo: 0, manaCost: 9, size: 0, magicResistance: 0,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 1, spellTargetType: 0, successChance: 65, school: 0
        }), noAbilities, "bafybeib6hv3hzfksi6wl5adzjnbor754k6yxhi467xp4zfkdlxj6x5ws3a");

        // --- BUILDINGS (units with speed 0) ---

        // 17: Tower (Castle, Common, stationary)
        config.addCard("Tower", CardStats({
            cardType: 0, faction: 0, rarity: 0,
            attack: 0, defense: 10, hp: 70, initiative: 0, speed: 0,
            ammo: 0, manaCost: 3, size: 1, magicResistance: 100,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, towerIpfsHash);

        // 18: Barracks (Castle, Rare, stationary)
        config.addCard("Barracks", CardStats({
            cardType: 0, faction: 0, rarity: 1,
            attack: 0, defense: 15, hp: 100, initiative: 0, speed: 0,
            ammo: 0, manaCost: 5, size: 1, magicResistance: 100,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, barracksIpfsHash);

        // 19: Monastery (Castle, Legendary, stationary)
        config.addCard("Monastery", CardStats({
            cardType: 0, faction: 0, rarity: 3,
            attack: 0, defense: 12, hp: 90, initiative: 0, speed: 0,
            ammo: 0, manaCost: 8, size: 1, magicResistance: 100,
            schoolImmunity: 0, effectImmunity: 0,
            spellPower: 0, duration: 0, spellTargetType: 0, successChance: 0, school: 0
        }), noAbilities, "bafybeihx36llvxyad6mcrtulhr4nztwypdib7imerp7zbrxawkkbt6psf4");

        console.log("All 20 cards registered (00-19)");

        vm.stopBroadcast();
    }
}
