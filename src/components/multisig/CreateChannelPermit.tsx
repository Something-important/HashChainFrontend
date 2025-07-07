"use client";
import React, { useState, useEffect } from "react";
import { providers, utils, Contract } from "ethers";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import { MULTISIG_CONTRACT_ADDRESS, MULTISIG_TARGET_CHAIN, MultisigUtils } from '../../utils/multisigUtils';

interface CreateChannelPermitProps {
  onChannelCreated?: (channelId: string) => void;
}

const CreateChannelPermit: React.FC<CreateChannelPermitProps> = ({ onChannelCreated }) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Derive provider
  const provider = publicClient ? new providers.JsonRpcProvider(publicClient.transport.url, {
    name: "Filecoin Calibration",
    chainId: 314159
  }) : null;

  // Form state
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('3600'); // 1 hour default
  const [reclaimDelay, setReclaimDelay] = useState('7200'); // 2 hours default
  const [tokenAddress, setTokenAddress] = useState('');
  
  // Permit state
  const [permitDeadline, setPermitDeadline] = useState('');
  const [permitSignature, setPermitSignature] = useState('');
  const [permitV, setPermitV] = useState('');
  const [permitR, setPermitR] = useState('');
  const [permitS, setPermitS] = useState('');
  
  // Token detection state
  const [permitSupported, setPermitSupported] = useState<boolean | null>(null);
  const [permitChecking, setPermitChecking] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  
  // Status
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Auto-detect token permit support when token address changes
  useEffect(() => {
    if (tokenAddress && tokenAddress !== "0x0000000000000000000000000000000000000000" && isConnected && walletClient) {
      checkPermitSupport();
    } else {
      setPermitSupported(null);
      setTokenName('');
      setTokenSymbol('');
      setPermitDeadline('');
    }
  }, [tokenAddress, isConnected, walletClient]);

  // Set default deadline when permit is supported
  useEffect(() => {
    if (permitSupported === true) {
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      setPermitDeadline(deadline.toString());
    }
  }, [permitSupported]);

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
        "function symbol() view returns (string)",
        "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external"
      ], resolvedSigner);
      
      // Try to call nonces to check if permit is supported
      await tokenContract.nonces(address);
      
      // Get token info
      const name = await tokenContract.name();
      const symbol = await tokenContract.symbol();
      
      setTokenName(name);
      setTokenSymbol(symbol);
      setPermitSupported(true);
      // console.log("✅ Token supports permit");
    } catch (error: any) {
      // Check if it's a user rejection - don't mark as unsupported in this case
              if (error.message && error.message.includes('User rejected')) {
          // console.log("⚠️ User rejected signature request during permit check - token may still support permit");
          // Don't set permitSupported to false for user rejections
          setPermitSupported(null); // Keep it as unknown
        } else {
          setPermitSupported(false);
          setTokenName('');
          setTokenSymbol('');
          // console.log("❌ Token does not support permit");
        }
    } finally {
      setPermitChecking(false);
    }
  };

  const generatePermitSignature = async () => {
    if (!address || !tokenAddress || !amount || !walletClient) {
      throw new Error('Please fill in all required fields for ERC20 token and ensure wallet is connected');
    }

    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error('❌ Permit is not available for native FIL (0x0000000000000000000000000000000000000000).\n\nPermit functionality is only for ERC20 tokens. For FIL payments, use the regular Create Channel function.');
    }

    if (permitSupported === false) {
      throw new Error('❌ This token does not support permit functionality. Please use a different ERC20 token or use the regular approval method.');
    }

    // If permit support is unknown (null), try anyway and let the contract decide
    if (permitSupported === null) {
      // console.log("⚠️ Permit support unknown - attempting anyway");
    }

    const resolvedSigner = new providers.Web3Provider(walletClient as any, {
      name: "Filecoin Calibration",
      chainId: 314159
    }).getSigner();

    // Get token contract for permit
    const tokenContract = new Contract(tokenAddress, [
      "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
      "function nonces(address owner) view returns (uint256)",
      "function DOMAIN_SEPARATOR() view returns (bytes32)",
      "function name() view returns (string)",
      "function decimals() view returns (uint8)"
    ], resolvedSigner);

    // Get token info
    let decimals = 18;
    try {
      decimals = await tokenContract.decimals();
    } catch {
      // console.log("Using default decimals: 18");
    }

    const nonce = await tokenContract.nonces(address);
    const tokenName = await tokenContract.name();
    
    // Validate deadline
    const currentTime = Math.floor(Date.now() / 1000);
    const deadline = parseInt(permitDeadline);
    
    if (deadline <= currentTime) {
      throw new Error(`❌ Permit deadline (${deadline}) must be in the future. Current time: ${currentTime}`);
    }

    // Create permit domain
    const domain = {
      name: tokenName,
      version: '1',
      chainId: 314159,
      verifyingContract: tokenAddress
    };

    // Create permit types
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };

    // Create permit value with proper decimal handling
    const value = {
      owner: address,
      spender: MULTISIG_CONTRACT_ADDRESS,
      value: utils.parseUnits(amount, decimals),
      nonce: nonce,
      deadline: deadline
    };

    // Log permit data for debugging
    // console.log('Permit data:', {
    //   domain,
    //   types,
    //   value,
    //   currentTime,
    //   deadline,
    //   nonce: nonce.toString()
    // });

    // Sign the permit
    const signature = await resolvedSigner._signTypedData(domain, types, value);

    // Split signature into v, r, s
    const sig = utils.splitSignature(signature);
    
    setPermitV(sig.v.toString());
    setPermitR(sig.r);
    setPermitS(sig.s);
    setPermitSignature(signature);
    
    // Log permit signature details for debugging
    // console.log('Permit signature details:', {
    //   domain,
    //   types,
    //   value,
    //   signature,
    //   v: sig.v,
    //   r: sig.r,
    //   s: sig.s
    // });
    
    return { v: sig.v, r: sig.r, s: sig.s };
  };

  const handleCreateChannel = async () => {
    if (!address || !payee || !amount || !duration || !reclaimDelay || !walletClient) {
      setError('Please fill in all required fields and ensure wallet is connected');
      return;
    }

    if (tokenAddress === "0x0000000000000000000000000000000000000000") {
      setError('❌ This component is for ERC20 tokens with permit support only. For native FIL, use the "Create Channel" tab.');
      return;
    }

    if (!tokenAddress) {
      setError('Please enter a valid ERC20 token address');
      return;
    }

    if (permitSupported === false) {
      setError('❌ This token does not support permit functionality. Please use a different ERC20 token or use the regular approval method.');
      return;
    }

    // Validate duration and reclaim delay
    const parsedDuration = parseInt(duration);
    const parsedReclaimDelay = parseInt(reclaimDelay);
    
    if (parsedReclaimDelay <= parsedDuration) {
      setError(`❌ Reclaim delay (${parsedReclaimDelay}s) must be greater than duration (${parsedDuration}s). Please increase the reclaim delay.`);
      return;
    }

    // Validate deadline
    const currentTime = Math.floor(Date.now() / 1000);
    const deadline = parseInt(permitDeadline);
    
    if (deadline <= currentTime) {
      setError(`❌ Permit deadline (${deadline}) must be in the future. Current time: ${currentTime}`);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setStatus('🔄 Step 1/2: Generating permit signature (this will trigger the first popup)...');

      // Automatically generate permit signature
      let permitSig;
      try {
        permitSig = await generatePermitSignature();
        // console.log("✅ Permit signature generated successfully");
      } catch (permitError: any) {
        console.error("❌ Permit signature failed:", permitError);
        setError(`Permit signature failed: ${permitError.message || 'User rejected the signature request'}`);
        setIsLoading(false);
        return;
      }
      
      setStatus('🔄 Step 2/2: Creating channel with permit (this will trigger the second popup)...');

      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      // Import the Multisig ABI
      const multisigABI = await import('../../contracts/multisig.json');

      // Create contract instance
      const contract = new Contract(MULTISIG_CONTRACT_ADDRESS, multisigABI.default, resolvedSigner);

      // Get token decimals for proper amount parsing
      const tokenContract = new Contract(tokenAddress, [
        "function decimals() view returns (uint8)"
      ], resolvedSigner);
      
      let decimals = 18;
      try {
        decimals = await tokenContract.decimals();
      } catch {
        // console.log("Using default decimals: 18");
      }

      const parsedAmount = utils.parseUnits(amount, decimals);

      // Log parameters for debugging
      // console.log('Contract call parameters:', {
      //   payer: address,
      //   payee: payee,
      //   token: tokenAddress,
      //   amount: parsedAmount.toString(),
      //   duration: parsedDuration,
      //   reclaimDelay: parsedReclaimDelay,
      //   deadline: deadline,
      //   v: permitSig.v,
      //   r: permitSig.r,
      //   s: permitSig.s
      // });

      // Create channel with ERC20 permit - pass uint64 parameters as numbers
      const tx = await contract.createChannelWithPermit(
        address, // payer
        payee, // payee
        tokenAddress, // token
        parsedAmount, // amount
        parsedDuration, // duration as uint64
        parsedReclaimDelay, // reclaimDelay as uint64
        deadline, // deadline
        permitSig.v, // v
        permitSig.r, // r
        permitSig.s // s
      );

      setTxHash(tx.hash);
      setStatus(`Transaction sent to mempool! ${tx.hash}`);
      
      // Wait for transaction
      const receipt = await tx.wait();
      setStatus(`Transaction confirmed in block: ${receipt.blockNumber}`);
      onChannelCreated?.(receipt.transactionHash);
    } catch (err) {
      console.error('Create channel error:', err);
      
      // Handle user rejection specifically
      if (err instanceof Error && err.message.includes('User rejected')) {
        setError('❌ Signature request was rejected. Please try again and approve the signature request in your wallet.');
      } else if (err instanceof Error && err.message.includes('Internal JSON-RPC error')) {
        setError('❌ Internal RPC error. This might be due to:\n• Invalid permit signature\n• Token approval issues\n• Contract state issues\n• Token does not support permit\n\nPlease check the console for detailed error information.');
      } else if (err instanceof Error && err.message.includes('execution reverted')) {
        setError('❌ Contract execution reverted. This could be due to:\n• Invalid permit signature\n• Insufficient token balance\n• Invalid parameters\n• Token does not support permit\n\nPlease check the console for detailed error information.');
      } else if (err instanceof Error && err.message.includes('InsufficientAllowance')) {
        setError('❌ Insufficient allowance. The permit signature may be invalid or the token does not support permit.');
      } else if (err instanceof Error && err.message.includes('AddressIsNotERC20')) {
        setError('❌ Token address is not a valid ERC20 token.');
      } else if (err instanceof Error && err.message.includes('AddressIsNotContract')) {
        setError('❌ Token address is not a contract.');
      } else {
        setError(`Failed to create channel: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      setStatus('');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    if (!address || !payee || !amount || !duration || !reclaimDelay) return false;
    if (tokenAddress === "0x0000000000000000000000000000000000000000") return false;
    if (!tokenAddress) return false;
    if (permitSupported === false) return false;
    // Allow creation if permit support is unknown (null) - let the contract decide
    return true;
  };

  // Debug function to verify permit signature
  const debugPermitSignature = async () => {
    if (!address || !tokenAddress || !amount || !walletClient) {
      setError('Please fill in all required fields for debugging');
      return;
    }

    try {
      setStatus('Debugging permit signature...');
      
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      const tokenContract = new Contract(tokenAddress, [
        "function nonces(address owner) view returns (uint256)",
        "function name() view returns (string)",
        "function decimals() view returns (uint8)",
        "function DOMAIN_SEPARATOR() view returns (bytes32)"
      ], resolvedSigner);

      // Get token info
      let decimals = 18;
      try {
        decimals = await tokenContract.decimals();
      } catch {
        // console.log("Using default decimals: 18");
      }

      const nonce = await tokenContract.nonces(address);
      const tokenName = await tokenContract.name();
      const deadline = parseInt(permitDeadline);
      const currentTime = Math.floor(Date.now() / 1000);

      // Create permit domain
      const domain = {
        name: tokenName,
        version: '1',
        chainId: 314159,
        verifyingContract: tokenAddress
      };

      // Create permit types
      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      // Create permit value
      const value = {
        owner: address,
        spender: MULTISIG_CONTRACT_ADDRESS,
        value: utils.parseUnits(amount, decimals),
        nonce: nonce,
        deadline: deadline
      };

      // Generate signature
      const signature = await resolvedSigner._signTypedData(domain, types, value);
      const sig = utils.splitSignature(signature);

      // Verify signature
      const recoveredAddress = utils.verifyTypedData(domain, types, value, signature);
      
      const debugInfo = {
        tokenAddress,
        tokenName,
        decimals,
        nonce: nonce.toString(),
        currentTime,
        deadline,
        deadlineValid: deadline > currentTime,
        owner: address,
        spender: MULTISIG_CONTRACT_ADDRESS,
        value: utils.parseUnits(amount, decimals).toString(),
        signature,
        v: sig.v,
        r: sig.r,
        s: sig.s,
        recoveredAddress,
        signatureValid: recoveredAddress.toLowerCase() === address.toLowerCase()
      };

      // console.log('Permit Debug Info:', debugInfo);
      setStatus(`Debug complete. Check console for details.\nSignature valid: ${debugInfo.signatureValid}\nDeadline valid: ${debugInfo.deadlineValid}`);
      
    } catch (error) {
      console.error('Debug error:', error);
      setError(`Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">Please connect your wallet to create a channel</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Channel with Permit</h2>
      
      {/* Instructions */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">
          Create payment channels with ERC20 tokens using permit signatures for gasless approval.
        </p>
        <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-800 mb-1">💡 Permit Support</h4>
          <p className="text-xs text-blue-700">
            This component works with ERC20 tokens that support permit functionality. For native FIL payments, use the "Create Channel" tab.
          </p>
          <p className="text-xs text-blue-700 mt-2">
            <strong>Two-step process:</strong> You'll see two popups - first sign the permit message, then confirm the transaction.
          </p>
        </div>
        
        {/* Token Support Status */}
        {tokenAddress !== "0x0000000000000000000000000000000000000000" && tokenAddress && (
          <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">🔍 Token Permit Support</h4>
            <div className="text-xs text-blue-700">
              {permitChecking ? (
                <p>🔍 Checking token capabilities...</p>
              ) : permitSupported === true ? (
                <div>
                  <p>✅ Token supports permit (gasless approval)</p>
                  {tokenName && <p>Token: {tokenName} ({tokenSymbol})</p>}
                </div>
              ) : permitSupported === false ? (
                <p>❌ Token does not support permit</p>
              ) : permitSupported === null ? (
                <div>
                  <p>⚠️ Permit support unknown (user may have rejected signature check)</p>
                  <p>You can still try to create a channel - the contract will validate permit support</p>
                  <button
                    onClick={checkPermitSupport}
                    className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                  >
                    Retry Permit Check
                  </button>
                </div>
              ) : (
                <p>Enter a token address to check permit support</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Channel Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payee Address
          </label>
          <input
            type="text"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount (Tokens)
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duration (seconds)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="3600"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reclaim Delay (seconds)
          </label>
          <input
            type="number"
            value={reclaimDelay}
            onChange={(e) => setReclaimDelay(e.target.value)}
            placeholder="7200"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* ERC20 Token Fields */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Address
            </label>
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x... (ERC20 token address)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter an ERC20 token address that supports permit
              {tokenAddress === "0x0000000000000000000000000000000000000000" && (
                <span className="text-red-600 block mt-1">
                  ❌ This is native FIL. Permit is only for ERC20 tokens. Use the Create Channel tab for FIL payments.
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permit Deadline (Auto: 1 hour)
            </label>
            <input
              type="number"
              value={permitDeadline}
              onChange={(e) => setPermitDeadline(e.target.value)}
              placeholder="Unix timestamp"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">
              Automatically set to 1 hour from now
            </p>
          </div>
        </div>
      </div>

      {/* Create Channel Button */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => {
            if (permitSupported === true) {
              setStatus("ℹ️ You'll see two popups: first sign the permit message, then confirm the transaction");
            }
            handleCreateChannel();
          }}
          disabled={!validateForm() || isLoading}
          className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? 'Creating Channel...' : 'Create Channel'}
        </button>
        
        {/* Debug Button */}
        {tokenAddress && tokenAddress !== "0x0000000000000000000000000000000000000000" && (permitSupported === true || permitSupported === null) && (
          <button
            onClick={debugPermitSignature}
            className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 font-medium text-sm"
          >
            Debug Permit
          </button>
        )}
      </div>

      {/* Status Messages */}
      {status && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800">
            {status.includes('Transaction sent to mempool!') ? (
              <>
                Transaction sent to mempool!{' '}
                <a
                  href={`https://calibration.filscan.io/en/tx/${status.split(' ').pop()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  {status.split(' ').pop()}
                </a>
              </>
            ) : (
              status
            )}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h3 className="font-medium text-gray-900 mb-2">Instructions:</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• <strong>Native FIL:</strong> Direct channel creation with FIL</li>
          <li>• <strong>ERC20 Token:</strong> Requires permit signature for approval</li>
          <li>• <strong>Duration:</strong> How long the channel is active</li>
          <li>• <strong>Reclaim Delay:</strong> Time before payer can reclaim funds</li>
          <li>• <strong>Reclaim Delay</strong> must be greater than <strong>Duration</strong></li>
        </ul>
      </div>
    </div>
  );
};

export default CreateChannelPermit; 