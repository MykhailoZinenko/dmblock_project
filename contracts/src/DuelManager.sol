// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Duel, IDuelManager} from "./interfaces/IDuelManager.sol";
import {IHeroNFT} from "./interfaces/IHeroNFT.sol";

contract DuelManager is OwnableUpgradeable, ReentrancyGuard, IDuelManager {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @custom:storage-location erc7201:arcanaarena.storage.DuelManager
    struct DuelManagerStorage {
        mapping(uint256 => Duel) duels;
        uint256 duelCount;
        mapping(address => uint256) elo;
        mapping(address => uint256) matchCount;
        uint256 protocolFee;
        uint256 minimumBet;
        address treasury;
        uint32 seasonId;
        address arbiter;
        IHeroNFT heroNFT;
    }

    // keccak256(abi.encode(uint256(keccak256("arcanaarena.storage.DuelManager")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_LOCATION =
        0x8c0b8c55e45f2569de6b7b8a8455d0a5a6e0b25d88e3a9b1c5e3f7d2a1b0c300;

    uint256 public constant EXPIRY_DURATION = 24 hours;
    uint256 public constant STARTING_ELO = 1000;
    uint256 public constant CALIBRATION_MATCHES = 25;
    uint256 public constant K_FACTOR = 32;
    uint32 public constant WINNER_XP = 100;
    uint32 public constant LOSER_XP = 30;

    error BetTooLow();
    error DuelNotOpen();
    error DuelNotActive();
    error NotPlayer1();
    error CannotAcceptOwnDuel();
    error NotExpiredYet();
    error InvalidSignatures();
    error WinnerNotParticipant();
    error NotArbiter();

    function _getStorage() private pure returns (DuelManagerStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address treasury_, uint256 protocolFee_, uint256 minimumBet_) external initializer {
        __Ownable_init(owner_);
        DuelManagerStorage storage s = _getStorage();
        s.treasury = treasury_;
        s.protocolFee = protocolFee_;
        s.minimumBet = minimumBet_;
        s.seasonId = 1;
    }

    function createDuel(uint256 heroId) external payable returns (uint256 duelId) {
        DuelManagerStorage storage s = _getStorage();
        if (msg.value < s.minimumBet) revert BetTooLow();

        duelId = s.duelCount++;
        Duel storage d = s.duels[duelId];
        d.player1 = msg.sender;
        d.player1Bet = msg.value;
        d.player1HeroId = heroId;
        d.createdAt = block.timestamp;

        emit DuelCreated(duelId, msg.sender, msg.value);
    }

    function acceptDuel(uint256 duelId, uint256 heroId) external payable nonReentrant {
        DuelManagerStorage storage s = _getStorage();
        Duel storage d = s.duels[duelId];
        if (d.status != 0) revert DuelNotOpen();
        if (msg.sender == d.player1) revert CannotAcceptOwnDuel();
        if (msg.value < s.minimumBet) revert BetTooLow();

        d.player2 = msg.sender;
        d.player2Bet = msg.value;
        d.player2HeroId = heroId;
        d.lockedBet = d.player1Bet < msg.value ? d.player1Bet : msg.value;
        d.status = 1; // Active

        uint256 excess1 = d.player1Bet - d.lockedBet;
        uint256 excess2 = msg.value - d.lockedBet;

        if (excess1 > 0) {
            (bool ok,) = d.player1.call{value: excess1}("");
            require(ok, "Refund p1 failed");
        }
        if (excess2 > 0) {
            (bool ok,) = msg.sender.call{value: excess2}("");
            require(ok, "Refund p2 failed");
        }

        emit DuelAccepted(duelId, msg.sender, d.lockedBet);
    }

    function cancelDuel(uint256 duelId) external nonReentrant {
        DuelManagerStorage storage s = _getStorage();
        Duel storage d = s.duels[duelId];
        if (d.status != 0) revert DuelNotOpen();
        if (msg.sender != d.player1) revert NotPlayer1();

        d.status = 3; // Cancelled

        (bool ok,) = d.player1.call{value: d.player1Bet}("");
        require(ok, "Refund failed");

        emit DuelCancelled(duelId);
    }

    function settleDuel(uint256 duelId, address winner, bytes calldata sig1, bytes calldata sig2) external nonReentrant {
        DuelManagerStorage storage s = _getStorage();
        Duel storage d = s.duels[duelId];
        if (d.status != 1) revert DuelNotActive();
        if (winner != address(0) && winner != d.player1 && winner != d.player2) revert WinnerNotParticipant();

        bytes32 messageHash = keccak256(abi.encodePacked(duelId, winner));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();

        address signer1 = ethSignedHash.recover(sig1);
        address signer2 = ethSignedHash.recover(sig2);

        bool validSigners = (signer1 == d.player1 && signer2 == d.player2) ||
                            (signer1 == d.player2 && signer2 == d.player1);
        if (!validSigners) revert InvalidSignatures();

        d.status = 2; // Settled
        d.settledAt = block.timestamp;
        d.winner = winner;

        uint256 totalPot = d.lockedBet * 2;

        if (winner == address(0)) {
            (bool ok1,) = d.player1.call{value: d.lockedBet}("");
            require(ok1, "Refund p1 failed");
            (bool ok2,) = d.player2.call{value: d.lockedBet}("");
            require(ok2, "Refund p2 failed");
        } else {
            uint256 fee = totalPot * s.protocolFee / 10000;
            uint256 payout = totalPot - fee;

            (bool ok1,) = winner.call{value: payout}("");
            require(ok1, "Payout failed");
            if (fee > 0) {
                (bool ok2,) = s.treasury.call{value: fee}("");
                require(ok2, "Fee transfer failed");
            }

            address loser = winner == d.player1 ? d.player2 : d.player1;
            _updateElo(winner, loser, s);
            _awardXp(d, winner, s);

            emit DuelSettled(duelId, winner, payout, fee);
        }
    }

    function claimExpired(uint256 duelId) external nonReentrant {
        DuelManagerStorage storage s = _getStorage();
        Duel storage d = s.duels[duelId];
        if (d.status != 1) revert DuelNotActive();
        if (block.timestamp <= d.createdAt + EXPIRY_DURATION) revert NotExpiredYet();

        d.status = 4; // Expired

        (bool ok1,) = d.player1.call{value: d.lockedBet}("");
        require(ok1, "Refund p1 failed");
        (bool ok2,) = d.player2.call{value: d.lockedBet}("");
        require(ok2, "Refund p2 failed");

        emit DuelExpired(duelId);
    }

    function arbiterSettle(uint256 duelId, address winner) external nonReentrant {
        DuelManagerStorage storage s = _getStorage();
        if (msg.sender != s.arbiter) revert NotArbiter();
        Duel storage d = s.duels[duelId];
        if (d.status != 1) revert DuelNotActive();
        if (winner != address(0) && winner != d.player1 && winner != d.player2) revert WinnerNotParticipant();

        d.status = 2; // Settled
        d.settledAt = block.timestamp;
        d.winner = winner;

        uint256 totalPot = d.lockedBet * 2;

        if (winner == address(0)) {
            (bool ok1,) = d.player1.call{value: d.lockedBet}("");
            require(ok1, "Refund p1 failed");
            (bool ok2,) = d.player2.call{value: d.lockedBet}("");
            require(ok2, "Refund p2 failed");
        } else {
            uint256 fee = totalPot * s.protocolFee / 10000;
            uint256 payout = totalPot - fee;

            (bool ok1,) = winner.call{value: payout}("");
            require(ok1, "Payout failed");
            if (fee > 0) {
                (bool ok2,) = s.treasury.call{value: fee}("");
                require(ok2, "Fee transfer failed");
            }

            address loser = winner == d.player1 ? d.player2 : d.player1;
            _updateElo(winner, loser, s);
            _awardXp(d, winner, s);

            emit DuelSettled(duelId, winner, payout, fee);
        }
    }

    // --- ELO ---

    function _updateElo(address winner, address loser, DuelManagerStorage storage s) internal {
        uint256 winnerElo = s.elo[winner] == 0 ? STARTING_ELO : s.elo[winner];
        uint256 loserElo = s.elo[loser] == 0 ? STARTING_ELO : s.elo[loser];

        // ELO formula using fixed-point math (scaled by 1000)
        // expectedScore = 1 / (1 + 10^((opponent - player) / 400))
        // Approximation: use linear interpolation for the sigmoid
        uint256 eloDiff;
        bool winnerStronger = winnerElo >= loserElo;
        unchecked {
            eloDiff = winnerStronger ? winnerElo - loserElo : loserElo - winnerElo;
        }
        if (eloDiff > 400) eloDiff = 400;

        // Winner gains K * (1 - expected), loser loses K * expected
        // When eloDiff=0: gain = K/2 = 16. When diff=400 favoring winner: gain ~= 5
        uint256 winnerGain;
        uint256 loserLoss;

        if (winnerStronger) {
            winnerGain = K_FACTOR * (400 - eloDiff) / 800;
            loserLoss = K_FACTOR - winnerGain;
        } else {
            winnerGain = K_FACTOR * (400 + eloDiff) / 800;
            loserLoss = K_FACTOR - winnerGain;
        }
        if (winnerGain == 0) winnerGain = 1;

        s.elo[winner] = winnerElo + winnerGain;
        s.elo[loser] = loserElo > loserLoss ? loserElo - loserLoss : 0;

        s.matchCount[winner]++;
        s.matchCount[loser]++;

        emit EloUpdated(winner, s.elo[winner], s.matchCount[winner]);
        emit EloUpdated(loser, s.elo[loser], s.matchCount[loser]);
    }

    function _awardXp(Duel storage d, address winner, DuelManagerStorage storage s) internal {
        if (address(s.heroNFT) == address(0)) return;
        if (winner == address(0)) return; // draw — no XP
        uint256 winnerHeroId = winner == d.player1 ? d.player1HeroId : d.player2HeroId;
        uint256 loserHeroId = winner == d.player1 ? d.player2HeroId : d.player1HeroId;
        s.heroNFT.addXp(winnerHeroId, WINNER_XP);
        s.heroNFT.addXp(loserHeroId, LOSER_XP);
    }

    // --- Admin ---

    function setProtocolFee(uint256 bps) external onlyOwner {
        _getStorage().protocolFee = bps;
    }

    function setMinimumBet(uint256 amount) external onlyOwner {
        _getStorage().minimumBet = amount;
    }

    function setTreasury(address treasury_) external onlyOwner {
        _getStorage().treasury = treasury_;
    }

    function setSeasonId(uint32 seasonId_) external onlyOwner {
        _getStorage().seasonId = seasonId_;
    }

    function setArbiter(address arbiter_) external onlyOwner {
        _getStorage().arbiter = arbiter_;
    }

    function setHeroNFT(address heroNFT_) external onlyOwner {
        _getStorage().heroNFT = IHeroNFT(heroNFT_);
    }

    // --- Views ---

    function getDuel(uint256 duelId) external view returns (Duel memory) {
        return _getStorage().duels[duelId];
    }

    function getElo(address player) external view returns (uint256) {
        uint256 elo = _getStorage().elo[player];
        return elo == 0 ? STARTING_ELO : elo;
    }

    function getMatchCount(address player) external view returns (uint256) {
        return _getStorage().matchCount[player];
    }

    function isCalibrated(address player) external view returns (bool) {
        return _getStorage().matchCount[player] >= CALIBRATION_MATCHES;
    }

    function protocolFee() external view returns (uint256) {
        return _getStorage().protocolFee;
    }

    function minimumBet() external view returns (uint256) {
        return _getStorage().minimumBet;
    }

    function treasury() external view returns (address) {
        return _getStorage().treasury;
    }

    function seasonId() external view returns (uint32) {
        return _getStorage().seasonId;
    }

    function arbiter() external view returns (address) {
        return _getStorage().arbiter;
    }

    function duelCount() external view returns (uint256) {
        return _getStorage().duelCount;
    }
}
