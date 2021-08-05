import { Contract, providers, Wallet, utils, BigNumber } from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import dotenv from "dotenv";
dotenv.config();

import contracts from "./contracts.mjs";
import { checkSimulation, beepBoop, gasPriceToGwei, GWEI } from "./util.mjs";
const PRIORITY_GAS_PRICE = GWEI.mul(49);
const BLOCKS_IN_FUTURE = 2;

// wallets
const authSigner = new Wallet(process.env.BUNDLE_SIGNER_REPUTATION_KEY);
const victimSigner = new Wallet(process.env.VICTIM_KEY); 
const donorSigner = new Wallet(process.env.DONOR_KEY);

// EOA addresses
const donorAddress = process.env.DONOR_ADDRESS;
const recipientAddress = process.env.SAFE_RECIPIENT_ADDRESS;
const victimAddress = process.env.VICTIM_ADDRESS;

// providers
const provider = new providers.JsonRpcProvider({url: process.env.ETH_RPC_HTTP}, 1); // mainnet
const flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner);

// contracts
const nimbusTokenContract = new Contract(contracts.nimbusToken.address, contracts.nimbusToken.abi, provider);
const nimbusGovernanceContract = new Contract(contracts.nimbusGovernance.address, contracts.nimbusGovernance.abi, provider);

// print starting ETH balances
console.log(`VICTIM WALLET\t(${victimAddress}) ${utils.formatEther(await provider.getBalance(victimAddress))} ETH`);
console.log(`SAFE WALLET\t(${recipientAddress}) ${utils.formatEther(await provider.getBalance(recipientAddress))} ETH`);
console.log(`DONOR WALLET\t(${donorAddress}) ${utils.formatEther(await provider.getBalance(donorAddress))} ETH`);

// tokens currently sitting in victim wallet (that can be transferred)
const nimbusTokenBalance = await nimbusTokenContract.availableForTransfer(victimAddress);
const nimbusGovernanceBalance = await nimbusGovernanceContract.availableForTransfer(victimAddress);

// print token balances before un-staking
console.log("\n*** Pre-exit Balances ***");
console.log("NBU Balance", utils.formatEther(nimbusTokenBalance));
console.log("GNBU Balance", utils.formatEther(nimbusGovernanceBalance));

// how much we should expect to have after unstake
const expectedNimbusBalance = BigNumber.from("0x3a099b217caeb6a116");        // pre-calculated with hardhat // TODO: always re-run right before recovery since this should increase over time)
const expectedNimbusGovernanceBalance = BigNumber.from("0x17a3eab4a890f3da37");        // pre-calculated with hardhat // TODO: always re-run right before recovery since this should increase over time)

const nonce = await provider.getTransactionCount(victimAddress);
const block = await provider.getBlock("latest");
console.log("starting nonce", nonce);
console.log("starting block", block.number);
console.log("block base gas fee", block.baseFeePerGas);

// transactions: unstake & transfer
const sponsoredTransactions = [
    { // unvest NBU tokens
        ...(await nimbusTokenContract.populateTransaction.unvest()),
        nonce: nonce,
    },
    { // unvest GNBU tokens
        ...(await nimbusGovernanceContract.populateTransaction.unvest()),
        nonce: nonce + 1,
    },
    { // transfer NBU tokens to safe address
        ...(await nimbusTokenContract.populateTransaction.transfer(recipientAddress, expectedNimbusBalance)),
        nonce: nonce + 2,
    },
    { // transfer GNBU tokens to safe address
        ...(await nimbusGovernanceContract.populateTransaction.transfer(recipientAddress, expectedNimbusGovernanceBalance)),
        nonce: nonce + 3,
    },
];

const gasEstimates = await Promise.all(sponsoredTransactions.map(tx =>
    provider.estimateGas({
      ...tx,
      from: tx.from === undefined ? victimSigner.address : tx.from
    }))
);
console.log("gas estimates", gasEstimates);
const gasEstimateTotal = gasEstimates.reduce((acc, cur) => acc.add(cur), BigNumber.from(0))
const gasPrice = PRIORITY_GAS_PRICE.add(block.baseFeePerGas || 0);

const bundleTransactions = [
    {
      transaction: {
        to: victimSigner.address,
        gasPrice: gasPrice,
        value: gasEstimateTotal.mul(gasPrice),
        gasLimit: 21000,
      },
      signer: donorSigner,
    },
    ...sponsoredTransactions.map((transaction, txNumber) => {
      return {
        transaction: {
          ...transaction,
          gasPrice: gasPrice,
          gasLimit: gasEstimates[txNumber],
        },
        signer: victimSigner,
      }
    })
];

// const signedBundle = await flashbotsProvider.signBundle(bundleTransactions);

// // simulate the bundle
// const simulationGasPrice = await checkSimulation(flashbotsProvider, signedBundle);
// console.log("simulation gas price", simulationGasPrice);

// WARNING
console.log("SENDING TRANSACTION TO FLASHBOTS.");
await beepBoop(5, "PRESS CTRL-C NOW TO QUIT.");

// send the bundle for real
// provider.on('block', async (blockNumber) => {
//     const gasPrice = await checkSimulation(flashbotsProvider, signedBundle);
//     const targetBlockNumber = blockNumber + BLOCKS_IN_FUTURE;
//     console.log(`Current Block Number: ${blockNumber},   Target Block Number:${targetBlockNumber},   gasPrice: ${gasPriceToGwei(gasPrice)} gwei`)
//     const bundleResponse = await flashbotsProvider.sendBundle(bundle, targetBlockNumber);
//     const bundleResolution = await bundleResponse.wait()
//     if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
//         console.log(`Congrats, included in ${targetBlockNumber}`);
//         // print new balances to compare
//         console.log("\n*** Post-exit Balances ***");
//         const newDuckBalance = await duckTokenContract.balanceOf(victimAddress);
//         console.log("DUCK Balance", utils.formatEther(newDuckBalance));
//         process.exit(0);
//     } else if (bundleResolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
//         console.log(`Not included in ${targetBlockNumber}`)
//     } else if (bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
//         console.log("Nonce too high, bailing")
//         process.exit(1)
//     }
// });
