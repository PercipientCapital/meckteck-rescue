import hre from "hardhat";
import contracts from "../src/contracts.mjs";
const ethers = hre.ethers;

const victimAddress = "0xfcF4710e3078c3b28dcCc90adf3a1faFf6dD3a7A";
// pulled from accounts list printed by `npx hardhat node`; has 1000ETH
const donorAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
// one of my 1337 addresses
const recipientAddress = "0x1333756bb3CEC30c8F321A016bd80E8f3dc4a589";

// ERC20s
// const aWethAddress = "0x030ba81f1c18d280636f32af80b9aad02cf0854e";
// const vdUsdcAddress = "0x619beb58998ed2278e08620f97007e1116d5d25b";

const impersonate = async (address) => {
    return await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address]
    });
  }
  
const stopImpersonating = async (address) => {
    return await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [address],
    });
}

// send some ETH to victim account (for simplicity)
const fundVictimAccount = async () => {
    await impersonate(donorAddress);
    const donorSigner = ethers.provider.getSigner(donorAddress);
    let fundVictimTx = {
      value: "0x400000000000000000",
      to: victimAddress,
    };
    let res = await donorSigner.sendTransaction(fundVictimTx);
    console.log("donor-fund result", res);
    await stopImpersonating(donorAddress);
}

async function main() {
    // give victim account some test moneys
    await fundVictimAccount();

    // impersonate victim account
    await impersonate(victimAddress);
    const victimSigner = ethers.provider.getSigner(victimAddress);

    // instantiate contracts
    const duckContract = new ethers.Contract(contracts.duckToken.address, contracts.anyERC20.abi, victimSigner);
    const duckStakingContract = new ethers.Contract(contracts.duckStaking.address, contracts.duckStaking.abi, victimSigner);
    // const aWethContract = new ethers.Contract(aWethAddress, contracts.anyERC20.abi, victimSigner);
    // const vdUsdcContract = new ethers.Contract(vdUsdcAddress, contracts.anyERC20.abi, victimSigner);

    console.log("ETH BALANCE (Victim)", await ethers.provider.getBalance(victimAddress));
    console.log("ETH BALANCE (Safe Wallet)", await ethers.provider.getBalance(recipientAddress));
    
    // redeemable token balances
    const duckBalance = await duckContract.balanceOf(victimAddress);
    const duckStakeBalance = (await duckStakingContract.userInfo(victimAddress))["staked"];
    // const aWethBalance = await aWethContract.balanceOf(victimAddress);
    // const vdUsdcBalance = await vdUsdcContract.balanceOf(victimAddress);
    
    console.log("DUCK BALANCE", duckBalance);
    console.log("DUCK STAKE BALANCE", duckStakeBalance);
    // console.log("aWETH BALANCE", aWethBalance);
    // console.log("vdUSDC BALANCE", vdUsdcBalance);
    
    // unstake duck from duckstarter
    await duckStakingContract.withdraw(duckStakeBalance);
    const newDuckBalance = await duckContract.balanceOf(victimAddress);
    console.log("NEW DUCK BALANCE", newDuckBalance);

    // simulate transfers
    // DUCK
    await duckContract.transfer(recipientAddress, newDuckBalance);
    const recipientDuckBalance = await duckContract.balanceOf(recipientAddress);
    console.log("RECIPIENT DUCK BALANCE", recipientDuckBalance, ethers.utils.formatEther(recipientDuckBalance));
    const newVictimDuckBalance = await duckContract.balanceOf(victimAddress);
    console.log("REMAINING VICTIM DUCK BALANCE", newVictimDuckBalance);
    // aWETH
    // await aWethContract.transfer(recipientAddress, aWethBalance);
    // const recipientAWethBalance = await aWethContract.balanceOf(recipientAddress);
    // console.log("RECIPIENT aWETH BALANCE", recipientAWethBalance);
    // vdUSDC
    // await vdUsdcContract.transfer(recipientAddress, vdUsdcBalance);
    // const recipientVdUsdcBalance = await vdUsdcContract.balanceOf(recipientAddress);
    // console.log("RECIPIENT vdUSDC BALANCE", recipientVdUsdcBalance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
