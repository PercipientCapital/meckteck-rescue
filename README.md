# flashbots rescue

```sh
# run the ETH impersonation script
yarn eth-hardhat

# run the flashbots script
yarn flashbots

# run the BSC script
yarn bsc
```

## technical details

compromised account: `0xF248f7e076F8F63b39DEcEf2B115E01c9c6c8978`

### ETH

Recoverable assets: NBU, GNBU.

#### Unvest

Tokens are (or will be) available to "unvest."

```js
tokenContract.unvest()
```

##### NBU

Address: [`0xEB58343b36C7528F23CAAe63a150240241310049`](https://etherscan.io/address/0xeb58343b36c7528f23caae63a150240241310049#code)

##### GNBU

Address: [`0x639ae8F3EEd18690bF451229d14953a5A5627b72`](https://etherscan.io/address/0x639ae8f3eed18690bf451229d14953a5a5627b72#code)
