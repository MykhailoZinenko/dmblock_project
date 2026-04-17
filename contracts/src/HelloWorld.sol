// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract HelloWorld {
    string public greeting;
    address public owner;

    event GreetingChanged(string oldGreeting, string newGreeting);

    constructor(string memory _greeting) {
        greeting = _greeting;
        owner = msg.sender;
    }

    function setGreeting(string memory _newGreeting) external {
        require(msg.sender == owner, "Not owner");
        string memory old = greeting;
        greeting = _newGreeting;
        emit GreetingChanged(old, _newGreeting);
    }

    function greet() external view returns (string memory) {
        return greeting;
    }
}
