import { useState } from 'react';
import { useAccount } from 'wagmi';
import {
  CreateChannel,
  RedeemChannel,
  ReclaimChannel,
  VerifyHashchain,
  ChannelInspector,
  HashchainTools
} from './HashChain/index';

export function HashChain() {
  const [activeTab, setActiveTab] = useState<'create' | 'redeem' | 'reclaim' | 'verify' | 'inspect' | 'hashchain'>('create');
  const [isLoading, setIsLoading] = useState(false);

  const { address: userAddress } = useAccount();

  const tabs = [
    { id: 'create', label: 'Create Channel', icon: '➕' },
    { id: 'redeem', label: 'Redeem Channel', icon: '💰' },
    { id: 'reclaim', label: 'Reclaim Channel', icon: '⏪' },
    { id: 'verify', label: 'Verify Hashchain', icon: '🔍' },
    { id: 'inspect', label: 'Channel Inspector', icon: '📊' },
    { id: 'hashchain', label: 'Hashchain Tools', icon: '🔗' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ease-in-out ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-lg transform scale-105"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-102"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px] transition-all duration-300 ease-in-out">
        {activeTab === 'create' && (
          <div className="animate-fadeIn">
            <CreateChannel isLoading={isLoading} setIsLoading={setIsLoading} />
          </div>
        )}
        {activeTab === 'redeem' && (
          <div className="animate-fadeIn">
            <RedeemChannel isLoading={isLoading} setIsLoading={setIsLoading} />
          </div>
        )}
        {activeTab === 'reclaim' && (
          <div className="animate-fadeIn">
            <ReclaimChannel isLoading={isLoading} setIsLoading={setIsLoading} />
          </div>
        )}
        {activeTab === 'verify' && (
          <div className="animate-fadeIn">
            <VerifyHashchain isLoading={isLoading} setIsLoading={setIsLoading} />
          </div>
        )}
        {activeTab === 'inspect' && (
          <div className="animate-fadeIn">
            <ChannelInspector isLoading={isLoading} setIsLoading={setIsLoading} />
          </div>
        )}
        {activeTab === 'hashchain' && (
          <div className="animate-fadeIn">
            <HashchainTools isLoading={isLoading} setIsLoading={setIsLoading} />
          </div>
        )}
      </div>
    </div>
  );
} 