import React, { useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CrawlResponse, PageResponse } from '../types';
import { buildGraphFromCrawlResponse, SiteMapNodeData } from '../utils/siteMap';
import { PageNodeComponent } from './PageNodeComponent';
import { Network, Info, Maximize2, ZoomIn, ZoomOut, RotateCcw, Filter } from 'lucide-react';

interface SiteMapProps {
  crawlResult: CrawlResponse | null;
  selectedPageUrl?: string | null;
  onSelectPage: (page: PageResponse) => void;
  searchTerm?: string;
  statusFilter?: string;
  depthFilter?: string;
}

/** Toolbar controls for Zoom In, Zoom Out, Fit View, and Reset */
const SiteMapToolbarControls: React.FC = () => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  return (
    <div className="flex items-center gap-1 bg-[#F5F8FC]/95 backdrop-blur border border-[#CBD8E6] p-1 rounded-xl shadow-md z-10">
      <button
        onClick={() => fitView({ padding: 0.2, duration: 400 })}
        className="p-1.5 hover:bg-[#EDF3F9] text-[#172033] rounded-lg transition-all flex items-center gap-1 text-xs font-medium"
        title="Fit graph to view (Fit View)"
      >
        <Maximize2 className="w-3.5 h-3.5 text-[#2563EB]" />
        <span className="hidden sm:inline">Fit View</span>
      </button>

      <div className="w-[1px] h-4 bg-[#CBD8E6]" />

      <button
        onClick={() => zoomIn({ duration: 300 })}
        className="p-1.5 hover:bg-[#EDF3F9] text-[#172033] rounded-lg transition-all"
        title="Zoom In"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => zoomOut({ duration: 300 })}
        className="p-1.5 hover:bg-[#EDF3F9] text-[#172033] rounded-lg transition-all"
        title="Zoom Out"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => fitView({ duration: 400 })}
        className="p-1.5 hover:bg-[#EDF3F9] text-[#172033] rounded-lg transition-all"
        title="Reset Zoom"
      >
        <RotateCcw className="w-3.5 h-3.5 text-[#526174]" />
      </button>
    </div>
  );
};

export const SiteMapContent: React.FC<SiteMapProps> = ({
  crawlResult,
  selectedPageUrl,
  onSelectPage,
  searchTerm,
  statusFilter,
  depthFilter,
}) => {
  const nodeTypes = useMemo(() => ({ pageNode: PageNodeComponent }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Synchronize React Flow nodes & edges whenever crawlResult or filters change
  useEffect(() => {
    if (!crawlResult || !crawlResult.pages || crawlResult.pages.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: graphNodes, edges: graphEdges } = buildGraphFromCrawlResponse(crawlResult, {
      searchTerm,
      statusFilter,
      depthFilter,
    });

    // Mark selected node
    const updatedNodes = graphNodes.map((n) => {
      const data = n.data as unknown as SiteMapNodeData;
      const isSelected = selectedPageUrl ? (data.url === selectedPageUrl || data.normalizedUrl === selectedPageUrl) : false;
      return {
        ...n,
        selected: isSelected,
      };
    });

    setNodes(updatedNodes);
    setEdges(graphEdges);
  }, [crawlResult, selectedPageUrl, searchTerm, statusFilter, depthFilter, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const nodeData = node.data as unknown as SiteMapNodeData;
      if (nodeData && nodeData.page) {
        onSelectPage(nodeData.page);
      }
    },
    [onSelectPage]
  );

  // Empty state check based directly on crawlResult.pages data presence
  if (!crawlResult || !crawlResult.pages || crawlResult.pages.length === 0) {
    return (
      <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-12 text-center space-y-3 shadow-sm">
        <div className="inline-flex p-4 rounded-full bg-[#DBEAFE] border border-[#BFCFE0] text-[#2563EB]">
          <Network className="w-8 h-8" />
        </div>
        <h4 className="text-lg font-bold text-[#172033]">No site map available</h4>
        <p className="text-xs text-[#526174] max-w-md mx-auto">
          Run a crawl above to generate your website structure.
        </p>
      </div>
    );
  }

  const hasActiveFilters = !!(
    (searchTerm && searchTerm.trim() !== '') ||
    (statusFilter && statusFilter !== 'ALL') ||
    (depthFilter && depthFilter !== 'ALL')
  );

  return (
    <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl overflow-hidden shadow-sm flex flex-col">
      
      {/* Header Bar */}
      <div className="p-4 bg-[#DCE7F2] border-b border-[#CBD8E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#DBEAFE] text-[#2563EB] rounded-lg shadow-xs">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#172033]">
              Interactive Website Hierarchy Map
            </h3>
            <p className="text-xs text-[#526174]">
              Showing {nodes.length} nodes and {edges.length} parent-child links for {crawlResult.domain}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#172033] font-mono flex-wrap">
          {hasActiveFilters && (
            <span className="px-2.5 py-1 rounded bg-[#DBEAFE] text-[#2563EB] border border-[#BFCFE0] text-[11px] font-sans font-semibold flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#2563EB]" /> Filters Active
            </span>
          )}
          <span className="flex items-center gap-1.5 bg-[#F5F8FC] px-2.5 py-1 rounded border border-[#CBD8E6] shadow-sm truncate max-w-xs" title={crawlResult.starting_url}>
            <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" /> Root: {crawlResult.starting_url}
          </span>
        </div>
      </div>

      {/* React Flow Canvas Container */}
      <div className="w-full h-[550px] sm:h-[620px] bg-[#E3ECF5] relative">
        <ReactFlow
          key={crawlResult.starting_url || 'sitemap-flow'}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15}
          maxZoom={2.0}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#2563EB', strokeWidth: 2 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#94A3B8" />

          {/* Top-Right Controls Toolbar */}
          <div className="absolute top-3 right-3 z-10">
            <SiteMapToolbarControls />
          </div>

          <Controls showInteractive={false} className="!bg-[#F5F8FC] !border-[#CBD8E6] !text-[#172033] !rounded-xl shadow-sm !top-3 !left-3" />

          <MiniMap
            nodeColor={(n) => {
              const d = n.data as unknown as SiteMapNodeData;
              if (d?.isRoot) return '#2563EB';
              if (d?.crawlSuccess) return '#16A34A';
              return '#DC2626';
            }}
            maskColor="rgba(227, 236, 245, 0.85)"
            className="!bg-[#F5F8FC] !border-[#CBD8E6] !rounded-xl overflow-hidden shadow-sm"
          />

          {/* Graph Legend Overlay */}
          <div className="absolute bottom-3 left-3 bg-[#F5F8FC]/95 backdrop-blur border border-[#CBD8E6] rounded-xl p-2.5 shadow-md z-10 text-[11px] font-sans space-y-1.5 max-w-xs">
            <div className="font-bold text-[#172033] border-b border-[#CBD8E6] pb-1 flex items-center justify-between">
              <span>Site Map Legend</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 font-mono text-[10px] text-[#334155]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-2 ring-[#DBEAFE]" />
                <span>Root</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                <span>2xx Success</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                <span>3xx Redirect</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
                <span>4xx Client</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" />
                <span>5xx Server</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] border border-[#FCA5A5]" />
                <span>Crawl Err</span>
              </div>
            </div>
            <div className="text-[9.5px] text-[#718096] font-mono pt-0.5 border-t border-[#CBD8E6]/60">
              Depth = crawl distance from root
            </div>
          </div>
        </ReactFlow>
      </div>

      {/* Footer Helper */}
      <div className="px-4 py-2.5 bg-[#DCE7F2] border-t border-[#CBD8E6] text-[11px] text-[#526174] flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-sans">
          <Info className="w-3.5 h-3.5 text-[#2563EB]" />
          Click any page node to inspect detailed metadata, parent links, and internal/external references.
        </span>
        <span className="font-mono text-[#718096]">React Flow Layout</span>
      </div>

    </div>
  );
};

export const SiteMap: React.FC<SiteMapProps> = (props) => {
  return (
    <ReactFlowProvider>
      <SiteMapContent {...props} />
    </ReactFlowProvider>
  );
};

