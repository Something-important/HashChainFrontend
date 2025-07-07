"use client";
import React, { useState, useEffect } from "react";
import { providers, utils } from "ethers"; // ethers.js v5.8.0
import { HashchainProtocol } from "@hashchain/sdk";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { HASHPAY_CONTRACT_ADDRESS } from "../../utils/blockchainUtils";

// Target chain: Filecoin Calibration Testnet
const TARGET_CHAIN = {
  chainId: 314159,
  chainName: "Filecoin Calibration Testnet",
};

interface ReclaimChannelProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function ReclaimChannel({ isLoading, setIsLoading }: ReclaimChannelProps) {
  const [merchant, setMerchant] = useState("");
  const [tokenAddress, setTokenAddress] = useState("0x0000000000000000000000000000000000000000");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Derive provider
  const provider = publicClient ? new providers.JsonRpcProvider(publicClient.transport.url, {
    name: "Filecoin Calibration",
    chainId: 314159
  }) : null;

  // Update status when wallet connects
  useEffect(() => {
    if (isConnected && userAddress) {
      setStatus(`Connected: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
    } else {
      setMerchant("");
      setStatus("");
      setErrorMessage("Please connect your wallet using the header button.");
    }
  }, [isConnected, userAddress]);

  // Check network
  useEffect(() => {
    if (chainId && chainId !== TARGET_CHAIN.chainId) {
      console.log(`Warning: You're on chain ${chainId}, but the contract is deployed on ${TARGET_CHAIN.chainId}`);
    } else if (isConnected) {
      setErrorMessage(null);
    }
  }, [chainId, isConnected]);

  const reclaimChannel = async () => {
    setErrorMessage("");
    setTxHash(null);
    setStatus("");
    setIsPending(true);
    setIsLoading(true);

    if (!isConnected || !userAddress) {
      setErrorMessage("Please connect your wallet using the header button.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (!provider) {
      setErrorMessage("Wallet provider not available. Please ensure your wallet is connected.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (!walletClient) {
      setErrorMessage("Wallet signer not available. Please reconnect your wallet.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    // Validate merchant address
    if (!merchant || !utils.isAddress(merchant)) {
      setErrorMessage("Invalid merchant address.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    // Validate token address
    if (!tokenAddress || !utils.isAddress(tokenAddress)) {
      setErrorMessage("Invalid token address.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    try {
      // Derive signer
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      let hashchainSDK: HashchainProtocol;
      try {
        hashchainSDK = new HashchainProtocol(provider, HASHPAY_CONTRACT_ADDRESS, resolvedSigner);
      } catch (err: any) {
        setErrorMessage(`SDK Error: Failed to initialize HashchainProtocol - ${err.message || "Invalid parameters"}`);
        setIsPending(false);
        setIsLoading(false);
        return;
      }

      setStatus("Initiating reclaim transaction...");
      console.log("Reclaiming channel with params:", {
        merchant,
        tokenAddress,
        contractAddress: HASHPAY_CONTRACT_ADDRESS
      });

      const tx = await hashchainSDK.reclaimChannel({
        merchant: utils.getAddress(merchant),
        tokenAddress: utils.getAddress(tokenAddress)
      });

      console.log("Transaction hash:", tx.hash);
      setTxHash(tx.hash);
      setStatus(`Transaction sent to mempool! Hash: ${tx.hash}`);

      const receipt = await tx.wait();
      setStatus(`Transaction confirmed in block: ${receipt.blockNumber}`);

      // Reset form
      setMerchant("");
      setTokenAddress("0x0000000000000000000000000000000000000000");
    } catch (err: any) {
      console.log("Reclaim Error Details:", {
        code: err.code,
        reason: err.reason,
        message: err.message,
        data: err.data,
        error: err
      });
      
      let errorMsg = "Unknown error";
      
      if (err.code === "INSUFFICIENT_FUNDS") {
        errorMsg = "Insufficient FIL for gas or transaction.";
      } else if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
        errorMsg = "Cannot estimate gas. The contract may have reverted or has invalid state.";
      } else if (err.reason) {
        errorMsg = `Contract Error: ${err.reason}`;
      } else if (err.data?.message) {
        errorMsg = `Contract Revert: ${err.data.message}`;
      } else if (err.message && err.message.includes("revert")) {
        errorMsg = "Contract reverted. Check merchant address or channel state.";
      } else if (err.message) {
        errorMsg = `Transaction Error: ${err.message}`;
      } else {
        errorMsg = "Contract execution failed. Please check your parameters and try again.";
      }
      setErrorMessage(errorMsg);
    } finally {
      setIsPending(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-white/20">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Reclaim Channel</h3>
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Payer only:</strong> Only the payer can reclaim unused funds after the withdrawal period
        </p>
      </div>
      
      {/* Form Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Merchant Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Token Contract Address</label>
          <input
            type="text"
            placeholder="0x... (0x0 for FIL)"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Use 0x0000000000000000000000000000000000000000 for native FIL</p>
        </div>

        {/* Status Messages */}
        {isPending && <p className="text-yellow-600 bg-yellow-50 p-3 rounded">Transaction pending...</p>}
        {status && <p className="text-green-600 bg-green-50 p-3 rounded">{status}</p>}
        {errorMessage && <p className="text-red-600 bg-red-50 p-3 rounded">Error: {errorMessage}</p>}

        {/* Transaction Link */}
        {txHash && (
          <a
            href={`https://calibration.filscan.io/en/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on Calibration Explorer
          </a>
        )}

        {/* Reclaim Button */}
        <button
          onClick={reclaimChannel}
          className="bg-orange-600 text-white px-6 py-2 rounded font-semibold hover:bg-orange-700 transition-all"
          disabled={isPending || !isConnected}
        >
          {isPending ? 'Reclaiming...' : 'Reclaim Channel'}
        </button>
      </div>
    </div>
  );
} 