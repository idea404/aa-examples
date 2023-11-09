import { expect } from "chai";
import * as ethers from "ethers";
import * as zks from "zksync-web3";
import { config, deployPensionAccountFactory, deployPensionAccount, fundAccount, PensionAccountWallet } from "./utils";

describe("Account Abstraction Tests", function () {
  let result: any;
  let factory: ethers.Contract;
  let firstRichWallet: zks.Wallet;
  let pensionAccountContract: ethers.Contract;
  let pensionAccountWallet: PensionAccountWallet;

  before(async function () {
    console.log("Before all tests");
    firstRichWallet = new zks.Wallet(config.firstWalletPrivateKey);
    console.log("First rich wallet address: ", firstRichWallet.address);
  });

  describe("PensionAccountFactory", function () {
    before(async function () {
      this.timeout(10000);
      console.log("Before PensionAccountFactory tests");
      factory = await deployPensionAccountFactory(config.firstWalletPrivateKey);
      console.log("PensionAccountFactory address: ", factory.address);
    });

    it("Should have a tx hash that starts from 0x", async function () {
      result = factory.deployTransaction.hash;
      expect(result).to.contains("0x");
    });

    it("Should have the confirmations value as 0", async function () {
      result = factory.deployTransaction.confirmations;
      expect(result).to.equal(0);
    });

    it("Should have the From value as a rich wallet address", async function () {
      result = factory.deployTransaction.from;
      expect(result).to.equal(config.firstWalletAddress);
    });

    it("Should have the Signer address value as a rich wallet address", async function () {
      result = factory.signer;
      expect(result.address).to.equal(config.firstWalletAddress);
    });
  });

  describe("PensionAccount", function () {
    before(async function () {
      pensionAccountContract = await deployPensionAccount(config.L2NetworkRpcUrl, config.firstWalletPrivateKey, factory.address, firstRichWallet.address);
      await fundAccount(config.L2NetworkRpcUrl, config.firstWalletPrivateKey, pensionAccountContract.address);
    });

    it("Should be deployed and have an address", async function () {
      result = ethers.utils.isAddress(pensionAccountContract.address);
      expect(result).to.be.true;
    });

    it("Should have a balance with the value X after funding", async function () {
      const balance = await pensionAccountContract.balance();
      expect(balance).to.equal(ethers.utils.parseEther("0.1"));
    });

    it("Should have the PensionAccount nonce as 0 initially", async function () {
      result = await pensionAccountContract.nonce();
      expect(result).to.equal(0);
    });

    it("Should be able to send 10 ETH to the main wallet", async function () {
      pensionAccountWallet = new PensionAccountWallet(
        pensionAccountContract.address,
        config.firstWalletPrivateKey,
        config.L2NetworkRpcUrl
      );
      const balanceBefore = (
        await pensionAccountWallet.provider.getBalance(pensionAccountWallet.address)
      ).toBigInt();
      await (
        await pensionAccountWallet.transfer({
          to: firstRichWallet.address,
          amount: ethers.utils.parseUnits("5", 18),
          overrides: { type: 113 },
        })
      ).wait();
      const balance = (
        await pensionAccountWallet.provider.getBalance(pensionAccountWallet.address)
      ).toBigInt();
      const difference = balanceBefore - balance;
      // expect to be slightly higher than 5
      expect(difference / BigInt(10 ** 18) > 4.9).to.be.true;
      expect(difference / BigInt(10 ** 18) < 5.1).to.be.true;
    });

    it("Should fail to send ETH for a multisig wallet of random keys", async function () {
      const randomWalletKeys = zks.Wallet.createRandom();
      const randomPensionAccountWallet = new PensionAccountWallet(
        pensionAccountContract.address,
        randomWalletKeys.privateKey,
        config.L2NetworkRpcUrl,
      );
      try {
        await (
          await randomPensionAccountWallet.transfer({
            to: firstRichWallet.address,
            amount: ethers.utils.parseUnits("5", 18),
            overrides: { type: 113 },
          })
        ).wait();
        expect.fail("Should fail");
      } catch (e) {
        const expectedMessage =
          "Execution error: Transaction HALT: Account validation error: Account validation returned invalid magic value. Most often this means that the signature is incorrect";
        expect(e.message).to.contains(expectedMessage);
      }
    });
  });
});