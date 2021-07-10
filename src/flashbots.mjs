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
const duckStakingContract = new Contract(contracts.duckStaking.address, contracts.duckStaking.abi, provider);
const duckTokenContract = new Contract(contracts.duckToken.address, contracts.anyERC20.abi, provider);
const checkAndSendContract = new Contract(contracts.checkAndSend.address, contracts.checkAndSend.abi, provider);

// print starting ETH balances
console.log(`VICTIM WALLET\t(${victimAddress}) ${utils.formatEther(await provider.getBalance(victimAddress))} ETH`);
console.log(`SAFE WALLET\t(${recipientAddress}) ${utils.formatEther(await provider.getBalance(recipientAddress))} ETH`);
console.log(`DONOR WALLET\t(${donorAddress}) ${utils.formatEther(await provider.getBalance(donorAddress))} ETH`);

// tokens currently sitting in victim wallet
const duckTokenBalance = await duckTokenContract.balanceOf(victimAddress);
// amount we can unstake
const duckStakingBalance = (await duckStakingContract.userInfo(victimAddress))["staked"];

// print token balances before un-staking
console.log("\n*** Pre-exit Balances ***");
console.log("DUCK Balance", utils.formatEther(duckTokenBalance));
console.log("DUCK Staking Balance", utils.formatEther(duckStakingBalance));

// how much we should expect to have after unstake
const expectedDuckBalance = BigNumber.from("0x67ad9ee3759772696b");        // pre-calculated with hardhat // TODO: always re-run right before recovery since this should increase over time)

// transactions: unstake & transfer
const zeroGasTxs = [
    { // unstake
        ...(await duckStakingContract.populateTransaction.withdraw(duckStakingBalance)),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(180000),
    },
    { // transfer DUCK tokens (in wallet after withdraw/unstake)
        ...(await duckTokenContract.populateTransaction.transfer(recipientAddress, expectedDuckBalance)),
        gasPrice: BigNumber.from(0),
        gasLimit: BigNumber.from(80000),
    },
];

// build donor transaction
const checkTargets = [
    duckTokenContract.address,
];
const checkPayloads = [
    duckTokenContract.interface.encodeFunctionData('balanceOf', [recipientAddress]),
];
const checkMatches = [
    duckTokenContract.interface.encodeFunctionResult('balanceOf', [expectedDuckBalance]),
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
