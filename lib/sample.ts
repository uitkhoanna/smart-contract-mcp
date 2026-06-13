// The canonical VulnerableBank Solidity source used by the demo page,
// the smoke-test scripts, and the README. It is intentionally vulnerable
// to: reentrancy, tx.origin authorization, integer overflow (pre-0.8),
// and unprotected selfdestruct.

export const VULNERABLE_BANK_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

contract VulnerableBank {
    mapping(address => uint256) public balances;
    address public owner;

    constructor() public {
        owner = msg.sender;
    }

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "insufficient");
        (bool success, ) = msg.sender.call{value: amount}("");
        balances[msg.sender] -= amount;
        require(success, "transfer failed");
    }

    function emergencyWithdraw() public {
        require(tx.origin == owner, "not owner");
        selfdestruct(payable(owner));
    }
}
`;
