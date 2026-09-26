// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
/// @notice Freely mintable test token, never production USDC.
contract TestUSD is ERC20 {
 constructor() ERC20('DANK Test Dollar','dUSD') {require(block.chainid==10143||block.chainid==31337,'Testnet only');}
 function decimals() public pure override returns(uint8){return 6;}
 function faucet() external {_mint(msg.sender,10000e6);}
}
