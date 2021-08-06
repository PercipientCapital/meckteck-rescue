# flashbots rescue

```sh
# run the ETH impersonation script
yarn eth-hardhat

# run the flashbots script
yarn flashbots

# run the BSC script
yarn bsc
```

## TODO

- [x] get private key
- [x] ensure transactions work with EIP-1559, modify if necessary
- [ ] save the moneys

## meat and potatoes

- [hardhat simulation script](./scripts/impersonate-meckteck.mjs)
- [flashbots script](./src/flashbots.mjs)

## technical details

supported Node.js version: `16`

compromised account: `0xF248f7e076F8F63b39DEcEf2B115E01c9c6c8978`

### ETH

Recoverable assets: NBU, GNBU.

- NBU

  Address: [`0xEB58343b36C7528F23CAAe63a150240241310049`](https://etherscan.io/address/0xeb58343b36c7528f23caae63a150240241310049#code)

- GNBU

  Address: [`0x639ae8F3EEd18690bF451229d14953a5A5627b72`](https://etherscan.io/address/0x639ae8f3eed18690bf451229d14953a5a5627b72#code)

#### Unvest

Tokens are (or will be) available to "unvest."

```js
tokenContract.unvest();
```

#### Transfer

To transfer these tokens, we need to look not at `balanceOf` but `availableForTransfer`. The entire balance may not be transferred; only as much as is marked "available."

```js
const transferrableBalance = await tokenContract.availableForTransfer(
  victimAddress
);

await tokenContract.transfer(recipientAddress, transferrableBalance);
```
