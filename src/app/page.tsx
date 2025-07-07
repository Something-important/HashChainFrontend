"use client";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import React, { useState } from 'react';
import { HashChain } from '../components/HashChain';
import { MultisigPay } from '../components/MultisigPay';

export default function Home() {
  const [activePaymentType, setActivePaymentType] = useState<'hashpay' | 'multisig'>('hashpay');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {/* Logo removed - favicon doesn't display well as image */}
              <div>
                <h1 className="text-xl font-bold text-gray-800">Hashchain Protocol</h1>
                <p className="text-sm text-gray-600">Fast, Fair, and Scalable – One Hash at a Time</p>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Payment Type Selector */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActivePaymentType('hashpay')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activePaymentType === 'hashpay'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔗 MuPay Channels
            </button>
            <button
              onClick={() => setActivePaymentType('multisig')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activePaymentType === 'multisig'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔐 Multisig Channels
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activePaymentType === 'hashpay' ? <HashChain /> : <MultisigPay />}
      </main>

      {/* Footer */}
      <footer className="bg-white/40 backdrop-blur-sm border-t border-white/20 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} Hashchain Protocol - Powered by Filecoin
          </div>
        </div>
      </footer>
    </div>
  );
}
