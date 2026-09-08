const { expect } = require("chai");
const { ethers } = require("hardhat");

// All amounts are in USDC 6-decimal units.
const USDC = (n) => ethers.parseUnits(String(n), 6);

describe("SplitEscrow", function () {
  let usdc, escrow, owner, alice, bob, payee;

  beforeEach(async function () {
    [owner, alice, bob, payee] = await ethers.getSigners();

    // Deploy the mock USDC token (6 decimals) first.
    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    // Deploy the escrow, pointing it at the mock token.
    const EscrowFactory = await ethers.getContractFactory("SplitEscrow");
    escrow = await EscrowFactory.deploy(await usdc.getAddress());
    await escrow.waitForDeployment();
  });

  // Helper: mint USDC and approve the escrow in one step.
  async function fundAndApprove(signer, amount) {
    await usdc.mint(signer.address, amount);
    await usdc.connect(signer).approve(await escrow.getAddress(), amount);
  }

  // ── openSplit ──────────────────────────────────────────────────────────────

  it("opens a split with a payee and target", async function () {
    await escrow.openSplit(1, payee.address, USDC("10"));
    const [collected, target, released] = await escrow.getSplitStatus(1);
    expect(target).to.equal(USDC("10"));
    expect(collected).to.equal(0n);
    expect(released).to.equal(false);
  });

  it("won't let you open the same splitId twice", async function () {
    await escrow.openSplit(1, payee.address, USDC("10"));
    await expect(
      escrow.openSplit(1, payee.address, USDC("10"))
    ).to.be.revertedWith("splitId already used");
  });

  // ── deposit ────────────────────────────────────────────────────────────────

  it("tracks deposits from multiple participants", async function () {
    await escrow.openSplit(2, payee.address, USDC("6"));

    await fundAndApprove(alice, USDC("2"));
    await escrow.connect(alice).deposit(2, USDC("2"));

    await fundAndApprove(bob, USDC("4"));
    await escrow.connect(bob).deposit(2, USDC("4"));

    const [collected] = await escrow.getSplitStatus(2);
    expect(collected).to.equal(USDC("6"));

    const aliceContribution = await escrow.contributions(2, alice.address);
    expect(aliceContribution).to.equal(USDC("2"));
  });

  it("rejects deposits into a split that doesn't exist", async function () {
    await fundAndApprove(alice, USDC("1"));
    await expect(
      escrow.connect(alice).deposit(999, USDC("1"))
    ).to.be.revertedWith("no such split");
  });

  it("rejects zero-amount deposits", async function () {
    await escrow.openSplit(6, payee.address, USDC("1"));
    await expect(
      escrow.connect(alice).deposit(6, 0n)
    ).to.be.revertedWith("amount must be positive");
  });

  it("rejects deposits without sufficient allowance", async function () {
    await escrow.openSplit(7, payee.address, USDC("5"));
    // Mint but deliberately don't approve.
    await usdc.mint(alice.address, USDC("5"));
    await expect(
      escrow.connect(alice).deposit(7, USDC("5"))
    ).to.be.revertedWith("ERC20: insufficient allowance");
  });

  // ── release ────────────────────────────────────────────────────────────────

  it("refuses to release before the target is hit", async function () {
    await escrow.openSplit(3, payee.address, USDC("5"));
    await fundAndApprove(alice, USDC("1"));
    await escrow.connect(alice).deposit(3, USDC("1"));
    await expect(escrow.release(3)).to.be.revertedWith("split isn't fully funded yet");
  });

  it("releases full USDC balance to payee once fully funded, callable by anyone", async function () {
    await escrow.openSplit(4, payee.address, USDC("3"));

    await fundAndApprove(alice, USDC("1"));
    await escrow.connect(alice).deposit(4, USDC("1"));

    await fundAndApprove(bob, USDC("2"));
    await escrow.connect(bob).deposit(4, USDC("2"));

    const before = await usdc.balanceOf(payee.address);

    // bob triggers release — not the payee (permissionless)
    await escrow.connect(bob).release(4);

    const after = await usdc.balanceOf(payee.address);
    expect(after - before).to.equal(USDC("3"));

    const [, , released] = await escrow.getSplitStatus(4);
    expect(released).to.equal(true);
  });

  it("won't release the same split twice", async function () {
    await escrow.openSplit(5, payee.address, USDC("1"));
    await fundAndApprove(alice, USDC("1"));
    await escrow.connect(alice).deposit(5, USDC("1"));
    await escrow.release(5);
    await expect(escrow.release(5)).to.be.revertedWith("already released");
  });

  it("rejects deposits into an already-released split", async function () {
    await escrow.openSplit(8, payee.address, USDC("1"));
    await fundAndApprove(alice, USDC("2"));
    await escrow.connect(alice).deposit(8, USDC("1"));
    await escrow.release(8);
    // Try to deposit after release
    await escrow.connect(alice).approve
    await expect(
      escrow.connect(alice).deposit(8, USDC("1"))
    ).to.be.revertedWith("split already released");
  });
});
