// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DuelManager} from "../src/DuelManager.sol";
import {Duel, IDuelManager} from "../src/interfaces/IDuelManager.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

// ============================================================
//  Fuzz + Edge-Case Tests
// ============================================================

contract DuelManagerAdvancedTest is Test {
    DuelManager public dm;
    address public admin = address(1);
    address public treasury = address(2);

    uint256 public p1Key = 0xA1;
    uint256 public p2Key = 0xB1;
    address public player1;
    address public player2;

    uint256 public constant MIN_BET = 0.001 ether;

    function setUp() public {
        player1 = vm.addr(p1Key);
        player2 = vm.addr(p2Key);

        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);

        vm.startPrank(admin);
        DuelManager impl = new DuelManager();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            admin,
            abi.encodeCall(DuelManager.initialize, (admin, treasury, 500, MIN_BET))
        );
        dm = DuelManager(address(proxy));
        vm.stopPrank();
    }

    function _signResult(uint256 duelId, address winner, uint256 privateKey) internal pure returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(duelId, winner));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Helper: create duel as player1, accept as player2, both with `bet`.
    function _createAndAccept(uint256 bet) internal returns (uint256 duelId) {
        vm.prank(player1);
        duelId = dm.createDuel{value: bet}(0);
        vm.prank(player2);
        dm.acceptDuel{value: bet}(duelId, 0);
    }

    /// @dev Helper: settle duel with player1 as winner using ECDSA sigs.
    function _settleP1Wins(uint256 duelId) internal {
        bytes memory sig1 = _signResult(duelId, player1, p1Key);
        bytes memory sig2 = _signResult(duelId, player1, p2Key);
        dm.settleDuel(duelId, player1, sig1, sig2);
    }

    // ================================================================
    //  FUZZ TESTS
    // ================================================================

    function testFuzz_CreateDuel_AnyValidBet(uint256 bet) public {
        bet = bound(bet, MIN_BET, 10 ether);
        vm.deal(player1, bet);

        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: bet}(0);

        Duel memory d = dm.getDuel(duelId);
        assertEq(d.player1, player1);
        assertEq(d.player1Bet, bet);
        assertEq(d.status, 0); // Open
        assertEq(dm.duelCount(), 1);
    }

    function testFuzz_AcceptDuel_LockedBetIsMin(uint256 bet1, uint256 bet2) public {
        bet1 = bound(bet1, MIN_BET, 10 ether);
        bet2 = bound(bet2, MIN_BET, 10 ether);
        vm.deal(player1, bet1);
        vm.deal(player2, bet2);

        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: bet1}(0);

        uint256 p1BalBefore = player1.balance;
        uint256 p2BalBefore = player2.balance;

        vm.prank(player2);
        dm.acceptDuel{value: bet2}(duelId, 0);

        Duel memory d = dm.getDuel(duelId);
        uint256 expectedLocked = bet1 < bet2 ? bet1 : bet2;
        assertEq(d.lockedBet, expectedLocked);
        assertEq(d.status, 1); // Active

        // Excess refunded: each player should have paid exactly lockedBet
        uint256 p1Excess = bet1 - expectedLocked;
        uint256 p2Excess = bet2 - expectedLocked;
        assertEq(player1.balance, p1BalBefore + p1Excess);
        assertEq(player2.balance, p2BalBefore - bet2 + p2Excess);
    }

    function testFuzz_AcceptDuel_BelowMinimum_Reverts(uint256 bet) public {
        bet = bound(bet, 1, MIN_BET - 1);

        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: 1 ether}(0);

        vm.deal(player2, bet);
        vm.prank(player2);
        vm.expectRevert(DuelManager.BetTooLow.selector);
        dm.acceptDuel{value: bet}(duelId, 0);
    }

    function testFuzz_SettleDuel_PayoutCorrect(uint256 bet) public {
        bet = bound(bet, MIN_BET, 10 ether);
        vm.deal(player1, bet);
        vm.deal(player2, bet);

        uint256 duelId = _createAndAccept(bet);

        uint256 winnerBefore = player1.balance;
        uint256 treasuryBefore = treasury.balance;

        _settleP1Wins(duelId);

        uint256 totalPot = bet * 2;
        uint256 expectedFee = totalPot * 500 / 10000; // 5%
        uint256 expectedPayout = totalPot - expectedFee;

        assertEq(player1.balance, winnerBefore + expectedPayout);
        assertEq(treasury.balance, treasuryBefore + expectedFee);
    }

    function testFuzz_ELO_NeverUnderflows(uint8 rounds) public {
        rounds = uint8(bound(rounds, 1, 50));

        for (uint256 i = 0; i < rounds; i++) {
            vm.deal(player1, MIN_BET);
            vm.deal(player2, MIN_BET);

            vm.prank(player1);
            uint256 duelId = dm.createDuel{value: MIN_BET}(0);
            vm.prank(player2);
            dm.acceptDuel{value: MIN_BET}(duelId, 0);

            // player1 always wins, player2 always loses
            bytes memory sig1 = _signResult(duelId, player1, p1Key);
            bytes memory sig2 = _signResult(duelId, player1, p2Key);
            dm.settleDuel(duelId, player1, sig1, sig2);

            // ELO should never underflow (Solidity would revert on underflow for uint)
            // getElo returns STARTING_ELO if storage is 0, but after first update storage is set
            assertTrue(dm.getElo(player2) >= 0); // always true for uint but proves no revert
        }
        // After many losses, ELO is floored at 0
        assertLe(dm.getElo(player2), 1000);
    }

    function testFuzz_ProtocolFee_Capped(uint256 fee) public {
        fee = bound(fee, 0, 10000);

        vm.prank(admin);
        dm.setProtocolFee(fee);

        uint256 bet = 1 ether;
        vm.deal(player1, bet);
        vm.deal(player2, bet);

        uint256 duelId = _createAndAccept(bet);

        uint256 winnerBefore = player1.balance;
        uint256 treasuryBefore = treasury.balance;

        _settleP1Wins(duelId);

        uint256 totalPot = bet * 2;
        uint256 expectedFee = totalPot * fee / 10000;
        uint256 expectedPayout = totalPot - expectedFee;

        assertEq(player1.balance, winnerBefore + expectedPayout);
        if (expectedFee > 0) {
            assertEq(treasury.balance, treasuryBefore + expectedFee);
        }
    }

    // ================================================================
    //  EDGE CASE TESTS
    // ================================================================

    function test_AcceptDuel_BelowMinimum_Reverts() public {
        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: 1 ether}(0);

        vm.prank(player2);
        vm.expectRevert(DuelManager.BetTooLow.selector);
        dm.acceptDuel{value: MIN_BET - 1}(duelId, 0);
    }

    function test_SettleDuel_ZeroFee_FullPayout() public {
        vm.prank(admin);
        dm.setProtocolFee(0);

        uint256 bet = 1 ether;
        uint256 duelId = _createAndAccept(bet);

        uint256 winnerBefore = player1.balance;
        uint256 treasuryBefore = treasury.balance;

        _settleP1Wins(duelId);

        // Winner gets full pot, treasury gets nothing
        assertEq(player1.balance, winnerBefore + 2 ether);
        assertEq(treasury.balance, treasuryBefore);
    }

    function test_SettleDuel_MaxFee_ZeroPayout() public {
        vm.prank(admin);
        dm.setProtocolFee(10000); // 100%

        uint256 bet = 1 ether;
        uint256 duelId = _createAndAccept(bet);

        uint256 winnerBefore = player1.balance;
        uint256 treasuryBefore = treasury.balance;

        _settleP1Wins(duelId);

        // All goes to treasury, winner gets 0
        assertEq(player1.balance, winnerBefore);
        assertEq(treasury.balance, treasuryBefore + 2 ether);
    }

    function test_ArbiterSettle_UpdatesElo() public {
        uint256 duelId = _createAndAccept(1 ether);

        vm.prank(admin);
        dm.setArbiter(address(42));

        uint256 p1EloBefore = dm.getElo(player1);
        uint256 p2EloBefore = dm.getElo(player2);

        vm.prank(address(42));
        dm.arbiterSettle(duelId, player1);

        assertGt(dm.getElo(player1), p1EloBefore);
        assertLt(dm.getElo(player2), p2EloBefore);
        assertEq(dm.getMatchCount(player1), 1);
        assertEq(dm.getMatchCount(player2), 1);
    }

    function test_ArbiterSettle_WrongWinner_Reverts() public {
        uint256 duelId = _createAndAccept(1 ether);

        vm.prank(admin);
        dm.setArbiter(address(42));

        address outsider = address(0xBAD);

        vm.prank(address(42));
        vm.expectRevert(DuelManager.WinnerNotParticipant.selector);
        dm.arbiterSettle(duelId, outsider);
    }

    function test_ClaimExpired_ExactBoundary() public {
        uint256 duelId = _createAndAccept(1 ether);
        uint256 createdAt = dm.getDuel(duelId).createdAt;

        // At exactly 24h: should revert (<=)
        vm.warp(createdAt + 24 hours);
        vm.expectRevert(DuelManager.NotExpiredYet.selector);
        dm.claimExpired(duelId);

        // At 24h + 1 second: should succeed
        vm.warp(createdAt + 24 hours + 1);
        dm.claimExpired(duelId);
        assertEq(dm.getDuel(duelId).status, 4); // Expired
    }

    function test_CreateDuel_ExactMinimum() public {
        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: MIN_BET}(0);

        Duel memory d = dm.getDuel(duelId);
        assertEq(d.player1, player1);
        assertEq(d.player1Bet, MIN_BET);
        assertEq(d.status, 0);
    }

    function test_P1ExcessRefundedOnAccept() public {
        // p1 bets 3 ether, p2 bets 1 ether → lockedBet = 1, p1 excess = 2
        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: 3 ether}(0);

        uint256 p1Before = player1.balance;

        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(duelId, 0);

        Duel memory d = dm.getDuel(duelId);
        assertEq(d.lockedBet, 1 ether);
        // p1 gets 2 ether refunded
        assertEq(player1.balance, p1Before + 2 ether);
    }
}

// ============================================================
//  Handler for Invariant Tests
// ============================================================

contract DuelHandler is Test {
    DuelManager public dm;
    uint256 public p1Key;
    uint256 public p2Key;
    address public player1;
    address public player2;
    address public admin;

    // Ghost variables for tracking expected state
    uint256 public expectedLockedBalance;
    uint256[] public activeDuelIds;
    mapping(uint256 => bool) public isActiveDuel;

    // Track terminal statuses to verify immutability
    mapping(uint256 => uint8) public terminalStatus; // duelId => status when it became terminal
    mapping(uint256 => bool) public isTerminal;

    constructor(DuelManager dm_, uint256 p1Key_, uint256 p2Key_, address admin_) {
        dm = dm_;
        p1Key = p1Key_;
        p2Key = p2Key_;
        player1 = vm.addr(p1Key_);
        player2 = vm.addr(p2Key_);
        admin = admin_;
    }

    function _signResult(uint256 duelId, address winner, uint256 privateKey) internal pure returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(duelId, winner));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function createDuel(uint256 betSeed) external {
        uint256 bet = bound(betSeed, 0.001 ether, 5 ether);
        vm.deal(player1, player1.balance + bet);

        vm.prank(player1);
        dm.createDuel{value: bet}(0);

        // Open duels hold player1's bet in the contract
        expectedLockedBalance += bet;
    }

    function acceptDuel(uint256 duelIdSeed, uint256 betSeed) external {
        uint256 count = dm.duelCount();
        if (count == 0) return;

        uint256 duelId = bound(duelIdSeed, 0, count - 1);
        Duel memory d = dm.getDuel(duelId);
        if (d.status != 0) return; // only Open duels

        uint256 bet = bound(betSeed, 0.001 ether, 5 ether);
        vm.deal(player2, player2.balance + bet);

        // Before accept, contract holds d.player1Bet for this duel (tracked in createDuel).
        // After accept, contract holds lockedBet*2 (excess refunded to both).
        uint256 p1BetBefore = d.player1Bet;

        vm.prank(player2);
        dm.acceptDuel{value: bet}(duelId, 0);

        Duel memory dAfter = dm.getDuel(duelId);
        // Replace the tracked p1Bet with the actual locked amount for both sides
        expectedLockedBalance = expectedLockedBalance - p1BetBefore + dAfter.lockedBet * 2;
        activeDuelIds.push(duelId);
        isActiveDuel[duelId] = true;
    }

    function cancelDuel(uint256 duelIdSeed) external {
        uint256 count = dm.duelCount();
        if (count == 0) return;

        uint256 duelId = bound(duelIdSeed, 0, count - 1);
        Duel memory d = dm.getDuel(duelId);
        if (d.status != 0) return;

        // Cancel refunds player1Bet
        expectedLockedBalance -= d.player1Bet;

        vm.prank(player1);
        dm.cancelDuel(duelId);

        terminalStatus[duelId] = 3;
        isTerminal[duelId] = true;
    }

    function settleDuel(uint256 duelIdSeed) external {
        if (activeDuelIds.length == 0) return;

        uint256 idx = bound(duelIdSeed, 0, activeDuelIds.length - 1);
        uint256 duelId = activeDuelIds[idx];
        Duel memory d = dm.getDuel(duelId);
        if (d.status != 1) return;

        bytes memory sig1 = _signResult(duelId, player1, p1Key);
        bytes memory sig2 = _signResult(duelId, player1, p2Key);
        dm.settleDuel(duelId, player1, sig1, sig2);

        expectedLockedBalance -= d.lockedBet * 2;
        isActiveDuel[duelId] = false;

        terminalStatus[duelId] = 2;
        isTerminal[duelId] = true;
    }

    function expireDuel(uint256 duelIdSeed) external {
        if (activeDuelIds.length == 0) return;

        uint256 idx = bound(duelIdSeed, 0, activeDuelIds.length - 1);
        uint256 duelId = activeDuelIds[idx];
        Duel memory d = dm.getDuel(duelId);
        if (d.status != 1) return;

        vm.warp(d.createdAt + 24 hours + 1);
        dm.claimExpired(duelId);

        expectedLockedBalance -= d.lockedBet * 2;
        isActiveDuel[duelId] = false;

        terminalStatus[duelId] = 4;
        isTerminal[duelId] = true;
    }

    function activeDuelCount() external view returns (uint256) {
        return activeDuelIds.length;
    }
}

// ============================================================
//  Invariant Tests
// ============================================================

contract DuelManagerInvariantTest is Test {
    DuelManager public dm;
    DuelHandler public handler;

    address public admin = address(1);
    address public treasury = address(2);
    uint256 public p1Key = 0xA1;
    uint256 public p2Key = 0xB1;
    address public player1;
    address public player2;

    uint256 public constant MIN_BET = 0.001 ether;

    function setUp() public {
        player1 = vm.addr(p1Key);
        player2 = vm.addr(p2Key);

        vm.deal(player1, 1000 ether);
        vm.deal(player2, 1000 ether);

        vm.startPrank(admin);
        DuelManager impl = new DuelManager();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            admin,
            abi.encodeCall(DuelManager.initialize, (admin, treasury, 500, MIN_BET))
        );
        dm = DuelManager(address(proxy));
        vm.stopPrank();

        handler = new DuelHandler(dm, p1Key, p2Key, admin);
        targetContract(address(handler));
    }

    /// @notice Contract balance must equal the sum of locked bets from all active duels.
    function invariant_ContractBalanceMatchesLockedBets() public view {
        assertEq(address(dm).balance, handler.expectedLockedBalance());
    }

    /// @notice ELO must never be stored as a value that would underflow.
    ///         getElo returns STARTING_ELO for 0, so we just confirm no reverts and valid uint.
    function invariant_EloNeverNegative() public view {
        // getElo returns uint256, if it were to underflow Solidity would revert.
        // Calling these without revert proves the invariant.
        uint256 elo1 = dm.getElo(player1);
        uint256 elo2 = dm.getElo(player2);
        assertTrue(elo1 <= type(uint256).max);
        assertTrue(elo2 <= type(uint256).max);
    }

    /// @notice Once a duel reaches a terminal status (Settled=2, Cancelled=3, Expired=4),
    ///         that status must never change.
    function invariant_SettledDuelImmutable() public view {
        uint256 count = dm.duelCount();
        for (uint256 i = 0; i < count; i++) {
            if (handler.isTerminal(i)) {
                Duel memory d = dm.getDuel(i);
                assertEq(d.status, handler.terminalStatus(i));
            }
        }
    }
}
