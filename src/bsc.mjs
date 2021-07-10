import { Contract, providers, Wallet, utils, BigNumber } from "ethers";
import dotenv from "dotenv";
dotenv.config();

import contracts from "./contracts.mjs";
import { sleep } from "./util.mjs";

const IS_SIMULATION = process.env.BSC_SIMULATION === "true";

const RPC_URL = IS_SIMULATION ? "http://localhost:8545" : process.env.BSC_RPC_HTTP;
const CHAIN_ID = IS_SIMULATION ? 31337 : 56;

const provider = new providers.JsonRpcProvider({url: RPC_URL}, CHAIN_ID); // mainnet
const victimSigner = new Wallet(process.env.VICTIM_KEY, provider);
const whaleSigner = IS_SIMULATION ? 
    new Wallet("ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider) // hardhat account
    : new Wallet(process.env.BSC_DONOR_KEY); // real donor

// erc20 tokens
const bunnyTokenContract = new Contract(contracts.bunnyToken.address, contracts.anyERC20.abi, victimSigner);
const cakeTokenContract = new Contract(contracts.cakeToken.address, contracts.anyERC20.abi, victimSigner);
const wiseTokenContract = new Contract(contracts.wiseToken.address, contracts.anyERC20.abi, victimSigner);

// staking contracts
const cakeStakingContract = new Contract(contracts.cakeStaking.address, contracts.cakeStaking.abi, victimSigner);
const wiseStakingContract = new Contract(contracts.wiseStaking.address, contracts.wiseStaking.abi, victimSigner);

console.log(victimSigner.address);
console.log(whaleSigner.address);
console.log(`whale balance: ${utils.formatEther(await provider.getBalance(whaleSigner.address))} ETH`); // simulated whale

// send BNB to victim account
const tx = {
    value: "0x010C8E00", // 17600000
    to: victimSigner.address,
    gasLimit: 40000,
};
await whaleSigner.sendTransaction(tx).then(res => {
    console.log(res);
});

/* Game Plan
  (use sims to figure out exactly how much BNB we need to pay for the unstakes & transfers)
  * stop burner if running
    * transfer exact amount of BNB required to unstake & transfer CAKE+BUNNY+WISE
    * unstake CAKE to receive CAKE & BUNNY
    * transfer CAKE & BUNNY to safe account
    * unstake WISE
    * transfer WISE to safe account
  * ensure funds made it
  * run burner to piss off suckers
*/

/* EXACT COSTS (gas)
    * unstake CAKE: 393483
    * unstake WISE: 50493
    * transfer BUNNY: 51639
    * transfer CAKE: 51639
    * transfer WISE: 36665
    * 
    * GRAND TOTAL:  583919
    * GAS PRICE:    20
    * ---------------------
    * COST SUM:     11678380 ("wei")
*/
/* ESTIMATE COSTS (gas)
    * 600000 + 100000 + (60000 * 3) = 17600000
 */

const startingBunnyBalance = await bunnyTokenContract.balanceOf(victimSigner.address);
const startingCakeBalance = await cakeTokenContract.balanceOf(victimSigner.address);
const startingWiseBalance = await wiseTokenContract.balanceOf(victimSigner.address);
console.log("starting BUNNY balance", startingBunnyBalance);
console.log("starting CAKE balance", startingCakeBalance);
console.log("starting WISE balance", startingWiseBalance);

const nonce = await victimSigner.getTransactionCount();
const gasPrice = 20; // TODO: always check current gas prices and set this higher than the average!

// unstake
// not sure why but gas limit has to be much higher than the actual cost...
const cakeUnstakePromise = cakeStakingContract.withdrawAll({gasPrice, gasLimit: 600000, nonce });
const wiseUnstakePromise = wiseStakingContract.$getMyTokens({gasPrice, gasLimit: 100000, nonce: nonce + 1 });

// transfer (values hardcoded from previous hardhat sim run)
const bunnyTransferPromise = bunnyTokenContract.transfer(process.env.SAFE_RECIPIENT_ADDRESS, 
    BigNumber.from("0x0a5cd765252e9010"), // TODO: update this right before running (comment out transfers)
    {gasPrice, gasLimit: 60000, nonce: nonce + 2});
const cakeTransferPromise = cakeTokenContract.transfer(process.env.SAFE_RECIPIENT_ADDRESS, 
    BigNumber.from("0xfda51e14f72dfa9f"), // TODO: update this right before running (comment out transfers)
    {gasPrice, gasLimit: 60000, nonce: nonce + 3});
const wiseTransferPromise = wiseTokenContract.transfer(process.env.SAFE_RECIPIENT_ADDRESS, 
    BigNumber.from("0x0727de34a24f900000"), // TODO: update this right before running (comment out transfers)
    {gasPrice, gasLimit: 60000, nonce: nonce + 4});

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
