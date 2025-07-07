"use client";
import React, { useState } from "react";
import { CreateMultisigChannel } from "./multisig/CreateMultisigChannel";
import { RedeemMultisigChannel } from "./multisig/RedeemMultisigChannel";
import { ReclaimMultisigChannel } from "./multisig/ReclaimMultisigChannel";
import { MultisigChannelInspector } from "./multisig/MultisigChannelInspector";
import { MultisigTools } from "./multisig/MultisigTools";
import CreateChannelPermit from "./multisig/CreateChannelPermit";

export function MultisigPay() {
  const [activeTab, setActiveTab] = useState("create");
  const [isLoading, setIsLoading] = useState(false);

  const tabs = [
    { id: "create", label: "Create Channel", icon: "🔧" },
    { id: "redeem", label: "Redeem Payment", icon: "💰" },
    { id: "reclaim", label: "Reclaim Funds", icon: "↩️" },
    { id: "inspect", label: "Channel Inspector", icon: "🔍" },
    { id: "tools", label: "Multisig Tools", icon: "🛠️" },
    { id: "test", label: "Create with Permit", icon: "🔐" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "create":
        return <CreateMultisigChannel isLoading={isLoading} setIsLoading={setIsLoading} />;
      case "redeem":
        return <RedeemMultisigChannel isLoading={isLoading} setIsLoading={setIsLoading} />;
      case "reclaim":
        return <ReclaimMultisigChannel isLoading={isLoading} setIsLoading={setIsLoading} />;
      case "inspect":
        return <MultisigChannelInspector isLoading={isLoading} setIsLoading={setIsLoading} />;
      case "tools":
        return <MultisigTools isLoading={isLoading} setIsLoading={setIsLoading} />;
      case "test":
        return <CreateChannelPermit onChannelCreated={(channelId) => {
          console.log('Channel created:', channelId);
        }} />;
      default:
        return <CreateMultisigChannel isLoading={isLoading} setIsLoading={setIsLoading} />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ease-in-out ${
              activeTab === tab.id
                ? "bg-purple-600 text-white shadow-lg transform scale-105"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-102"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Processing transaction...</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="min-h-[600px] transition-all duration-300 ease-in-out">
        <div className="animate-fadeIn">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
} 