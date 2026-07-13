import React from 'react';
import { Coffee, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  activeTab: 'order' | 'admin';
  setActiveTab: (tab: 'order' | 'admin') => void;
  isAdminAuthorized: boolean;
  onOpenAdminPin: () => void;
  onLockAdmin: () => void;
  loading?: boolean;
}

export default function Header({ 
  activeTab, 
  setActiveTab, 
  isAdminAuthorized, 
  onOpenAdminPin, 
  onLockAdmin, 
  loading 
}: HeaderProps) {
  return (
    <header className="bg-[#FDFCFB] text-[#1A1A1A] py-8 px-6 md:px-12 border-b border-[#EBE5DF] transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-4">
          <div className="bg-[#006241] text-white p-3.5 rounded-none shadow-sm flex items-center justify-center">
            <Coffee className="w-7 h-7 stroke-[2]" id="brand-logo" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tighter leading-none text-[#1A1A1A]">
                欣巴克咖啡<span className="text-[#006241]">.</span>
              </h1>
              {loading && (
                <span className="inline-block w-2.5 h-2.5 border-2 border-t-transparent border-[#006241] rounded-full animate-spin"></span>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] mt-1.5 opacity-60 font-mono">
              手作咖啡智能点单系统 V2.0 • 实时云端同步
            </p>
          </div>
        </div>

        {/* View Toggle System - Hidden or password locked to prevent customer intrusion */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          
          {isAdminAuthorized ? (
            <div className="flex border border-[#EBE5DF] p-1.5 bg-[#F5F2EF] rounded-none shadow-xs self-start md:self-auto w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('order')}
                className={`flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer rounded-none flex items-center justify-center gap-2 ${
                  activeTab === 'order' 
                    ? 'bg-[#1A1A1A] text-white' 
                    : 'text-[#1A1A1A] hover:bg-white/50'
                }`}
              >
                <span>☕ 咖啡点单POS</span>
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer rounded-none flex items-center justify-center gap-2 ${
                  activeTab === 'admin' 
                    ? 'bg-[#1A1A1A] text-white' 
                    : 'text-[#1A1A1A] hover:bg-white/50'
                }`}
              >
                <span>📊 商家管理后台</span>
              </button>
              <button
                onClick={onLockAdmin}
                title="退出登录并锁定后台"
                className="px-3 py-1.5 text-slate-500 hover:text-red-600 transition-colors cursor-pointer border-l border-[#EBE5DF] ml-1 text-xs font-bold"
              >
                🔒 锁屏
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="text-[10px] text-slate-500 font-sans uppercase tracking-wider hidden lg:flex items-center gap-1.5 bg-[#F5F2EF] px-3 py-1.5 border border-[#EBE5DF]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#006241]" />
                云端数据已同步
              </div>
              <button
                onClick={onOpenAdminPin}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-[#1A1A1A] bg-[#F5F2EF] border border-[#EBE5DF] hover:border-[#1A1A1A] transition-all cursor-pointer flex items-center gap-1.5 rounded-none"
              >
                <span>🔑 商家安全通道</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
