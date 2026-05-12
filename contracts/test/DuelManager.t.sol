// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DuelManager} from "../src/DuelManager.sol";
import {Duel, IDuelManager} from "../src/interfaces/IDuelManager.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DuelManagerTest is Test {
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
            address(impl), admin,
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

    // --- Create Duel ---

    function test_CreateDuel() public {
        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: 1 ether}();

        assertEq(duelId, 0);
        Duel memory d = dm.getDuel(0);
        assertEq(d.player1, player1);
        assertEq(d.player1Bet, 1 ether);
        assertEq(d.status, 0);
    }

    function test_CreateDuel_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IDuelManager.DuelCreated(0, player1, 1 ether);

        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
    }

    function test_CreateDuel_BelowMinimum_Reverts() public {
        vm.prank(player1);
        vm.expectRevert(DuelManager.BetTooLow.selector);
        dm.createDuel{value: 0.0001 ether}();
    }

    // --- Accept Duel ---

    function test_AcceptDuel() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();

        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        Duel memory d = dm.getDuel(0);
        assertEq(d.player2, player2);
        assertEq(d.lockedBet, 1 ether);
        assertEq(d.status, 1);
    }

    function test_AcceptDuel_ExcessRefunded() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();

        uint256 p2Before = player2.balance;
        vm.prank(player2);
        dm.acceptDuel{value: 2 ether}(0);

        Duel memory d = dm.getDuel(0);
        assertEq(d.lockedBet, 1 ether);
        assertEq(player2.balance, p2Before - 1 ether);
    }

    function test_AcceptDuel_SelfAccept_Reverts() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();

        vm.prank(player1);
        vm.expectRevert(DuelManager.CannotAcceptOwnDuel.selector);
        dm.acceptDuel{value: 1 ether}(0);
    }

    function test_AcceptDuel_WrongStatus_Reverts() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();

        vm.prank(player1);
        dm.cancelDuel(0);

        vm.prank(player2);
        vm.expectRevert(DuelManager.DuelNotOpen.selector);
        dm.acceptDuel{value: 1 ether}(0);
    }

    // --- Cancel Duel ---

    function test_CancelDuel() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();

        uint256 balBefore = player1.balance;
        vm.prank(player1);
        dm.cancelDuel(0);

        assertEq(dm.getDuel(0).status, 3);
        assertEq(player1.balance, balBefore + 1 ether);
    }

    function test_CancelDuel_NotPlayer1_Reverts() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();

        vm.prank(player2);
        vm.expectRevert(DuelManager.NotPlayer1.selector);
        dm.cancelDuel(0);
    }

    function test_CancelDuel_NotOpen_Reverts() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();

        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        vm.prank(player1);
        vm.expectRevert(DuelManager.DuelNotOpen.selector);
        dm.cancelDuel(0);
    }

    // --- Settle Duel ---

    function test_SettleDuel_WinnerGetsPayout() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        bytes memory sig1 = _signResult(0, player1, p1Key);
        bytes memory sig2 = _signResult(0, player1, p2Key);

        uint256 winnerBefore = player1.balance;
        uint256 treasuryBefore = treasury.balance;

        dm.settleDuel(0, player1, sig1, sig2);

        // 5% fee on 2 ETH = 0.1 ETH, winner gets 1.9 ETH
        assertEq(player1.balance, winnerBefore + 1.9 ether);
        assertEq(treasury.balance, treasuryBefore + 0.1 ether);
        assertEq(dm.getDuel(0).status, 2);
        assertEq(dm.getDuel(0).winner, player1);
    }

    function test_SettleDuel_DrawRefundsBoth() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        bytes memory sig1 = _signResult(0, address(0), p1Key);
        bytes memory sig2 = _signResult(0, address(0), p2Key);

        uint256 p1Before = player1.balance;
        uint256 p2Before = player2.balance;

        dm.settleDuel(0, address(0), sig1, sig2);

        assertEq(player1.balance, p1Before + 1 ether);
        assertEq(player2.balance, p2Before + 1 ether);
    }

    function test_SettleDuel_InvalidSignatures_Reverts() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        uint256 fakeKey = 0xDEAD;
        bytes memory sig1 = _signResult(0, player1, p1Key);
        bytes memory sig2 = _signResult(0, player1, fakeKey);

        vm.expectRevert(DuelManager.InvalidSignatures.selector);
        dm.settleDuel(0, player1, sig1, sig2);
    }

    function test_SettleDuel_WrongWinner_Reverts() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        address outsider = address(0xBAD);
        bytes memory sig1 = _signResult(0, outsider, p1Key);
        bytes memory sig2 = _signResult(0, outsider, p2Key);

        vm.expectRevert(DuelManager.WinnerNotParticipant.selector);
        dm.settleDuel(0, outsider, sig1, sig2);
    }

    function test_SettleDuel_DoubleSettle_Reverts() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        bytes memory sig1 = _signResult(0, player1, p1Key);
        bytes memory sig2 = _signResult(0, player1, p2Key);

        dm.settleDuel(0, player1, sig1, sig2);

        vm.expectRevert(DuelManager.DuelNotActive.selector);
        dm.settleDuel(0, player1, sig1, sig2);
    }

    function test_SettleDuel_SwappedSignatureOrder() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        bytes memory sig1 = _signResult(0, player1, p2Key);
        bytes memory sig2 = _signResult(0, player1, p1Key);

        dm.settleDuel(0, player1, sig1, sig2);
        assertEq(dm.getDuel(0).status, 2);
    }

    // --- Expire ---

    function test_ClaimExpired() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        vm.warp(block.timestamp + 24 hours + 1);

        uint256 p1Before = player1.balance;
        uint256 p2Before = player2.balance;

        dm.claimExpired(0);

        assertEq(player1.balance, p1Before + 1 ether);
        assertEq(player2.balance, p2Before + 1 ether);
        assertEq(dm.getDuel(0).status, 4);
    }

    function test_ClaimExpired_TooEarly_Reverts() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        vm.expectRevert(DuelManager.NotExpiredYet.selector);
        dm.claimExpired(0);
    }

    // --- ELO ---

    function test_ELO_StartsAt1000() public view {
        assertEq(dm.getElo(player1), 1000);
        assertEq(dm.getMatchCount(player1), 0);
        assertFalse(dm.isCalibrated(player1));
    }

    function test_ELO_UpdatesOnSettle() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        bytes memory sig1 = _signResult(0, player1, p1Key);
        bytes memory sig2 = _signResult(0, player1, p2Key);
        dm.settleDuel(0, player1, sig1, sig2);

        assertGt(dm.getElo(player1), 1000);
        assertLt(dm.getElo(player2), 1000);
        assertEq(dm.getMatchCount(player1), 1);
        assertEq(dm.getMatchCount(player2), 1);
    }

    function test_ELO_FloorAtZero() public {
        for (uint256 i = 0; i < 100; i++) {
            vm.prank(player1);
            uint256 duelId = dm.createDuel{value: MIN_BET}();
            vm.prank(player2);
            dm.acceptDuel{value: MIN_BET}(duelId);

            bytes memory sig1 = _signResult(duelId, player1, p1Key);
            bytes memory sig2 = _signResult(duelId, player1, p2Key);
            dm.settleDuel(duelId, player1, sig1, sig2);
        }

        // ELO floors near 0 — exact 0 depends on rounding, but must never underflow
        assertLe(dm.getElo(player2), 5);
    }

    function test_ELO_DrawNoChange() public {
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(0);

        bytes memory sig1 = _signResult(0, address(0), p1Key);
        bytes memory sig2 = _signResult(0, address(0), p2Key);
        dm.settleDuel(0, address(0), sig1, sig2);

        assertEq(dm.getElo(player1), 1000);
        assertEq(dm.getElo(player2), 1000);
    }

    function test_Calibration_After25Matches() public {
        for (uint256 i = 0; i < 25; i++) {
            vm.prank(player1);
            uint256 duelId = dm.createDuel{value: MIN_BET}();
            vm.prank(player2);
            dm.acceptDuel{value: MIN_BET}(duelId);

            address winner = i % 2 == 0 ? player1 : player2;
            bytes memory sig1 = _signResult(duelId, winner, p1Key);
            bytes memory sig2 = _signResult(duelId, winner, p2Key);
            dm.settleDuel(duelId, winner, sig1, sig2);
        }

        assertTrue(dm.isCalibrated(player1));
        assertTrue(dm.isCalibrated(player2));
    }

    // --- Admin ---

    function test_SetProtocolFee_OnlyOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        dm.setProtocolFee(300);
    }

    function test_SetMinimumBet_OnlyOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        dm.setMinimumBet(0.01 ether);
    }

    function test_SetTreasury_OnlyOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        dm.setTreasury(player1);
    }

    function test_AdminCanUpdateSettings() public {
        vm.startPrank(admin);
        dm.setProtocolFee(300);
        dm.setMinimumBet(0.01 ether);
        dm.setTreasury(address(99));
        vm.stopPrank();

        assertEq(dm.protocolFee(), 300);
        assertEq(dm.minimumBet(), 0.01 ether);
        assertEq(dm.treasury(), address(99));
    }

    // --- Duel Count ---

    function test_DuelCount() public {
        assertEq(dm.duelCount(), 0);
        vm.prank(player1);
        dm.createDuel{value: 1 ether}();
        assertEq(dm.duelCount(), 1);
        vm.prank(player2);
        dm.createDuel{value: 1 ether}();
        assertEq(dm.duelCount(), 2);
    }

    // --- Arbiter ---

    function test_SetArbiter() public {
        vm.prank(admin);
        dm.setArbiter(address(42));
        assertEq(dm.arbiter(), address(42));
    }

    function test_SetArbiter_OnlyOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        dm.setArbiter(address(42));
    }

    function test_ArbiterSettle_Winner() public {
        // Setup: create + accept duel
        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(duelId);

        // Set arbiter
        vm.prank(admin);
        dm.setArbiter(address(42));

        // Arbiter settles in favor of player1
        uint256 p1Before = player1.balance;
        vm.prank(address(42));
        dm.arbiterSettle(duelId, player1);

        Duel memory d = dm.getDuel(duelId);
        assertEq(d.status, 2); // Settled
        assertEq(d.winner, player1);
        // Winner gets pot minus 5% fee: 2 ETH * 0.95 = 1.9 ETH
        assertEq(player1.balance, p1Before + 1.9 ether);
    }

    function test_ArbiterSettle_Draw() public {
        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(duelId);

        vm.prank(admin);
        dm.setArbiter(address(42));

        uint256 p1Before = player1.balance;
        uint256 p2Before = player2.balance;

        vm.prank(address(42));
        dm.arbiterSettle(duelId, address(0));

        assertEq(player1.balance, p1Before + 1 ether);
        assertEq(player2.balance, p2Before + 1 ether);
    }

    function test_ArbiterSettle_NotArbiter_Reverts() public {
        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: 1 ether}();
        vm.prank(player2);
        dm.acceptDuel{value: 1 ether}(duelId);

        vm.prank(admin);
        dm.setArbiter(address(42));

        vm.prank(player1);
        vm.expectRevert(abi.encodeWithSignature("NotArbiter()"));
        dm.arbiterSettle(duelId, player1);
    }

    function test_ArbiterSettle_NotActive_Reverts() public {
        vm.prank(player1);
        uint256 duelId = dm.createDuel{value: 1 ether}();
        // Still Open, not Active

        vm.prank(admin);
        dm.setArbiter(address(42));

        vm.prank(address(42));
        vm.expectRevert(abi.encodeWithSignature("DuelNotActive()"));
        dm.arbiterSettle(duelId, player1);
    }
}
