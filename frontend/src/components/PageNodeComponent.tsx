import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Home, FileText, CheckCircle, AlertCircle, XCircle, ArrowUpRight, Clock, Zap } from 'lucide-react';
import { SiteMapNodeData } from '../utils/siteMap';

export const PageNodeComponent: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as SiteMapNodeData;
  const {
    title,
    url,
    statusCode,
    depth,
    isRoot,
    crawlSuccess,
    responseTime,
    parentUrl,
    internalLinksCount,
    externalLinksCount,
    isDimmed,
    isMatched,
    errorMessage,
  } = nodeData;

  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Format display path (e.g. example.com or /products)
  let displayPath = url;
  try {
    const parsed = new URL(url);
    if (isRoot) {
      displayPath = parsed.hostname + (parsed.pathname === '/' ? '' : parsed.pathname);
    } else {
      displayPath = parsed.pathname === '/' ? '/' : parsed.pathname;
    }
  } catch {
    displayPath = url;
  }

  // Format response time (e.g. 142 ms or 1.45 s)
  const formatResponseTime = (sec: number) => {
    if (!sec || sec <= 0) return null;
    if (sec < 1) {
      return `${Math.round(sec * 1000)} ms`;
    }
    return `${sec.toFixed(2)} s`;
  };

  const formattedTime = formatResponseTime(responseTime);

  const getStatusBadge = () => {
    if (!statusCode || !crawlSuccess) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]">
          <Zap className="w-2.5 h-2.5" /> ERR
        </span>
      );
    }
    if (statusCode >= 200 && statusCode < 300) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#DCFCE7] text-[#16A34A] border border-[#BBE5C8]">
          <CheckCircle className="w-2.5 h-2.5" /> {statusCode}
        </span>
      );
    }
    if (statusCode >= 300 && statusCode < 400) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
          <ArrowUpRight className="w-2.5 h-2.5" /> {statusCode}
        </span>
      );
    }
    if (statusCode >= 400 && statusCode < 500) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]">
          <AlertCircle className="w-2.5 h-2.5" /> {statusCode}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F3E8FF] text-[#7C3AED] border border-[#D8B4FE]">
        <XCircle className="w-2.5 h-2.5" /> {statusCode}
      </span>
    );
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-[260px] rounded-xl border p-3.5 transition-all font-sans text-xs select-none ${
        isDimmed
          ? 'opacity-35 hover:opacity-100 bg-[#F5F8FC] border-[#CBD8E6]'
          : selected
          ? 'ring-2 ring-[#2563EB] border-[#2563EB] bg-[#EFF6FF] shadow-lg scale-[1.02] z-20'
          : isMatched && !isRoot
          ? 'ring-2 ring-[#3B82F6]/50 border-[#2563EB] bg-[#F0F7FF] shadow-md z-10'
          : isRoot
          ? 'bg-[#F0F7FF] border-2 border-[#2563EB] shadow-md z-10'
          : crawlSuccess
          ? 'bg-[#F5F8FC] border-[#CBD8E6] hover:border-[#2563EB] hover:shadow-md'
          : 'bg-[#FEE2E2]/60 border-[#FCA5A5] hover:border-[#DC2626] hover:shadow-md'
      }`}
    >
      {/* Connection Target Handle (Top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#2563EB] !w-2.5 !h-2.5 !border-2 !border-[#F5F8FC]"
      />

      <div className="space-y-2">
        {/* Top Bar: Root Tag or Icon & Status / Depth */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate">
            {isRoot ? (
              <span className="px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase bg-[#DBEAFE] text-[#2563EB] border border-[#BFCFE0] rounded-md flex items-center gap-1 shadow-xs">
                <Home className="w-3 h-3 text-[#2563EB]" /> 🏠 ROOT
              </span>
            ) : (
              <div className="p-1 bg-[#EDF3F9] text-[#526174] rounded">
                <FileText className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {getStatusBadge()}
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#526174] bg-[#EDF3F9] border border-[#CBD8E6] font-semibold">
              Depth: {depth}
            </span>
          </div>
        </div>

        {/* Middle Section: Title & URL & SEO Keyword Badge */}
        <div>
          <h4
            className="font-bold text-[#172033] truncate text-xs leading-snug"
            title={title || 'Untitled Page'}
          >
            {title || <span className="text-[#718096] italic font-normal">(No Title)</span>}
          </h4>
          <p
            className="font-mono text-[11px] text-[#526174] truncate mt-0.5"
            title={url}
          >
            {displayPath}
          </p>

          {nodeData.primaryKeyword && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
              <span className="px-1.5 py-0.5 bg-[#DBEAFE] text-[#2563EB] rounded text-[9.5px] font-semibold truncate max-w-[170px]" title={`Primary KW: ${nodeData.primaryKeyword}`}>
                🔑 {nodeData.primaryKeyword}
              </span>
              {nodeData.clusterId && (
                <span className="px-1 py-0.5 bg-[#E2E8F0] text-[#475569] rounded text-[9px] font-mono" title={`Cluster: ${nodeData.clusterName || nodeData.clusterId}`}>
                  {nodeData.clusterId}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom Section: Response Time & Meta */}
        <div className="pt-1 border-t border-[#CBD8E6]/50 flex items-center justify-between text-[10px] text-[#526174] font-mono">
          <div className="flex items-center gap-1">
            {formattedTime ? (
              <span className="flex items-center gap-1 text-[#2563EB] font-semibold">
                <Clock className="w-2.5 h-2.5 text-[#2563EB]" /> {formattedTime}
              </span>
            ) : (
              <span className="text-[#718096]">n/a</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-sans">
            <span title="Internal links" className="text-[#6366F1] font-semibold">
              {internalLinksCount} int
            </span>
            <span title="External links" className="text-[#0891B2] font-semibold">
              {externalLinksCount} ext
            </span>
          </div>
        </div>
      </div>

      {/* Connection Source Handle (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#2563EB] !w-2.5 !h-2.5 !border-2 !border-[#F5F8FC]"
      />

      {/* Hover Tooltip Popup Card */}
      {isHovered && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#172033] text-white rounded-xl shadow-xl z-50 text-[11px] space-y-1.5 pointer-events-none animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-700 pb-1">
            <span className="font-bold truncate text-[#93C5FD]">
              {isRoot ? '🏠 Root Page' : title || 'Untitled Page'}
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
              Depth {depth}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">URL:</span>
            <p className="font-mono text-[10px] text-gray-200 break-all leading-tight">{url}</p>
          </div>
          {parentUrl && (
            <div>
              <span className="text-gray-400 block text-[10px]">Parent:</span>
              <p className="font-mono text-[10px] text-gray-300 truncate">{parentUrl}</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-gray-700 text-[10px] font-mono">
            <span>Status: {statusCode || 'Error'}</span>
            <span>Resp: {formattedTime || 'N/A'}</span>
          </div>
          {errorMessage && (
            <p className="text-[#FCA5A5] text-[10px] italic font-sans">{errorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
});

