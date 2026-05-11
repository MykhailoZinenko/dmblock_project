// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {FreedomRecord} from "../src/FreedomRecord.sol";
import {IFreedomRecord} from "../src/interfaces/IFreedomRecord.sol";

contract FreedomRecordTest is Test {
    FreedomRecord public record;
    address public duelManager = address(100);
    address public winner = address(0xA);
    address public unauthorized = address(0xB);

    function setUp() public {
        record = new FreedomRecord(duelManager);
    }

    function test_RecordFreedom() public {
        vm.prank(duelManager);
        record.recordFreedom(1, winner);

        assertTrue(record.isFreed(winner));
        assertEq(record.getSeasonWinner(1), winner);
    }

    function test_RecordFreedom_EmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit IFreedomRecord.FreedomRecorded(1, winner);

        vm.prank(duelManager);
        record.recordFreedom(1, winner);
    }

    function test_RecordFreedom_OnlyDuelManager() public {
        vm.prank(unauthorized);
        vm.expectRevert(FreedomRecord.OnlyDuelManager.selector);
        record.recordFreedom(1, winner);
    }

    function test_RecordFreedom_AlreadyRecorded() public {
        vm.startPrank(duelManager);
        record.recordFreedom(1, winner);

        vm.expectRevert(FreedomRecord.AlreadyRecorded.selector);
        record.recordFreedom(1, address(0xC));
        vm.stopPrank();
    }

    function test_IsFreed_DefaultFalse() public view {
        assertFalse(record.isFreed(winner));
    }

    function test_GetSeasonWinner_DefaultZero() public view {
        assertEq(record.getSeasonWinner(99), address(0));
    }

    function test_MultipleSeasonsMultipleWinners() public {
        vm.startPrank(duelManager);
        record.recordFreedom(1, winner);
        record.recordFreedom(2, address(0xC));
        vm.stopPrank();

        assertTrue(record.isFreed(winner));
        assertTrue(record.isFreed(address(0xC)));
        assertEq(record.getSeasonWinner(1), winner);
        assertEq(record.getSeasonWinner(2), address(0xC));
    }
}
