"use client";
import React, { useState, useEffect } from "react";
import { providers, utils, Contract } from "ethers"; // ethers.js v5.8.0
import { HashchainProtocol, HashchainProtocolABI } from "@hashchain/sdk";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

// Contract address
const CONTRACT_ADDRESS = "0x9164199a9B814b6337F0e90e245D37E11a49fe32";

// Target chain: Filecoin Calibration Testnet
const TARGET_CHAIN = {
  chainId: 314159,
  chainName: "Filecoin Calibration Testnet",
};

interface CreateChannelProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function CreateChannel({ isLoading, setIsLoading }: CreateChannelProps) {
  const [merchant, setMerchant] = useState("");
  const [trustAnchor, setTrustAnchor] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenAddress, setTokenAddress] = useState("0x0000000000000000000000000000000000000000");
  const [numberOfTokens, setNumberOfTokens] = useState("100");
  const [merchantWithdrawAfterBlocks, setMerchantWithdrawAfterBlocks] = useState("1");
  const [payerWithdrawAfterBlocks, setPayerWithdrawAfterBlocks] = useState("1");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  // Check network (optional - can be removed if you want to work on any network)
  useEffect(() => {
    if (chainId && chainId !== TARGET_CHAIN.chainId) {
      console.log(`Warning: You're on chain ${chainId}, but the contract is deployed on ${TARGET_CHAIN.chainId}`);
      // Uncomment the next line if you want to enforce network validation
      // setErrorMessage(`Wrong network detected. Please switch to ${TARGET_CHAIN.chainName} (Chain ID ${TARGET_CHAIN.chainId}).`);
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
      const tx = await tokenContract.approve(CONTRACT_ADDRESS, approvalAmount);
      
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

    // Optional network validation - uncomment if you want to enforce it
    // if (chainId !== TARGET_CHAIN.chainId) {
    //   setErrorMessage(`Wrong network. Please switch to ${TARGET_CHAIN.chainName} (Chain ID ${TARGET_CHAIN.chainId}).`);
    //   setIsPending(false);
    //   setIsLoading(false);
    //   return;
    // }

    // Input validation
    if (!merchant || !utils.isAddress(merchant.trim())) {
      setErrorMessage("Invalid merchant address.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (!trustAnchor || (!utils.isAddress(trustAnchor) && !trustAnchor.match(/^0x[a-fA-F0-9]{64}$/))) {
      setErrorMessage("Invalid trust anchor (must be a valid address or 32-byte hex).");
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

    const parsedTokens = parseInt(numberOfTokens, 10);
    if (!numberOfTokens || isNaN(parsedTokens) || parsedTokens <= 0) {
      setErrorMessage("Invalid number of tokens (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedMerchantBlocks = parseInt(merchantWithdrawAfterBlocks, 10);
    if (!merchantWithdrawAfterBlocks || isNaN(parsedMerchantBlocks) || parsedMerchantBlocks <= 0) {
      setErrorMessage("Invalid merchant withdraw blocks (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedPayerBlocks = parseInt(payerWithdrawAfterBlocks, 10);
    if (!payerWithdrawAfterBlocks || isNaN(parsedPayerBlocks) || parsedPayerBlocks <= 0) {
      setErrorMessage("Invalid payer withdraw blocks (must be a positive integer).");
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

      // Create contract instance directly using ethers
      const contract = new Contract(CONTRACT_ADDRESS, [
        {
          type: "function",
          name: "createChannel",
          inputs: [
            { name: "merchant", type: "address" },
            { name: "token", type: "address" },
            { name: "trustAnchor", type: "bytes32" },
            { name: "amount", type: "uint256" },
            { name: "numberOfTokens", type: "uint16" },
            { name: "merchantWithdrawAfterBlocks", type: "uint64" },
            { name: "payerWithdrawAfterBlocks", type: "uint64" },
          ],
          outputs: [],
          stateMutability: "payable",
        }
      ], resolvedSigner);

      setStatus("Creating payment channel...");
      
      // Call contract directly with proper parameters
      const tx = await contract.createChannel(
        utils.getAddress(merchant.trim()), // merchant address (trimmed)
        utils.getAddress(tokenAddress), // token address
        trustAnchor, // trustAnchor as bytes32
        utils.parseEther(amount), // amount in wei
        parsedTokens, // numberOfTokens
        parsedMerchantBlocks, // merchantWithdrawAfterBlocks
        parsedPayerBlocks, // payerWithdrawAfterBlocks
        { value: utils.parseEther(amount) } // Include value for native FIL
      );

      setTxHash(tx.hash);
      setStatus(`Transaction sent! Hash: ${tx.hash}`);

      const receipt = await tx.wait();
      setStatus(`Transaction confirmed in block: ${receipt.blockNumber}`);
    } catch (err: any) {
      console.error('CreateChannel error:', err);
      
      let errorMsg = "Unknown error";
      
      // Handle specific contract errors from the ABI
      if (err.code === "INSUFFICIENT_FUNDS") {
        errorMsg = "Insufficient FIL for gas or transaction.";
      } else if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
        errorMsg = "Cannot estimate gas. Check contract address or parameters.";
      } else if (err.code === -32603 || err.message?.includes("Internal JSON-RPC error")) {
        errorMsg = "RPC Error: Token address may not exist or be invalid. Try using 0x0000000000000000000000000000000000000000 for native FIL.";
      } else if (err.errorName === "ChannelAlreadyExist") {
        errorMsg = "Channel already exists for this payer/merchant/token combination.";
      } else if (err.errorName === "IncorrectAmount") {
        errorMsg = "Incorrect amount sent. Check the amount field.";
      } else if (err.errorName === "MerchantWithdrawTimeTooShort") {
        errorMsg = "Merchant withdraw time is too short. Increase the merchant withdraw blocks.";
      } else if (err.errorName === "ZeroTokensNotAllowed") {
        errorMsg = "Number of tokens must be greater than 0.";
      } else if (err.errorName === "AddressIsNotContract") {
        errorMsg = "Token address is not a contract.";
      } else if (err.errorName === "AddressIsNotERC20") {
        errorMsg = "Token address is not a valid ERC20 token.";
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
    if (!merchant || !utils.isAddress(merchant.trim())) {
      setErrorMessage("Invalid merchant address.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (!trustAnchor || (!utils.isAddress(trustAnchor) && !trustAnchor.match(/^0x[a-fA-F0-9]{64}$/))) {
      setErrorMessage("Invalid trust anchor (must be a valid address or 32-byte hex).");
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

    const parsedTokens = parseInt(numberOfTokens, 10);
    if (!numberOfTokens || isNaN(parsedTokens) || parsedTokens <= 0) {
      setErrorMessage("Invalid number of tokens (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedMerchantBlocks = parseInt(merchantWithdrawAfterBlocks, 10);
    if (!merchantWithdrawAfterBlocks || isNaN(parsedMerchantBlocks) || parsedMerchantBlocks <= 0) {
      setErrorMessage("Invalid merchant withdraw blocks (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedPayerBlocks = parseInt(payerWithdrawAfterBlocks, 10);
    if (!payerWithdrawAfterBlocks || isNaN(parsedPayerBlocks) || parsedPayerBlocks <= 0) {
      setErrorMessage("Invalid payer withdraw blocks (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    try {
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      // Create contract instance
      const contract = new Contract(CONTRACT_ADDRESS, [
        {
          type: "function",
          name: "createChannelWithPermit",
          inputs: [
            { name: "payer", type: "address" },
            { name: "merchant", type: "address" },
            { name: "token", type: "address" },
            { name: "trustAnchor", type: "bytes32" },
            { name: "amount", type: "uint256" },
            { name: "numberOfTokens", type: "uint16" },
            { name: "merchantWithdrawAfterBlocks", type: "uint64" },
            { name: "payerWithdrawAfterBlocks", type: "uint64" },
            { name: "deadline", type: "uint256" },
            { name: "v", type: "uint8" },
            { name: "r", type: "bytes32" },
            { name: "s", type: "bytes32" },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        }
      ], resolvedSigner);

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
        spender: CONTRACT_ADDRESS,
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
        address, // payer
        utils.getAddress(merchant.trim()), // merchant
        utils.getAddress(tokenAddress), // token
        trustAnchor, // trustAnchor
        parsedAmountWei, // amount
        parsedTokens, // numberOfTokens
        parsedMerchantBlocks, // merchantWithdrawAfterBlocks
        parsedPayerBlocks, // payerWithdrawAfterBlocks
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
        errorMsg = "Channel already exists for this payer/merchant/token combination.";
      } else if (err.errorName === "IncorrectAmount") {
        errorMsg = "Incorrect amount sent. Check the amount field.";
      } else if (err.errorName === "MerchantWithdrawTimeTooShort") {
        errorMsg = "Merchant withdraw time is too short. Increase the merchant withdraw blocks.";
      } else if (err.errorName === "ZeroTokensNotAllowed") {
        errorMsg = "Number of tokens must be greater than 0.";
      } else if (err.errorName === "AddressIsNotContract") {
        errorMsg = "Token address is not a contract.";
      } else if (err.errorName === "AddressIsNotERC20") {
        errorMsg = "Token address is not a valid ERC20 token.";
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

  // Smart channel creation that automatically chooses between permit and approval
  const smartCreateChannel = async () => {
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
    if (!merchant || !utils.isAddress(merchant.trim())) {
      setErrorMessage("Invalid merchant address.");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    if (!trustAnchor || (!utils.isAddress(trustAnchor) && !trustAnchor.match(/^0x[a-fA-F0-9]{64}$/))) {
      setErrorMessage("Invalid trust anchor (must be a valid address or 32-byte hex).");
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

    const parsedTokens = parseInt(numberOfTokens, 10);
    if (!numberOfTokens || isNaN(parsedTokens) || parsedTokens <= 0) {
      setErrorMessage("Invalid number of tokens (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedMerchantBlocks = parseInt(merchantWithdrawAfterBlocks, 10);
    if (!merchantWithdrawAfterBlocks || isNaN(parsedMerchantBlocks) || parsedMerchantBlocks <= 0) {
      setErrorMessage("Invalid merchant withdraw blocks (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    const parsedPayerBlocks = parseInt(payerWithdrawAfterBlocks, 10);
    if (!payerWithdrawAfterBlocks || isNaN(parsedPayerBlocks) || parsedPayerBlocks <= 0) {
      setErrorMessage("Invalid payer withdraw blocks (must be a positive integer).");
      setIsPending(false);
      setIsLoading(false);
      return;
    }

    try {
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      // For native FIL, use regular createChannel
      if (tokenAddress === "0x0000000000000000000000000000000000000000") {
        setStatus("Creating channel with native FIL...");
        await createChannel();
        return;
      }

      // For ERC20 tokens, check if permit is supported
      if (permitSupported === true) {
        setStatus("Creating channel with permit (gasless approval)...");
        await createChannelWithPermit();
      } else {
        // Check allowance and approve if needed
        setStatus("Checking token allowance...");
        const tokenContract = new Contract(tokenAddress, [
          "function allowance(address owner, address spender) external view returns (uint256)",
          "function approve(address spender, uint256 amount) external returns (bool)"
        ], resolvedSigner);
        
        const allowance = await tokenContract.allowance(address, CONTRACT_ADDRESS);
        const requiredAmount = utils.parseEther(amount);
        
        if (allowance.lt(requiredAmount)) {
          setStatus("Approving tokens...");
          try {
            const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, requiredAmount);
            await approveTx.wait();
            setStatus("Token approval successful!");
          } catch (approveErr: any) {
            console.error('Approval error:', approveErr);
            setErrorMessage("Token approval failed. Please try again or approve manually.");
            setIsPending(false);
            setIsLoading(false);
            return;
          }
        }
        
        setStatus("Creating channel...");
        await createChannel();
      }
    } catch (error) {
      console.error('Smart channel creation error:', error);
      setErrorMessage("Failed to create channel. Please check your parameters and try again.");
    } finally {
      setIsPending(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-white/20">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Create Payment Channel</h3>
      
      {/* Instructions */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Please fill out the following details to create a payment channel.
          <br />
          Ensure that the values are correct before submitting.
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Merchant Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={merchant}
            onChange={(e) => setMerchant(e.target.value.trim())}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Trust Anchor</label>
          <input
            type="text"
            placeholder="0x... (32-byte hex - generate in HashchainTools tab)"
            value={trustAnchor}
            onChange={(e) => setTrustAnchor(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Generate a trust anchor in the HashchainTools tab, then copy and paste it here
          </p>
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
          
          {/* Manual Approval Button (fallback) */}
          {tokenAddress !== "0x0000000000000000000000000000000000000000" && permitSupported === false && (
            <div className="mt-2">
              <button
                onClick={approveToken}
                className="bg-yellow-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-yellow-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isApproving === true || isConnected !== true}
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Advanced Options */}
        <div className="flex items-center space-x-2 mb-4">
          <input
            type="checkbox"
            checked={showAdvanced}
            onChange={(e) => setShowAdvanced(e.target.checked)}
          />
          <label className="text-sm">Show advanced options</label>
        </div>

        {showAdvanced && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Tokens</label>
              <input
                type="number"
                placeholder="Number of tokens"
                value={numberOfTokens}
                onChange={(e) => setNumberOfTokens(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Merchant Withdraw After Blocks</label>
                <input
                  type="number"
                  value={merchantWithdrawAfterBlocks}
                  onChange={(e) => setMerchantWithdrawAfterBlocks(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payer Withdraw After Blocks</label>
                <input
                  type="number"
                  value={payerWithdrawAfterBlocks}
                  onChange={(e) => setPayerWithdrawAfterBlocks(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </>
        )}

        {/* Status Messages */}
        {isPending && <p className="text-yellow-600 bg-yellow-50 p-3 rounded">Transaction pending...</p>}
        {status && <p className="text-green-600 bg-green-50 p-3 rounded">{status}</p>}
        {errorMessage && <p className="text-red-600 bg-red-50 p-3 rounded">Error: {errorMessage}</p>}

        {/* Transaction Link */}
        {txHash && (
          <p className="text-green-600 bg-green-50 p-3 rounded">
            Transaction successful! Hash:{" "}
            <a
              href={`https://calibration.filscan.io/en/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Calibration Explorer
            </a>
          </p>
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

        {/* Debug Output for Button State */}
        <div className="mb-2 p-2 bg-gray-100 rounded text-xs text-gray-700">
          <div><strong>Debug:</strong></div>
          <div>isPending: {String(isPending)}</div>
          <div>isConnected: {String(isConnected)}</div>
          <div>permitChecking: {String(permitChecking)}</div>
        </div>
        {/* Create Channel Button */}
        <button
          onClick={async () => {
            await smartCreateChannel();
          }}
          className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isPending === true || isConnected !== true || permitChecking === true}
        >
          {isPending ? 'Creating...' : 'Create Channel'}
        </button>
      </div>
    </div>
  );
} 