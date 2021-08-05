import hre from "hardhat";
import contracts from "../src/contracts.mjs";
const ethers = hre.ethers;

const victimAddress = "0xF248f7e076F8F63b39DEcEf2B115E01c9c6c8978";
// pulled from accounts list printed by `npx hardhat node`; has 1000ETH
const donorAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
// one of my 1337 addresses
const recipientAddress = "0x1333756bb3CEC30c8F321A016bd80E8f3dc4a589";

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
      gasPrice: 48870166374,
    };
    let res = await donorSigner.sendTransaction(fundVictimTx);
    console.log("donor-fund result", res);
    await stopImpersonating(donorAddress);
}

async function main() {
    // give victim account some test moneys
    await fundVictimAccount();
    await impersonate(victimAddress);
    const victimSigner = ethers.provider.getSigner(victimAddress);

    // instantiate contracts
    const nimbusTokenContract = new ethers.Contract(contracts.nimbusToken.address, contracts.nimbusToken.abi, victimSigner);
    const nimbusGovernanceContract = new ethers.Contract(contracts.nimbusGovernance.address, contracts.nimbusGovernance.abi, victimSigner);

    console.log("ETH BALANCE (Victim)", await ethers.provider.getBalance(victimAddress));
    console.log("ETH BALANCE (Safe Wallet)", await ethers.provider.getBalance(recipientAddress));
    
    // total token balances
    const nimbusTokenBalanceBase = await nimbusTokenContract.balanceOf(victimAddress);
    const nimbusGovernanceBalanceBase = await nimbusGovernanceContract.balanceOf(victimAddress);

    // redeemable token balances
    const nimbusTokenBalance = await nimbusTokenContract.availableForTransfer(victimAddress);
    const nimbusGovernanceBalance = await nimbusGovernanceContract.availableForTransfer(victimAddress);
    
    console.log("NBU BALANCE", nimbusTokenBalanceBase, ethers.utils.formatEther(nimbusTokenBalanceBase));
    console.log("GNBU BALANCE", nimbusGovernanceBalanceBase, ethers.utils.formatEther(nimbusGovernanceBalanceBase));
    console.log("NBU BALANCE (transferrable)", nimbusTokenBalance, ethers.utils.formatEther(nimbusTokenBalance));
    console.log("GNBU BALANCE (transferrable)", nimbusGovernanceBalance, ethers.utils.formatEther(nimbusGovernanceBalance));
    
    // unvest tokens
    console.log("\nunvesting tokens!\n");
    const _unvestRes1 = await nimbusTokenContract.unvest({gasPrice: 48870166374});
    const _unvestRes2 = await nimbusGovernanceContract.unvest({gasPrice: 48870166374});
    // console.log(_unvestRes1);
    // console.log(_unvestRes2);

    const newNimbusTokenBalance = await nimbusTokenContract.availableForTransfer(victimAddress);
    console.log("NEW NBU BALANCE (transferrable)", newNimbusTokenBalance, ethers.utils.formatEther(newNimbusTokenBalance));

    const newNimbusGovernanceBalance = await nimbusGovernanceContract.availableForTransfer(victimAddress);
    console.log("NEW GNBU BALANCE (transferrable)", newNimbusGovernanceBalance, ethers.utils.formatEther(newNimbusGovernanceBalance));

    // transfer NBU
    await nimbusTokenContract.transfer(recipientAddress, newNimbusTokenBalance, {gasPrice: 48870166374});

    // print balances
    const recipientNimbusTokenBalance = await nimbusTokenContract.availableForTransfer(recipientAddress);
    console.log("RECIPIENT NBU BALANCE (transferrable)", recipientNimbusTokenBalance, ethers.utils.formatEther(recipientNimbusTokenBalance));
    const newVictimNimbusTokenBalance = await nimbusTokenContract.availableForTransfer(victimAddress);
    console.log("REMAINING VICTIM NBU BALANCE (transferrable)", newVictimNimbusTokenBalance);

    // transfer GNBU
    await nimbusGovernanceContract.transfer(recipientAddress, newNimbusGovernanceBalance, {gasPrice: 48870166374});

    // print balances
    const recipientNimbusGovernanceBalance = await nimbusGovernanceContract.availableForTransfer(recipientAddress);
    console.log("RECIPIENT GNBU BALANCE", recipientNimbusGovernanceBalance, ethers.utils.formatEther(recipientNimbusGovernanceBalance));
    const newVictimNimbusGovernanceBalance = await nimbusGovernanceContract.availableForTransfer(victimAddress);
    console.log("REMAINING VICTIM GNBU BALANCE", newVictimNimbusGovernanceBalance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
