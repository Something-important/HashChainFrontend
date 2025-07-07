"use client";
import React, { useState, useEffect } from "react";
import { providers, utils, Contract } from "ethers";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import { MULTISIG_CONTRACT_ADDRESS, MULTISIG_TARGET_CHAIN } from '../../utils/multisigUtils';

interface SmartSignatureProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

interface ChannelState {
  exists: boolean;
  amount: string;
  lastNonce: number;
  expiration: number;
  isExpired: boolean;
  canReclaim: boolean;
  payee: string;
}

interface SignatureData {
  signature: string;
  parameters: {
    payer: string;
    payee: string;
    token: string;
    amount: string;
    nonce: string;
  };
  timestamp: string;
}

interface VerificationResult {
  isValid: boolean;
  recoveredSigner: string;
  expectedSigner: string;
  parameterMatch: boolean;
  errors: string[];
}

export function SmartSignature({ isLoading, setIsLoading }: SmartSignatureProps) {
  // State management
  const [mode, setMode] = useState<'payer' | 'merchant'>('payer');
  const [payer, setPayer] = useState("");
  const [payee, setPayee] = useState("");
  const [tokenAddress, setTokenAddress] = useState("0x0000000000000000000000000000000000000000");
  const [amount, setAmount] = useState("");
  const [nonce, setNonce] = useState("");
  const [signature, setSignature] = useState("");
  
  // Channel state
  const [channelState, setChannelState] = useState<ChannelState | null>(null);
  const [isLoadingChannel, setIsLoadingChannel] = useState(false);
  
  // Signature management
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  
  // Transaction results
  const [redeemResult, setRedeemResult] = useState<any>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Derive provider
  const provider = publicClient ? new providers.JsonRpcProvider(publicClient.transport.url, {
    name: "Filecoin Calibration",
    chainId: 314159
  }) : undefined;

  // Auto-fill addresses based on mode
  useEffect(() => {
    if (address) {
      if (mode === 'payer') {
        setPayer(address);
        setPayee(""); // Clear payee for payer mode
      } else {
        setPayee(address); // Set payee to connected wallet for merchant mode
        setPayer(""); // Clear payer for merchant mode
      }
    }
  }, [address, mode]);

  // Get channel state and suggest next nonce
  const getChannelState = async () => {
    if (!isConnected || !address || !payer || !payee) {
      alert("Please connect wallet and enter both payer and payee addresses");
      return;
    }

    setIsLoadingChannel(true);
    try {
      const multisigABI = await import('../../contracts/multisig.json');
      const contract = new Contract(MULTISIG_CONTRACT_ADDRESS, multisigABI.default, provider);

      const channel = await contract.channels(
        utils.getAddress(payer),
        utils.getAddress(payee),
        utils.getAddress(tokenAddress)
      );

      const state: ChannelState = {
        exists: true,
        amount: utils.formatEther(channel.amount),
        lastNonce: parseInt(channel.lastNonce.toString()),
        expiration: parseInt(channel.expiration.toString()),
        isExpired: channel.expiration.lt(Math.floor(Date.now() / 1000)),
        canReclaim: channel.reclaimAfter.lt(Math.floor(Date.now() / 1000)),
        payee: payee
      };

      setChannelState(state);
      setNonce((state.lastNonce + 1).toString());
    } catch (err: any) {
      console.error("Channel state error:", err);
      setChannelState({ 
        exists: false, 
        amount: "0", 
        lastNonce: 0, 
        expiration: 0, 
        isExpired: false, 
        canReclaim: false,
        payee: payee
      });
      alert("Channel not found or error occurred. Please check addresses.");
    } finally {
      setIsLoadingChannel(false);
    }
  };

  // Create signature (Payer mode)
  const createSignature = async () => {
    if (!isConnected || !address || !walletClient) {
      alert("Please connect your wallet");
      return;
    }

    if (!payee || !utils.isAddress(payee.trim())) {
      alert("Please enter a valid payee address");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!nonce || parseInt(nonce) <= 0) {
      alert("Please enter a valid nonce (must be > 0)");
      return;
    }

    try {
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      const domain = {
        name: 'Multisig Payment Channel',
        version: '1',
        chainId: 314159,
        verifyingContract: MULTISIG_CONTRACT_ADDRESS
      };

      const types = {
        RedeemVoucher: [
          { name: 'payer', type: 'address' },
          { name: 'payee', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }
        ]
      };

      const value = {
        payer: utils.getAddress(address),
        payee: utils.getAddress(payee.trim()),
        token: utils.getAddress(tokenAddress),
        amount: utils.parseEther(amount),
        nonce: parseInt(nonce)
      };

      const sig = await resolvedSigner._signTypedData(domain, types, value);
      
      const signatureInfo: SignatureData = {
        signature: sig,
        parameters: {
          payer: address,
          payee: payee.trim(),
          token: tokenAddress,
          amount: amount,
          nonce: nonce
        },
        timestamp: new Date().toISOString()
      };

      setSignature(sig);
      setSignatureData(signatureInfo);
      
      // Auto-verify the signature
      await verifySignature(signatureInfo);
      
    } catch (err: any) {
      alert(`Signature creation failed: ${err.message}`);
    }
  };

  // Verify signature
  const verifySignature = async (sigData?: SignatureData) => {
    let dataToVerify = sigData || signatureData;
    
    // If no signature data exists, create it from current form values and provided signature
    if (!dataToVerify && signature) {
      dataToVerify = {
        signature: signature,
        parameters: {
          payer: payer,
          payee: payee,
          token: tokenAddress,
          amount: amount,
          nonce: nonce
        },
        timestamp: new Date().toISOString()
      };
    }
    
    if (!dataToVerify) {
      alert("No signature data to verify");
      return;
    }

    try {
      const domain = {
        name: 'Multisig Payment Channel',
        version: '1',
        chainId: 314159,
        verifyingContract: MULTISIG_CONTRACT_ADDRESS
      };

      const types = {
        RedeemVoucher: [
          { name: 'payer', type: 'address' },
          { name: 'payee', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }
        ]
      };

      const value = {
        payer: utils.getAddress(dataToVerify.parameters.payer),
        payee: utils.getAddress(dataToVerify.parameters.payee),
        token: utils.getAddress(dataToVerify.parameters.token),
        amount: utils.parseEther(dataToVerify.parameters.amount),
        nonce: parseInt(dataToVerify.parameters.nonce)
      };

      const recoveredSigner = utils.verifyTypedData(domain, types, value, dataToVerify.signature);
      const expectedSigner = utils.getAddress(dataToVerify.parameters.payer);

      const errors: string[] = [];
      
      // Check if recovered signer matches expected signer
      if (recoveredSigner.toLowerCase() !== expectedSigner.toLowerCase()) {
        errors.push("Recovered signer does not match expected payer");
      }

      // Check if parameters match current state
      const parameterMatch = 
        dataToVerify.parameters.payer === payer &&
        dataToVerify.parameters.payee === payee &&
        dataToVerify.parameters.token === tokenAddress &&
        dataToVerify.parameters.amount === amount &&
        dataToVerify.parameters.nonce === nonce;

      if (!parameterMatch) {
        errors.push("Signature parameters do not match current form values");
      }

      // Check signature format
      if (!dataToVerify.signature.startsWith('0x') || dataToVerify.signature.length !== 132) {
        errors.push("Invalid signature format");
      }

      const result: VerificationResult = {
        isValid: errors.length === 0,
        recoveredSigner,
        expectedSigner,
        parameterMatch,
        errors
      };

      setVerificationResult(result);
      
      // Show detailed debug info
      console.log("🔍 Debug Information:");
      console.log("Signature was created for:", dataToVerify.parameters);
      console.log("Current form values:", { payer, payee, token: tokenAddress, amount, nonce });
      console.log("Recovered signer:", recoveredSigner);
      console.log("Expected signer:", expectedSigner);
      console.log("Parameter match:", parameterMatch);
      console.log("Errors:", errors);
      
      if (errors.length > 0) {
        alert(`Signature verification failed:\n${errors.join('\n')}\n\nCheck console for detailed debug info.`);
      } else {
        alert("✅ Signature verification successful!");
      }

    } catch (err: any) {
      console.error("Signature verification error:", err);
      alert(`Signature verification failed: ${err.message}`);
    }
  };

  // Redeem with signature (Merchant mode)
  const redeemWithSignature = async () => {
    if (!isConnected || !address || !walletClient) {
      alert("Please connect your wallet");
      return;
    }

    if (!channelState || !channelState.exists) {
      alert("Please check channel state first");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (parsedAmount > parseFloat(channelState.amount)) {
      alert(`Amount ${amount} exceeds channel balance ${channelState.amount}`);
      return;
    }

    if (!signature || signature.length < 10) {
      alert("Please enter a valid signature");
      return;
    }

    // Remove verification requirement - let the contract handle validation
    console.log("Attempting redemption with parameters:");
    console.log("Payer:", payer);
    console.log("Token:", tokenAddress);
    console.log("Amount:", amount);
    console.log("Nonce:", nonce);
    console.log("Signature:", signature);

    try {
      const resolvedSigner = new providers.Web3Provider(walletClient as any, {
        name: "Filecoin Calibration",
        chainId: 314159
      }).getSigner();

      const multisigABI = await import('../../contracts/multisig.json');
      const contract = new Contract(MULTISIG_CONTRACT_ADDRESS, multisigABI.default, resolvedSigner);

      const tx = await contract.redeemChannel(
        utils.getAddress(payer),
        utils.getAddress(tokenAddress),
        utils.parseEther(amount),
        parseInt(nonce),
        signature
      );

      setRedeemResult({
        success: true,
        hash: tx.hash,
        message: "Redemption transaction sent successfully!"
      });

      await tx.wait();
      setRedeemResult({
        success: true,
        hash: tx.hash,
        message: "Redemption confirmed!"
      });

      // Refresh channel state
      await getChannelState();

    } catch (err: any) {
      console.error("Redeem error:", err);
      
      // Parse specific contract errors
      let errorMessage = err.message;
      if (err.data) {
        try {
          const errorData = JSON.parse(err.data);
          if (errorData.message && errorData.message.includes("StaleNonce")) {
            errorMessage = "Nonce is already used or too low. Try a higher nonce.";
          } else if (errorData.message && errorData.message.includes("InvalidChannelSignature")) {
            errorMessage = "Invalid signature. Check that signature parameters match exactly.";
          } else if (errorData.message && errorData.message.includes("IncorrectAmount")) {
            errorMessage = "Amount exceeds channel balance or is invalid.";
          } else if (errorData.message && errorData.message.includes("ChannelDoesNotExistOrWithdrawn")) {
            errorMessage = "Channel does not exist or has been withdrawn.";
          }
        } catch (parseErr) {
          // If parsing fails, use original error
        }
      }
      
      setRedeemResult({
        success: false,
        error: errorMessage
      });
    }
  };

  // Check nonce status and channel details
  const checkNonceStatus = async () => {
    if (!isConnected || !address || !payer || !payee) {
      alert("Please connect wallet and enter both payer and payee addresses");
      return;
    }

    try {
      const multisigABI = await import('../../contracts/multisig.json');
      const contract = new Contract(MULTISIG_CONTRACT_ADDRESS, multisigABI.default, provider);

      const channel = await contract.channels(
        utils.getAddress(payer),
        utils.getAddress(payee),
        utils.getAddress(tokenAddress)
      );

      const currentNonce = parseInt(channel.lastNonce.toString());
      const channelBalance = utils.formatEther(channel.amount);
      const requestedAmount = parseFloat(amount);
      
      console.log("🔍 Nonce Status Check:");
      console.log("Current channel nonce:", currentNonce);
      console.log("Your requested nonce:", nonce);
      console.log("Channel balance:", channelBalance, "FIL");
      console.log("Requested amount:", requestedAmount, "FIL");
      console.log("Balance sufficient:", requestedAmount <= parseFloat(channelBalance));
      console.log("Nonce valid:", parseInt(nonce) > currentNonce);

      let issues = [];
      if (parseInt(nonce) <= currentNonce) {
        issues.push(`Nonce ${nonce} is not greater than current nonce ${currentNonce}`);
      }
      if (requestedAmount > parseFloat(channelBalance)) {
        issues.push(`Requested amount ${requestedAmount} exceeds channel balance ${channelBalance}`);
      }
      if (requestedAmount <= 0) {
        issues.push("Requested amount must be greater than 0");
      }

      if (issues.length > 0) {
        alert(`Contract revert likely due to:\n${issues.join('\n')}`);
      } else {
        alert("✅ Parameters look valid. The issue might be with the signature parameters.");
      }

    } catch (err: any) {
      console.error("Nonce status check error:", err);
      alert(`Error checking nonce status: ${err.message}`);
    }
  };

  // Test signature with different payer addresses
  const testSignatureWithPayer = async () => {
    if (!signature || !amount || !nonce) {
      alert("Please enter signature, amount, and nonce first");
      return;
    }

    const testPayerAddresses = [
      "0x5E1db14378278D012b192b022cDB609eA5A5EC52",
      "0xd7ccF7400C59bC932838FA4A9882D8A041113497",
      address || "" // connected wallet address
    ].filter(addr => addr !== "");

    console.log("🔍 Testing signature with different payer addresses...");

    for (const testPayer of testPayerAddresses) {
      try {
        const domain = {
          name: 'Multisig Payment Channel',
          version: '1',
          chainId: 314159,
          verifyingContract: MULTISIG_CONTRACT_ADDRESS
        };

        const types = {
          RedeemVoucher: [
            { name: 'payer', type: 'address' },
            { name: 'payee', type: 'address' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'nonce', type: 'uint256' }
          ]
        };

        const value = {
          payer: utils.getAddress(testPayer),
          payee: utils.getAddress(payee),
          token: utils.getAddress(tokenAddress),
          amount: utils.parseEther(amount),
          nonce: parseInt(nonce)
        };

        const recoveredSigner = utils.verifyTypedData(domain, types, value, signature);
        
        console.log(`Testing with payer ${testPayer}:`);
        console.log(`  Recovered signer: ${recoveredSigner}`);
        console.log(`  Expected signer: ${testPayer}`);
        console.log(`  Match: ${recoveredSigner.toLowerCase() === testPayer.toLowerCase()}`);
        
        if (recoveredSigner.toLowerCase() === testPayer.toLowerCase()) {
          alert(`✅ Found matching payer: ${testPayer}\n\nUse this payer address for redemption.`);
          setPayer(testPayer);
          return;
        }
             } catch (err: any) {
         console.log(`❌ Failed with payer ${testPayer}:`, err.message);
       }
    }
    
    alert("❌ No matching payer found. The signature might be for different parameters.");
  };

  // Get the next available nonce
  const getNextNonce = async () => {
    if (!isConnected || !address || !payer || !payee) {
      alert("Please connect wallet and enter both payer and payee addresses");
      return;
    }

    try {
      const multisigABI = await import('../../contracts/multisig.json');
      const contract = new Contract(MULTISIG_CONTRACT_ADDRESS, multisigABI.default, provider);

      const channel = await contract.channels(
        utils.getAddress(payer),
        utils.getAddress(payee),
        utils.getAddress(tokenAddress)
      );

      const currentNonce = parseInt(channel.lastNonce.toString());
      const nextNonce = currentNonce + 1;
      
      console.log("🔢 Nonce Information:");
      console.log("Current channel nonce:", currentNonce);
      console.log("Next available nonce:", nextNonce);
      console.log("Your current nonce setting:", nonce);
      
      setNonce(nextNonce.toString());
      
      alert(`✅ Next available nonce: ${nextNonce}\n\nThis has been set automatically.`);
      
    } catch (err: any) {
      console.error("Get next nonce error:", err);
      alert(`Error getting next nonce: ${err.message}`);
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-white/20">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">🔐 Smart Signature Manager</h3>
      
      {/* Mode Toggle */}
      <div className="mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMode('payer')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'payer'
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🏦 Payer Mode (Create Signatures)
          </button>
          <button
            onClick={() => setMode('merchant')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'merchant'
                ? 'bg-green-600 text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🛒 Merchant Mode (Redeem)
          </button>
        </div>
      </div>

      {/* Common Parameters */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {mode === 'payer' ? 'Payer Address (You)' : 'Payer Address'}
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={payer}
              onChange={(e) => setPayer(e.target.value.trim())}
              className="w-full border rounded px-3 py-2"
              readOnly={mode === 'payer'}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {mode === 'merchant' ? 'Payee Address (You)' : 'Payee Address (Merchant)'}
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={payee}
              onChange={(e) => setPayee(e.target.value.trim())}
              className="w-full border rounded px-3 py-2"
              readOnly={mode === 'merchant'}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Token Address</label>
          <input
            type="text"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {mode === 'payer' ? (
        /* Payer Mode - Create Signatures */
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">🏦 Payer Mode</h4>
            <p className="text-xs text-blue-700">
              Create signatures to authorize merchant redemptions from your payment channel.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount to Authorize</label>
              <input
                type="number"
                placeholder="5.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nonce</label>
              <input
                type="number"
                placeholder="1"
                value={nonce}
                onChange={(e) => setNonce(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">Must be strictly increasing</p>
            </div>

            <button
              onClick={createSignature}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded font-semibold hover:bg-blue-700 transition-all"
            >
              Create Signature
            </button>
          </div>

          {signatureData && (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <h4 className="text-sm font-semibold text-green-800 mb-2">✅ Signature Created</h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-green-700">Signature:</label>
                  <textarea
                    value={signatureData.signature}
                    readOnly
                    className="w-full mt-1 p-2 bg-white border rounded text-xs font-mono"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><strong>Payer:</strong> {signatureData.parameters.payer}</div>
                  <div><strong>Payee:</strong> {signatureData.parameters.payee}</div>
                  <div><strong>Amount:</strong> {signatureData.parameters.amount}</div>
                  <div><strong>Nonce:</strong> {signatureData.parameters.nonce}</div>
                </div>
                <button
                  onClick={() => verifySignature()}
                  className="w-full bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700"
                >
                  Verify Signature
                </button>
              </div>
            </div>
          )}

          {verificationResult && (
            <div className={`p-4 border rounded ${
              verificationResult.isValid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <h4 className={`text-sm font-semibold mb-2 ${
                verificationResult.isValid ? 'text-green-800' : 'text-red-800'
              }`}>
                {verificationResult.isValid ? '✅ Signature Valid' : '❌ Signature Invalid'}
              </h4>
              <div className="text-xs space-y-1">
                <p><strong>Recovered Signer:</strong> {verificationResult.recoveredSigner}</p>
                <p><strong>Expected Signer:</strong> {verificationResult.expectedSigner}</p>
                <p><strong>Parameter Match:</strong> {verificationResult.parameterMatch ? '✅ Yes' : '❌ No'}</p>
                {verificationResult.errors.length > 0 && (
                  <div>
                    <strong>Errors:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {verificationResult.errors.map((error, idx) => (
                        <li key={idx} className="text-red-600">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Merchant Mode - Redeem */
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <h4 className="text-sm font-semibold text-green-800 mb-2">🛒 Merchant Mode</h4>
            <p className="text-xs text-green-700">
              Redeem funds using signatures from the payer. Channel state is automatically checked.
            </p>
          </div>

          <button
            onClick={getChannelState}
            disabled={isLoadingChannel}
            className="w-full bg-yellow-600 text-white px-6 py-3 rounded font-semibold hover:bg-yellow-700 transition-all disabled:opacity-50"
          >
            {isLoadingChannel ? 'Checking...' : 'Check Channel State'}
          </button>

          {channelState && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">📊 Channel State</h4>
              <div className="text-xs text-blue-700 space-y-1">
                <p><strong>Exists:</strong> {channelState.exists ? '✅ Yes' : '❌ No'}</p>
                {channelState.exists && (
                  <>
                    <p><strong>Balance:</strong> {channelState.amount} FIL</p>
                    <p><strong>Last Nonce:</strong> {channelState.lastNonce}</p>
                    <p><strong>Suggested Nonce:</strong> {channelState.lastNonce + 1}</p>
                    <p><strong>Expired:</strong> {channelState.isExpired ? 'Yes' : 'No'}</p>
                    <p><strong>Can Reclaim:</strong> {channelState.canReclaim ? 'Yes' : 'No'}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {channelState && channelState.exists && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount to Redeem</label>
                <input
                  type="number"
                  placeholder="5.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Max: {channelState.amount} FIL</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nonce</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={nonce}
                    onChange={(e) => setNonce(e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                  />
                  <button
                    onClick={getNextNonce}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    🔢 Get Next
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Must be greater than {channelState.lastNonce}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>
                <textarea
                  placeholder="0x..."
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="w-full border rounded px-3 py-2 h-20"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste the signature from the payer. Make sure the parameters above match what the signature was created for.
                </p>
              </div>

              <button
                onClick={() => verifySignature()}
                className="w-full bg-yellow-600 text-white px-6 py-3 rounded font-semibold hover:bg-yellow-700 transition-all"
              >
                Verify Signature
              </button>

              <button
                onClick={checkNonceStatus}
                className="w-full bg-orange-600 text-white px-6 py-3 rounded font-semibold hover:bg-orange-700 transition-all"
              >
                🔍 Check Why Contract Reverts
              </button>

              <button
                onClick={testSignatureWithPayer}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded font-semibold hover:bg-purple-700 transition-all"
              >
                🔍 Find Correct Payer Address
              </button>

              <button
                onClick={redeemWithSignature}
                disabled={!signature || !amount || !nonce}
                className="w-full bg-green-600 text-white px-6 py-3 rounded font-semibold hover:bg-green-700 transition-all disabled:opacity-50"
              >
                Redeem Funds
              </button>
              {!verificationResult?.isValid && signature && (
                <p className="text-xs text-yellow-600 text-center">
                  ⚠️ Signature not verified. Consider verifying first to ensure success.
                </p>
              )}
            </div>
          )}

          {redeemResult && (
            <div className={`p-4 border rounded ${
              redeemResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <h4 className={`text-sm font-semibold mb-2 ${
                redeemResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {redeemResult.success ? '✅ Success' : '❌ Error'}
              </h4>
              <p className={`text-sm ${
                redeemResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {redeemResult.message || redeemResult.error}
              </p>
              {redeemResult.hash && (
                <a
                  href={`https://calibration.filscan.io/en/tx/${redeemResult.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  View Transaction →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 