import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { initContracts } from './contracts';

const configResult = dotenv.config();

if (configResult.error) {
  throw configResult.error;
}

const mnemonic = process.env.MNEMONIC;
const nodeUrl = process.env.NODE_URL;



const OVERRIDES: GasOverrides = {
  gasPrice: ethers.utils.parseUnits('10', 'gwei'),
  gasLimit: 200000
};

const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
const account = wallet.connect(provider);
const { dinoToken, wethToken, dinoWethPool, dinoMasterchef, quickswapRouter } = initContracts(account);



const swapTokens = async (ammRouter: ethers.Contract, amount: ethers.BigNumber, tokenIn: ERC20, tokenOut: ERC20, address: string, overrides?: GasOverrides) => {
  const amounts = await ammRouter.getAmountsOut(amount, [tokenIn.contract.address, tokenOut.contract.address]);
  const amountOutMin = amounts[1].sub(amounts[1].div(20));

  console.log(`
    Selling ${tokenIn.name} for ${tokenOut.name}
    =================
    tokenIn: ${ethers.utils.formatEther(amount)} ${tokenIn.name}
    tokenOut: ${ethers.utils.formatEther(amountOutMin)} ${tokenOut.name}
  `.trimLeft());

  const tx = await ammRouter.swapExactTokensForTokens(
    amount,
    amountOutMin,
    [tokenIn.contract.address, tokenOut.contract.address],
    address,
    Date.now() + 1000 * 60 * 10, // txn is valid for 10 minutes
    overrides
  );

  console.log(`
    Sell Transaction:
    ==================
    ${logTxn(tx)}
  `.trimLeft());

  const receipt = await tx.wait();
  console.log(`
    Sell Transaction Receipt:
    ==========================
    ${logTxn(receipt)}
  `.trimLeft());
};

const addLiquidity = async (ammRouter: ethers.Contract, amount: ethers.BigNumber, tokenA: ERC20, tokenB: ERC20, address: string, overrides?: GasOverrides) => {
  const [amountA, amountB] = await ammRouter.getAmountsOut(amount, [tokenA.contract.address, tokenB.contract.address]);
  console.log(`
    Adding liquidity to ${tokenA.name}-${tokenB.name} pool:
    =================
    tokenA: ${ethers.utils.formatEther(amountA)} ${tokenA.name}
    tokenB: ${ethers.utils.formatEther(amountB)} ${tokenB.name}
  `.trimLeft());

  const tx = await ammRouter.addLiquidity(
    tokenA.contract.address,
    tokenB.contract.address,
    amountA,
    amountB,
    amountA.sub(amountA.div(20)),
    amountB.sub(amountB.div(20)),
    address,
    Date.now() + 1000 * 60 * 10, // txn is valid for 10 minutes
    overrides
  );
  console.log(`
    Add Liquidity Transaction:
    ==================
    ${logTxn(tx)}
  `.trimLeft());

  const receipt = await tx.wait();
  console.log(`
    Add Liquidity Transaction Receipt:
    ==========================
    ${logTxn(receipt)}
  `.trimLeft());
};

const stakeLP = async (masterchef: ethers.Contract, pool: LiquidityPool, address: string, overrides?: GasOverrides) => {
  const lpBalance = await dinoWethPool.contract.balanceOf(address);

  console.log(`Staking ${ethers.utils.formatEther(lpBalance)} ${pool.name} tokens`);

  const tx = await masterchef.deposit(pool.pid, lpBalance, overrides);

  console.log(`
    Stake LP Transaction:
    ==================
    ${logTxn(tx)}
  `.trimLeft());

  const receipt = await tx.wait();
  console.log(`
    Stake LP Transaction Receipt:
    ==========================
    ${logTxn(receipt)}
  `.trimLeft());
};

const logTxn = (txn: ethers.providers.TransactionResponse & ethers.providers.TransactionReceipt) => {
  if (txn.gasUsed) {
    const {
      gasUsed,
      transactionHash
    } = txn;
    return (`
      Gas Used: ${gasUsed}
      Link: https://polygonscan.com/tx/${transactionHash}
    `.trimRight())
  } else {
    const {
      nonce,
      gasPrice,
      gasLimit,
      hash
    } = txn;
    return (`
      Nonce: ${nonce}
      Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')}
      Gas Limit: ${gasLimit}
      Link: https://polygonscan.com/tx/${hash}
    `.trimRight())
  }
};

const main = async () => {
  const myAddress = await account.getAddress();

  await claimRewards(dinoMasterchef, dinoWethPool.pid, myAddress, OVERRIDES);
  
  let dinoBalance = await dinoToken.contract.balanceOf(myAddress);
  console.log(`You have ${ethers.utils.formatEther(dinoBalance)} DINO in your wallet`);

  await swapTokens(quickswapRouter, dinoBalance.div(2), dinoToken, wethToken, myAddress, OVERRIDES);

  dinoBalance = await dinoToken.contract.balanceOf(myAddress);
  await addLiquidity(quickswapRouter, dinoBalance, dinoToken, wethToken, myAddress, OVERRIDES);
  
  await stakeLP(dinoMasterchef, dinoWethPool, myAddress, OVERRIDES);
}

main();
