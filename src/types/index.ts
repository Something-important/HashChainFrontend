export interface ChannelEvent {
  channelId: string;
  action: 'create' | 'redeem' | 'reclaim';
  amount: string;
  timestamp: number;
  status?: string;
  recipient?: string;
  metadata?: any;
}

export interface ChannelDetails {
  id: string;
  recipient: string;
  amount: string;
  status: string;
  created: string;
  remaining?: string;
  totalAmount?: string;
  claimedAmount?: string;
  availableAmount?: string;
  usedAmount?: string;
  reclaimableAmount?: string;
  expiryDate?: string;
  rawAvailable?: number;
  rawReclaimed?: number;
}

export interface ChannelStatus {
  active: number;
  redeemed: number;
  reclaimed: number;
}

export interface DashboardStats {
  totalChannels: number;
  activeChannels: number;
  totalValue: string;
  pendingAmount: string;
  statusCounts: ChannelStatus;
}

export interface SearchFilters {
  status?: 'active' | 'redeemed' | 'reclaimed' | 'all';
  recipient?: string;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
} 