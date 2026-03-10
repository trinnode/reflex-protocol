import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  REFLEXVault,
  MockPriceOracle,
  MockReactivityPrecompile,
} from "../typechain-types";

const MIN_POSITION_COLLATERAL = ethers.parseEther("0.01");
const PRICE_ONE = ethers.parseEther("1");

const COLLATERAL_HEALTHY = ethers.parseEther("150");
const COLLATERAL_AT_RISK = ethers.parseEther("125");
const COLLATERAL_EMERGENCY = ethers.parseEther("110");

const DEBT = ethers.parseEther("100");
const PROTECTION_RATIO = 130n;
const SUBSCRIPTION_ID = 1n;

async function deployedAddress(contract: unknown): Promise<string> {
  return (contract as { getAddress(): Promise<string> }).getAddress();
}

async function encodeEventData(price: bigint): Promise<string> {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "uint256"],
    [price, Math.floor(Date.now() / 1000)]
  );
}

async function deployFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const precompile = await ethers.deployContract("MockReactivityPrecompile") as unknown as MockReactivityPrecompile;
  await precompile.waitForDeployment();

  const oracle = await ethers.deployContract("MockPriceOracle") as unknown as MockPriceOracle;
  await oracle.waitForDeployment();

  const oracleAddr = await deployedAddress(oracle);
  const precompileAddr = await deployedAddress(precompile);
  const priceUpdateTopic = await oracle.PRICE_UPDATED_TOPIC();

  const vault = await ethers.deployContract(
    "REFLEXVault",
    [oracleAddr, priceUpdateTopic, precompileAddr]
  ) as unknown as REFLEXVault;
  await vault.waitForDeployment();

  const vaultAddr = await deployedAddress(vault);
  const assetAddr = ethers.Wallet.createRandom().address;

  const subscribeTx = await precompile.subscribe({
    eventTopics: [priceUpdateTopic, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash],
    origin: ethers.ZeroAddress,
    caller: ethers.ZeroAddress,
    emitter: oracleAddr,
    handlerContractAddress: vaultAddr,
    handlerFunctionSelector: await vault.ON_EVENT_SELECTOR(),
    priorityFeePerGas: 1n,
    maxFeePerGas: 2n,
    gasLimit: 1_000_000n,
    isGuaranteed: true,
    isCoalesced: false,
  });
  await subscribeTx.wait();

  await vault.configureSharedSubscription(SUBSCRIPTION_ID);

  return {
    vault,
    oracle,
    precompile,
    owner,
    alice,
    bob,
    oracleAddr,
    vaultAddr,
    assetAddr,
    precompileAddr,
    priceUpdateTopic,
  };
}

async function deployWithoutSubscriptionFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const precompile = await ethers.deployContract("MockReactivityPrecompile") as unknown as MockReactivityPrecompile;
  await precompile.waitForDeployment();

  const oracle = await ethers.deployContract("MockPriceOracle") as unknown as MockPriceOracle;
  await oracle.waitForDeployment();

  const oracleAddr = await deployedAddress(oracle);
  const precompileAddr = await deployedAddress(precompile);
  const priceUpdateTopic = await oracle.PRICE_UPDATED_TOPIC();

  const vault = await ethers.deployContract(
    "REFLEXVault",
    [oracleAddr, priceUpdateTopic, precompileAddr]
  ) as unknown as REFLEXVault;
  await vault.waitForDeployment();

  return { vault, oracle, precompile, owner, alice, bob };
}

async function openHealthyPositionFixture() {
  const base = await deployFixture();
  const { vault, alice } = base;

  await vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
    value: COLLATERAL_HEALTHY,
  });

  return { ...base, subscriptionId: SUBSCRIPTION_ID };
}

describe("openPosition", function () {
  it("opens successfully with enough collateral and emits PositionOpened", async () => {
    const { vault, alice } = await loadFixture(deployFixture);

    await expect(
      vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
        value: COLLATERAL_HEALTHY,
      })
    )
      .to.emit(vault, "PositionOpened")
      .withArgs(alice.address, COLLATERAL_HEALTHY, DEBT, SUBSCRIPTION_ID);
  });

  it("stores position data correctly after open", async () => {
    const { vault, alice } = await loadFixture(deployFixture);

    await vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
      value: COLLATERAL_HEALTHY,
    });

    const pos = await vault.positions(alice.address);
    expect(pos.collateral).to.equal(COLLATERAL_HEALTHY);
    expect(pos.debt).to.equal(DEBT);
    expect(pos.active).to.be.true;
    expect(pos.protectionRatio).to.equal(PROTECTION_RATIO);
    expect(pos.subscriptionId).to.equal(SUBSCRIPTION_ID);
  });

  it("reports shared subscription status once configured", async () => {
    const { vault } = await loadFixture(deployFixture);

    const [subscriptionId, active] = await vault.getSharedSubscriptionStatus();

    expect(subscriptionId).to.equal(SUBSCRIPTION_ID);
    expect(active).to.be.true;
  });

  it("reverts if monitoring has not been initialized", async () => {
    const { vault, alice } = await loadFixture(deployWithoutSubscriptionFixture);

    await expect(
      vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
        value: COLLATERAL_HEALTHY,
      })
    ).to.be.revertedWith("Monitoring inactive");
  });

  it("reverts if a position is already active for the caller", async () => {
    const { vault, alice } = await loadFixture(deployFixture);

    await vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
      value: COLLATERAL_HEALTHY,
    });

    await expect(
      vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
        value: COLLATERAL_HEALTHY,
      })
    ).to.be.revertedWith("Position already active");
  });

  it("reverts if protectionRatio is <= MIN_COLLATERAL_RATIO (120)", async () => {
    const { vault, alice } = await loadFixture(deployFixture);

    await expect(
      vault.connect(alice).openPosition(DEBT, 120n, {
        value: COLLATERAL_HEALTHY,
      })
    ).to.be.revertedWith("protectionRatio out of range [121,500]");

    await expect(
      vault.connect(alice).openPosition(DEBT, 115n, {
        value: COLLATERAL_HEALTHY,
      })
    ).to.be.revertedWith("protectionRatio out of range [121,500]");
  });

  it("reverts if protectionRatio exceeds 500", async () => {
    const { vault, alice } = await loadFixture(deployFixture);

    await expect(
      vault.connect(alice).openPosition(DEBT, 501n, {
        value: COLLATERAL_HEALTHY,
      })
    ).to.be.revertedWith("protectionRatio out of range [121,500]");
  });

  it("reverts if collateral is below the minimum position threshold", async () => {
    const { vault, alice } = await loadFixture(deployFixture);

    await expect(
      vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
        value: MIN_POSITION_COLLATERAL - 1n,
      })
    ).to.be.revertedWith("Collateral too low");
  });

  it("reverts if debt is zero", async () => {
    const { vault, alice } = await loadFixture(deployFixture);

    await expect(
      vault.connect(alice).openPosition(0n, PROTECTION_RATIO, {
        value: COLLATERAL_HEALTHY,
      })
    ).to.be.revertedWith("Debt must be non-zero");
  });
});

describe("_onEvent — protection triggered", function () {
  it("non-precompile caller on onEvent reverts with UnauthorizedCaller", async () => {
    const { vault, alice } = await loadFixture(openHealthyPositionFixture);

    await expect(
      vault.connect(alice).onEvent(alice.address, [], "0x")
    ).to.be.revertedWithCustomError(vault, "UnauthorizedCaller");
  });

  it("price stays healthy and emits no protection events", async () => {
    const { vault, precompile, assetAddr, vaultAddr } =
      await loadFixture(openHealthyPositionFixture);

    const data = await encodeEventData(PRICE_ONE);
    const tx = precompile.triggerHandler(vaultAddr, assetAddr, [], data);

    await expect(tx).to.not.emit(vault, "ProtectionTriggered");
    await expect(tx).to.not.emit(vault, "PositionAtRisk");
    await expect(tx).to.not.emit(vault, "EmergencyExit");
  });

  it("price drop below protectionRatio but above MIN emits PositionAtRisk", async () => {
    const { vault, precompile, alice, oracleAddr, vaultAddr, priceUpdateTopic } =
      await loadFixture(deployFixture);

    await vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
      value: COLLATERAL_AT_RISK,
    });

    const data = await encodeEventData(PRICE_ONE);

    await expect(
      precompile.triggerHandler(vaultAddr, oracleAddr, [priceUpdateTopic], data)
    )
      .to.emit(vault, "ProtectionTriggered")
      .withArgs(alice.address, 125n, PRICE_ONE)
      .and.to.emit(vault, "PositionAtRisk")
      .withArgs(alice.address, 125n);
  });

  it("price drop below MIN_COLLATERAL_RATIO triggers emergency exit", async () => {
    const { vault, precompile, alice, oracleAddr, vaultAddr, priceUpdateTopic } =
      await loadFixture(deployFixture);

    await vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
      value: COLLATERAL_EMERGENCY,
    });

    const data = await encodeEventData(PRICE_ONE);

    await expect(
      precompile.triggerHandler(vaultAddr, oracleAddr, [priceUpdateTopic], data)
    )
      .to.emit(vault, "ProtectionTriggered")
      .withArgs(alice.address, 110n, PRICE_ONE)
      .and.to.emit(vault, "EmergencyExit")
      .withArgs(alice.address, COLLATERAL_EMERGENCY);

    const posAfter = await vault.positions(alice.address);
    expect(posAfter.active).to.be.false;
  });

  it("handles all active users through the shared subscription", async () => {
    const { vault, precompile, alice, bob, oracleAddr, vaultAddr, priceUpdateTopic } =
      await loadFixture(deployFixture);

    await vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, {
      value: COLLATERAL_HEALTHY,
    });
    await vault.connect(bob).openPosition(DEBT, PROTECTION_RATIO, {
      value: COLLATERAL_AT_RISK,
    });

    const data = await encodeEventData(PRICE_ONE);

    await expect(
      precompile.triggerHandler(vaultAddr, oracleAddr, [priceUpdateTopic], data)
    )
      .to.emit(vault, "ProtectionTriggered")
      .withArgs(bob.address, 125n, PRICE_ONE)
      .and.to.emit(vault, "PositionAtRisk")
      .withArgs(bob.address, 125n);
  });

  it("ignores events from other emitters", async () => {
    const { vault, precompile, assetAddr, vaultAddr, priceUpdateTopic } =
      await loadFixture(openHealthyPositionFixture);

    const data = await encodeEventData(PRICE_ONE);
    const tx = precompile.triggerHandler(vaultAddr, assetAddr, [priceUpdateTopic], data);

    await expect(tx).to.not.emit(vault, "ProtectionTriggered");
    await expect(tx).to.not.emit(vault, "PositionAtRisk");
    await expect(tx).to.not.emit(vault, "EmergencyExit");
  });
});

describe("closePosition", function () {
  it("returns collateral minus protocol fee and emits PositionClosed", async () => {
    const { vault, alice } = await loadFixture(openHealthyPositionFixture);

    const fee = (COLLATERAL_HEALTHY * 10n) / 10_000n;
    const expected = COLLATERAL_HEALTHY - fee;

    await expect(vault.connect(alice).closePosition())
      .to.emit(vault, "PositionClosed")
      .withArgs(alice.address, expected);

    const pos = await vault.positions(alice.address);
    expect(pos.active).to.be.false;
  });

  it("transfers the correct ETH amount back to the caller", async () => {
    const { vault, alice } = await loadFixture(openHealthyPositionFixture);

    const fee = (COLLATERAL_HEALTHY * 10n) / 10_000n;
    const expected = COLLATERAL_HEALTHY - fee;

    await expect(vault.connect(alice).closePosition()).to.changeEtherBalance(
      alice,
      expected
    );
  });

  it("reverts if the caller has no active position", async () => {
    const { vault, bob } = await loadFixture(openHealthyPositionFixture);

    await expect(vault.connect(bob).closePosition()).to.be.revertedWith(
      "No active position"
    );
  });
});

describe("topUpCollateral", function () {
  it("increases collateral by exactly msg.value", async () => {
    const { vault, alice } = await loadFixture(openHealthyPositionFixture);

    const topUp = ethers.parseEther("10");
    await vault.connect(alice).topUpCollateral({ value: topUp });

    const pos = await vault.positions(alice.address);
    expect(pos.collateral).to.equal(COLLATERAL_HEALTHY + topUp);
  });

  it("reverts if the caller has no active position", async () => {
    const { vault, bob } = await loadFixture(openHealthyPositionFixture);

    await expect(
      vault.connect(bob).topUpCollateral({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("No active position");
  });
});
