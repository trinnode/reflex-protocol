import { ethers } from "hardhat";
async function main() {
  const insurance = await ethers.getContractAt("REFLEXInsurance", "0xDd49a6BbB1b84b5BE744b3Ef7618783F41f0EBAD");
  const init = await insurance.subscriptionInitialized();
  console.log("Insurance initialized:", init);
  if (!init) {
    const tx = await insurance.configureSubscription(2);
    console.log("Tx:", tx.hash);
    await tx.wait();
    console.log("Done!");
  } else {
    console.log("Already initialized");
  }
}
main().catch(console.error);
