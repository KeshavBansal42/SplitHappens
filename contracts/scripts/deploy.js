require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    throw new Error(
      "USDC_ADDRESS is not set in .env\n" +
      "On Arc testnet this is 0x3600000000000000000000000000000000000000\n" +
      "(see https://docs.arc.net/contracts or FAUCET.md)"
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("deploying from:", deployer.address);
  console.log("USDC address:  ", usdcAddress);

  const Factory = await hre.ethers.getContractFactory("SplitEscrow");
  const escrow = await Factory.deploy(usdcAddress);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  const network = hre.network.name;

  console.log("SplitEscrow deployed to:", address);
  console.log("network:", network);

  const artifact = await hre.artifacts.readArtifact("SplitEscrow");
  const handoff = {
    network,
    address,
    usdcAddress,
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  const outDir = path.join(__dirname, "..", "deployed");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${network}.json`);
  fs.writeFileSync(outPath, JSON.stringify(handoff, null, 2));

  console.log("wrote hand-off file:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
