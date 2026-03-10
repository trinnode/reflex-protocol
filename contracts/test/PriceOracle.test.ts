import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { PriceOracle } from "../typechain-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const HEARTBEAT = 300;           // 5 minutes
const MAX_DEVIATION_BPS = 500;   // 5%
const MIN_INTERVAL = 10;         // 10 seconds
const PRICE_ONE = ethers.parseEther("1"); // 1.0

// ─── Fixture ──────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [owner, updater, alice] = await ethers.getSigners();

  const oracle = await (
    await ethers.getContractFactory("PriceOracle")
  ).deploy(HEARTBEAT, MAX_DEVIATION_BPS, MIN_INTERVAL) as unknown as PriceOracle;

  return { oracle, owner, updater, alice };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PriceOracle", function () {
  describe("constructor", function () {
    it("sets heartbeat, maxDeviationBps, minUpdateInterval correctly", async () => {
      const { oracle } = await loadFixture(deployFixture);
      expect(await oracle.heartbeat()).to.equal(HEARTBEAT);
      expect(await oracle.maxDeviationBps()).to.equal(MAX_DEVIATION_BPS);
      expect(await oracle.minUpdateInterval()).to.equal(MIN_INTERVAL);
    });

    it("makes deployer an authorized updater", async () => {
      const { oracle, owner } = await loadFixture(deployFixture);
      expect(await oracle.authorizedUpdaters(owner.address)).to.be.true;
    });

    it("exposes correct PRICE_UPDATED_TOPIC", async () => {
      const { oracle } = await loadFixture(deployFixture);
      const expected = ethers.id("PriceUpdated(address,uint256,uint256)");
      expect(await oracle.PRICE_UPDATED_TOPIC()).to.equal(expected);
    });
  });

  describe("updatePrice", function () {
    it("allows authorized updater to set initial price", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await expect(
        oracle.updatePrice(ethers.ZeroAddress, PRICE_ONE)
      ).to.emit(oracle, "PriceUpdated")
        .withArgs(ethers.ZeroAddress, PRICE_ONE, await time.latest() + 1);

      expect(await oracle.prices(ethers.ZeroAddress)).to.equal(PRICE_ONE);
    });

    it("reverts for unauthorized caller", async () => {
      const { oracle, alice } = await loadFixture(deployFixture);

      await expect(
        oracle.connect(alice).updatePrice(ethers.ZeroAddress, PRICE_ONE)
      ).to.be.revertedWithCustomError(oracle, "UnauthorizedUpdater");
    });

    it("reverts if price is zero", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await expect(
        oracle.updatePrice(ethers.ZeroAddress, 0n)
      ).to.be.revertedWithCustomError(oracle, "PriceIsZero");
    });

    it("reverts if update is too frequent", async () => {
      const { oracle } = await loadFixture(deployFixture);

      // First update (no interval check for initial).
      await oracle.updatePrice(ethers.ZeroAddress, PRICE_ONE);

      // Second update immediately — should fail.
      await expect(
        oracle.updatePrice(ethers.ZeroAddress, PRICE_ONE)
      ).to.be.revertedWithCustomError(oracle, "UpdateTooFrequent");
    });

    it("allows update after minUpdateInterval elapses", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await oracle.updatePrice(ethers.ZeroAddress, PRICE_ONE);

      // Advance time past the minimum interval.
      await time.increase(MIN_INTERVAL + 1);

      await expect(
        oracle.updatePrice(ethers.ZeroAddress, PRICE_ONE)
      ).to.emit(oracle, "PriceUpdated");
    });

    it("reverts when deviation exceeds maxDeviationBps", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await oracle.updatePrice(ethers.ZeroAddress, PRICE_ONE);

      await time.increase(MIN_INTERVAL + 1);

      // 6% move — exceeds the 5% max deviation.
      const newPrice = PRICE_ONE * 106n / 100n;
      await expect(
        oracle.updatePrice(ethers.ZeroAddress, newPrice)
      ).to.be.revertedWithCustomError(oracle, "DeviationExceeded");
    });

    it("allows update within deviation bounds", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await oracle.updatePrice(ethers.ZeroAddress, PRICE_ONE);

      await time.increase(MIN_INTERVAL + 1);

      // 4% move — within the 5% max deviation.
      const newPrice = PRICE_ONE * 104n / 100n;
      await expect(
        oracle.updatePrice(ethers.ZeroAddress, newPrice)
      ).to.emit(oracle, "PriceUpdated");
    });
  });

  describe("getPrice", function () {
    it("returns price and timestamp after update", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await oracle.updatePrice(ethers.ZeroAddress, PRICE_ONE);

      const [price, updatedAt] = await oracle.getPrice(ethers.ZeroAddress);
      expect(price).to.equal(PRICE_ONE);
      expect(updatedAt).to.be.greaterThan(0);
    });

    it("reverts if price has never been set (stale)", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await expect(
        oracle.getPrice(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(oracle, "PriceTooStale");
    });

    it("reverts if price is older than heartbeat", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await oracle.updatePrice(ethers.ZeroAddress, PRICE_ONE);

      // Advance time past the heartbeat.
      await time.increase(HEARTBEAT + 1);

      await expect(
        oracle.getPrice(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(oracle, "PriceTooStale");
    });
  });

  describe("access control", function () {
    it("owner can add a new updater", async () => {
      const { oracle, updater } = await loadFixture(deployFixture);

      await expect(oracle.addUpdater(updater.address))
        .to.emit(oracle, "UpdaterAdded")
        .withArgs(updater.address);

      expect(await oracle.authorizedUpdaters(updater.address)).to.be.true;
    });

    it("new updater can push prices", async () => {
      const { oracle, updater } = await loadFixture(deployFixture);

      await oracle.addUpdater(updater.address);

      await expect(
        oracle.connect(updater).updatePrice(ethers.ZeroAddress, PRICE_ONE)
      ).to.emit(oracle, "PriceUpdated");
    });

    it("owner can remove an updater", async () => {
      const { oracle, updater } = await loadFixture(deployFixture);

      await oracle.addUpdater(updater.address);
      await oracle.removeUpdater(updater.address);

      await expect(
        oracle.connect(updater).updatePrice(ethers.ZeroAddress, PRICE_ONE)
      ).to.be.revertedWithCustomError(oracle, "UnauthorizedUpdater");
    });

    it("non-owner cannot add updaters", async () => {
      const { oracle, alice } = await loadFixture(deployFixture);

      await expect(
        oracle.connect(alice).addUpdater(alice.address)
      ).to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
    });
  });

  describe("owner configuration", function () {
    it("owner can update heartbeat", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await oracle.setHeartbeat(600);
      expect(await oracle.heartbeat()).to.equal(600);
    });

    it("owner can update maxDeviation", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await oracle.setMaxDeviation(1000);
      expect(await oracle.maxDeviationBps()).to.equal(1000);
    });

    it("owner can update minUpdateInterval", async () => {
      const { oracle } = await loadFixture(deployFixture);

      await oracle.setMinUpdateInterval(60);
      expect(await oracle.minUpdateInterval()).to.equal(60);
    });
  });
});
