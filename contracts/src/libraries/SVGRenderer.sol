// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {CardStats} from "./CardTypes.sol";

library SVGRenderer {
    using Strings for uint256;

    function renderCard(
        string memory,
        CardStats memory stats,
        string memory ipfsHash
    ) internal pure returns (string memory) {
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 1050" width="750" height="1050">',
            '<image width="750" height="1050" href="https://gateway.pinata.cloud/ipfs/', ipfsHash, '"/>',
            stats.cardType == 0 ? _unitNumbers(stats) : _spellNumbers(stats),
            "</svg>"
        );
    }

    function _unitNumbers(CardStats memory stats) private pure returns (string memory) {
        return string.concat(
            _statNumber(119, 953, stats.attack),
            _statNumber(247, 953, stats.hp),
            _statNumber(375, 953, stats.defense),
            _statNumber(503, 953, stats.initiative),
            _statNumber(631, 953, stats.manaCost)
        );
    }

    function _spellNumbers(CardStats memory stats) private pure returns (string memory) {
        return string.concat(
            _statNumber(119, 953, stats.spellPower),
            _statNumber(247, 953, stats.duration),
            _statNumber(375, 953, stats.successChance),
            _statNumber(503, 953, stats.manaCost),
            _statNumber(631, 953, stats.school)
        );
    }

    function _statNumber(uint16 x, uint16 y, uint8 value) private pure returns (string memory) {
        return string.concat(
            '<text x="', uint256(x).toString(), '" y="', uint256(y).toString(),
            '" text-anchor="middle" fill="white" font-family="serif" font-size="28" font-weight="bold">',
            uint256(value).toString(),
            "</text>"
        );
    }
}
