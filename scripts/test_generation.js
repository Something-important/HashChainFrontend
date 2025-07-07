const { keccak256 } = require('viem');

// Test the hashchain generation logic
console.log("🔗 Testing Hashchain Generation");
console.log("================================");

// Generate a simple hashchain with length 100
const seed = "0x2d49409030599b72ecab1b49404c288fb5e74ef8a35f515b3e6f1bdf05c0fa5c";
console.log(`Seed: ${seed}`);

let currentValue = seed;
const nodes = [];

// Generate hashchain
for (let i = 0; i < 100; i++) {
  nodes.push(currentValue);
  if (i < 99) { // Don't hash the last time
    currentValue = keccak256(currentValue);
  }
}

console.log(`Generated ${nodes.length} nodes`);
console.log(`Position 1 (seed): ${nodes[0]}`);
console.log(`Position 50: ${nodes[49]}`);
console.log(`Position 100 (trust anchor): ${nodes[99]}`);

// Now test verification from position 50 to trust anchor
console.log("\n🔍 Testing Verification");
console.log("======================");
const testHash = nodes[49]; // Position 50
const trustAnchor = nodes[99]; // Position 100

console.log(`Test Hash (Pos 50): ${testHash}`);
console.log(`Trust Anchor (Pos 100): ${trustAnchor}`);

// Hash from position 50 to position 100
let current = testHash;
for (let i = 1; i <= 50; i++) {
  current = keccak256(current);
  console.log(`Step ${i}: ${current}`);
  
  if (current === trustAnchor) {
    console.log(`✅ SUCCESS! Trust anchor found after ${i} hashes`);
    break;
  }
  
  if (i === 50) {
    console.log("❌ Trust anchor not found after 50 hashes");
  }
} 