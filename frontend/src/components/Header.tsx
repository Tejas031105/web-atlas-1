import React, { useState, useEffect } from 'react';
import { Network } from 'lucide-react';
import { checkHealth } from '../services/crawlService';

export const Header: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyBackendStatus = async () => {
      const healthy = await checkHealth();
      setIsOnline(healthy);
    };

    verifyBackendStatus();
    // Periodically verify API health status every 30 seconds
    const interval = setInterval(verifyBackendStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#F5F8FC] border-b border-[#CBD8E6] shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#2563EB] text-white rounded-xl shadow-sm">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#172033]">
                  WebAtlas
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-[#DBEAFE] text-[#2563EB] border border-[#BFCFE0] rounded-full">
                  v0.1.0
                </span>
              </div>
              <p className="text-xs text-[#526174] hidden sm:block font-medium">
                Intelligent Website Crawler & Site Mapper
              </p>
            </div>
          </div>

          {/* Backend API Status Badge */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-[#EDF7F1] border border-[#BBE5C8] shadow-xs rounded-xl flex items-center gap-2 text-xs font-medium text-[#172033]">
              <span className="text-[#526174] hidden xs:inline">Backend API:</span>
              {isOnline === null ? (
                <span className="flex items-center gap-1.5 text-[#D97706] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#D97706] animate-ping" /> Checking...
                </span>
              ) : isOnline ? (
                <span className="flex items-center gap-1.5 text-[#16A34A] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[#DC2626] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#DC2626]" /> Offline
                </span>
              )}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
