// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICardNFT {
    function batchMint(address to, uint256[] calldata cardIds) external returns (uint256 firstTokenId);
}
