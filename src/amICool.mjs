// https://gist.github.com/martriay/ef59ab139f9ea80c1b7ea18f3da296fb
import fetch from 'node-fetch';
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// const sendingAccount = {
//   privateKey: process.env.BUNDLE_SIGNER_REPUTATION_KEY,
//   address: process.env.BUNDLE_SIGNER_REPUTATION_ADDRESS,
// };
const sendingAccount = {
  privateKey: process.env.BUNDLE_SIGNER_REPUTATION_KEY,
  address: process.env.BUNDLE_SIGNER_REPUTATION_ADDRESS,
};

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_HTTP);
  const signer = new ethers.Wallet(sendingAccount.privateKey);
  const blockNumber = await provider.getBlockNumber();
  const message = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "flashbots_getUserStats",
    "params": [ethers.utils.hexlify(blockNumber)]
  };

  const body = JSON.stringify(message);
  const signature = await signer.signMessage(ethers.utils.id(body));
  const headers = { 'X-Flashbots-Signature': `${sendingAccount.address}:${signature}` };
  const request = await fetch('https://relay.flashbots.net/', {
    method: 'POST',
    body,
    headers
  });

  console.log(await request.json());
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });