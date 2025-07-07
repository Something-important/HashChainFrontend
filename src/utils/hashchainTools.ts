import { keccak256 } from 'viem';
import { hashchain, generateSeed } from '@hashchain/sdk';

export interface HashchainData {
  seed: string;
  trustAnchor: string;
  firstToken: string; // Position n-1 (1 token)
  length: number;
  nodes: string[];
  fullChain: string[];
}

// Generate a hashchain with the specified length using SDK
export const generateHashchain = (length: number, seed?: string): HashchainData => {
  if (length <= 0) {
    throw new Error('Hashchain length must be greater than 0');
  }

  // Generate random seed if not provided using SDK
  if (!seed) {
    seed = generateSeed();
  }

  // Use SDK to generate hashchain
  const hashes = hashchain(seed, length);
  
  // Calculate first token (position length-1)
  const firstToken = hashes[hashes.length - 2]; // Second to last position

  return {
    seed,
    trustAnchor: hashes[hashes.length - 1], // Last node is the trust anchor (0% payment)
    firstToken, // First token (1 token)
    length: hashes.length,
    nodes: hashes,
    fullChain: hashes
  };
};

// Get hash by position (1-based indexing)
export const getHashByPosition = (hashchain: HashchainData, position: number): string => {
  if (position < 1 || position > hashchain.length) {
    throw new Error(`Position must be between 1 and ${hashchain.length}`);
  }
  
  return hashchain.fullChain[position - 1];
};

// Get tokens for a specific position
export const getTokensForPosition = (position: number, totalLength: number): number => {
  if (position < 1 || position > totalLength) {
    throw new Error(`Position must be between 1 and ${totalLength}`);
  }
  
  // Position 1 = 100 tokens (100th payment)
  // Position 100 = 1 token (1st payment)
  // Position 101 = 0 tokens (trust anchor)
  if (position === totalLength) {
    return 0; // Trust anchor has 0 tokens
  }
  return totalLength - position; // Inverted: Position 1 = max tokens, Position 100 = 1 token
};

// Get position for a specific token number
export const getPositionForToken = (tokenNumber: number, totalLength: number): number => {
  if (tokenNumber < 1 || tokenNumber > totalLength - 1) {
    throw new Error(`Token number must be between 1 and ${totalLength - 1}`);
  }
  
  // Token 1 = Position 100
  // Token 100 = Position 1
  return totalLength - tokenNumber;
};

// Search for a hash in the hashchain
export const searchHashInHashchain = (hashchain: HashchainData, searchHash: string): { found: boolean; position?: number; tokens?: number } => {
  const position = hashchain.fullChain.indexOf(searchHash);
  
  if (position === -1) {
    return { found: false };
  }
  
  const actualPosition = position + 1; // Convert to 1-based indexing
  const tokens = getTokensForPosition(actualPosition, hashchain.length);
  
  return {
    found: true,
    position: actualPosition,
    tokens
  };
};

// Verify a hashchain by checking if the trust anchor can be derived from the test hash
export const verifyHashchain = (testHash: string, trustAnchor: string, numberOfHashes: number): boolean => {
  let currentValue = testHash;
  
  // Hash the test hash numberOfHashes times to see if we get to the trust anchor
  for (let i = 0; i < numberOfHashes; i++) {
    currentValue = keccak256(currentValue as `0x${string}`);
  }
  
  return currentValue === trustAnchor;
};

// Calculate the number of hashes needed to go from a test hash to the trust anchor
export const calculateHashesNeeded = (testHash: string, trustAnchor: string, maxHashes: number = 1000): number | null => {
  let currentValue = testHash;
  
  // Try hashing up to maxHashes times to find the trust anchor
  for (let i = 0; i < maxHashes; i++) {
    currentValue = keccak256(currentValue as `0x${string}`);
    if (currentValue === trustAnchor) {
      return i + 1; // Return the number of hashes needed
    }
  }
  
  return null; // Trust anchor not found within maxHashes
};

// Generate a random seed for hashchain creation using SDK
export const generateRandomSeed = (): string => {
  return generateSeed();
};

// Validate hashchain parameters
export const validateHashchainParams = (length: number, seed?: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (length <= 0) {
    errors.push('Length must be greater than 0');
  }
  
  if (length > 10000) {
    errors.push('Length must be less than or equal to 10000');
  }
  
  if (seed && !seed.startsWith('0x')) {
    errors.push('Seed must start with 0x');
  }
  
  if (seed && seed.length !== 66) {
    errors.push('Seed must be 32 bytes (0x + 64 hex characters)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}; 