// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {CardStats} from "./CardTypes.sol";

library SVGRenderer {
    using Strings for uint256;
    using Strings for uint8;

    function renderCard(
        string memory name,
        CardStats memory stats,
        string memory ipfsHash
    ) internal pure returns (string memory) {
        string memory bgColor = _factionColor(stats.faction);
        string memory borderColor = _rarityBorder(stats.rarity);

        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 375 525" width="375" height="525">',
            _renderBackground(bgColor, borderColor),
            _renderCardArt(ipfsHash),
            _renderName(name),
            _renderManaCost(stats.manaCost),
            _renderRarityGem(stats.rarity),
            stats.cardType == 0 ? _renderUnitStats(stats) : _renderSpellStats(stats),
            _renderTypeBadge(stats.cardType),
            "</svg>"
        );
    }

    function _renderBackground(
        string memory bgColor,
        string memory borderColor
    ) private pure returns (string memory) {
        return string.concat(
            '<rect width="375" height="525" rx="16" fill="', bgColor, '"/>',
            '<rect x="8" y="8" width="359" height="509" rx="12" fill="none" stroke="', borderColor, '" stroke-width="3"/>'
        );
    }

    function _renderCardArt(string memory ipfsHash) private pure returns (string memory) {
        if (bytes(ipfsHash).length == 0) {
            return '<rect x="28" y="60" width="319" height="240" rx="8" fill="#1a1a2e"/>';
        }
        return string.concat(
            '<image x="28" y="60" width="319" height="240" href="ipfs://', ipfsHash,
            '" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 8px)"/>'
        );
    }

    function _renderName(string memory name) private pure returns (string memory) {
        return string.concat(
            '<text x="187" y="40" text-anchor="middle" fill="white" font-family="serif" font-size="20" font-weight="bold">',
            name,
            "</text>"
        );
    }

    function _renderManaCost(uint8 manaCost) private pure returns (string memory) {
        return string.concat(
            '<circle cx="345" cy="35" r="20" fill="#1a3a6e" stroke="#4a9eff" stroke-width="2"/>',
            '<text x="345" y="42" text-anchor="middle" fill="#4a9eff" font-family="sans-serif" font-size="18" font-weight="bold">',
            uint256(manaCost).toString(),
            "</text>"
        );
    }

    function _renderRarityGem(uint8 rarity) private pure returns (string memory) {
        string memory gemColor;
        if (rarity == 0) gemColor = "#a0a0a0";
        else if (rarity == 1) gemColor = "#2196f3";
        else if (rarity == 2) gemColor = "#9c27b0";
        else gemColor = "#ffd700";

        return string.concat(
            '<circle cx="187" cy="315" r="8" fill="', gemColor, '" stroke="white" stroke-width="1.5"/>'
        );
    }

    function _renderUnitStats(CardStats memory stats) private pure returns (string memory) {
        return string.concat(
            _statBox(30, 420, "#c62828", unicode"⚔", stats.attack),
            _statBox(110, 420, "#1565c0", unicode"🛡", stats.defense),
            _statBox(190, 420, "#2e7d32", unicode"♥", stats.hp),
            _statBox(270, 420, "#f9a825", unicode"⚡", stats.initiative),
            _renderSecondaryUnitStats(stats)
        );
    }

    function _renderSecondaryUnitStats(CardStats memory stats) private pure returns (string memory) {
        string memory result = string.concat(
            '<text x="30" y="490" fill="#ccc" font-family="sans-serif" font-size="11">SPD ',
            uint256(stats.speed).toString(),
            "</text>"
        );

        if (stats.ammo > 0) {
            result = string.concat(
                result,
                '<text x="100" y="490" fill="#ccc" font-family="sans-serif" font-size="11">AMMO ',
                uint256(stats.ammo).toString(),
                "</text>"
            );
        }

        if (stats.size == 2) {
            result = string.concat(
                result,
                '<text x="200" y="490" fill="#ccc" font-family="sans-serif" font-size="11">2x2</text>'
            );
        }

        return result;
    }

    function _renderSpellStats(CardStats memory stats) private pure returns (string memory) {
        return string.concat(
            _statBox(30, 420, "#9c27b0", unicode"✦", stats.spellPower),
            _statBox(110, 420, "#00838f", unicode"◷", stats.duration),
            _statBox(190, 420, "#ef6c00", unicode"🎯", stats.successChance),
            '<text x="30" y="490" fill="#ccc" font-family="sans-serif" font-size="11">',
            _schoolName(stats.school),
            "</text>"
        );
    }

    function _statBox(
        uint16 x,
        uint16 y,
        string memory color,
        string memory icon,
        uint8 value
    ) private pure returns (string memory) {
        return string.concat(
            '<rect x="', uint256(x).toString(), '" y="', uint256(y).toString(),
            '" width="65" height="50" rx="6" fill="#0d0d1a" stroke="', color, '" stroke-width="1.5"/>',
            '<text x="', uint256(x + 32).toString(), '" y="', uint256(y + 22).toString(),
            '" text-anchor="middle" fill="', color, '" font-size="14">', icon, "</text>",
            '<text x="', uint256(x + 32).toString(), '" y="', uint256(y + 42).toString(),
            '" text-anchor="middle" fill="white" font-family="sans-serif" font-size="18" font-weight="bold">',
            uint256(value).toString(),
            "</text>"
        );
    }

    function _renderTypeBadge(uint8 cardType) private pure returns (string memory) {
        string memory label = cardType == 0 ? "UNIT" : "SPELL";
        return string.concat(
            '<rect x="28" y="330" width="50" height="20" rx="4" fill="#0d0d1a" opacity="0.85"/>',
            '<text x="53" y="344" text-anchor="middle" fill="#ccc" font-family="sans-serif" font-size="10" font-weight="bold">',
            label,
            "</text>"
        );
    }

    function _factionColor(uint8 faction) private pure returns (string memory) {
        if (faction == 0) return "#1a2744";  // Castle — dark blue-silver
        if (faction == 1) return "#3e1008";  // Inferno — dark red
        if (faction == 2) return "#1a0a2e";  // Necropolis — dark purple
        return "#0a2620";                     // Dungeon — dark teal
    }

    function _rarityBorder(uint8 rarity) private pure returns (string memory) {
        if (rarity == 0) return "#707070";  // Common — gray
        if (rarity == 1) return "#2196f3";  // Rare — blue
        if (rarity == 2) return "#9c27b0";  // Epic — purple
        return "#ffd700";                    // Legendary — gold
    }

    function _schoolName(uint8 school) private pure returns (string memory) {
        if (school == 1) return "FIRE";
        if (school == 2) return "EARTH";
        if (school == 3) return "WATER";
        if (school == 4) return "AIR";
        if (school == 5) return "DARK";
        if (school == 6) return "LIGHT";
        return "";
    }
}
