// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IGameConfig} from "./interfaces/IGameConfig.sol";
import {CardData, CardStats} from "./libraries/CardTypes.sol";
import {SVGRenderer} from "./libraries/SVGRenderer.sol";

contract CardNFT is ERC721Royalty, Ownable {
    using Strings for uint256;

    IGameConfig public immutable gameConfig;

    uint256 private _nextTokenId;
    mapping(uint256 => uint256) private _tokenCardId;
    mapping(address => bool) public authorizedMinters;

    error UnauthorizedMinter();
    error CardDoesNotExist();

    event AuthorizedMinterSet(address indexed minter, bool authorized);

    modifier onlyMinter() {
        if (!authorizedMinters[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedMinter();
        }
        _;
    }

    constructor(
        address gameConfigProxy,
        address royaltyReceiver,
        uint96 royaltyBps
    ) ERC721("Arcana Arena Cards", "ARENA") Ownable(msg.sender) {
        gameConfig = IGameConfig(gameConfigProxy);
        _setDefaultRoyalty(royaltyReceiver, royaltyBps);
    }

    function mint(address to, uint256 cardId) external onlyMinter returns (uint256 tokenId) {
        _requireCardExists(cardId);
        tokenId = _nextTokenId++;
        _tokenCardId[tokenId] = cardId;
        _safeMint(to, tokenId);
    }

    function batchMint(address to, uint256[] calldata cardIds) external onlyMinter returns (uint256 firstTokenId) {
        firstTokenId = _nextTokenId;
        for (uint256 i = 0; i < cardIds.length; i++) {
            _requireCardExists(cardIds[i]);
            uint256 tokenId = _nextTokenId++;
            _tokenCardId[tokenId] = cardIds[i];
            _safeMint(to, tokenId);
        }
    }

    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        authorizedMinters[minter] = authorized;
        emit AuthorizedMinterSet(minter, authorized);
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function tokenCardId(uint256 tokenId) external view returns (uint256) {
        _requireOwned(tokenId);
        return _tokenCardId[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        uint256 cardId = _tokenCardId[tokenId];
        CardData memory card = gameConfig.getCard(cardId);

        string memory svg = SVGRenderer.renderCard(card.name, card.stats, card.ipfsHash);
        string memory svgBase64 = Base64.encode(bytes(svg));

        string memory json = string.concat(
            '{"name":"', card.name, ' #', tokenId.toString(),
            '","description":"Arcana Arena Card","image":"data:image/svg+xml;base64,', svgBase64,
            '","attributes":', _buildAttributes(card),
            "}"
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function _buildAttributes(CardData memory card) private pure returns (string memory) {
        CardStats memory s = card.stats;

        if (s.cardType == 0) {
            return string.concat(
                '[{"trait_type":"Type","value":"Unit"},',
                '{"trait_type":"Faction","value":"', _factionName(s.faction), '"},',
                '{"trait_type":"Rarity","value":"', _rarityName(s.rarity), '"},',
                '{"display_type":"number","trait_type":"Attack","value":', uint256(s.attack).toString(), "},",
                '{"display_type":"number","trait_type":"Defense","value":', uint256(s.defense).toString(), "},",
                '{"display_type":"number","trait_type":"HP","value":', uint256(s.hp).toString(), "},",
                _buildUnitAttributesTail(s),
                "]"
            );
        }

        return string.concat(
            '[{"trait_type":"Type","value":"Spell"},',
            '{"trait_type":"School","value":"', _schoolName(s.school), '"},',
            '{"trait_type":"Rarity","value":"', _rarityName(s.rarity), '"},',
            '{"display_type":"number","trait_type":"Spell Power","value":', uint256(s.spellPower).toString(), "},",
            '{"display_type":"number","trait_type":"Duration","value":', uint256(s.duration).toString(), "},",
            '{"display_type":"number","trait_type":"Mana Cost","value":', uint256(s.manaCost).toString(), "},",
            '{"display_type":"number","trait_type":"Success Chance","value":', uint256(s.successChance).toString(), "}",
            "]"
        );
    }

    function _buildUnitAttributesTail(CardStats memory s) private pure returns (string memory) {
        return string.concat(
            '{"display_type":"number","trait_type":"Initiative","value":', uint256(s.initiative).toString(), "},",
            '{"display_type":"number","trait_type":"Speed","value":', uint256(s.speed).toString(), "},",
            '{"display_type":"number","trait_type":"Mana Cost","value":', uint256(s.manaCost).toString(), "}",
            s.ammo > 0 ? string.concat(',{"display_type":"number","trait_type":"Ammo","value":', uint256(s.ammo).toString(), "}") : ""
        );
    }

    function _requireCardExists(uint256 cardId) private view {
        if (cardId >= gameConfig.getCardCount()) revert CardDoesNotExist();
    }

    function _factionName(uint8 faction) private pure returns (string memory) {
        if (faction == 0) return "Castle";
        if (faction == 1) return "Inferno";
        if (faction == 2) return "Necropolis";
        return "Dungeon";
    }

    function _rarityName(uint8 rarity) private pure returns (string memory) {
        if (rarity == 0) return "Common";
        if (rarity == 1) return "Rare";
        if (rarity == 2) return "Epic";
        return "Legendary";
    }

    function _schoolName(uint8 school) private pure returns (string memory) {
        if (school == 1) return "Fire";
        if (school == 2) return "Earth";
        if (school == 3) return "Water";
        if (school == 4) return "Air";
        if (school == 5) return "Dark";
        if (school == 6) return "Light";
        return "None";
    }
}
