// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Marketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint96 priceWei;
    }

    IERC721 public immutable cardNFT;

    mapping(uint256 tokenId => Listing) private _listings;

    error NotOwner();
    error NotApproved();
    error AlreadyListed();
    error NotListed();
    error NotSeller();
    error WrongPrice();
    error ZeroPrice();
    error StaleListing();
    error ListingFresh();
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
    event StaleCleared(uint256 indexed tokenId, address indexed staleSeller);

    constructor(address cardNFTAddress) {
        cardNFT = IERC721(cardNFTAddress);
    }

    function list(uint256 tokenId, uint96 priceWei) external {
        if (priceWei == 0) revert ZeroPrice();
        if (cardNFT.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (_listings[tokenId].seller != address(0)) revert AlreadyListed();

        bool approved = cardNFT.getApproved(tokenId) == address(this) ||
            cardNFT.isApprovedForAll(msg.sender, address(this));
        if (!approved) revert NotApproved();

        _listings[tokenId] = Listing({seller: msg.sender, priceWei: priceWei});

        emit Listed(tokenId, msg.sender, priceWei);
    }

    function cancel(uint256 tokenId) external {
        Listing memory listing = _listings[tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (listing.seller != msg.sender) revert NotSeller();

        delete _listings[tokenId];

        emit Cancelled(tokenId, msg.sender);
    }

    function buy(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = _listings[tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (msg.value != listing.priceWei) revert WrongPrice();
        if (cardNFT.ownerOf(tokenId) != listing.seller) revert StaleListing();

        delete _listings[tokenId];

        (address royaltyReceiver, uint256 royaltyAmount) = IERC2981(address(cardNFT)).royaltyInfo(
            tokenId,
            listing.priceWei
        );
        if (royaltyAmount > listing.priceWei) royaltyAmount = listing.priceWei;
        uint256 sellerProceeds = listing.priceWei - royaltyAmount;

        cardNFT.safeTransferFrom(listing.seller, msg.sender, tokenId);

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
    }

    function cleanupStale(uint256 tokenId) external {
        Listing memory listing = _listings[tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (cardNFT.ownerOf(tokenId) == listing.seller) revert ListingFresh();

        delete _listings[tokenId];

        emit StaleCleared(tokenId, listing.seller);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return _listings[tokenId];
    }

    function isListed(uint256 tokenId) external view returns (bool) {
        return _listings[tokenId].seller != address(0);
    }
}
