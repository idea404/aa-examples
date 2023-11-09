import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as hre from "hardhat";
import * as ethers from "ethers";
import { Wallet, utils, Provider, types } from "zksync-web3";

export const config = {
  firstWalletPrivateKey: "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110",
  firstWalletAddress: "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049",
  L2NetworkRpcUrl: "http://127.0.0.1:8011",
};

export async function deployPensionAccountFactory(privateKey: string) {
  // Private key of the account used to deploy
  console.log("Deploying PensionAccountFactory")
  const wallet = new Wallet(privateKey, new Provider(config.L2NetworkRpcUrl));
  console.log("Wallet address: ", wallet.address);
  const deployer = new Deployer(hre, wallet);
  console.log("Deployer");
  const pensionAccountFactoryArtifact = await deployer.loadArtifact("PensionAccountFactory");
  console.log("PensionAccountFactoryArtifact");
  const paArtifact = await deployer.loadArtifact("PensionAccount");
  console.log("PensionAccountArtifact");

  // Getting the bytecodeHash of the account
  const bytecodeHash = utils.hashBytecode(paArtifact.bytecode);
  console.log(`PensionAccount bytecode hash: ${bytecodeHash}`);
  let paFactory = await deployer.deploy(pensionAccountFactoryArtifact, [bytecodeHash], undefined, [
    // Since the factory requires the code of the multisig to be available,
    // we should pass it here as well.
    paArtifact.bytecode,
  ]);
  console.log(`PensionAccount factory address: ${paFactory.address}`);

  return paFactory;
}

export async function deployPensionAccount(L2RpcUrl: string, walletPrivateKey: string, factoryAddress: string, accountOwnerPublicKey: string) {
  const AA_FACTORY_ADDRESS = factoryAddress;
  const provider = new Provider(L2RpcUrl);

  // Private key of the account used to deploy
  const wallet = new Wallet(walletPrivateKey).connect(provider);
  const paFactoryArtifact = await hre.artifacts.readArtifact("PensionAccountFactory");
  const paFactory = new ethers.Contract(AA_FACTORY_ADDRESS, paFactoryArtifact.abi, wallet);

  // Account owner address
  const owner = ethers.utils.getAddress(accountOwnerPublicKey);

  // Contract constructor args
  const dex = "0x123dex";
  const doge = "0x123doge";
  const pepe = "0x123pepe";
  const shib = "0x123shib";
  const btc = "0x123btc";

  // For the simplicity of the tutorial, we will use zero hash as salt
  const salt = ethers.constants.HashZero;

  // deploy account with dex and token addresses
  const tx = await paFactory.deployAccount(salt, owner, dex, doge, pepe, shib, btc, { gasLimit: 10000000 });
  await tx.wait();

  // Getting the address of the deployed contract account
  const abiCoder = new ethers.utils.AbiCoder();
  let multisigAddress = utils.create2Address(
    AA_FACTORY_ADDRESS,
    await paFactory.aaBytecodeHash(),
    salt,
    abiCoder.encode(["owner", "dex", "doge", "pepe", "shib", "btc"], [owner, dex, doge, pepe, shib, btc])
  );
  console.log(`Multisig account deployed on address ${multisigAddress}`);

  const pensionAccountContract = new ethers.Contract(multisigAddress, paFactoryArtifact.abi, wallet);
  return pensionAccountContract;
}

export async function fundAccount(L2RpcUrl: string, walletPrivateKey: string, destinationAddress: string, amount: string = "100") {
  const provider = new Provider(L2RpcUrl);
  // Private key of the account used to deploy
  const wallet = new Wallet(walletPrivateKey).connect(provider);
  console.log("Destination address is: " + destinationAddress);
  // Send funds to the account
  await (
    await wallet.sendTransaction({
      to: destinationAddress,
      // You can increase the amount of ETH sent to the multisig
      value: ethers.utils.parseEther(amount),
    })
  ).wait();
  const destinationAccountBalance = await provider.getBalance(destinationAddress);
  console.log(`Destination account balance is ${destinationAccountBalance.toString()}`);
}

// Temporary wallet for testing - that is accepting one foreign private key - and signs the transaction with it.
export class PensionAccountWallet extends Wallet {
  readonly address: string;
  otherWallet: Wallet;

  // AA_address - is the account abstraction address for which, we'll use the private key to sign transactions.
  constructor(
    paAddress: string,
    privateKey: string,
    L2RpcUrl: string,
  ) {
    const provider = new Provider(L2RpcUrl);
    super(privateKey, provider);
    this.address = paAddress;
  }

  getAddress(): Promise<string> {
    return Promise.resolve(this.address);
  }

  async signTransaction(transaction: types.TransactionRequest) {
    const signature = await this.eip712.sign(transaction);
    if (transaction.customData === undefined) {
      throw new Error("Transaction customData is undefined");
    }
    transaction.customData.customSignature = signature;
    return (0, utils.serialize)(transaction);
  }
}