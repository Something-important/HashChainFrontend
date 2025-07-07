import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { verifyHashchain, calculateHashesNeeded, getTokensForPosition } from '../../utils/hashchainTools';

interface VerifyHashchainProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function VerifyHashchain({ isLoading, setIsLoading }: VerifyHashchainProps) {
  const [verifyForm, setVerifyForm] = useState({
    trustAnchor: '',
    hashToTest: '',
    numberOfHashes: 0
  });

  const [verificationResult, setVerificationResult] = useState<any>(null);

  const handleVerifyHashchain = async () => {
    if (!verifyForm.trustAnchor || !verifyForm.hashToTest || verifyForm.numberOfHashes <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setVerificationResult(null);
    
    try {
      console.log('🔍 Verifying hashchain locally with params:', {
        trustAnchor: verifyForm.trustAnchor,
        hashToTest: verifyForm.hashToTest,
        numberOfHashes: verifyForm.numberOfHashes
      });

      // First, calculate how many hashes are actually needed
      const hashesNeeded = calculateHashesNeeded(verifyForm.hashToTest, verifyForm.trustAnchor);
      
      // Use local verification instead of contract call
      const isValid = verifyHashchain(
        verifyForm.hashToTest,
        verifyForm.trustAnchor,
        verifyForm.numberOfHashes
      );

      // Calculate token values for better understanding
      // We're deriving trust anchor FROM the hash, so the hash is at a specific position
      const totalLength = hashesNeeded ? hashesNeeded + verifyForm.numberOfHashes : null;
      const hashPosition = totalLength ? totalLength - verifyForm.numberOfHashes + 1 : null;
      // The token number should be the number of hashes applied (since that's what you're paying for)
      const tokenNumber = verifyForm.numberOfHashes;

      const result = {
        success: true,
        isValid: isValid,
        hashesNeeded: hashesNeeded,
        totalLength: totalLength,
        hashPosition: hashPosition,
        tokenNumber: tokenNumber,
        error: isValid ? null : 'Hash cannot be derived from trust anchor'
      };

      setVerificationResult(result);

      if (result.isValid) {
        console.log('✅ Hashchain verification successful');
        toast.success('Hashchain verification successful!');
      } else {
        toast.error('Hashchain verification failed: Hash cannot be derived');
      }
    } catch (error: any) {
      console.error('❌ Error verifying hashchain:', error);
      toast.error('Failed to verify hashchain');
      setVerificationResult({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border-2 border-gray-300 shadow-lg">
      <h3 className="text-xl font-bold text-gray-900 mb-4">🔍 Verify Hashchain</h3>
      <div className="mb-4 p-4 bg-blue-100 rounded-lg border border-blue-300">
        <p className="text-sm font-medium text-blue-900">
          <strong>Local Verification:</strong> Test if the trust anchor can be derived from the test hash by hashing the specified number of times (off-chain)
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Hash to Test</label>
          <input
            type="text"
            placeholder="0x..."
            value={verifyForm.hashToTest}
            onChange={e => setVerifyForm({...verifyForm, hashToTest: e.target.value})}
            className="w-full border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Trust Anchor</label>
          <input
            type="text"
            placeholder="0x..."
            value={verifyForm.trustAnchor}
            onChange={e => setVerifyForm({...verifyForm, trustAnchor: e.target.value})}
            className="w-full border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Number of Hashes</label>
          <input
            type="number"
            placeholder="Number of times to hash"
            value={verifyForm.numberOfHashes}
            onChange={e => setVerifyForm({...verifyForm, numberOfHashes: Number(e.target.value)})}
            className="w-full border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleVerifyHashchain}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700 transition-all shadow-md"
          disabled={isLoading}
        >
          {isLoading ? 'Verifying...' : 'Verify Hashchain'}
        </button>

        {/* Verification Results */}
        {verificationResult && (
          <div className="mt-6 p-4 rounded-lg border-2 shadow-md">
            {verificationResult.success && verificationResult.isValid ? (
              <div className="bg-green-100 border-green-400">
                <h4 className="font-bold mb-3 text-green-900 text-lg">✅ Verification Successful</h4>
                <div className="space-y-2 text-sm">
                  <div className="bg-white p-3 rounded border">
                    <span className="font-bold text-gray-800">Status:</span>
                    <span className="text-green-700 font-bold ml-2">Valid Hashchain</span>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <span className="font-bold text-gray-800">Trust Anchor:</span>
                    <span className="text-gray-900 font-mono text-xs ml-2">{verifyForm.trustAnchor}</span>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <span className="font-bold text-gray-800">Test Hash:</span>
                    <span className="text-gray-900 font-mono text-xs ml-2">{verifyForm.hashToTest}</span>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <span className="font-bold text-gray-800">Hashes Applied:</span>
                    <span className="text-gray-900 font-bold ml-2">{verifyForm.numberOfHashes}</span>
                  </div>
                  {verificationResult.hashesNeeded !== null && (
                    <div className="bg-blue-50 p-3 rounded border border-blue-200">
                      <span className="font-bold text-blue-800">💡 Calculated Hashes Needed:</span>
                      <span className="text-blue-900 font-bold ml-2">{verificationResult.hashesNeeded}</span>
                    </div>
                  )}
                  {verificationResult.tokenNumber !== null && (
                    <div className="bg-green-50 p-3 rounded border border-green-200">
                      <span className="font-bold text-green-800">💰 Token Information:</span>
                      <div className="mt-1 text-sm">
                        <span className="text-green-900 font-bold">{verificationResult.tokenNumber} tokens</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-red-100 border-red-400">
                <h4 className="font-bold mb-3 text-red-900 text-lg">❌ Verification Failed</h4>
                <div className="space-y-2 text-sm">
                  <div className="bg-white p-3 rounded border">
                    <span className="font-bold text-gray-800">Status:</span>
                    <span className="text-red-700 font-bold ml-2">Invalid Hashchain</span>
                  </div>
                  {verificationResult.error && (
                    <div className="bg-white p-3 rounded border">
                      <span className="font-bold text-gray-800">Error:</span>
                      <span className="text-red-700 ml-2">{verificationResult.error}</span>
                    </div>
                  )}
                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <div className="text-sm text-yellow-800">
                      <p><strong>💡 Tip:</strong> The hash cannot be derived from the trust anchor with {verifyForm.numberOfHashes} hashes. 
                      {verificationResult.hashesNeeded !== null && (
                        <span> Try using <strong>{verificationResult.hashesNeeded} hashes</strong> instead.</span>
                      )}
                      {verificationResult.hashesNeeded === null && (
                        <span> Try a different number of hashes or check if the hash is correct.</span>
                      )}
                      </p>
                      {verificationResult.tokenNumber !== null && (
                        <div className="mt-2">
                          <span className="text-yellow-800">This would represent <strong>{verificationResult.tokenNumber} tokens</strong>.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 