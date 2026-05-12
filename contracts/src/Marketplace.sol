// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICardNFT} from "./interfaces/ICardNFT.sol";

interface IPackOpeningRecord {
    function recordTrade(uint256 cardId, uint96 priceWei) external;
}

contract Marketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint96 priceWei;
    }

    IERC721 public immutable cardNFT;
    /// @notice Optional PackOpening hook for trade stats. address(0) disables recording.
    address public immutable packOpening;

    mapping(uint256 tokenId => Listing) private _listings;

    error NotOwner();
    error NotApproved();
    error NotListed();
    error NotSeller();
    error WrongPrice();
    error ZeroPrice();
    error PayoutFailed();

    event Listed(uint256 indexed tokenId, address indexed seller, uint96 priceWei);
    event Cancelled(uint256 indexed tokenId, address indexed seller);
    event Sold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint96 priceWei,
        address royaltyReceiver,
        uint256 royaltyAmount
    );

    constructor(address cardNFTAddress, address packOpeningAddress) {
        cardNFT = IERC721(cardNFTAddress);
        packOpening = packOpeningAddress;
    }

    /// @notice List a card for sale. The NFT is escrowed by this contract until cancelled or bought.
    function list(uint256 tokenId, uint96 priceWei) external {
        if (priceWei == 0) revert ZeroPrice();
        if (cardNFT.ownerOf(tokenId) != msg.sender) revert NotOwner();

        bool approved = cardNFT.getApproved(tokenId) == address(this) ||
            cardNFT.isApprovedForAll(msg.sender, address(this));
        if (!approved) revert NotApproved();

        _listings[tokenId] = Listing({seller: msg.sender, priceWei: priceWei});

        cardNFT.transferFrom(msg.sender, address(this), tokenId);

        emit Listed(tokenId, msg.sender, priceWei);
    }

    /// @notice Cancel a listing and return the escrowed NFT to the seller.
    function cancel(uint256 tokenId) external {
        Listing memory listing = _listings[tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (listing.seller != msg.sender) revert NotSeller();

        delete _listings[tokenId];

        cardNFT.transferFrom(address(this), listing.seller, tokenId);

        emit Cancelled(tokenId, msg.sender);
    }

    /// @notice Buy a listed card. Pays royalty per ERC-2981, remainder to the seller.
    function buy(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = _listings[tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (msg.value != listing.priceWei) revert WrongPrice();

        delete _listings[tokenId];

        (address royaltyReceiver, uint256 royaltyAmount) = IERC2981(address(cardNFT)).royaltyInfo(
            tokenId,
            listing.priceWei
        );
        if (royaltyAmount > listing.priceWei) royaltyAmount = listing.priceWei;
        uint256 sellerProceeds = listing.priceWei - royaltyAmount;

        cardNFT.safeTransferFrom(address(this), msg.sender, tokenId);

        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool okR, ) = royaltyReceiver.call{value: royaltyAmount}("");
            if (!okR) revert PayoutFailed();
        } else {
            sellerProceeds = listing.priceWei;
        }

        if (sellerProceeds > 0) {
            (bool okS, ) = listing.seller.call{value: sellerProceeds}("");
            if (!okS) revert PayoutFailed();
        }

        emit Sold(tokenId, listing.seller, msg.sender, listing.priceWei, royaltyReceiver, royaltyAmount);

        // Best-effort trade-stats hook. Wrapped in try/catch so a broken or
        // un-authorized PackOpening can never block a settled trade.
        if (packOpening != address(0)) {
            try ICardNFT(address(cardNFT)).tokenCardId(tokenId) returns (uint256 cardId) {
                try IPackOpeningRecord(packOpening).recordTrade(cardId, listing.priceWei) {} catch {}
            } catch {}
        }
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return _listings[tokenId];
    }

    function isListed(uint256 tokenId) external view returns (bool) {
        return _listings[tokenId].seller != address(0);
    }
}
