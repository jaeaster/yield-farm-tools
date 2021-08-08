import { ethers } from "ethers";

interface GasOverrides {
  gasPrice: ethers.BigNumber,
  gasLimit: number
}

export interface ERC20 {
  name: string;
  contract: ethers.Contract;
}

export interface LiquidityPool {
  name: string;
  pid: number;
  contract: ethers.Contract;
}

class Masterchef extends ethers.Contract {
  async claimRewards(pid: number, address: string, overrides?: GasOverrides): Promise<void> {
    console.log('Claiming Rewards');
    let dinoRewards = await this.pendingDino(pid, address);
    console.log(`Attempting to withdraw Dino rewards: ${ethers.utils.formatUnits(dinoRewards, 18)} DINO`);

    const withdrawTx = await this.withdraw(pid, 0, overrides);
    console.log(`
      Withdrawal Transaction:
      ========================
      ${logTxn(withdrawTx)}
    `.trimLeft());
    const withdrawReceipt = await withdrawTx.wait();
    console.log(`
      Withdrawal receipt:
      =====================
      ${logTxn(withdrawReceipt)}
    `.trimLeft());
    dinoRewards = await this.pendingDino(pid, address);
    console.log(`You now have pending rewards: ${ethers.utils.formatEther(dinoRewards)} DINO`);
  };
}

export type AMMRouter = ethers.Contract;

export const initContracts = (account: ethers.Signer): any => {
  return {
    dinoToken: {
      name: 'DINO',
      contract: new ethers.Contract(
        '0xaa9654becca45b5bdfa5ac646c939c62b527d394',
        ['function balanceOf(address account) external view returns (uint256)'],
        account
      )
    },

    wethToken: {
      name: 'WETH',
      contract: new ethers.Contract(
        '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
        ['function balanceOf(address account) external view returns (uint256)'],
        account
      )
    },

    dinoWethPool: {
      name: 'DINO-WETH LP',
      pid: 11,
      contract: new ethers.Contract(
        '0x9f03309A588e33A239Bf49ed8D68b2D45C7A1F11',
        ['function balanceOf(address account) external view returns (uint256)'],
        account
      )
    },

    dinoMasterchef: new ethers.Contract(
      '0x1948abc5400aa1d72223882958da3bec643fb4e5',
      [
        'function withdraw(uint256 _pid, uint256 _amount) public',
        'function deposit(uint256 _pid, uint256 _amount) public',
        'function pendingDino(uint256 _pid, address _user) external view returns (uint256)',
      ],
      account
    ),

    quickswapRouter: new ethers.Contract(
      '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff',
      [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)'
      ],
      account
    )
  };
}

