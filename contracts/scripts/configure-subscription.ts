import { ethers } from "hardhat";

async function main() {
  const vaultAddress = "0x34C72450cC4a34Cf0BD4c24dDa64310c96CFd001";
  const insuranceAddress = "0xDd49a6BbB1b84b5BE744b3Ef7618783F41f0EBAD";

  const vault = await ethers.getContractAt("REFLEXVault", vaultAddress);
  const insurance = await ethers.getContractAt("REFLEXInsurance", insuranceAddress);

  // Check vault status
  const initialized = await vault.subscriptionInitialized();
  console.log("Vault subscriptionInitialized:", initialized);

  if (!initialized) {
    console.log("Configuring shared subscription with ID=1...");
    const tx = await vault.configureSharedSubscription(1);
    console.log("Tx hash:", tx.hash);
    await tx.wait();
    console.log("Vault subscription configured!");
  } else {
    console.log("Vault subscription already initialized");
  }

  // Check insurance  
  try {
    const insuranceInit = await insurance.subscriptionInitialized();
    console.log("Insurance subscriptionInitialized:", insuranceInit);
    if (!insuranceInit) {
      console.log("Configuring insurance subscription with ID=2...");
      const tx2 = await insurance.configureSubscription(2);
      console.log("Tx hash:", tx2.hash);
      await tx2.wait();
      console.log("Insurance subscription configured!");
    } else {
      console.log("Insurance subscription already initialized");
    }
  } catch (e: any) {
    console.log("Insurance check error:", e.message?.slice(0, 200));
  }

  // Verify
  const [subId, active] = await vault.getSharedSubscriptionStatus();
  console.log("Final vault status - subId:", subId.toString(), "active:", active);
}

main().catch(console.error);
