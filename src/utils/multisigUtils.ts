// Multisig Contract Configuration
export const MULTISIG_CONTRACT_ADDRESS = "0xd57A97f616bbDFCF4D854a24552AEeD818fDBEf7";

// Target chain: Filecoin Calibration Testnet
export const MULTISIG_TARGET_CHAIN = {
  chainId: 314159,
  chainName: "Filecoin Calibration Testnet",
};

// Utility functions for Multisig payment channels
export class MultisigUtils {
  /**
   * Get the current timestamp in seconds
   */
  static getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Format a timestamp to human-readable date
   */
  static formatTimestamp(timestamp: string | number): string {
    const date = new Date(parseInt(timestamp.toString()) * 1000);
    return date.toLocaleString();
  }

  /**
   * Check if a channel has expired
   */
  static isExpired(expiration: string | number): boolean {
    return this.getCurrentTimestamp() > parseInt(expiration.toString());
  }

  /**
   * Check if a channel can be reclaimed
   */
  static canReclaim(reclaimAfter: string | number): boolean {
    return this.getCurrentTimestamp() > parseInt(reclaimAfter.toString());
  }

  /**
   * Get time remaining until a timestamp
   */
  static getTimeRemaining(timestamp: string | number): string {
    const remaining = parseInt(timestamp.toString()) - this.getCurrentTimestamp();
    if (remaining <= 0) return "Expired";
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  /**
   * Validate channel parameters
   */
  static validateChannelParams(params: {
    payee?: string;
    payer?: string;
    tokenAddress?: string;
    amount?: string;
    duration?: string;
    reclaimDelay?: string;
    nonce?: string;
    signature?: string;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate addresses
    if (params.payee && !this.isValidAddress(params.payee)) {
      errors.push("Invalid payee address");
    }
    if (params.payer && !this.isValidAddress(params.payer)) {
      errors.push("Invalid payer address");
    }
    if (params.tokenAddress && !this.isValidAddress(params.tokenAddress)) {
      errors.push("Invalid token address");
    }

    // Validate amounts
    if (params.amount) {
      const amount = parseFloat(params.amount);
      if (isNaN(amount) || amount <= 0) {
        errors.push("Amount must be a positive number");
      }
    }

    // Validate duration and reclaim delay
    if (params.duration) {
      const duration = parseInt(params.duration);
      if (isNaN(duration) || duration <= 0) {
        errors.push("Duration must be a positive integer");
      }
    }

    if (params.reclaimDelay) {
      const reclaimDelay = parseInt(params.reclaimDelay);
      if (isNaN(reclaimDelay) || reclaimDelay <= 0) {
        errors.push("Reclaim delay must be a positive integer");
      }
    }

    // Validate that reclaim delay > duration
    if (params.duration && params.reclaimDelay) {
      const duration = parseInt(params.duration);
      const reclaimDelay = parseInt(params.reclaimDelay);
      if (reclaimDelay <= duration) {
        errors.push("Reclaim delay must be greater than duration");
      }
    }

    // Validate nonce
    if (params.nonce) {
      const nonce = parseInt(params.nonce);
      if (isNaN(nonce) || nonce <= 0) {
        errors.push("Nonce must be a positive integer");
      }
    }

    // Validate signature
    if (params.signature) {
      if (!this.isValidSignature(params.signature)) {
        errors.push("Invalid signature format");
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if an address is valid
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Check if a signature is valid (basic format check)
   */
  static isValidSignature(signature: string): boolean {
    return /^0x[a-fA-F0-9]{130}$/.test(signature);
  }

  /**
   * Get token display name
   */
  static getTokenDisplayName(tokenAddress: string): string {
    return tokenAddress === "0x0000000000000000000000000000000000000000" ? "FIL" : "tokens";
  }

  /**
   * Format amount with token name
   */
  static formatAmount(amount: string, tokenAddress: string): string {
    const tokenName = this.getTokenDisplayName(tokenAddress);
    return `${amount} ${tokenName}`;
  }
} 