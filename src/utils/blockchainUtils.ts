import { Address } from 'viem';
import { publicClient } from '../config/wagmi';
import contractABI from '../contracts/hashpay.json';

// HashPay contract address - replace with your actual deployed contract address
export const HASHPAY_CONTRACT_ADDRESS = '0x9164199a9B814b6337F0e90e245D37E11a49fe32';

export interface ChannelInfo {
  token: Address;
  trustAnchor: string;
  amount: bigint;
  numberOfTokens: number;
  merchantWithdrawAfterBlocks: number;
  payerWithdrawAfterBlocks: number;
}

// Get current block number
export const getCurrentBlockNumber = async (): Promise<bigint> => {
  try {
    return await publicClient.getBlockNumber();
  } catch (error) {
    console.error('Error getting current block number:', error);
    return BigInt(0);
  }
};

// Get channel information
export const getChannelInfo = async (
  payer: Address,
  merchant: Address,
  token: Address
): Promise<ChannelInfo | null> => {
  try {
    const channelInfo = await publicClient.readContract({
      address: HASHPAY_CONTRACT_ADDRESS as Address,
      abi: contractABI,
      functionName: 'channelsMapping',
      args: [payer, merchant, token],
    });
    
    // channelInfo is returned as an array: [token, trustAnchor, amount, numberOfTokens, merchantWithdrawAfterBlocks, payerWithdrawAfterBlocks]
    if (channelInfo && Array.isArray(channelInfo) && channelInfo.length >= 6) {
      const [tokenAddr, trustAnchor, amount, numberOfTokens, merchantWithdrawAfterBlocks, payerWithdrawAfterBlocks] = channelInfo;
      
      // Convert to ChannelInfo object
      return {
        token: tokenAddr as Address,
        trustAnchor: trustAnchor as string,
        amount: amount as bigint,
        numberOfTokens: Number(numberOfTokens),
        merchantWithdrawAfterBlocks: Number(merchantWithdrawAfterBlocks),
        payerWithdrawAfterBlocks: Number(payerWithdrawAfterBlocks),
      };
    }
    
    return null;
  } catch (error: any) {
    console.error('Error getting channel info:', error);
    return null;
  }
};

// Debug contract state
export const debugContractState = async (payer: Address, merchant: Address, token: Address) => {
  try {
    console.log('🔍 Debugging contract state...');
    console.log('  - Payer:', payer);
    console.log('  - Merchant:', merchant);
    console.log('  - Token:', token);
    
    // Try to read channel info
    const channelInfo = await publicClient.readContract({
      address: HASHPAY_CONTRACT_ADDRESS as Address,
      abi: contractABI,
      functionName: 'channelsMapping',
      args: [payer, merchant, token],
    });
    
    console.log('🔍 Channel info:', channelInfo);
    
    // Check if channel exists and has funds
    // channelInfo is returned as an array: [token, trustAnchor, amount, numberOfTokens, merchantWithdrawAfterBlocks, payerWithdrawAfterBlocks]
    if (channelInfo && Array.isArray(channelInfo) && channelInfo.length >= 6) {
      const [token, trustAnchor, amount, numberOfTokens, merchantWithdrawAfterBlocks, payerWithdrawAfterBlocks] = channelInfo;
      
      if (amount > BigInt(0)) {
        console.log('✅ Channel exists with funds');
        console.log('  - Amount:', formatTokenAmount(amount));
        console.log('  - Trust Anchor:', trustAnchor);
        console.log('  - Number of Tokens:', numberOfTokens);
        console.log('  - Merchant Withdraw After:', merchantWithdrawAfterBlocks);
        console.log('  - Payer Withdraw After:', payerWithdrawAfterBlocks);
      
        const currentBlock = await getCurrentBlockNumber();
        console.log('  - Current Block:', currentBlock.toString());
        
        const blocksUntilMerchantReclaim = BigInt(merchantWithdrawAfterBlocks) - currentBlock;
        const blocksUntilPayerReclaim = BigInt(payerWithdrawAfterBlocks) - currentBlock;
        
        console.log('  - Blocks until merchant can reclaim:', blocksUntilMerchantReclaim.toString());
        console.log('  - Blocks until payer can reclaim:', blocksUntilPayerReclaim.toString());
        
        // Check if payer can reclaim (only payer can reclaim unused funds)
        const canPayerReclaim = blocksUntilPayerReclaim <= BigInt(0);
        
        return {
          exists: true,
          canPayerReclaim,
          blocksUntilPayerReclaim,
          channelInfo
        };
      } else {
        console.log('❌ Channel exists but has no funds');
        return {
          exists: false,
          canPayerReclaim: false,
          blocksUntilPayerReclaim: BigInt(0),
          channelInfo: null
        };
      }
    } else {
      console.log('❌ Channel does not exist');
      return {
        exists: false,
        canPayerReclaim: false,
        blocksUntilPayerReclaim: BigInt(0),
        channelInfo: null
      };
    }
  } catch (error: any) {
    console.error('Error debugging contract state:', error);
    return {
      exists: false,
      canPayerReclaim: false,
      blocksUntilPayerReclaim: BigInt(0),
      channelInfo: null,
      error: error.message || 'Unknown error'
    };
  }
};

// Utility functions
export const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const parseTokenAmount = (amount: bigint, decimals: number = 18) => {
  return parseFloat(amount.toString()) / Math.pow(10, decimals);
};

export const formatTokenAmount = (amount: bigint, decimals: number = 18) => {
  const parsed = parseTokenAmount(amount, decimals);
  return `${parsed.toFixed(4)} FIL`;
}; 