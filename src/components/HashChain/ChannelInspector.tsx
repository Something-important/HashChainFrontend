import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAccount } from 'wagmi';
import { getChannelInfo, debugContractState, formatAddress, formatTokenAmount, HASHPAY_CONTRACT_ADDRESS } from '../../utils/blockchainUtils';

interface ChannelInspectorProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function ChannelInspector({ isLoading, setIsLoading }: ChannelInspectorProps) {
  const { address: connectedAddress } = useAccount();
  
  const [inspectForm, setInspectForm] = useState({
    payerAddress: '',
    merchantAddress: '',
    tokenAddress: '0x0000000000000000000000000000000000000000'
  });

  const [channelInfo, setChannelInfo] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [searchStatus, setSearchStatus] = useState<string>('');

  const handleInspectChannel = async () => {
    if (!inspectForm.payerAddress || !inspectForm.merchantAddress || !inspectForm.tokenAddress) {
      toast.error('Please fill in all required fields (Payer, Merchant, and Token addresses)');
      return;
    }

    setIsLoading(true);
    setSearchStatus('Looking up channel...');
    setChannelInfo(null);
    setDebugInfo(null);

    try {
      // Get specific channel with all three addresses
      const result = await getChannelInfo(
        inspectForm.payerAddress as `0x${string}`,
        inspectForm.merchantAddress as `0x${string}`,
        inspectForm.tokenAddress as `0x${string}`
      );

      if (result) {
        console.log('✅ Channel info retrieved:', result);
        setChannelInfo({
          payer: inspectForm.payerAddress,
          merchant: inspectForm.merchantAddress,
          ...result
        });
        
        // Also get debug info
        setSearchStatus('Getting debug information...');
        const debugResult = await debugContractState(
          inspectForm.payerAddress as `0x${string}`,
          inspectForm.merchantAddress as `0x${string}`,
          inspectForm.tokenAddress as `0x${string}`
        );
        setDebugInfo(debugResult);
        
        toast.success('Channel inspection completed!');
        setSearchStatus('Inspection completed successfully');
      } else {
        console.log('❌ No channel found');
        setChannelInfo(null);
        setDebugInfo(null);
        toast.error('No channel found with the provided parameters');
        setSearchStatus('No channel found');
      }
    } catch (error) {
      console.error('❌ Error inspecting channel:', error);
      toast.error('Failed to inspect channel');
      setChannelInfo(null);
      setDebugInfo(null);
      setSearchStatus('Error occurred during inspection');
    } finally {
      setIsLoading(false);
    }
  };

  // Add BigInt serialization helper
  const serializeBigInt = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  };

  // Determine user's role in the channel
  const getUserRole = () => {
    if (!connectedAddress || !channelInfo) return null;
    
    const connected = connectedAddress.toLowerCase();
    const payer = channelInfo.payer.toLowerCase();
    const merchant = channelInfo.merchant.toLowerCase();
    
    if (connected === payer) return 'payer';
    if (connected === merchant) return 'merchant';
    return null;
  };

  const userRole = getUserRole();

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border-2 border-gray-300 shadow-lg">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Channel Inspector</h3>
      <div className="mb-4 p-4 bg-blue-100 rounded-lg border border-blue-300">
        <p className="text-sm font-medium text-blue-900">
          <strong>Channel Lookup:</strong> Get channel info and debug contract state. All three addresses are required.
        </p>
      </div>
      
      {/* Search Status */}
      {searchStatus && (
        <div className="mb-4 p-3 bg-gray-100 rounded-lg border border-gray-300">
          <p className="text-sm font-medium text-gray-800">{searchStatus}</p>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Payer Address *</label>
          <input
            type="text"
            placeholder="0x..."
            value={inspectForm.payerAddress}
            onChange={e => setInspectForm({...inspectForm, payerAddress: e.target.value})}
            className="w-full border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Merchant Address *</label>
          <input
            type="text"
            placeholder="0x..."
            value={inspectForm.merchantAddress}
            onChange={e => setInspectForm({...inspectForm, merchantAddress: e.target.value})}
            className="w-full border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Token Address *</label>
          <input
            type="text"
            placeholder="0x... (0x0 for FIL)"
            value={inspectForm.tokenAddress}
            onChange={e => setInspectForm({...inspectForm, tokenAddress: e.target.value})}
            className="w-full border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleInspectChannel}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md"
          disabled={isLoading}
        >
          {isLoading ? 'Inspecting...' : 'Inspect Channel'}
        </button>
        
        {/* Channel Information */}
        {channelInfo && (
          <div className="mt-6 p-4 bg-green-100 rounded-lg border-2 border-green-400 shadow-md">
            <h4 className="font-bold mb-3 text-green-900 text-lg">📊 Channel Information</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Payer:</span> <span className="text-gray-900">{formatAddress(channelInfo.payer)}</span></div>
              <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Merchant:</span> <span className="text-gray-900">{formatAddress(channelInfo.merchant)}</span></div>
              <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Token:</span> <span className="text-gray-900">{formatAddress(channelInfo.token)}</span></div>
              <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Trust Anchor:</span> <span className="text-gray-900 font-mono text-xs">{channelInfo.trustAnchor}</span></div>
              <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Amount:</span> <span className="text-gray-900">{formatTokenAmount(channelInfo.amount)}</span></div>
              <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Number of Tokens:</span> <span className="text-gray-900">{channelInfo.numberOfTokens}</span></div>
              <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Merchant Withdraw After:</span> <span className="text-gray-900">{channelInfo.merchantWithdrawAfterBlocks} blocks</span></div>
              <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Payer Withdraw After:</span> <span className="text-gray-900">{channelInfo.payerWithdrawAfterBlocks} blocks</span></div>
            </div>
          </div>
        )}

        {/* Debug Information */}
        {debugInfo && (
          <div className="mt-4 p-4 bg-yellow-100 rounded-lg border-2 border-yellow-400 shadow-md">
            <h4 className="font-bold mb-3 text-yellow-900 text-lg">🐛 Debug Information</h4>
            
            {/* Contract Address Verification */}
            <div className="mb-3 p-3 bg-red-50 rounded border border-red-200">
              <span className="font-bold text-red-800">📋 HashPay Contract Address: </span>
              <span className="text-red-900 font-mono text-sm">{HASHPAY_CONTRACT_ADDRESS}</span>
              <div className="text-xs text-red-700 mt-1">
                ⚠️ Make sure this matches your deployed contract address
              </div>
            </div>
            
            {/* User Role Information */}
            {userRole && (
              <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
                <span className="font-bold text-blue-800">👤 Your Role: </span>
                <span className="text-blue-900 font-bold capitalize">{userRole}</span>
                {userRole === 'merchant' && (
                  <div className="mt-1 text-sm text-blue-700">
                    💡 You can redeem payments for services rendered
                  </div>
                )}
                {userRole === 'payer' && (
                  <div className="mt-1 text-sm text-blue-700">
                    💡 You can reclaim unused funds after withdrawal time
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2 text-sm">
              <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Channel Exists:</span> <span className={debugInfo.exists ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>{debugInfo.exists ? '✅ Yes' : '❌ No'}</span></div>
              
              {/* Show relevant information based on user role */}
              {userRole === 'payer' && (
                <>
                  <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">You Can Reclaim:</span> <span className={debugInfo.canPayerReclaim ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>{debugInfo.canPayerReclaim ? '✅ Yes' : '❌ No'}</span></div>
                  {debugInfo.blocksUntilPayerReclaim !== undefined && (
                    <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Blocks Until You Can Reclaim:</span> <span className="text-gray-900 font-mono">{debugInfo.blocksUntilPayerReclaim.toString()}</span></div>
                  )}
                </>
              )}
              
              {userRole === 'merchant' && (
                <div className="bg-white p-2 rounded border">
                  <span className="font-bold text-gray-800">You Can Redeem:</span> 
                  <span className="text-green-700 font-bold ml-2">✅ Yes (anytime)</span>
                  <div className="text-xs text-gray-600 mt-1">You can redeem payments for services rendered using the Redeem tab</div>
                </div>
              )}
              
              {!userRole && (
                <>
                  <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Payer Can Reclaim:</span> <span className={debugInfo.canPayerReclaim ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>{debugInfo.canPayerReclaim ? '✅ Yes' : '❌ No'}</span></div>
                  {debugInfo.blocksUntilPayerReclaim !== undefined && (
                    <div className="bg-white p-2 rounded border"><span className="font-bold text-gray-800">Blocks Until Payer Reclaim:</span> <span className="text-gray-900 font-mono">{debugInfo.blocksUntilPayerReclaim.toString()}</span></div>
                  )}
                </>
              )}
              
              {debugInfo.error && (
                <div className="bg-red-100 p-2 rounded border border-red-300">
                  <span className="font-bold text-red-800">Error:</span> <span className="text-red-700">{debugInfo.error}</span>
                </div>
              )}
            </div>
            
            {/* Troubleshooting Tips */}
            {!debugInfo.exists && (
              <div className="mt-3 p-3 bg-orange-50 rounded border border-orange-200">
                <h5 className="font-bold text-orange-800 mb-2">🔍 Troubleshooting Tips:</h5>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Verify the contract address matches your deployed contract</li>
                  <li>• Check that all addresses are correct (payer, merchant, token)</li>
                  <li>• Ensure the transaction is confirmed on the blockchain</li>
                  <li>• Try using lowercase addresses if the search fails</li>
                  <li>• For FIL payments, use token address: 0x0000000000000000000000000000000000000000</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Raw Data */}
        {channelInfo && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-bold text-gray-700 hover:text-gray-900">Raw Channel Data</summary>
            <pre className="text-xs overflow-auto max-h-48 mt-2 bg-gray-100 p-3 rounded border border-gray-300 text-gray-800">
              {JSON.stringify(serializeBigInt(channelInfo), null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
} 