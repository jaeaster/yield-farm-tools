const { ethers } = require('ethers');
const dotenv = require('dotenv');

const configResult = dotenv.config();

if (configResult.error) {
  throw configResult.error;
}

const mnemonic = process.env.MNEMONIC;
const nodeUrl = process.env.NODE_URL;

const GAS_PRICE = ethers.utils.parseUnits('10', 'gwei');
const GAS_LIMIT = 200000;

const provider = new ethers.providers.JsonRpcProvider(nodeUrl);
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
const account = wallet.connect(provider);

const dinoWethPool = {
  name: 'DINO-WETH LP',
  pid: 11,
  lpTokenAddress: '0x9f03309A588e33A239Bf49ed8D68b2D45C7A1F11',
};

dinoWethPool.contract = new ethers.Contract(
  dinoWethPool.lpTokenAddress,
  ['function balanceOf(address account) external view returns (uint256)'],
  account
);

const dinoToken = {
  name: 'DINO',
  address: '0xaa9654becca45b5bdfa5ac646c939c62b527d394',
};

dinoToken.contract = new ethers.Contract(
  dinoToken.address,
  ['function balanceOf(address account) external view returns (uint256)'],
  account
);

const wethToken = {
  name: 'WETH',
  address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'
}

wethToken.contract = new ethers.Contract(
  wethToken.address,
  ['function balanceOf(address account) external view returns (uint256)'],
  account
);

const dinoMasterchef = new ethers.Contract(
  '0x1948abc5400aa1d72223882958da3bec643fb4e5',
  [
    'function withdraw(uint256 _pid, uint256 _amount) public',
    'function deposit(uint256 _pid, uint256 _amount) public',
    'function pendingDino(uint256 _pid, address _user) external view returns (uint256)',
  ],
  account
);

const quickswapRouter = new ethers.Contract(
  '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff',
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)'
  ],
  account
);

const claimRewards = async (masterchef, pid, address, overrides = {}) => {
  console.log('Claiming Rewards');
  let dinoRewards = await masterchef.pendingDino(pid, address);
  console.log(`Attempting to withdraw Dino rewards: ${ethers.utils.formatUnits(dinoRewards, 18)} DINO`);

  const withdrawTx = await masterchef.withdraw(pid, 0, overrides);
  console.log(`
    Withdrawal Transaction:
    ========================
    ${logTxn(withdrawTx)}
  `.trimLeft());
  const withdrawReceipt = await withdrawTx.wait();
  console.log(`
    Withdrawal receipt:
    =====================
    ${logTxn(withdrawReceipt, { receipt: true })}
  `.trimLeft());
  dinoRewards = await masterchef.pendingDino(pid, address);
  console.log(`You now have pending rewards: ${ethers.utils.formatEther(dinoRewards)} DINO`);
};

const swapTokens = async (ammRouter, amount, tokenIn, tokenOut, address, overrides = {}) => {
  const amounts = await ammRouter.getAmountsOut(amount, [tokenIn.address, tokenOut.address]);
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
    [tokenIn.address, tokenOut.address],
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
    ${logTxn(receipt, { receipt: true })}
  `.trimLeft());
};

const addLiquidity = async (pool, amount, tokenA, tokenB, address, overrides = {}) => {
  const [amountA, amountB] = await pool.getAmountsOut(amount, [tokenA.address, tokenB.address]);
  console.log(`
    Adding liquidity to ${tokenA.name}-${tokenB.name} pool:
    =================
    tokenA: ${ethers.utils.formatEther(amountA)} ${tokenA.name}
    tokenB: ${ethers.utils.formatEther(amountB)} ${tokenB.name}
  `.trimLeft());

  const tx = await pool.addLiquidity(
    tokenA.address,
    tokenB.address,
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
    ${logTxn(receipt, { receipt: true })}
  `.trimLeft());
};

const stakeLP = async (masterchef, pool, address, overrides = {}) => {
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
    ${logTxn(receipt, { receipt: true })}
  `.trimLeft());
};

const logTxn = (txn, options = {}) => {
  if (options.receipt) {
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
  overrides = { gasPrice: GAS_PRICE, gasLimit: GAS_LIMIT }

  await claimRewards(dinoMasterchef, dinoWethPool.pid, myAddress, overrides);
  
  let dinoBalance = await dinoToken.contract.balanceOf(myAddress);
  console.log(`You have ${ethers.utils.formatEther(dinoBalance)} DINO in your wallet`);

  await swapTokens(quickswapRouter, dinoBalance.div(2), dinoToken, wethToken, myAddress, overrides);

  dinoBalance = await dinoToken.contract.balanceOf(myAddress);
  await addLiquidity(quickswapRouter, dinoBalance, dinoToken, wethToken, myAddress, overrides);
  
  await stakeLP(dinoMasterchef, dinoWethPool, myAddress, overrides);
}

main();
