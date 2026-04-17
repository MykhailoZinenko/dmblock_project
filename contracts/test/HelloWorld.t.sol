// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {HelloWorld} from "../src/HelloWorld.sol";

contract HelloWorldTest is Test {
    HelloWorld public hello;

    function setUp() public {
        hello = new HelloWorld("Hello, Arcana Arena!");
    }

    function test_InitialGreeting() public view {
        assertEq(hello.greet(), "Hello, Arcana Arena!");
    }

    function test_SetGreeting() public {
        hello.setGreeting("New greeting");
        assertEq(hello.greet(), "New greeting");
    }

    function test_OnlyOwnerCanSet() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("Not owner");
        hello.setGreeting("Should fail");
    }

    function test_EmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit HelloWorld.GreetingChanged("Hello, Arcana Arena!", "Updated");
        hello.setGreeting("Updated");
    }
}
