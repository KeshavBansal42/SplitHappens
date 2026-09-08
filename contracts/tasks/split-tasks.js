const { task } = require("hardhat/config");
const fs = require("fs");
const path = require("path");

// USDC has 6 decimals
const USDC = (hre, n) => hre.ethers.parseUnits(String(n), 6);
const formatUSDC = (hre, n) => hre.ethers.formatUnits(n, 6);

function loadDeployment(network) {
  const file = path.join(__dirname, "..", "deployed", `${network}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`no deployment found for network "${network}" — run scripts/deploy.js first`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Minimal ERC-20 ABI (only what we need)
const erc20Abi = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

task("split:open", "opens a new split on the deployed escrow contract")
  .addParam("id",     "numeric split id")
  .addParam("payee",  "address that gets paid once the split is fully funded")
  .addParam("target", "target amount, in USDC (e.g. 25.5)")
  .setAction(async (args, hre) => {
    const deployment = loadDeployment(hre.network.name);
    const [signer] = await hre.ethers.getSigners();
    const escrow = await hre.ethers.getContractAt("SplitEscrow", deployment.address, signer);

    const tx = await escrow.openSplit(args.id, args.payee, USDC(hre, args.target));
    const receipt = await tx.wait();

    console.log(`split ${args.id} opened, payee ${args.payee}, target ${args.target} USDC`);
    console.log("tx:", receipt.hash);
  });

task("split:deposit", "approves + deposits USDC into a split as the current signer")
  .addParam("id",     "numeric split id")
  .addParam("amount", "amount to deposit, in USDC (e.g. 5)")
  .setAction(async (args, hre) => {
    const deployment = loadDeployment(hre.network.name);
    const usdcAddress = deployment.usdcAddress || process.env.USDC_ADDRESS;
    if (!usdcAddress) {
      throw new Error("USDC address not found — set USDC_ADDRESS in .env or redeploy to populate deployed JSON");
    }

    const [signer] = await hre.ethers.getSigners();
    const amount = USDC(hre, args.amount);

    // 1. Approve the escrow to spend the tokens
    const token = new hre.ethers.Contract(usdcAddress, erc20Abi, signer);
    const approveTx = await token.approve(deployment.address, amount);
    await approveTx.wait();
    console.log(`approved ${args.amount} USDC to escrow`);

    // 2. Deposit
    const escrow = await hre.ethers.getContractAt("SplitEscrow", deployment.address, signer);
    const depositTx = await escrow.deposit(args.id, amount);
    const receipt = await depositTx.wait();

    console.log(`deposited ${args.amount} USDC into split ${args.id} from ${signer.address}`);
    console.log("tx:", receipt.hash);
  });

task("split:release", "releases a split's funds to the payee once fully funded")
  .addParam("id", "numeric split id")
  .setAction(async (args, hre) => {
    const deployment = loadDeployment(hre.network.name);
    const [signer] = await hre.ethers.getSigners();
    const escrow = await hre.ethers.getContractAt("SplitEscrow", deployment.address, signer);

    const tx = await escrow.release(args.id);
    const receipt = await tx.wait();

    console.log(`split ${args.id} released`);
    console.log("tx:", receipt.hash);
  });

task("split:status", "prints the current on-chain status of a split")
  .addParam("id", "numeric split id")
  .setAction(async (args, hre) => {
    const deployment = loadDeployment(hre.network.name);
    const [signer] = await hre.ethers.getSigners();
    const escrow = await hre.ethers.getContractAt("SplitEscrow", deployment.address, signer);

    const [collected, target, released] = await escrow.getSplitStatus(args.id);
    console.log(`split ${args.id}`);
    console.log("  target:   ", formatUSDC(hre, target), "USDC");
    console.log("  collected:", formatUSDC(hre, collected), "USDC");
    console.log("  released: ", released);
  });
