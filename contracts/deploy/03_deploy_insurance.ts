import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const SOMNIA_PRECOMPILE = "0x0000000000000000000000000000000000000100";

// The insurance contract must be funded with at least 2 STT so it can create
// its Reactivity subscription in the constructor.
const INITIAL_SUBSCRIPTION_FUNDING = ethers.parseEther("2");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const vault = await get("REFLEXVault");

  // On local networks with mock precompile, fund the subscription at deploy.
  // On live networks the constructor gracefully skips subscription if value < 2 STT;
  // owner can call initializeSubscription() later when the precompile is ready.
  const isLocal = ["hardhat", "localhost"].includes(hre.network.name);

  const result = await deploy("REFLEXInsurance", {
    from: deployer,
    args: [vault.address, SOMNIA_PRECOMPILE],
    value: isLocal ? INITIAL_SUBSCRIPTION_FUNDING : 0,
    log: true,
    waitConfirmations: hre.network.name === "hardhat" ? 0 : 2,
  });

  console.log(`REFLEXInsurance deployed to: ${result.address}`);
  console.log(`  Watching vault:             ${vault.address}`);
  console.log(`  Initial sub funding:        ${ethers.formatEther(INITIAL_SUBSCRIPTION_FUNDING)} STT`);
};

export default func;
func.tags = ["insurance"];
func.dependencies = ["vault"];
