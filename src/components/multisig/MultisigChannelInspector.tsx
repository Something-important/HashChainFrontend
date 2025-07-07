"use client";
import React, { useState, useEffect } from "react";
import { providers, utils, Contract } from "ethers";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import { MULTISIG_CONTRACT_ADDRESS, MULTISIG_TARGET_CHAIN, MultisigUtils } from '../../utils/multisigUtils';

interface MultisigChannelInspectorProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

interface ChannelInfo {
  token: string;
  amount: string;
  expiration: string;
  reclaimAfter: string;
  sessionId: string;
  lastNonce: string;
}

export function MultisigChannelInspector({ isLoading, setIsLoading }: MultisigChannelInspectorProps) {
  const [payer, setPayer] = useState("");
  const [payee, setPayee] = useState("");
  const [tokenAddress, setTokenAddress] = useState("0x0000000000000000000000000000000000000000");
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [isLoadingChannel, setIsLoadingChannel] = useState(false);

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

  const inspectChannel = async () => {
    setErrorMessage("");
    setChannelInfo(null);
    setStatus("");
    setIsLoadingChannel(true);

    if (!isConnected || !address) {
      setErrorMessage("Please connect your wallet using the header button.");
      setIsLoadingChannel(false);
      setIsLoading(false);
      return;
    }

    if (!provider) {
      setErrorMessage("Wallet provider not available. Please ensure your wallet is connected.");
      setIsLoadingChannel(false);
      setIsLoading(false);
      return;
    }

    // Input validation
    if (!payer || !utils.isAddress(payer.trim())) {
      setErrorMessage("Invalid payer address.");
      setIsLoadingChannel(false);
      setIsLoading(false);
      return;
    }

    if (!payee || !utils.isAddress(payee.trim())) {
      setErrorMessage("Invalid payee address.");
      setIsLoadingChannel(false);
      setIsLoading(false);
      return;
    }

    if (!tokenAddress || !utils.isAddress(tokenAddress)) {
      setErrorMessage("Invalid token address.");
      setIsLoadingChannel(false);
      setIsLoading(false);
      return;
    }

    try {
      // Import the Multisig ABI
      const multisigABI = await import('../../contracts/multisig.json');

      // Create contract instance
      const contract = new Contract(MULTISIG_CONTRACT_ADDRESS, multisigABI.default, provider);

      setStatus("Inspecting channel...");
      
      // Call contract to get channel info
      const channel = await contract.channels(
        utils.getAddress(payer.trim()), // payer address
        utils.getAddress(payee.trim()), // payee address
        utils.getAddress(tokenAddress)  // token address
      );

      // Convert BigNumber values to strings
      const channelInfo: ChannelInfo = {
        token: channel.token,
        amount: utils.formatEther(channel.amount),
        expiration: channel.expiration.toString(),
        reclaimAfter: channel.reclaimAfter.toString(),
        sessionId: channel.sessionId.toString(),
        lastNonce: channel.lastNonce.toString()
      };

      setChannelInfo(channelInfo);
      setStatus("Channel information retrieved successfully!");
    } catch (err: any) {
      console.error('MultisigChannelInspector error:', err);
      
      let errorMsg = "Unknown error";
      
      if (err.code === -32603 || err.message?.includes("Internal JSON-RPC error")) {
        errorMsg = "RPC Error: Could not fetch channel information.";
      } else if (err.message && err.message.includes("Error decoding failed")) {
        errorMsg = "Contract error: Invalid parameters or contract state. Check your inputs.";
      } else if (err.reason) {
        errorMsg = `Contract Error: ${err.reason}`;
      } else if (err.message) {
        errorMsg = `Transaction Error: ${err.message}`;
      } else {
        errorMsg = "Failed to inspect channel. Please check your parameters and try again.";
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsLoadingChannel(false);
    }
  };

  // Use utility functions from MultisigUtils
  const getCurrentTimestamp = () => MultisigUtils.getCurrentTimestamp();
  const formatTimestamp = (timestamp: string) => MultisigUtils.formatTimestamp(timestamp);
  const isExpired = (expiration: string) => MultisigUtils.isExpired(expiration);
  const canReclaim = (reclaimAfter: string) => MultisigUtils.canReclaim(reclaimAfter);
  const getTimeRemaining = (timestamp: string) => MultisigUtils.getTimeRemaining(timestamp);

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-white/20">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Multisig Channel Inspector</h3>
      
      {/* Instructions */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Inspect the details of a payment channel between a payer and payee.
          <br />
          Enter the channel parameters to view its current state.
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
            onChange={(e) => setPayer(e.target.value.trim())}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Address of the payer who created the channel</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payee Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={payee}
            onChange={(e) => setPayee(e.target.value.trim())}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Address of the payee/merchant</p>
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

        {/* Inspect Button */}
        <button
          onClick={inspectChannel}
          className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={Boolean(isLoadingChannel || !isConnected)}
        >
          {isLoadingChannel ? 'Inspecting...' : 'Inspect Channel'}
        </button>

        {/* Status Messages */}
        {isLoadingChannel && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 font-medium">Loading Channel Information...</p>
            <p className="text-yellow-700 text-sm">Please wait while we fetch the channel details.</p>
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

        {/* Channel Information Display */}
        {channelInfo && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Channel Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Token Address</p>
                <p className="text-sm text-gray-800 font-mono break-all">{channelInfo.token}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-600">Amount</p>
                <p className="text-sm text-gray-800">{MultisigUtils.formatAmount(channelInfo.amount, channelInfo.token)}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-600">Expiration</p>
                <p className={`text-sm ${isExpired(channelInfo.expiration) ? 'text-red-600' : 'text-gray-800'}`}>
                  {formatTimestamp(channelInfo.expiration)}
                  {!isExpired(channelInfo.expiration) && ` (${getTimeRemaining(channelInfo.expiration)} remaining)`}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-600">Reclaim After</p>
                <p className={`text-sm ${canReclaim(channelInfo.reclaimAfter) ? 'text-green-600' : 'text-gray-800'}`}>
                  {formatTimestamp(channelInfo.reclaimAfter)}
                  {!canReclaim(channelInfo.reclaimAfter) && ` (${getTimeRemaining(channelInfo.reclaimAfter)} until reclaim)`}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-600">Session ID</p>
                <p className="text-sm text-gray-800">{channelInfo.sessionId}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-600">Last Nonce</p>
                <p className="text-sm text-gray-800">{channelInfo.lastNonce}</p>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full ${isExpired(channelInfo.expiration) ? 'bg-red-500' : 'bg-green-500'}`}></span>
                <span className="text-sm font-medium text-gray-800">
                  {isExpired(channelInfo.expiration) ? 'Channel Expired' : 'Channel Active'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full ${canReclaim(channelInfo.reclaimAfter) ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                <span className="text-sm font-medium text-gray-800">
                  {canReclaim(channelInfo.reclaimAfter) ? 'Can Reclaim: Yes' : 'Can Reclaim: No'}
                </span>
              </div>
              
              {!canReclaim(channelInfo.reclaimAfter) && (
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-sm font-medium text-gray-800">
                    Blocks Until Reclaim: {Math.max(0, parseInt(channelInfo.reclaimAfter) - getCurrentTimestamp())}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 