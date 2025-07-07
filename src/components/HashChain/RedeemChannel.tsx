"use client";
import React, { useState, useEffect } from "react";
import { providers, utils } from "ethers"; // ethers.js v5.8.0
import { HashchainProtocol, HashchainProtocolABI } from "@hashchain/sdk";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { HASHPAY_CONTRACT_ADDRESS } from "../../utils/blockchainUtils";

// Target chain: Filecoin Calibration Testnet
const TARGET_CHAIN = {
  chainId: 314159,
  chainName: "Filecoin Calibration Testnet",
};

interface RedeemChannelProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function RedeemChannel({ isLoading, setIsLoading }: RedeemChannelProps) {
  const [payer, setPayer] = useState("");
  const [tokenAddress, setTokenAddress] = useState("0x0000000000000000000000000000000000000000");
  const [finalHashValue, setFinalHashValue] = useState("");
  const [numberOfTokensUsed, setNumberOfTokensUsed] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Derive provider
  const provider = publicClient ? new providers.JsonRpcProvider(publicClient.transport.url) : null;

  // Update status
  useEffect(() => {
    if (isConnected && address) {
      setStatus(`Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
    } else {
      setStatus("");
      setErrorMessage("Please connect your wallet using the header button.");
    }
  }, [isConnected, address]);

  // Check network (optional)
  useEffect(() => {
    if (chainId && chainId !== TARGET_CHAIN.chainId) {
      console.log(`Warning: You're on chain ${chainId}, but the contract is deployed on ${TARGET_CHAIN.chainId}`);
    } else if (isConnected) {
      setErrorMessage(null);
    }
  }, [chainId, isConnected]);
  const redeemChannel = async () => {
    setErrorMessage("");
    setTxHash(null);
    setStatus("");
    setIsPending(true);
    setIsLoading(true);

    if (!isConnected || !address) {
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

    // Validate inputs
    if (!payer || !utils.isAddress(payer)) {
      setErrorMessage("Invalid payer address.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (!tokenAddress || !utils.isAddress(tokenAddress)) {
      setErrorMessage("Invalid token address.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    // Check if contract address is valid
    if (!HASHPAY_CONTRACT_ADDRESS) {
      setErrorMessage("Invalid contract address. Please check configuration.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (!finalHashValue || !finalHashValue.match(/^0x[a-fA-F0-9]{64}$/)) {
      setErrorMessage("Invalid final hash value (must be a 32-byte hex string starting with 0x and 64 characters total). Example: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedTokensUsed = parseInt(numberOfTokensUsed, 10);
    if (!numberOfTokensUsed || isNaN(parsedTokensUsed) || parsedTokensUsed < 0) {
      setErrorMessage("Invalid number of tokens used (must be a non-negative integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    // Debug: Check if you're the merchant
    console.log("🔍 Debug: Checking roles...");
    console.log("  - Your address:", address);
    console.log("  - Payer address:", payer);
    console.log("  - Are you the merchant?", address.toLowerCase() !== payer.toLowerCase());
    
    if (address.toLowerCase() === payer.toLowerCase()) {
      setErrorMessage("You are the payer. Only the merchant can redeem payments. Use the Reclaim tab to reclaim unused funds.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    try {
      // Derive signer (ethers v5.x)
      const resolvedSigner = new providers.Web3Provider(walletClient as any).getSigner();

      let hashchainSDK: HashchainProtocol;
      try {
        hashchainSDK = new HashchainProtocol(provider, HASHPAY_CONTRACT_ADDRESS, resolvedSigner);
      } catch (err: any) {
        setErrorMessage(`SDK Error: Failed to initialize HashchainProtocol - ${err.message || "Invalid parameters"}`);
        setIsPending(false);
        setIsLoading(false);
        return;
      }

      setStatus("Initiating redeem transaction...");
      console.log("Initiating redeem transaction with:", { payer, tokenAddress, finalHashValue, numberOfTokensUsed });
      const tx = await hashchainSDK.redeemChannel({
        payer: payer,
        tokenAddress: utils.getAddress(tokenAddress),
        finalHashValue: finalHashValue,
        numberOfTokensUsed: parsedTokensUsed,
      });
      console.log("Transaction hash:", tx);
      setTxHash(tx.hash);
      setStatus(`Transaction sent to mempool! Hash: ${tx.hash}`);

      const receipt = await tx.wait();
      setStatus(`Transaction confirmed in block: ${receipt.blockNumber}`);

      // Reset form
      setPayer("");
      setTokenAddress("0x0000000000000000000000000000000000000000");
      setFinalHashValue("");
      setNumberOfTokensUsed("");
    } catch (err: any) {
      console.log("Redeem Error Details:", {
        code: err.code,
        reason: err.reason,
        message: err.message,
        data: err.data,
        error: err
      });
      
      let errorMsg = "Unknown error";
      
      // Handle SDK-specific errors
      if (err.message && err.message.includes("Invalid error data")) {
        errorMsg = "Contract execution failed with invalid error data. This usually means the contract reverted. Check your parameters and ensure you're the merchant for this channel.";
      } else if (err.message && err.message.includes("Contract Error: Unknown")) {
        errorMsg = "Contract execution failed with unknown error. This usually means the contract reverted due to invalid parameters or state. Check: 1) You are the merchant, 2) Hash value is correct, 3) Channel exists and has funds.";
      } else if (err.code === "INSUFFICIENT_FUNDS") {
        errorMsg = "Insufficient FIL for gas or transaction.";
      } else if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
        errorMsg = "Cannot estimate gas. The contract may have reverted or has invalid state.";
      } else if (err.reason) {
        errorMsg = `Contract Error: ${err.reason}`;
      } else if (err.data?.message) {
        errorMsg = `Contract Revert: ${err.data.message}`;
      } else if (err.message && err.message.includes("revert")) {
        errorMsg = "Contract reverted. Check payer, hash value, or channel state.";
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
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Redeem Channel</h3>
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Merchant only:</strong> Only the merchant can redeem payments for services rendered
        </p>
      </div>
      
      {/* Form Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payer Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
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
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Number of Tokens to Redeem</label>
          <input
            type="number"
            placeholder="Tokens to redeem"
            value={numberOfTokensUsed}
            onChange={(e) => setNumberOfTokensUsed(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        

        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Final Hash Value</label>
          <input
            type="text"
            placeholder="0x..."
            value={finalHashValue}
            onChange={(e) => setFinalHashValue(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Must be a 32-byte hex string (64 characters after 0x). Example: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef</p>

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

        {/* Redeem Button */}
        <button
          onClick={redeemChannel}
          className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700 transition-all"
          disabled={isPending || !isConnected}
        >
          {isPending ? 'Redeeming...' : 'Redeem Channel'}
        </button>
      </div>
    </div>
  );
} 