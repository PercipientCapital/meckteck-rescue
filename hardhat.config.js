require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.3",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      hardfork: "london",
      forking: {
        url: process.env.ETH_RPC_HTTP,
      }
    },
  }
};
