import { createPublicClient, http } from 'viem';
import { filecoinCalibration } from 'viem/chains';

// Create public client for Filecoin Calibration testnet
export const publicClient = createPublicClient({
  chain: filecoinCalibration,
  transport: http('https://api.calibration.node.glif.io/rpc/v1'),
}); 