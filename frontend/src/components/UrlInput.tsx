import React, { useState, useEffect } from 'react';
import {
  Globe,
  Play,
  Sliders,
  ShieldCheck,
  Loader2,
  Clock,
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { CrawlRequest } from '../types';

interface UrlInputProps {
  onStartCrawl: (request: CrawlRequest) => void;
  isCrawling: boolean;
}

const STORAGE_KEY = 'webatlas_last_config';

export const UrlInput: React.FC<UrlInputProps> = ({ onStartCrawl, isCrawling }) => {
  const [url, setUrl] = useState<string>('');
  const [maxDepth, setMaxDepth] = useState<number>(2);
  const [maxPages, setMaxPages] = useState<number>(100);
  const [requestDelay, setRequestDelay] = useState<number>(0.25);
  const [timeout, setTimeoutVal] = useState<number>(10);
  const [respectRobotsTxt, setRespectRobotsTxt] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Restore non-sensitive configuration settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.maxDepth === 'number') setMaxDepth(parsed.maxDepth);
        if (typeof parsed.maxPages === 'number') setMaxPages(parsed.maxPages);
        if (typeof parsed.requestDelay === 'number') setRequestDelay(parsed.requestDelay);
        if (typeof parsed.timeout === 'number') setTimeoutVal(parsed.timeout);
        if (typeof parsed.respectRobotsTxt === 'boolean') setRespectRobotsTxt(parsed.respectRobotsTxt);
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  // Save non-sensitive settings to localStorage
  const saveSettingsToLocalStorage = (config: {
    maxDepth: number;
    maxPages: number;
    requestDelay: number;
    timeout: number;
    respectRobotsTxt: boolean;
  }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore localStorage write errors
    }
  };

  // Presets Handlers (ONLY populates form values, does NOT auto-submit)
  const applyPreset = (type: 'quick' | 'standard' | 'deep') => {
    if (isCrawling) return;
    if (type === 'quick') {
      setMaxDepth(1);
      setMaxPages(25);
      setRequestDelay(0.1);
      setTimeoutVal(5);
    } else if (type === 'standard') {
      setMaxDepth(2);
      setMaxPages(100);
      setRequestDelay(0.25);
      setTimeoutVal(10);
    } else if (type === 'deep') {
      setMaxDepth(3);
      setMaxPages(250);
      setRequestDelay(0.5);
      setTimeoutVal(15);
    }
  };

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    let trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setValidationError('Please enter a website URL to crawl.');
      return;
    }

    // Auto-prepend https:// if user omitted scheme
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      trimmedUrl = `https://${trimmedUrl}`;
      setUrl(trimmedUrl);
    }

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setValidationError('URL scheme must be http:// or https://');
        return;
      }
    } catch {
      setValidationError('Enter a valid HTTP or HTTPS URL (e.g. https://example.com)');
      return;
    }

    // Parameter Validations
    if (maxDepth < 0 || maxDepth > 10) {
      setValidationError('Max Depth must be between 0 and 10.');
      return;
    }

    if (maxPages <= 0 || maxPages > 2000) {
      setValidationError('Max Pages must be greater than 0.');
      return;
    }

    if (requestDelay < 0 || requestDelay > 5.0) {
      setValidationError('Delay cannot be negative.');
      return;
    }

    if (timeout < 1 || timeout > 60) {
      setValidationError('Timeout must be between 1s and 60s.');
      return;
    }

    saveSettingsToLocalStorage({
      maxDepth,
      maxPages,
      requestDelay,
      timeout,
      respectRobotsTxt,
    });

    onStartCrawl({
      url: trimmedUrl,
      max_depth: maxDepth,
      max_pages: maxPages,
      request_delay: requestDelay,
      respect_robots_txt: respectRobotsTxt,
      timeout: timeout,
    });
  };

  // Extract domain for configuration summary
  let targetDomain = 'target website';
  try {
    if (url.trim()) {
      const formatted = url.startsWith('http://') || url.startsWith('https://') ? url.trim() : `https://${url.trim()}`;
      targetDomain = new URL(formatted).hostname || 'target website';
    }
  } catch {
    targetDomain = 'target website';
  }

  const formattedDelayMs = Math.round(requestDelay * 1000);

  return (
    <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
            Explore Website Structure & Hierarchy
          </h2>
          <p className="text-[#526174] text-sm max-w-xl mx-auto">
            Enter any public website URL to recursively discover pages, extract internal links, analyze page HTTP statuses, and map site architecture.
          </p>
        </div>

        {/* Quick Presets Bar */}
        <div className="flex items-center justify-between gap-2 bg-[#EDF3F9] p-2 rounded-xl border border-[#CBD8E6] flex-wrap text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[#526174] px-1">
            <Sparkles className="w-4 h-4 text-[#2563EB]" />
            <span>Quick Configuration Presets:</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyPreset('quick')}
              disabled={isCrawling}
              className="px-3 py-1 bg-[#F5F8FC] hover:bg-[#E1EBF4] text-[#172033] border border-[#CBD8E6] rounded-lg font-medium transition-all shadow-xs active:scale-95 disabled:opacity-50"
              title="Populate Quick preset (Depth: 1, Pages: 25, Delay: 100ms)"
            >
              ⚡ Quick (Depth 1, 25 Pages)
            </button>

            <button
              type="button"
              onClick={() => applyPreset('standard')}
              disabled={isCrawling}
              className="px-3 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg font-medium transition-all shadow-xs active:scale-95 disabled:opacity-50"
              title="Populate Standard preset (Depth: 2, Pages: 100, Delay: 250ms)"
            >
              🎯 Standard (Depth 2, 100 Pages)
            </button>

            <button
              type="button"
              onClick={() => applyPreset('deep')}
              disabled={isCrawling}
              className="px-3 py-1 bg-[#F5F8FC] hover:bg-[#E1EBF4] text-[#172033] border border-[#CBD8E6] rounded-lg font-medium transition-all shadow-xs active:scale-95 disabled:opacity-50"
              title="Populate Deep preset (Depth: 3, Pages: 250, Delay: 500ms)"
            >
              🔍 Deep (Depth 3, 250 Pages)
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Main URL Input Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#718096]">
              <Globe className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={isCrawling}
              placeholder="https://example.com"
              className={`w-full pl-11 pr-38 py-3.5 bg-[#EDF3F9] border ${
                validationError
                  ? 'border-[#DC2626] focus:ring-[#DC2626]'
                  : 'border-[#BFCFE0] focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'
              } rounded-xl text-[#172033] placeholder-[#718096] focus:bg-[#F5F8FC] focus:outline-none font-mono text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-inner`}
            />
            <div className="absolute inset-y-1.5 right-1.5 flex items-center">
              <button
                type="submit"
                disabled={isCrawling}
                className={`px-5 py-2.5 font-bold text-sm rounded-lg flex items-center gap-2 transition-all shadow-sm ${
                  isCrawling
                    ? 'bg-blue-300 text-white cursor-not-allowed'
                    : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer hover:shadow active:scale-95'
                }`}
              >
                {isCrawling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Crawling...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Start Crawling</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation Error Banner */}
          {validationError && (
            <div className="flex items-center gap-2 text-[#DC2626] text-xs px-1 font-semibold animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Primary Configuration Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            
            {/* Control 1: Max Depth */}
            <div className="p-3.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl space-y-2 font-sans shadow-xs">
              <div className="flex items-center justify-between text-[#526174] text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                  <span>Max Depth</span>
                </div>
                <span className="font-mono text-[11px] text-[#718096]">d = {maxDepth}</span>
              </div>
              <select
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                disabled={isCrawling}
                className="w-full bg-[#EDF3F9] border border-[#BFCFE0] text-[#172033] rounded-lg px-3 py-2 focus:bg-[#F5F8FC] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-mono text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value={0}>Depth 0 (Root Starting Page Only)</option>
                <option value={1}>Depth 1 (Direct Homepage Links)</option>
                <option value={2}>Depth 2 (Standard Website Crawl)</option>
                <option value={3}>Depth 3 (Deep Architecture Mapping)</option>
                <option value={4}>Depth 4 (Extended Crawl)</option>
                <option value={5}>Depth 5 (Maximum Recursive Depth)</option>
              </select>
            </div>

            {/* Control 2: Request Delay */}
            <div className="p-3.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl space-y-2 font-sans shadow-xs">
              <div className="flex items-center justify-between text-[#526174] text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                  <span>Request Delay</span>
                </div>
                <span className="font-mono text-[11px] text-[#718096]">{formattedDelayMs} ms ({requestDelay}s)</span>
              </div>
              <select
                value={requestDelay}
                onChange={(e) => setRequestDelay(Number(e.target.value))}
                disabled={isCrawling}
                className="w-full bg-[#EDF3F9] border border-[#BFCFE0] text-[#172033] rounded-lg px-3 py-2 focus:bg-[#F5F8FC] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-mono text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value={0.0}>0 ms / 0.0s (Fast Fetching)</option>
                <option value={0.1}>100 ms / 0.1s (Normal Speed)</option>
                <option value={0.25}>250 ms / 0.25s (Polite Crawling)</option>
                <option value={0.5}>500 ms / 0.5s (Conservative)</option>
                <option value={1.0}>1000 ms / 1.0s (Slow Server Safety)</option>
              </select>
            </div>

          </div>

          {/* Advanced Options Collapse Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 transition-colors py-1 focus:outline-none"
            >
              {showAdvanced ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Hide Advanced Options</span>
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <span>Advanced Options ▸</span>
                </>
              )}
            </button>
          </div>

          {/* Collapsible Advanced Options Panel */}
          {showAdvanced && (
            <div className="p-4 bg-[#EDF3F9]/70 border border-[#CBD8E6] rounded-xl space-y-4 animate-fadeIn">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                
                {/* Advanced 1: Max Pages */}
                <div className="p-3 bg-[#F5F8FC] border border-[#CBD8E6] rounded-lg space-y-1.5 text-xs">
                  <span className="font-semibold text-[#526174] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" /> Max Pages Limit
                  </span>
                  <select
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    disabled={isCrawling}
                    className="w-full bg-[#EDF3F9] border border-[#BFCFE0] text-[#172033] rounded px-2.5 py-1.5 font-mono text-xs cursor-pointer disabled:opacity-60"
                  >
                    <option value={10}>10 Pages</option>
                    <option value={25}>25 Pages</option>
                    <option value={50}>50 Pages</option>
                    <option value={100}>100 Pages</option>
                    <option value={250}>250 Pages</option>
                    <option value={500}>500 Pages</option>
                    <option value={1000}>1000 Pages</option>
                  </select>
                </div>

                {/* Advanced 2: Request Timeout */}
                <div className="p-3 bg-[#F5F8FC] border border-[#CBD8E6] rounded-lg space-y-1.5 text-xs">
                  <span className="font-semibold text-[#526174] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#D97706]" /> Fetch Timeout
                  </span>
                  <select
                    value={timeout}
                    onChange={(e) => setTimeoutVal(Number(e.target.value))}
                    disabled={isCrawling}
                    className="w-full bg-[#EDF3F9] border border-[#BFCFE0] text-[#172033] rounded px-2.5 py-1.5 font-mono text-xs cursor-pointer disabled:opacity-60"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds (Default)</option>
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                  </select>
                </div>

                {/* Advanced 3: Robots.txt */}
                <div className="p-3 bg-[#F5F8FC] border border-[#CBD8E6] rounded-lg space-y-1.5 text-xs">
                  <span className="font-semibold text-[#526174] flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-[#6366F1]" /> Robots.txt Policy
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer py-1 text-xs text-[#172033] select-none">
                    <input
                      type="checkbox"
                      checked={respectRobotsTxt}
                      onChange={(e) => setRespectRobotsTxt(e.target.checked)}
                      disabled={isCrawling}
                      className="rounded border-[#BFCFE0] text-[#2563EB] focus:ring-[#2563EB] bg-[#EDF3F9] w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="font-mono text-xs font-semibold">Enforce Robots Rules</span>
                  </label>
                </div>

              </div>

              {/* Informational Read-Only Crawl Security Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#CBD8E6]/60 text-[11px] font-mono text-[#526174]">
                <div className="flex items-center gap-1.5 bg-[#F5F8FC] p-2 rounded border border-[#CBD8E6]">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                  <span>Scope: <strong>Same domain only</strong></span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#F5F8FC] p-2 rounded border border-[#CBD8E6]">
                  <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                  <span>User-Agent: <strong>WebAtlas/0.1.0</strong></span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#F5F8FC] p-2 rounded border border-[#CBD8E6]">
                  <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                  <span>Redirects: <strong>Follow internal</strong></span>
                </div>
              </div>

            </div>
          )}

          {/* Pre-Crawl Configuration Summary Preview Banner */}
          <div className="p-3 bg-[#DCE7F2]/60 border border-[#CBD8E6] rounded-xl text-xs font-mono text-[#172033] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-sans font-bold text-[#526174] flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-[#2563EB]" /> Crawl Summary:
              </span>
              <span className="px-2 py-0.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded">
                Target: {targetDomain}
              </span>
              <span className="px-2 py-0.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded">
                Depth: {maxDepth}
              </span>
              <span className="px-2 py-0.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded">
                Pages: {maxPages}
              </span>
              <span className="px-2 py-0.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded">
                Delay: {formattedDelayMs}ms
              </span>
              <span className="px-2 py-0.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded text-[#16A34A]">
                Robots: {respectRobotsTxt ? 'Enforced' : 'Off'}
              </span>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

