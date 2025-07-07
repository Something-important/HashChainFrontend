"use client";
import React, { useState, useEffect } from "react";
import { providers, utils, Contract } from "ethers";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import { MULTISIG_CONTRACT_ADDRESS, MULTISIG_TARGET_CHAIN, MultisigUtils } from '../../utils/multisigUtils';

interface CreateMultisigChannelProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function CreateMultisigChannel({ isLoading, setIsLoading }: CreateMultisigChannelProps) {
  const [tokenAddress, setTokenAddress] = useState("0x0000000000000000000000000000000000000000");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("3600"); // 1 hour in seconds
  const [reclaimDelay, setReclaimDelay] = useState("7200"); // 2 hours in seconds
  const [payee, setPayee] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string>("");
  const [permitSupported, setPermitSupported] = useState<boolean | null>(null);
  const [permitChecking, setPermitChecking] = useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Derive provider - use direct RPC URL to avoid ENS issues
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

  // Check if token supports permit when token address changes
  useEffect(() => {
    if (tokenAddress && tokenAddress !== "0x0000000000000000000000000000000000000000" && isConnected && walletClient) {
      checkPermitSupport();
    } else {
      setPermitSupported(null);
    }
  }, [tokenAddress, isConnected, walletClient]);

  // Check if token supports permit
  const checkPermitSupport = async () => {
    if (!walletClient || tokenAddress === "0x0000000000000000000000000000000000000000") return;
    
    setPermitChecking(true);
    try {
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();
      
      const tokenContract = new Contract(tokenAddress, [
        "function nonces(address owner) view returns (uint256)",
        "function name() view returns (string)",
        "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external"
      ], resolvedSigner);
      
      // Try to call nonces to check if permit is supported
      await tokenContract.nonces(address);
      setPermitSupported(true);
      console.log("✅ Token supports permit");
    } catch (error) {
      setPermitSupported(false);
      console.log("❌ Token does not support permit, will use approval");
    } finally {
      setPermitChecking(false);
    }
  };

  const approveToken = async () => {
    if (!isConnected || !address || !walletClient) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }

    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
      setApprovalStatus("No approval needed for native FIL");
      return;
    }

    // Validate token address exists
    if (!utils.isAddress(tokenAddress)) {
      setApprovalStatus("❌ Invalid token address format");
      return;
    }

    setIsApproving(true);
    setApprovalStatus("Approving token...");

    try {
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();
      
      // ERC20 ABI for approval
      const erc20ABI = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];

      const tokenContract = new Contract(tokenAddress, erc20ABI, resolvedSigner);
      
      // Get decimals (default to 18 if not available)
      let decimals = 18;
      try {
        decimals = await tokenContract.decimals();
      } catch {
        console.log("Using default decimals: 18");
      }

      // Approve the contract to spend the amount
      const approvalAmount = utils.parseUnits(amount, decimals);
      const tx = await tokenContract.approve(MULTISIG_CONTRACT_ADDRESS, approvalAmount);
      
      setApprovalStatus(`Approval transaction sent: ${tx.hash}`);
      await tx.wait();
      setApprovalStatus(`✅ Token approved successfully! Tx: ${tx.hash}`);
    } catch (err: any) {
      console.error('Approval error:', err);
      setApprovalStatus(`❌ Approval failed: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const createChannel = async () => {
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
    if (!address) {
      setErrorMessage("No wallet address available.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (!payee || !utils.isAddress(payee.trim())) {
      setErrorMessage("Invalid payee address.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (payee.trim().toLowerCase() === address.toLowerCase()) {
      setErrorMessage("Payee cannot be the same as payer (your wallet address).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Invalid amount (must be a positive number).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedDuration = parseInt(duration, 10);
    if (!duration || isNaN(parsedDuration) || parsedDuration <= 0) {
      setErrorMessage("Invalid duration (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedReclaimDelay = parseInt(reclaimDelay, 10);
    if (!reclaimDelay || isNaN(parsedReclaimDelay) || parsedReclaimDelay <= 0) {
      setErrorMessage("Invalid reclaim delay (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (parsedReclaimDelay <= parsedDuration) {
      setErrorMessage("Reclaim delay must be greater than duration.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    try {
      // Derive signer (ethers v5.x)
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      // Import the Multisig ABI
      const multisigABI = await import('../../contracts/multisig.json');

      // Create contract instance
      const contract = new Contract(MULTISIG_CONTRACT_ADDRESS, multisigABI.default, resolvedSigner);

      setStatus("Creating multisig payment channel...");
      
      // Call contract with proper parameters
      const tx = await contract.createChannel(
        utils.getAddress(payee.trim()), // payee address (merchant/recipient)
        utils.getAddress(tokenAddress), // token address
        utils.parseEther(amount), // amount in wei
        parsedDuration, // duration in seconds
        parsedReclaimDelay, // reclaim delay in seconds
        { 
          value: tokenAddress === "0x0000000000000000000000000000000000000000" ? utils.parseEther(amount) : 0 
        }
      );

      setTxHash(tx.hash);
      setStatus(`Transaction sent! Hash: ${tx.hash}`);

      const receipt = await tx.wait();
      setStatus(`Transaction confirmed in block: ${receipt.blockNumber}`);
    } catch (err: any) {
      console.error('CreateMultisigChannel error:', err);
      
      let errorMsg = "Unknown error";
      
      // Handle specific contract errors
      if (err.code === "INSUFFICIENT_FUNDS") {
        errorMsg = "Insufficient FIL for gas or transaction.";
      } else if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
        errorMsg = "Cannot estimate gas. Check contract address or parameters.";
      } else if (err.code === -32603 || err.message?.includes("Internal JSON-RPC error")) {
        errorMsg = "RPC Error: Token address may not exist or be invalid. Try using 0x0000000000000000000000000000000000000000 for native FIL.";
      } else if (err.errorName === "ChannelAlreadyExist") {
        errorMsg = "Channel already exists for this payer/payee/token combination.";
      } else if (err.errorName === "IncorrectAmount") {
        errorMsg = "Incorrect amount sent. Check the amount field.";
      } else if (err.errorName === "ReclaimAfterMustBeAfterExpiration") {
        errorMsg = "Reclaim delay must be greater than duration.";
      } else if (err.errorName === "AddressIsNotContract") {
        errorMsg = "Token address is not a contract.";
      } else if (err.errorName === "AddressIsNotERC20") {
        errorMsg = "Token address is not a valid ERC20 token.";
      } else if (err.errorName === "InsufficientAllowance") {
        errorMsg = "Token allowance insufficient. Please approve tokens first.";
      } else if (err.message && err.message.includes("Error decoding failed")) {
        errorMsg = "Contract error: Invalid parameters or contract state. Check your inputs.";
      } else if (err.reason) {
        errorMsg = `Contract Error: ${err.reason}`;
      } else if (err.message) {
        errorMsg = `Transaction Error: ${err.message}`;
      } else {
        errorMsg = "Failed to create channel. Please check your parameters and try again.";
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsPending(false);
    }
  };

  const createChannelWithPermit = async () => {
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

    // Input validation
    if (!payee || !utils.isAddress(payee.trim())) {
      setErrorMessage("Invalid payee address.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (payee.trim().toLowerCase() === address.toLowerCase()) {
      setErrorMessage("Payee cannot be the same as payer (your wallet address).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Invalid amount (must be a positive number).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedDuration = parseInt(duration, 10);
    if (!duration || isNaN(parsedDuration) || parsedDuration <= 0) {
      setErrorMessage("Invalid duration (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedReclaimDelay = parseInt(reclaimDelay, 10);
    if (!reclaimDelay || isNaN(parsedReclaimDelay) || parsedReclaimDelay <= 0) {
      setErrorMessage("Invalid reclaim delay (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (parsedReclaimDelay <= parsedDuration) {
      setErrorMessage("Reclaim delay must be greater than duration.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    try {
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      // Import the Multisig ABI
      const multisigABI = await import('../../contracts/multisig.json');

      // Create contract instance
      const contract = new Contract(MULTISIG_CONTRACT_ADDRESS, multisigABI.default, resolvedSigner);

      // ERC20 ABI for permit
      const erc20ABI = [
        "function nonces(address owner) view returns (uint256)",
        "function name() view returns (string)",
        "function decimals() view returns (uint8)"
      ];

      const tokenContract = new Contract(tokenAddress, erc20ABI, resolvedSigner);
      
      // Get token info
      let decimals = 18;
      try {
        decimals = await tokenContract.decimals();
      } catch {
        console.log("Using default decimals: 18");
      }

      const parsedAmountWei = utils.parseUnits(amount, decimals);
      const nonce = await tokenContract.nonces(address);
      const tokenName = await tokenContract.name();
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      // Generate permit signature
      const domain = {
        name: tokenName,
        version: "1",
        chainId: 314159,
        verifyingContract: tokenAddress,
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: address,
        spender: MULTISIG_CONTRACT_ADDRESS,
        value: parsedAmountWei,
        nonce: nonce,
        deadline: deadline,
      };

      setStatus("Generating permit signature...");
      const signature = await resolvedSigner._signTypedData(domain, types, message);
      const { v, r, s } = utils.splitSignature(signature);

      setStatus("Creating channel with permit...");
      
      // Call contract with permit
      const tx = await contract.createChannelWithPermit(
        utils.getAddress(payee.trim()), // payee address (merchant/recipient)
        utils.getAddress(tokenAddress), // token address
        parsedAmountWei, // amount in wei
        parsedDuration, // duration in seconds
        parsedReclaimDelay, // reclaim delay in seconds
        deadline, // deadline
        v, // v
        r, // r
        s  // s
      );

      setTxHash(tx.hash);
      setStatus(`Transaction sent! Hash: ${tx.hash}`);

      const receipt = await tx.wait();
      setStatus(`Transaction confirmed in block: ${receipt.blockNumber}`);
    } catch (err: any) {
      console.error('CreateChannelWithPermit error:', err);
      
      let errorMsg = "Unknown error";
      
      if (err.code === "INSUFFICIENT_FUNDS") {
        errorMsg = "Insufficient FIL for gas or transaction.";
      } else if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
        errorMsg = "Cannot estimate gas. Check contract address or parameters.";
      } else if (err.code === -32603 || err.message?.includes("Internal JSON-RPC error")) {
        errorMsg = "RPC Error: Token address may not exist or be invalid.";
      } else if (err.errorName === "ChannelAlreadyExist") {
        errorMsg = "Channel already exists for this payer/payee/token combination.";
      } else if (err.errorName === "IncorrectAmount") {
        errorMsg = "Incorrect amount sent. Check the amount field.";
      } else if (err.errorName === "ReclaimAfterMustBeAfterExpiration") {
        errorMsg = "Reclaim delay must be greater than duration.";
      } else if (err.errorName === "AddressIsNotContract") {
        errorMsg = "Token address is not a contract.";
      } else if (err.errorName === "AddressIsNotERC20") {
        errorMsg = "Token address is not a valid ERC20 token.";
      } else if (err.errorName === "InsufficientAllowance") {
        errorMsg = "Token allowance insufficient. Please approve tokens first.";
      } else if (err.message && err.message.includes("Error decoding failed")) {
        errorMsg = "Contract error: Invalid parameters or contract state. Check your inputs.";
      } else if (err.reason) {
        errorMsg = `Contract Error: ${err.reason}`;
      } else if (err.message) {
        errorMsg = `Transaction Error: ${err.message}`;
      } else {
        errorMsg = "Failed to create channel. Please check your parameters and try again.";
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsPending(false);
      setIsLoading(false);
    }
  };

  const smartCreateChannel = async () => {
    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
      // For native FIL, use regular createChannel
      await createChannel();
    } else if (permitSupported === true) {
      // For tokens with permit support, use createChannelWithPermit
      await createChannelWithPermit();
    } else {
      // For tokens without permit support, check allowance first
      if (!isConnected || !address || !walletClient) {
        setErrorMessage("Please connect your wallet first.");
        return;
      }

      try {
        const resolvedSigner = new providers.Web3Provider(walletClient as any, {
          name: "Filecoin Calibration",
          chainId: 314159
        }).getSigner();
        
        const tokenContract = new Contract(tokenAddress, [
          "function allowance(address owner, address spender) external view returns (uint256)",
          "function decimals() view returns (uint8)"
        ], resolvedSigner);
        
        let decimals = 18;
        try {
          decimals = await tokenContract.decimals();
        } catch {
          console.log("Using default decimals: 18");
        }

        const requiredAmount = utils.parseUnits(amount, decimals);
        const allowance = await tokenContract.allowance(address, MULTISIG_CONTRACT_ADDRESS);
        
        if (allowance.lt(requiredAmount)) {
          setErrorMessage("Token approval required. Please approve tokens first using the 'Approve Token Manually' button.");
          return;
        }
      } catch (error) {
        console.error("Error checking allowance:", error);
        setErrorMessage("Error checking token allowance. Please try approving tokens manually.");
        return;
      }
      
      await createChannel();
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-white/20">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Create Multisig Payment Channel</h3>
      
      {/* Instructions */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Create a payment channel with the Multisig contract.
          <br />
          You (connected wallet) will be the payer, and the payee will be the merchant/recipient.
        </p>
        
        {/* Token Flow Explanation */}
        {tokenAddress !== "0x0000000000000000000000000000000000000000" && (
          <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 Token Approval Flow</h4>
            <div className="text-xs text-blue-700 space-y-1">
              {permitSupported === true ? (
                <>
                  <p>✅ <strong>Permit Supported:</strong> Gasless approval via signature</p>
                  <p>• No manual approval needed</p>
                  <p>• Single transaction for approval + channel creation</p>
                  <p>• Saves gas and provides better UX</p>
                  <p>• Will use createChannelWithPermit automatically</p>
                </>
              ) : permitSupported === false ? (
                <>
                  <p>⚠️ <strong>Manual Approval Required:</strong> Traditional approve transaction</p>
                  <p>• You may need to approve tokens manually</p>
                  <p>• Two transactions: approve + create channel</p>
                  <p>• Use the "Approve Token Manually" button if needed</p>
                </>
              ) : (
                <p>🔍 Checking token capabilities...</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Token Contract Address</label>
          <input
            type="text"
            placeholder="0x... (0x0 for FIL)"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use 0x0000000000000000000000000000000000000000 for native FIL
            {tokenAddress !== "0x0000000000000000000000000000000000000000" && tokenAddress.length > 0 && (
              <span className="text-orange-600 block mt-1">
                ⚠️ For Filecoin payments, use 0x0000000000000000000000000000000000000000
              </span>
            )}
          </p>
          
          {/* Manual Approval Button (fallback) */}
          {tokenAddress !== "0x0000000000000000000000000000000000000000" && permitSupported === false && (
            <div className="mt-2">
              <button
                onClick={approveToken}
                className="bg-yellow-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-yellow-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={Boolean(isApproving || !isConnected)}
              >
                {isApproving ? 'Approving...' : 'Approve Token Manually'}
              </button>
              {approvalStatus && (
                <p className="text-xs mt-1 text-gray-600">{approvalStatus}</p>
              )}
            </div>
          )}
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
          <p className="text-xs text-gray-500 mt-1">Merchant/recipient wallet address</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Duration (seconds)</label>
          <input
            type="number"
            placeholder="3600"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Channel lifetime in seconds (e.g., 3600 = 1 hour)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reclaim Delay (seconds)</label>
          <input
            type="number"
            placeholder="7200"
            value={reclaimDelay}
            onChange={(e) => setReclaimDelay(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">Time after which payer can reclaim funds (must be > duration)</p>
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

        {/* Token Support Status */}
        {tokenAddress !== "0x0000000000000000000000000000000000000000" && (
          <div className="mt-2 p-2 rounded border">
            {permitChecking ? (
              <p className="text-sm text-gray-600">🔍 Checking token capabilities...</p>
            ) : permitSupported === true ? (
              <p className="text-sm text-green-600">✅ Token supports permit (gasless approval)</p>
            ) : permitSupported === false ? (
              <p className="text-sm text-yellow-600">⚠️ Token requires manual approval</p>
            ) : null}
          </div>
        )}

        {/* Create Channel Button */}
        <button
          onClick={async () => {
            await smartCreateChannel();
          }}
          className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={Boolean(isPending || !isConnected || permitChecking)}
        >
          {isPending ? 'Creating...' : 'Create Multisig Channel'}
        </button>
      </div>
    </div>
  );
} 