import { Contract, providers, Wallet, utils, BigNumber } from "ethers";
import dotenv from "dotenv";
dotenv.config();

import contracts from "./contracts.mjs";
import { sleep } from "./util.mjs";
import { beepBoop } from "./util.mjs";

const IS_SIMULATION = process.env.BSC_SIMULATION === "true";

await beepBoop(3, IS_SIMULATION ? "COMMENCING SIMULATION MODE" : "THIS IS NOT A SIMULATION!!!");

const RPC_URL = IS_SIMULATION ? "http://localhost:8545" : process.env.BSC_RPC_HTTP;
const CHAIN_ID = IS_SIMULATION ? 31337 : 56;

const provider = new providers.JsonRpcProvider({url: RPC_URL}, CHAIN_ID);
console.log("provider", provider);
const victimSigner = new Wallet(process.env.VICTIM_KEY, provider);
const donorSigner = IS_SIMULATION ? 
    new Wallet("ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider) // hardhat account
    : new Wallet(process.env.DONOR_KEY, provider); // real donor

// erc20 tokens
const bunnyTokenContract = new Contract(contracts.bunnyToken.address, contracts.anyERC20.abi, victimSigner);
const cakeTokenContract = new Contract(contracts.cakeToken.address, contracts.anyERC20.abi, victimSigner);
const wiseTokenContract = new Contract(contracts.wiseToken.address, contracts.anyERC20.abi, victimSigner);

// staking contracts
const cakeStakingContract = new Contract(contracts.cakeStaking.address, contracts.cakeStaking.abi, victimSigner);
const wiseStakingContract = new Contract(contracts.wiseStaking.address, contracts.wiseStaking.abi, victimSigner);

console.log(donorSigner.address);
console.log(`donor balance: ${utils.formatEther(await provider.getBalance(donorSigner.address))} BNB`);
console.log(victimSigner.address);
console.log(`victim balance: ${utils.formatEther(await provider.getBalance(victimSigner.address))} BNB`);

// make you second-guess yourself
await beepBoop(10, "ABOUT TO SEND REAL TRANSACTIONS. PRESS CTRL-C NOW TO EXIT.");

// uncomment the following to send 0.0176 BNB to victim account
// send BNB to victim account
// const tx = {
//     value: "0x3E871B540C0000", // 17600000000000000 (on bsc, the smallest unit is gwei; but ethers uses wei, so multiply gwei value by 10^9)
//     to: victimSigner.address,
//     gasLimit: 40000,
// };
// await donorSigner.sendTransaction(tx).then(res => {
//     console.log(res);
// });

const startingBunnyBalance = await bunnyTokenContract.balanceOf(victimSigner.address);
const startingCakeBalance = await cakeTokenContract.balanceOf(victimSigner.address);
const startingWiseBalance = await wiseTokenContract.balanceOf(victimSigner.address);
console.log("starting BUNNY balance", startingBunnyBalance);
console.log("starting CAKE balance", startingCakeBalance);
console.log("starting WISE balance", startingWiseBalance);

const nonce = await victimSigner.getTransactionCount();

// unstake
// not sure why but gas limit has to be much higher than the actual cost...
const cakeUnstakePromise = cakeStakingContract.withdrawAll({gasLimit: 600000, nonce });
const wiseUnstakePromise = wiseStakingContract.$getMyTokens({gasLimit: 100000, nonce: nonce + 1 });

// make this false (also ensure BSC_SIMULATION=true) to get true recoverable balances before recovery
const shouldTransfer = true;

// transfer (values hardcoded from previous hardhat sim run)
if (shouldTransfer) {
    const bunnyTransferPromise = bunnyTokenContract.transfer(process.env.SAFE_RECIPIENT_ADDRESS, 
        BigNumber.from("0x0afece0cade5c4f7"), // TODO: update this right before running (set shouldTransfer=false)
        {gasLimit: 60000, nonce: nonce + 2});
    const cakeTransferPromise = cakeTokenContract.transfer(process.env.SAFE_RECIPIENT_ADDRESS, 
        BigNumber.from("0xfea4f78c52bfd45e"), // TODO: update this right before running (set shouldTransfer=false)
        {gasLimit: 60000, nonce: nonce + 3});
    const wiseTransferPromise = wiseTokenContract.transfer(process.env.SAFE_RECIPIENT_ADDRESS, 
        BigNumber.from("0x0727de34a24f900000"), // TODO: update this right before running (set shouldTransfer=false)
        {gasLimit: 60000, nonce: nonce + 4});
    
        // wait for all transactions to resolve
    await Promise.all([
        cakeUnstakePromise,
        wiseUnstakePromise,
        bunnyTransferPromise,
        cakeTransferPromise,
        wiseTransferPromise,
    ]).then(res => {
        console.log(res);
    });
} else {
    // wait for all transactions to resolve (no transfers)
    await Promise.all([
        cakeUnstakePromise,
        wiseUnstakePromise,
    ]).then(res => {
        console.log(res);
    });
}

sleep(5000);

// check that New Balances are fresh
const newBunnyBalance = await bunnyTokenContract.balanceOf(victimSigner.address);
const newCakeBalance = await cakeTokenContract.balanceOf(victimSigner.address);
const newWiseBalance = await wiseTokenContract.balanceOf(victimSigner.address);
console.log("new BUNNY balance", newBunnyBalance);
console.log("new CAKE balance", newCakeBalance);
console.log("new WISE balance", newWiseBalance);
// there will be some dust due to the fact that the transfer values are hardcoded

const recipientBunnyBalance = await bunnyTokenContract.balanceOf(process.env.SAFE_RECIPIENT_ADDRESS);
const recipientCakeBalance = await cakeTokenContract.balanceOf(process.env.SAFE_RECIPIENT_ADDRESS);
const recipientWiseBalance = await wiseTokenContract.balanceOf(process.env.SAFE_RECIPIENT_ADDRESS);
console.log("recipient BUNNY balance", recipientBunnyBalance);
console.log("recipient CAKE balance", recipientCakeBalance);
console.log("recipient WISE balance", recipientWiseBalance);
