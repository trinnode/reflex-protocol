import { ethers } from "hardhat";

/**
 * Sets an initial price on the PriceOracle and extends the heartbeat
 * for testnet so prices don't go stale every 5 minutes.
 *
 * Usage:
 *   npx hardhat run scripts/set-price.ts --network somnia_testnet
 */
async function main() {
  const ORACLE = "0xE85e5ac4F5Ac9987E28304d8f427f1ca6746a3E0";
  const ASSET  = ethers.ZeroAddress;                 // address(0) = native STT
  const PRICE  = ethers.parseEther("1.0");           // 1.0 USD (18-decimal)
  const NEW_HEARTBEAT = 86_400;                      // 24 hours (testnet-friendly)

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "STT");

  const oracle = await ethers.getContractAt("PriceOracle", ORACLE);

  // ── 1. Extend heartbeat so price doesn't go stale every 5 min ──
  const currentHB = await oracle.heartbeat();
  console.log(`Current heartbeat: ${currentHB}s`);

  if (Number(currentHB) < NEW_HEARTBEAT) {
    console.log(`Extending heartbeat to ${NEW_HEARTBEAT}s (24h)...`);
    const hbTx = await oracle.setHeartbeat(NEW_HEARTBEAT);
    await hbTx.wait(1);
    console.log(`Heartbeat updated: ${hbTx.hash}`);
  } else {
    console.log("Heartbeat already sufficient, skipping.");
  }

  // ── 2. Check if price is already set ──
  const currentPrice = await oracle.prices(ASSET);
  console.log(`Current price: ${ethers.formatEther(currentPrice)} (raw: ${currentPrice})`);

  if (currentPrice === 0n) {
    // First-ever update — deviation & interval checks are skipped
    console.log(`Setting initial price to ${ethers.formatEther(PRICE)}...`);
    const tx = await oracle.updatePrice(ASSET, PRICE);
    const receipt = await tx.wait(1);
    console.log(`Price set! Tx: ${tx.hash}`);
    console.log(`Block: ${receipt?.blockNumber}, Gas: ${receipt?.gasUsed}`);
  } else {
    // Subsequent update — respect deviation & interval constraints
    console.log("Price already set. Attempting update...");
    try {
      const tx = await oracle.updatePrice(ASSET, PRICE);
      const receipt = await tx.wait(1);
      console.log(`Price updated! Tx: ${tx.hash}`);
      console.log(`Block: ${receipt?.blockNumber}, Gas: ${receipt?.gasUsed}`);
    } catch (err: any) {
      console.log(`Update skipped: ${err.reason || err.message}`);
    }
  }

  // ── 3. Verify ──
  const newPrice = await oracle.prices(ASSET);
  const updatedAt = await oracle.updatedAt(ASSET);
  console.log("");
  console.log("=== Oracle State ===");
  console.log(`Price:     ${ethers.formatEther(newPrice)}`);
  console.log(`Updated:   ${new Date(Number(updatedAt) * 1000).toISOString()}`);
  console.log(`Heartbeat: ${await oracle.heartbeat()}s`);
  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
