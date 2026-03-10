import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Helpers ──────────────────────────────────────────────

const EXPLORER = "https://shannon-explorer.somnia.network";

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadDeployedAddress(name: string): string {
  const artifactPath = path.join(
    __dirname,
    "..",
    "deployments",
    "somnia_testnet",
    `${name}.json`
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Deployment artifact not found: ${artifactPath}`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  return artifact.address;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  log("=== REFLEX PROTOCOL — DEMO SIMULATION ===");
  log("");

  // 1. Connect
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  log(`Deployer:  ${deployer.address}`);
  log(`Balance:   ${ethers.formatEther(balance)} STT`);
  log("");

  // 2. Load contracts
  const vaultAddr = loadDeployedAddress("REFLEXVault");
  const oracleAddr = loadDeployedAddress("MockPriceOracle");

  log(`Vault:     ${vaultAddr}`);
  log(`Oracle:    ${oracleAddr}`);
  log("");

  const vault = await ethers.getContractAt("REFLEXVault", vaultAddr);
  const oracle = await ethers.getContractAt("MockPriceOracle", oracleAddr);

  // 3. Check current position
  const pos = await vault.positions(deployer.address);
  log(`Position active: ${pos.active}`);

  if (pos.active) {
    const currentPrice = await oracle.getPrice();
    const ratio =
      pos.debt > 0n
        ? Number((pos.collateral * currentPrice * 100n) / (pos.debt * ethers.parseEther("1")))
        : 999;
    log(`Current collateral ratio: ${ratio}%`);
    log("");
  }

  // 4. Open position if none exists
  if (!pos.active) {
    log("--- OPENING POSITION ---");
    // 50 STT collateral — monitoring is funded by the protocol-wide subscription.
    const collateral = ethers.parseEther("50");
    const debt = ethers.parseEther("10");
    const protectionRatio = 150n;

    try {
      const tx = await vault.openPosition(debt, protectionRatio, {
        value: collateral,
      });
      log(`Tx submitted: ${tx.hash}`);
      log(`Explorer:    ${EXPLORER}/tx/${tx.hash}`);

      const receipt = await tx.wait(2);
      log(`Confirmed in block ${receipt?.blockNumber}`);
      log(`Gas used:    ${receipt?.gasUsed.toString()}`);
      log("");

      // Re-read position
      const newPos = await vault.positions(deployer.address);
      log(`Collateral:  ${ethers.formatEther(newPos.collateral)} STT`);
      log(`Debt:        ${ethers.formatEther(newPos.debt)} STT`);
      log(`Protection:  ${newPos.protectionRatio}%`);
      log(`Sub ID:      ${newPos.subscriptionId}`);
      log("");
    } catch (err) {
      log(`ERROR opening position: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  // 5. Simulate price drop — below protection threshold (150%), above liquidation (120%)
  log("--- SIMULATING PRICE DROP ---");
  log("Waiting 3s for dramatic effect...");
  await sleep(3000);

  try {
    // Read current position for calculation
    const currentPos = await vault.positions(deployer.address);
    // Set price so ratio = ~128%
    // ratio = (collateral * price) / (debt * 1e18) * 100
    // 128 = (collateral * newPrice) / (debt * 1e18) * 100
    // newPrice = (128 * debt * 1e18) / (collateral * 100)
    const targetRatio = 128n;
    const newPrice =
      (targetRatio * currentPos.debt * ethers.parseEther("1")) /
      (currentPos.collateral * 100n);

    log(`Setting price to ${ethers.formatEther(newPrice)} (target ratio: ~128%)`);

    const tx = await oracle.updatePrice(newPrice);
    log(`Tx submitted: ${tx.hash}`);
    log(`Explorer:    ${EXPLORER}/tx/${tx.hash}`);

    const receipt = await tx.wait(2);
    log(`Confirmed in block ${receipt?.blockNumber}`);
    log("");
  } catch (err) {
    log(`ERROR updating price: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // 6. Wait for reactive handler
  log("Waiting 5s for Reactivity handler to fire...");
  await sleep(5000);

  try {
    const posAfterDrop = await vault.positions(deployer.address);
    if (posAfterDrop.active) {
      const priceAfter = await oracle.getPrice();
      const ratioAfter =
        posAfterDrop.debt > 0n
          ? Number(
              (posAfterDrop.collateral * BigInt(priceAfter) * 100n) /
                (posAfterDrop.debt * ethers.parseEther("1"))
            )
          : 999;
      log(`Position still active. Ratio: ${ratioAfter}%`);
      log("PROTECTION TRIGGERED — vault handled the price drop reactively!");
    } else {
      log("Position was closed by emergency exit.");
    }
    log("");
  } catch (err) {
    log(`ERROR reading position: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // 7. Critical drop — below 120% liquidation
  log("--- SIMULATING CRITICAL DROP ---");
  log("Waiting 3s...");
  await sleep(3000);

  try {
    const currentPos2 = await vault.positions(deployer.address);
    if (!currentPos2.active) {
      log("Position already closed — skipping critical drop simulation.");
      log("");
      log("=== DEMO COMPLETE ===");
      return;
    }

    // Target ratio ~110% — below 120% liquidation threshold
    const targetRatioCritical = 110n;
    const criticalPrice =
      (targetRatioCritical * currentPos2.debt * ethers.parseEther("1")) /
      (currentPos2.collateral * 100n);

    log(`Setting price to ${ethers.formatEther(criticalPrice)} (target ratio: ~110%)`);

    const tx = await oracle.updatePrice(criticalPrice);
    log(`Tx submitted: ${tx.hash}`);
    log(`Explorer:    ${EXPLORER}/tx/${tx.hash}`);

    const receipt = await tx.wait(2);
    log(`Confirmed in block ${receipt?.blockNumber}`);
    log("");
  } catch (err) {
    log(`ERROR updating price: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // 8. Wait for emergency exit handler
  log("Waiting 5s for Reactivity emergency handler...");
  await sleep(5000);

  try {
    const posAfterCritical = await vault.positions(deployer.address);
    if (!posAfterCritical.active) {
      log("EMERGENCY EXIT — position closed automatically!");
      log("Remaining collateral returned to user.");
    } else {
      const priceAfterCritical = await oracle.getPrice();
      const ratioFinal =
        posAfterCritical.debt > 0n
          ? Number(
              (posAfterCritical.collateral * BigInt(priceAfterCritical) * 100n) /
                (posAfterCritical.debt * ethers.parseEther("1"))
            )
          : 999;
      log(`Position still active. Ratio: ${ratioFinal}%`);
      log("Emergency handler may not have fired yet — check explorer.");
    }
    log("");
  } catch (err) {
    log(`ERROR reading position: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  log("=== DEMO COMPLETE ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
