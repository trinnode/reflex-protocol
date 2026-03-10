import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

// The canonical Somnia Reactivity Precompile address — same on all Somnia networks.
const SOMNIA_PRECOMPILE = "0x0000000000000000000000000000000000000100";
const INITIAL_SHARED_SUBSCRIPTION_FUNDING = ethers.parseEther(
  process.env.VAULT_SUBSCRIPTION_FUNDING ?? "32"
);
const DEFAULT_PRIORITY_FEE = 1_000_000_000n;
const DEFAULT_MAX_FEE = 2_000_000_000n;
const DEFAULT_GAS_LIMIT = 1_500_000n;

// Deterministic topic hash — keccak256("PriceUpdated(address,uint256,uint256)").
// Same value every IPriceOracle implementation exposes as PRICE_UPDATED_TOPIC.
const PRICE_UPDATE_TOPIC = ethers.id("PriceUpdated(address,uint256,uint256)");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, getOrNull } = deployments;
  const { deployer } = await getNamedAccounts();

  let oracleAddress: string;

  // Priority order for oracle address resolution:
  // 1. Explicit env var (highest priority)
  // 2. PriceOracle deployment (production)
  // 3. ChainlinkPriceOracleAdapter deployment
  // 4. MockPriceOracle deployment (fallback for local/test)
  if (process.env.PRICE_ORACLE_ADDRESS) {
    oracleAddress = process.env.PRICE_ORACLE_ADDRESS;
  } else {
    const prodOracle = await getOrNull("PriceOracle");
    const chainlinkAdapter = await getOrNull("ChainlinkPriceOracleAdapter");
    const mockOracle = await getOrNull("MockPriceOracle");

    if (prodOracle) {
      oracleAddress = prodOracle.address;
    } else if (chainlinkAdapter) {
      oracleAddress = chainlinkAdapter.address;
    } else if (mockOracle) {
      oracleAddress = mockOracle.address;
    } else {
      throw new Error(
        "No oracle deployment found. Deploy an oracle first or set PRICE_ORACLE_ADDRESS."
      );
    }
  }

  const priceUpdateTopic = PRICE_UPDATE_TOPIC;

  const result = await deploy("REFLEXVault", {
    from: deployer,
    args: [oracleAddress, priceUpdateTopic, SOMNIA_PRECOMPILE],
    log: true,
    waitConfirmations: network.name === "hardhat" ? 0 : 2,
  });

  const vault = await ethers.getContractAt("REFLEXVault", result.address);
  const subscriptionInitialized = await vault.subscriptionInitialized();

  if (!subscriptionInitialized) {
    const [signer] = await ethers.getSigners();
    const signerBalance = await ethers.provider.getBalance(signer.address);

    if (signerBalance < INITIAL_SHARED_SUBSCRIPTION_FUNDING) {
      console.log(
        `  Shared monitoring skipped: deployer balance ${ethers.formatEther(signerBalance)} STT is below required ${ethers.formatEther(INITIAL_SHARED_SUBSCRIPTION_FUNDING)} STT`
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

      const subscriptionData = {
        eventTopics: [priceUpdateTopic, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash],
        origin: ethers.ZeroAddress,
        caller: ethers.ZeroAddress,
        emitter: oracleAddress,
        handlerContractAddress: result.address,
        handlerFunctionSelector: vault.interface.getFunction("onEvent")!.selector,
        priorityFeePerGas: BigInt(feeData.maxPriorityFeePerGas ?? DEFAULT_PRIORITY_FEE),
        maxFeePerGas: BigInt(feeData.maxFeePerGas ?? DEFAULT_MAX_FEE),
        gasLimit: DEFAULT_GAS_LIMIT,
        isGuaranteed: true,
        isCoalesced: false,
      };
      const createdSubscriptionId = await precompile.subscribe.staticCall(subscriptionData);
      const tx = await precompile.subscribe(subscriptionData);
      await tx.wait(network.name === "hardhat" ? 1 : 2);

      const configureTx = await vault.configureSharedSubscription(createdSubscriptionId);
      await configureTx.wait(network.name === "hardhat" ? 1 : 2);
      console.log(`  Shared monitoring initialized: ${tx.hash}`);
      console.log(`  Shared subscription id:      ${createdSubscriptionId}`);
    }
  }

  console.log(`REFLEXVault deployed to:    ${result.address}`);
  console.log(`  Oracle:                   ${oracleAddress}`);
  console.log(`  Price topic:              ${priceUpdateTopic}`);
  console.log(`  Reactivity precompile:    ${SOMNIA_PRECOMPILE}`);
  console.log(
    `  Shared monitoring fund:   ${ethers.formatEther(INITIAL_SHARED_SUBSCRIPTION_FUNDING)} STT`
  );
};

export default func;
func.tags = ["vault", "core"];
func.dependencies = ["oracle"]; // ensures oracle is deployed first
