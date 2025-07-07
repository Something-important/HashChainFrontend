import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { generateHashchain, getHashByPosition, searchHashInHashchain, getTokensForPosition, getPositionForToken } from '../../utils/hashchainTools';

interface HashchainToolsProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function HashchainTools({ isLoading, setIsLoading }: HashchainToolsProps) {
  const [hashchainForm, setHashchainForm] = useState({
    hashchainLength: 100
  });

  const [hashchainData, setHashchainData] = useState<any>(null);
  const [generatedTrustAnchor, setGeneratedTrustAnchor] = useState<string>("");
  const [searchToken, setSearchToken] = useState<number>(1);
  const [searchResult, setSearchResult] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  // Generate random token numbers for quick lookup (client-side only)
  const generateRandomTokens = (maxToken: number, count: number = 7): number[] => {
    if (!isMounted) {
      // Not mounted yet: return empty array to avoid hydration mismatch
      return [];
    }
    
    const tokens = new Set<number>();
    while (tokens.size < count) {
      tokens.add(Math.floor(Math.random() * maxToken) + 1);
    }
    return Array.from(tokens).sort((a, b) => a - b);
  };

  // Set mounted state after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleGenerateHashchain = async () => {
    if (hashchainForm.hashchainLength <= 0) {
      toast.error('Hashchain length must be greater than 0');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔗 Generating hashchain with length:', hashchainForm.hashchainLength);

      const hashchain = generateHashchain(hashchainForm.hashchainLength);
      setHashchainData(hashchain);
      setGeneratedTrustAnchor(hashchain.trustAnchor);
      setSearchResult(""); // Reset search result
      setSearchToken(1); // Reset search token
      toast.success('Hashchain generated successfully! Trust anchor copied to clipboard.');

      await copyToClipboard(hashchain.trustAnchor);
    } catch (error) {
      console.error('❌ Error generating hashchain:', error);
      toast.error('Failed to generate hashchain');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchToken = () => {
    if (!hashchainData) {
      toast.error('Please generate a hashchain first');
      return;
    }

    // Allow searching up to the max token number
    const maxSearchToken = hashchainData.length - 1;
    
    if (searchToken < 1) {
      toast.error(`Token number must be at least 1`);
      return;
    }
    
    if (searchToken > maxSearchToken) {
      toast.error(`Token number cannot exceed ${maxSearchToken} (hashchain length: ${hashchainData.length})`);
      return;
    }

    try {
      const position = getPositionForToken(searchToken, hashchainData.length);
      const hash = getHashByPosition(hashchainData, position);
      setSearchResult(`${hash} (${searchToken} tokens)`);
      toast.success(`Found hash for token ${searchToken}`);
    } catch (error) {
      console.error('Error searching token:', error);
      toast.error('Failed to search token');
    }
  };

  const handleSearchHash = (searchHash: string) => {
    if (!hashchainData) {
      toast.error('Please generate a hashchain first');
      return;
    }

    if (!searchHash.startsWith('0x') || searchHash.length !== 66) {
      toast.error('Invalid hash format (must be 32-byte hex starting with 0x)');
      return;
    }

    try {
      const result = searchHashInHashchain(hashchainData, searchHash);
      if (result.found) {
        setSearchResult(`Position ${result.position}: ${searchHash} (${result.tokens} tokens)`);
        toast.success(`Found hash at position ${result.position}`);
      } else {
        setSearchResult('Hash not found in hashchain');
        toast.error('Hash not found in hashchain');
      }
    } catch (error) {
      console.error('Error searching hash:', error);
      toast.error('Failed to search hash');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand('copy');
          toast.success('Copied to clipboard!');
        } catch (err) {
          console.error('Fallback copy failed:', err);
          toast.error('Failed to copy to clipboard');
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border-2 border-gray-300 shadow-lg">
      <h3 className="text-xl font-bold text-gray-900 mb-4">🔗 Hashchain Generator</h3>
      <div className="mb-4 p-4 bg-blue-100 rounded-lg border border-blue-300">
        <p className="text-sm font-medium text-blue-900">
          <strong>Generate hashchain and display numbers</strong>
        </p>
      </div>

      <div className="space-y-4">
        {/* Input Section */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">Length</label>
            <input
              type="number"
              placeholder="100"
              value={hashchainForm.hashchainLength}
              onChange={e => setHashchainForm({ ...hashchainForm, hashchainLength: Number(e.target.value) })}
              className="w-full border-2 border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerateHashchain}
              className="w-full bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 transition-all"
              disabled={isLoading}
            >
              {isLoading ? '...' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Search Section */}
        {hashchainData && (
          <div className="mt-4 p-4 bg-purple-100 rounded-lg border-2 border-purple-400 shadow-md">
            <h4 className="font-bold mb-3 text-purple-900 text-lg">🔍 Search Hashchain</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">Token Number</label>
                <input
                  type="number"
                  placeholder={`1-${hashchainData ? hashchainData.length - 1 : '100'}`}
                  value={searchToken}
                  onChange={e => setSearchToken(Number(e.target.value))}
                  className="w-full border-2 border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSearchToken}
                  className="w-full bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-purple-700 transition-all"
                >
                  Search Token
                </button>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setSearchResult("")}
                  className="w-full bg-gray-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-gray-700 transition-all"
                >
                  Clear
                </button>
              </div>
            </div>
            {searchResult && (
              <div className="mt-2 p-2 bg-white rounded border">
                <span className="text-xs text-gray-900 font-mono break-all">{searchResult}</span>
              </div>
            )}
          </div>
        )}

        {/* Generated Trust Anchor */}
        {generatedTrustAnchor && (
          <div className="mt-4 p-4 bg-yellow-100 rounded-lg border-2 border-yellow-400 shadow-md">
            <h4 className="font-bold mb-3 text-yellow-900 text-lg">🔑 Generated Trust Anchor</h4>
            <div className="bg-white p-3 rounded border">
              <div className="flex items-center">
                <span className="text-gray-900 font-mono text-xs flex-1">{generatedTrustAnchor}</span>
                <button
                  onClick={() => copyToClipboard(generatedTrustAnchor)}
                  className="ml-2 text-yellow-600 hover:text-yellow-800 text-xs hover:scale-110 transition-transform"
                >
                  📋
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">Use this trust anchor in CreateChannel</p>
            </div>
          </div>
        )}

        {/* Hashchain Overview */}
        {hashchainData && (
          <div className="mt-6 p-4 bg-green-100 rounded-lg border-2 border-green-400 shadow-md">
            <h4 className="font-bold mb-3 text-green-900 text-lg">📊 Hashchain Numbers</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-gray-800">Initial Seed (Pos 1):</span>
                <div className="flex items-center mt-1">
                  <span className="text-gray-900 font-mono text-xs flex-1">{hashchainData.seed}</span>
                  <button
                    onClick={() => copyToClipboard(hashchainData.seed)}
                    className="ml-2 text-blue-600 hover:text-blue-800 text-xs hover:scale-110 transition-transform"
                  >
                    📋
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">{hashchainData.length - 1} tokens (100th payment)</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-gray-800">Trust Anchor (Pos {hashchainData.length}):</span>
                <div className="flex items-center mt-1">
                  <span className="text-gray-900 font-mono text-xs flex-1">{hashchainData.trustAnchor}</span>
                  <button
                    onClick={() => copyToClipboard(hashchainData.trustAnchor)}
                    className="ml-2 text-blue-600 hover:text-blue-800 text-xs hover:scale-110 transition-transform"
                  >
                    📋
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">0 tokens (trust anchor)</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-gray-800">First Token (1 token):</span>
                <div className="flex items-center mt-1">
                  <span className="text-gray-900 font-mono text-xs flex-1">{hashchainData.firstToken}</span>
                  <button
                    onClick={() => copyToClipboard(hashchainData.firstToken)}
                    className="ml-2 text-blue-600 hover:text-blue-800 text-xs hover:scale-110 transition-transform"
                  >
                    📋
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">Position {hashchainData.length - 1} (1st payment)</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <span className="font-bold text-gray-800">Total Tokens:</span>
                <span className="text-gray-900 font-bold text-lg">{hashchainData.length}</span>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>💡 Note:</strong> Position 1 = {hashchainData.length - 1} tokens (100th payment), Position {hashchainData.length - 1} = 1 token (1st payment), 
                Position {hashchainData.length} = 0 tokens (trust anchor). Search range: 1 to {hashchainData.length}.
              </p>
            </div>
          </div>
        )}

        {/* Quick Hash Lookup */}
        {hashchainData && (
          <div className="mt-4 p-4 bg-purple-100 rounded-lg border-2 border-purple-400 shadow-md">
            <h4 className="font-bold mb-3 text-purple-900 text-lg">⚡ Quick Hash Lookup</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {generateRandomTokens(hashchainData.length - 1, 7).map(tokenNumber => {
const position = getPositionForToken(tokenNumber, hashchainData.length);
const hash = hashchainData.fullChain?.[position - 1] ?? "Invalid position";
return (
<div key={tokenNumber} className="bg-white p-2 rounded border">
<div className="flex justify-between items-center mb-1">
<span className="font-bold text-gray-800">Token {tokenNumber}:</span>
<span className="text-gray-900 font-bold">{tokenNumber}t</span>
</div>
<div className="flex items-center">
<span className="text-gray-900 font-mono text-xs flex-1 truncate">{hash.substring(0, 12)}...</span>
<button
onClick={() => copyToClipboard(hash)}
className="ml-1 text-purple-600 hover:text-purple-800 text-xs hover:scale-110 transition-transform"
>
📋
</button>
</div>
</div>
);
})}
</div>
</div>
)}
</div>
</div>
);
}


