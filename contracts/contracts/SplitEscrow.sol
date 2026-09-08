// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal ERC-20 interface — only the two calls SplitEscrow needs.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title SplitEscrow
 * @notice Holds USDC on behalf of a group bill split until the full target
 *         amount has been collected, then releases to the payee.
 *
 * All amounts are in USDC token units (6 decimals).
 *
 * Frozen interface (must not change without coordinating with Person B):
 *   deposit(uint256 splitId, uint256 amount)   — nonpayable; caller must approve first
 *   release(uint256 splitId)                   — permissionless
 *   getSplitStatus(uint256 splitId)            — view, returns (collected, target, released)
 */
contract SplitEscrow {
    /// @notice The USDC token contract on this chain.
    address public immutable usdc;

    struct Split {
        address payee;
        uint256 target;
        uint256 collected;
        bool released;
        bool exists;
    }

    mapping(uint256 => Split) private splits;
    mapping(uint256 => mapping(address => uint256)) public contributions;

    event SplitOpened(uint256 indexed splitId, address indexed payee, uint256 target);
    event Deposited(uint256 indexed splitId, address indexed from, uint256 amount, uint256 newTotal);
    event Released(uint256 indexed splitId, address indexed payee, uint256 amount);

    modifier splitMustExist(uint256 splitId) {
        require(splits[splitId].exists, "no such split");
        _;
    }

    constructor(address _usdc) {
        require(_usdc != address(0), "usdc is zero address");
        usdc = _usdc;
    }

    /**
     * @notice Registers a new split on-chain. Must be called before any
     *         deposit can be made against this splitId.
     * @param splitId  Unique numeric ID (matches the DB primary key).
     * @param payee    Address that receives funds once fully collected.
     * @param target   Total USDC required, in 6-decimal token units.
     */
    function openSplit(uint256 splitId, address payee, uint256 target) external {
        Split storage s = splits[splitId];
        require(!s.exists, "splitId already used");
        require(payee != address(0), "payee is zero address");
        require(target > 0, "target must be positive");

        s.payee = payee;
        s.target = target;
        s.exists = true;

        emit SplitOpened(splitId, payee, target);
    }

    /**
     * @notice Deposit `amount` USDC into the escrow for `splitId`.
     *         Caller must have called USDC.approve(escrowAddress, amount) first.
     * @param splitId  The split to fund.
     * @param amount   USDC token units (6 decimals) to deposit.
     */
    function deposit(uint256 splitId, uint256 amount) external splitMustExist(splitId) {
        Split storage s = splits[splitId];
        require(!s.released, "split already released");
        require(amount > 0, "amount must be positive");

        bool ok = IERC20(usdc).transferFrom(msg.sender, address(this), amount);
        require(ok, "USDC transferFrom failed");

        s.collected += amount;
        contributions[splitId][msg.sender] += amount;

        emit Deposited(splitId, msg.sender, amount, s.collected);
    }

    /**
     * @notice Release the full collected USDC balance to the payee.
     *         Permissionless — anyone can call once collected >= target.
     * @param splitId  The split to release.
     */
    function release(uint256 splitId) external splitMustExist(splitId) {
        Split storage s = splits[splitId];
        require(!s.released, "already released");
        require(s.collected >= s.target, "split isn't fully funded yet");

        s.released = true;
        uint256 amount = s.collected;

        bool ok = IERC20(usdc).transfer(s.payee, amount);
        require(ok, "USDC transfer failed");

        emit Released(splitId, s.payee, amount);
    }

    /**
     * @notice Returns on-chain state for a split.
     *         Matches the frozen ABI in apps/api/src/chain/escrowAbi.ts.
     * @return collected  USDC collected so far (6-decimal units).
     * @return target     USDC target (6-decimal units).
     * @return released   Whether funds have been sent to the payee.
     */
    function getSplitStatus(uint256 splitId)
        external
        view
        splitMustExist(splitId)
        returns (uint256 collected, uint256 target, bool released)
    {
        Split storage s = splits[splitId];
        return (s.collected, s.target, s.released);
    }
}
