import { Contract, providers, Wallet, utils, BigNumber } from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import dotenv from "dotenv";
dotenv.config();

import contracts from "./contracts.mjs";
import { checkSimulation, beepBoop, gasPriceToGwei, ETHER } from "./util.mjs";
const MINER_REWARD_IN_WEI = ETHER.div(1000).mul(15); // 0.015 ETH
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
const checkAndSendContract = new Contract(contracts.checkAndSend.address, contracts.checkAndSend.abi, provider);

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
const expectedNimbusBalance = BigNumber.from("0x39906053ca922b50e0");        // pre-calculated with hardhat // TODO: always re-run right before recovery since this should increase over time)
const expectedNimbusGovernanceBalance = BigNumber.from("0x175a1794902f028bb4");        // pre-calculated with hardhat // TODO: always re-run right before recovery since this should increase over time)

const startNonce = await provider.getTransactionCount(victimAddress);
console.log("starting nonce", startNonce);

// transactions: unstake & transfer
const zeroGasTxs = [
    { // unvest NBU tokens
        ...(await nimbusTokenContract.populateTransaction.unvest()),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(180000),
        nonce: nonce,
    },
    { // unvest GNBU tokens
        ...(await nimbusGovernanceContract.populateTransaction.unvest()),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(80000),
        nonce: nonce + 1,
    },
    { // transfer NBU tokens to safe address
        ...(await nimbusTokenContract.populateTransaction.transfer(recipientAddress, expectedNimbusBalance)),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(50000),
        nonce: nonce + 2,
    },
    { // transfer GNBU tokens to safe address
        ...(await nimbusGovernanceContract.populateTransaction.transfer(recipientAddress, expectedNimbusGovernanceBalance)),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(50000),
        nonce: nonce + 3,
    },
];

// build donor transaction
const checkTargets = [
    nimbusTokenContract.address,
    nimbusGovernanceContract.address,
];
const checkPayloads = [
    nimbusTokenContract.interface.encodeFunctionData('availableForTransfer', [recipientAddress]),
    nimbusGovernanceContract.interface.encodeFunctionData('availableForTransfer', [recipientAddress]),
];
const checkMatches = [
    nimbusTokenContract.interface.encodeFunctionResult('availableForTransfer', [expectedNimbusBalance]),
    nimbusGovernanceContract.interface.encodeFunctionResult('availableForTransfer', [expectedNimbusGovernanceBalance]),
];
const donorTx = {
    ...(await checkAndSendContract.populateTransaction.check32BytesAndSendMulti(checkTargets, checkPayloads, checkMatches)),
    value: MINER_REWARD_IN_WEI,
    gasPrice: BigNumber.from(0),
    gasLimit: BigNumber.from(400000),
};

// flashbots bundle
const bundle = [
    ...zeroGasTxs.map(transaction => {
        return {
            transaction,
            signer: victimSigner,
        }
    }),
    {
        transaction: donorTx,
        signer: donorSigner,
    }
];
const signedBundle = await flashbotsProvider.signBundle(bundle);

// simulate the bundle
const gasPrice = await checkSimulation(flashbotsProvider, signedBundle);
console.log("simulation gasPrice", gasPrice);

// WARNING
console.log("SENDING TRANSACTION TO FLASHBOTS.");
await beepBoop(5, "PRESS CTRL-C NOW TO QUIT.");

// send the bundle for real
provider.on('block', async (blockNumber) => {
    const gasPrice = await checkSimulation(flashbotsProvider, signedBundle);
    const targetBlockNumber = blockNumber + BLOCKS_IN_FUTURE;
    console.log(`Current Block Number: ${blockNumber},   Target Block Number:${targetBlockNumber},   gasPrice: ${gasPriceToGwei(gasPrice)} gwei`)
    const bundleResponse = await flashbotsProvider.sendBundle(bundle, targetBlockNumber);
    const bundleResolution = await bundleResponse.wait()
    if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
        console.log(`Congrats, included in ${targetBlockNumber}`);
        // print new balances to compare
        console.log("\n*** Post-exit Balances ***");
        const newDuckBalance = await duckTokenContract.balanceOf(victimAddress);
        console.log("DUCK Balance", utils.formatEther(newDuckBalance));
        process.exit(0);
    } else if (bundleResolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
        console.log(`Not included in ${targetBlockNumber}`)
    } else if (bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
        console.log("Nonce too high, bailing")
        process.exit(1)
    }
});
