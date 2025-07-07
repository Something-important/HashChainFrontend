"use client";
import React, { useState, useEffect } from "react";
import { providers, utils, Contract } from "ethers";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import { MULTISIG_CONTRACT_ADDRESS, MULTISIG_TARGET_CHAIN, MultisigUtils } from '../../utils/multisigUtils';

interface ReclaimMultisigChannelProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function ReclaimMultisigChannel({ isLoading, setIsLoading }: ReclaimMultisigChannelProps) {
  const [payee, setPayee] = useState("");
  const [tokenAddress, setTokenAddress] = useState("0x0000000000000000000000000000000000000000");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  const { address, isConnected } = useAccount();
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
    if (isConnected && address) {
      setStatus(`Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
    } else {
      setStatus("");
      setErrorMessage("Please connect your wallet using the header button.");
    }
  }, [isConnected, address]);

  // Check network
  useEffect(() => {
    if (chainId && chainId !== MULTISIG_TARGET_CHAIN.chainId) {
      console.log(`Warning: You're on chain ${chainId}, but the contract is deployed on ${MULTISIG_TARGET_CHAIN.chainId}`);
    } else if (isConnected) {
      setErrorMessage(null);
    }
  }, [chainId, isConnected]);

  const reclaimChannel = async () => {
    setErrorMessage("");
    setTxHash(null);
    setStatus("");
    setIsPending(true);

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

    // Input validation
    if (!payee || !utils.isAddress(payee.trim())) {
      setErrorMessage("Invalid payee address.");
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

    try {
      // Derive signer
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      // Import the Multisig ABI
      const multisigABI = await import('../../contracts/multisig.json');

      // Create contract instance
      const contract = new Contract(MULTISIG_CONTRACT_ADDRESS, multisigABI.default, resolvedSigner);

      setStatus("Reclaiming payment channel...");
      
      // Call contract with proper parameters
      const tx = await contract.reclaimChannel(
        utils.getAddress(payee.trim()), // payee address
        utils.getAddress(tokenAddress)  // token address
      );

      setTxHash(tx.hash);
      setStatus(`Transaction sent! Hash: ${tx.hash}`);

      const receipt = await tx.wait();
      setStatus(`Transaction confirmed in block: ${receipt.blockNumber}`);
    } catch (err: any) {
      console.error('ReclaimMultisigChannel error:', err);
      
      let errorMsg = "Unknown error";
      
      // Handle specific contract errors
      if (err.code === "INSUFFICIENT_FUNDS") {
        errorMsg = "Insufficient FIL for gas.";
      } else if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
        errorMsg = "Cannot estimate gas. Check contract address or parameters.";
      } else if (err.errorName === "ChannelDoesNotExistOrWithdrawn") {
        errorMsg = "Channel does not exist or has already been withdrawn.";
      } else if (err.errorName === "PayerCannotRedeemChannelYet") {
        errorMsg = "Reclaim delay has not expired yet. You must wait until the reclaim delay period is over.";
      } else if (err.message && err.message.includes("Error decoding failed")) {
        errorMsg = "Contract error: Invalid parameters or contract state. Check your inputs.";
      } else if (err.reason) {
        errorMsg = `Contract Error: ${err.reason}`;
      } else if (err.message) {
        errorMsg = `Transaction Error: ${err.message}`;
      } else {
        errorMsg = "Failed to reclaim channel. Please check your parameters and try again.";
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-white/20">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Reclaim Multisig Payment Channel</h3>
      
      {/* Instructions */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Reclaim your funds from a payment channel after the reclaim delay has expired.
          <br />
          Only the payer can reclaim funds, and only after the reclaim delay period.
        </p>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payee Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={payee}
            onChange={(e) => setPayee(e.target.value.trim())}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Address of the payee in the channel you want to reclaim from</p>
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
        {isPending && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 font-medium">Transaction Pending...</p>
            <p className="text-yellow-700 text-sm">Please wait while your transaction is being processed.</p>
          </div>
        )}
        
        {status && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">{status}</p>
          </div>
        )}
        
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-700 text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Transaction Link */}
        {txHash && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">Transaction Successful!</p>
            <p className="text-green-700 text-sm">
              Hash: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </p>
            <a
              href={`https://calibration.filscan.io/en/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800 underline text-sm"
            >
              View on Calibration Explorer →
            </a>
          </div>
        )}

        {/* Reclaim Channel Button */}
        <button
          onClick={reclaimChannel}
          className="bg-orange-600 text-white px-6 py-2 rounded font-semibold hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={Boolean(isPending || !isConnected)}
        >
          {isPending ? 'Reclaiming...' : 'Reclaim Channel'}
        </button>
      </div>
    </div>
  );
} 