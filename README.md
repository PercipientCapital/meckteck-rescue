# flashbots rescue

```sh
# run the ETH impersonation script
npx hardhat run scripts/impersonate-orlando.mjs

# run the flashbots script
yarn flashbots

# run the BSC script
yarn bsc
```

## technical details

compromised account: `0xfcF4710e3078c3b28dcCc90adf3a1faFf6dD3a7A`

### ETH

Recoverable assets: aWETH, (aave) VariableDebtUSDC, DUCK.

#### Re-collateralize, liquidate, transfer

These assets cannot simply be transferred out. The Aave loan has to be liquidated. Only about $50. Not worth.

* aWETH ERC20 contract: [`0x030ba81f1c18d280636f32af80b9aad02cf0854e`](https://etherscan.io/address/0x030ba81f1c18d280636f32af80b9aad02cf0854e)
* vdUSDC ERC20 contract: [`0x619beb58998ed2278e08620f97007e1116d5d25b`](https://etherscan.io/address/0x619beb58998ed2278e08620f97007e1116d5d25b)

#### Unstake & Transfer

This asset has to be un-staked as well as transferred.

* DUCK ERC20 contract: [`0xc0ba369c8db6eb3924965e5c4fd0b4c1b91e305f`](https://etherscan.io/address/0xc0ba369c8db6eb3924965e5c4fd0b4c1b91e305f)
* Duckstarter staking contract: [`0x3a9280f3a7ac4dda31161d6df2f8139ae303d0ab`](https://etherscan.io/address/0x3a9280f3a7ac4dda31161d6df2f8139ae303d0ab#code)

7.775 DUCK can be transferred out directly. 2000 are still locked in a staking contract (Duckstarter).

Call `withdraw(amount)` on Duckstarter, then transfer total DUCK balance from account. Calculate pre-transfer balances in hardhat simulation.

### BSC

These assets must be un-staked and transferred.

Recoverable assets: CAKE, BUNNY, WISE.

* CAKE ERC20 contract: [`0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82`](https://bscscan.com/address/0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82)
* BUNNY ERC20 contract: [`0xc9849e6fdb743d08faee3e34dd2d1bc69ea11a51`](https://bscscan.com/address/0xc9849e6fdb743d08faee3e34dd2d1bc69ea11a51)
* WISE ERC20 contract: [`0x4f491d389a5bf7c56bd1e4d8af2280fd217c8543`](https://bscscan.com/address/0x4f491d389a5bf7c56bd1e4d8af2280fd217c8543)

* CAKE Staking contract: [`0xedfcb78e73f7ba6ad2d829bf5d462a0924da28ed`](https://bscscan.com/address/0xedfcb78e73f7ba6ad2d829bf5d462a0924da28ed)
  * `principalOf` => CAKE tokens (16.408)
  * what do these mean?
    * `earned` (1.539)
    * `sharesOf` (9.979)
    * `withdrawableBalanceOf` (17.948)
* WISE Staking contract: [`0xa79b25e1aa4ece82f681598ae2e1a8aacab4dca6`](https://bscscan.com/address/0xa79b25e1aa4ece82f681598ae2e1a8aacab4dca6)

#### CAKE/BUNNY

Bunny is a lending/staking platform. _victim_ earns CAKE & BUNNY by depositing CAKE. [CAKE/BUNNY Pool](https://pancakebunny.finance/pool/CAKE)

It looks like by exiting from the CAKE staking contract, we will receive both CAKE & BUNNY tokens.

The website shows two buttons: "Withdraw" and "Exit: Claim & Withdraw". We want the latter. `withdrawAll` seems like the right function...?
Aforementioned contract address is a proxy. Here's the [base contract](https://bscscan.com/address/0x272d425a4ab32fac776533078cf1801dd1a100f6#code)

relevant methods to investigate: `getReward`, `harvest`, `withdraw`, `withdrawUnderlying`, `withdrawAll`

`withdrawAll` does two (relevant) things: `CAKE.safeTransfer` (transfers CAKE), and `_harvest(cakeHarvested)`. The functionality of the former is obvious, but what does `_harvest` do? `getReward` does the same but it only claims the reward amount; doesn't transfer out _everything_.

`_harvest` does this:

```js
    CAKE_MASTER_CHEF.enterStaking(cakeAmount);
```

... which, in the CAKE_MASTER_CHEF contract, does this:

```js
    pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
```

... it transfers LP tokens from sender to contract. Why is this called?

#### WISE

`$getMyTokens` appears to be the function we need to unstake.
