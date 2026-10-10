// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice ERC-20 mock whose `transfer` always reverts AFTER being told to do so.
///         Used to exercise the pull-payment (pendingWithdrawals) path in AgentArena.
///         All other operations (mint, approve, transferFrom) work normally so the
///         contract-under-test can be initialised and funded before we flip the flag.
contract RevertOnTransferToken {
    string public name = "RevertToken";
    string public symbol = "RVT";
    uint8 public decimals = 6;

    bool public transferReverts;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function setTransferReverts(bool reverts) external {
        transferReverts = reverts;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /// @dev Reverts when `transferReverts` is true — simulates a broken ERC-20 token.
    function transfer(address to, uint256 amount) external returns (bool) {
        if (transferReverts) revert("RevertOnTransferToken: transfer reverted");
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "RevertOnTransferToken: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "RevertOnTransferToken: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
