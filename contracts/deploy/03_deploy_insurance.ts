import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const SOMNIA_PRECOMPILE = "0x0000000000000000000000000000000000000100";
const INITIAL_SUBSCRIPTION_FUNDING = ethers.parseEther(
  process.env.INSURANCE_SUBSCRIPTION_FUNDING ?? "32"
);
const DEFAULT_PRIORITY_FEE = 1_000_000_000n;
const DEFAULT_MAX_FEE = 2_000_000_000n;
const DEFAULT_GAS_LIMIT = 1_500_000n;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const vault = await get("REFLEXVault");

  const result = await deploy("REFLEXInsurance", {
    from: deployer,
    args: [vault.address, SOMNIA_PRECOMPILE],
    log: true,
    waitConfirmations: hre.network.name === "hardhat" ? 0 : 2,
  });

  const insurance = await ethers.getContractAt("REFLEXInsurance", result.address);
  const subscriptionInitialized = await insurance.subscriptionInitialized();

  if (!subscriptionInitialized) {
    const [signer] = await ethers.getSigners();
    const signerBalance = await ethers.provider.getBalance(signer.address);

    if (signerBalance < INITIAL_SUBSCRIPTION_FUNDING) {
      console.log(
        `  Insurance monitoring skipped: deployer balance ${ethers.formatEther(signerBalance)} STT is below required ${ethers.formatEther(INITIAL_SUBSCRIPTION_FUNDING)} STT`
      );
    } else {
      const feeData = await ethers.provider.getFeeData();
      const precompile = new ethers.Contract(
        SOMNIA_PRECOMPILE,
        [
          "function subscribe((bytes32[4] eventTopics,address origin,address caller,address emitter,address handlerContractAddress,bytes4 handlerFunctionSelector,uint64 priorityFeePerGas,uint64 maxFeePerGas,uint64 gasLimit,bool isGuaranteed,bool isCoalesced) subscriptionData) returns (uint256)"
        ],
        signer
      );

      const protectionTopic = await insurance.PROTECTION_TRIGGERED_TOPIC();
      const subscriptionData = {
        eventTopics: [protectionTopic, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash],
        origin: ethers.ZeroAddress,
        caller: ethers.ZeroAddress,
        emitter: vault.address,
        handlerContractAddress: result.address,
        handlerFunctionSelector: insurance.interface.getFunction("onEvent")!.selector,
        priorityFeePerGas: BigInt(feeData.maxPriorityFeePerGas ?? DEFAULT_PRIORITY_FEE),
        maxFeePerGas: BigInt(feeData.maxFeePerGas ?? DEFAULT_MAX_FEE),
        gasLimit: DEFAULT_GAS_LIMIT,
        isGuaranteed: true,
        isCoalesced: false,
      };
      const createdSubscriptionId = await precompile.subscribe.staticCall(subscriptionData);
      const tx = await precompile.subscribe(subscriptionData);
      await tx.wait(hre.network.name === "hardhat" ? 1 : 2);

      const configureTx = await insurance.configureSubscription(createdSubscriptionId);
      await configureTx.wait(hre.network.name === "hardhat" ? 1 : 2);
      console.log(`  Insurance monitoring initialized: ${tx.hash}`);
      console.log(`  Insurance subscription id:       ${createdSubscriptionId}`);
    }
  }

  console.log(`REFLEXInsurance deployed to: ${result.address}`);
  console.log(`  Watching vault:             ${vault.address}`);
  console.log(`  Initial sub funding:        ${ethers.formatEther(INITIAL_SUBSCRIPTION_FUNDING)} STT`);
};

export default func;
func.tags = ["insurance"];
func.dependencies = ["vault"];
