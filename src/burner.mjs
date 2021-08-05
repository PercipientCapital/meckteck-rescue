import { ethers, providers, Wallet } from "ethers";
import { gasPriceToGwei, GWEI } from "./util.mjs";

import dotenv from "dotenv";
dotenv.config();

const formatEther = ethers.utils.formatEther;
// require('log-timestamp');

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545"
// const VICTIM_KEY = process.env.VICTIM_KEY || ""
const VICTIM_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // hardhat account

if (VICTIM_KEY === "") {
  console.warn("Must provide VICTIM_KEY environment variable, corresponding to Ethereum EOA with assets to be transferred")
  process.exit(1)
}

const provider = new providers.JsonRpcProvider(ETHEREUM_RPC_URL);
const walletZeroGas = new Wallet(VICTIM_KEY, provider);

console.log(`Zero Gas Account: ${walletZeroGas.address}`)

async function burn(wallet) {
  const balance = await wallet.getBalance();
  if (balance.isZero()) {
    console.log(` Balance is zero`);
    return;
  }
  
  const gasPrice = balance.div(21000).sub(1);
  if (gasPrice.lt(1e9)) {
    console.log(` Balance too low to burn (balance=${formatEther(balance)} gasPrice=${gasPriceToGwei(gasPrice)})`);
    return;
  }

  try {
    console.log(` Burning ${formatEther(balance)}`);
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      gasLimit: 21000,
      gasPrice,
    });
    console.log(` Sent tx with nonce ${tx.nonce} burning ${formatEther(balance)} ETH at gas price ${gasPriceToGwei(gasPrice)} gwei: ${tx.hash}`);
  } catch (err) {
    console.log(` Error sending tx: ${err.message ?? err}`);
  }
}

async function main() {
  console.log(`Connected to ${ETHEREUM_RPC_URL}`);
  provider.on('block', async (blockNumber) => {
    console.log(`New block ${blockNumber}`);
    await burn(walletZeroGas);
  });
}

main()
// credit: [github/spalladino](https://github.com/spalladino/flashbots-unstake-and-transfer/blob/main/src/burner.ts)