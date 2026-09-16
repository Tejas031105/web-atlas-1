import React, { useState, useMemo } from 'react';
import { ClusterSummaryResponse, ClusterDetail, PageResponse } from '../types';
import { Layers, Tag, FileText, Hash, Search, X, FolderTree, Sparkles } from 'lucide-react';

interface SEOClustersOverviewProps {
  clustersData: ClusterSummaryResponse | null;
  pages: PageResponse[];
  onSelectPage?: (page: PageResponse) => void;
  loading?: boolean;
}

export const SEOClustersOverview: React.FC<SEOClustersOverviewProps> = ({
  clustersData,
  pages,
  onSelectPage,
  loading = false,
}) => {
  const [selectedCluster, setSelectedCluster] = useState<ClusterDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Collect primary keywords stats across all pages
  const primaryKeywordsSummary = useMemo(() => {
    if (!pages || pages.length === 0) return [];
    const counts: Record<string, number> = {};
    pages.forEach((p) => {
      if (p.primary_keyword) {
        counts[p.primary_keyword] = (counts[p.primary_keyword] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([kw, count]) => ({ keyword: kw, count }))
      .sort((a, b) => b.count - a.count);
  }, [pages]);

  const filteredClusters = useMemo(() => {
    if (!clustersData || !clustersData.clusters) return [];
    if (!searchTerm.trim()) return clustersData.clusters;

    const term = searchTerm.toLowerCase().trim();
    return clustersData.clusters.filter(
      (c) =>
        c.cluster_name.toLowerCase().includes(term) ||
        c.cluster_primary_topic.toLowerCase().includes(term) ||
        c.keywords.some((k) => k.toLowerCase().includes(term))
    );
  }, [clustersData, searchTerm]);

  if (loading) {
    return (
      <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-8 text-center animate-pulse shadow-sm">
        <div className="w-10 h-10 bg-[#CBD8E6] rounded-full mx-auto mb-3" />
        <div className="h-4 bg-[#CBD8E6] w-48 mx-auto mb-2 rounded" />
        <div className="h-3 bg-[#CBD8E6] w-64 mx-auto rounded" />
      </div>
    );
  }

  if (!clustersData || !clustersData.clusters || clustersData.clusters.length === 0) {
    return (
      <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-8 text-center space-y-3 shadow-sm">
        <div className="inline-flex p-3 rounded-xl bg-[#DBEAFE] text-[#2563EB]">
          <Layers className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-[#172033]">No SEO Clusters Analyzed</h4>
        <p className="text-xs text-[#526174] max-w-md mx-auto">
          Crawl a website to automatically map keywords and generate semantic topic clusters.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl overflow-hidden shadow-sm space-y-0">
      
      {/* Top Section Header */}
      <div className="p-5 bg-[#DCE7F2] border-b border-[#CBD8E6] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#DBEAFE] text-[#2563EB] rounded-xl shadow-xs">
            <FolderTree className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-[#172033]">SEO Keyword & Topic Clusters</h3>
              <span className="px-2 py-0.5 bg-[#2563EB] text-white text-[11px] font-semibold rounded-full flex items-center gap-1 font-mono">
                <Sparkles className="w-3 h-3" /> NLP Powered
              </span>
            </div>
            <p className="text-xs text-[#526174] mt-0.5">
              Deterministic keyword mapping & semantic page clustering for {clustersData.domain}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search keywords or clusters..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-[#172033]"
          />
        </div>
      </div>

      <div className="p-6 space-y-6">
        
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#EBF3FA] border border-[#CBD8E6] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-[#DBEAFE] text-[#2563EB] rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[#172033] font-mono">
                {clustersData.total_pages_analyzed}
              </div>
              <div className="text-xs text-[#526174] font-medium">Pages Analyzed</div>
            </div>
          </div>

          <div className="bg-[#EBF3FA] border border-[#CBD8E6] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-[#DCFCE7] text-[#16A34A] rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[#172033] font-mono">
                {clustersData.total_clusters}
              </div>
              <div className="text-xs text-[#526174] font-medium">Topic Clusters</div>
            </div>
          </div>

          <div className="bg-[#EBF3FA] border border-[#CBD8E6] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-[#FEF3C7] text-[#D97706] rounded-lg">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[#172033] font-mono">
                {primaryKeywordsSummary.length}
              </div>
              <div className="text-xs text-[#526174] font-medium">Unique Keywords</div>
            </div>
          </div>

          <div className="bg-[#EBF3FA] border border-[#CBD8E6] rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-[#F3E8FF] text-[#9333EA] rounded-lg">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-[#172033] font-mono">
                {primaryKeywordsSummary[0]?.keyword ? primaryKeywordsSummary[0].keyword.slice(0, 14) + '...' : 'N/A'}
              </div>
              <div className="text-xs text-[#526174] font-medium">Top Primary Keyword</div>
            </div>
          </div>
        </div>

        {/* Top Primary Keywords Cloud / Chips */}
        {primaryKeywordsSummary.length > 0 && (
          <div className="bg-[#F0F5FA] border border-[#CBD8E6] rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-[#172033] uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#2563EB]" /> Top Primary Keywords Identified
            </div>
            <div className="flex flex-wrap gap-1.5">
              {primaryKeywordsSummary.slice(0, 12).map((item, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-[#F5F8FC] border border-[#CBD8E6] rounded-lg text-xs font-medium text-[#172033] flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="font-semibold">{item.keyword}</span>
                  <span className="px-1.5 py-0.2 text-[10px] font-mono bg-[#DBEAFE] text-[#2563EB] rounded-full">
                    {item.count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Clusters Cards Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#172033] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2563EB]" /> Cluster Breakdown ({filteredClusters.length})
            </h4>
            <span className="text-xs text-[#526174]">Click any cluster card to inspect pages</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClusters.map((cluster) => (
              <div
                key={cluster.cluster_id}
                onClick={() => setSelectedCluster(cluster)}
                className="bg-[#F5F8FC] border border-[#CBD8E6] hover:border-[#2563EB] rounded-xl p-4 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between group space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-sm font-bold text-[#172033] group-hover:text-[#2563EB] transition-colors line-clamp-1">
                      {cluster.cluster_name}
                    </h5>
                    <span className="px-2 py-0.5 bg-[#DBEAFE] text-[#2563EB] font-mono text-[11px] font-semibold rounded-md shrink-0">
                      {cluster.page_count} {cluster.page_count === 1 ? 'page' : 'pages'}
                    </span>
                  </div>

                  <div className="text-xs text-[#526174] flex items-center gap-1">
                    <span className="font-semibold text-[#172033]">Primary Topic:</span>
                    <span className="bg-[#E2E8F0] px-2 py-0.5 rounded text-[11px] font-mono text-[#334155]">
                      {cluster.cluster_primary_topic}
                    </span>
                  </div>

                  {cluster.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {cluster.keywords.slice(0, 4).map((kw, kIdx) => (
                        <span
                          key={kIdx}
                          className="px-2 py-0.5 bg-[#EDF3F9] text-[#334155] rounded text-[10px] font-sans border border-[#CBD8E6]/60"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#CBD8E6]/70 flex items-center justify-between text-xs text-[#2563EB] font-semibold">
                  <span>Inspect {cluster.page_count} pages</span>
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Cluster Detail Modal / Drawer */}
      {selectedCluster && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-4 bg-[#DCE7F2] border-b border-[#CBD8E6] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#DBEAFE] text-[#2563EB] rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172033]">{selectedCluster.cluster_name}</h3>
                  <p className="text-xs text-[#526174]">
                    Topic: <span className="font-semibold">{selectedCluster.cluster_primary_topic}</span> &bull; {selectedCluster.page_count} Pages
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="p-1.5 hover:bg-[#CBD8E6] rounded-lg text-[#526174] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* Keywords List */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                  Representative Cluster Keywords
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCluster.keywords.map((kw, i) => (
                    <span key={i} className="px-2.5 py-1 bg-[#DBEAFE] text-[#2563EB] rounded-lg text-xs font-semibold">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pages in Cluster */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                  Pages in Cluster ({selectedCluster.pages.length})
                </label>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {selectedCluster.pages.map((p, idx) => {
                    const fullPageObj = pages.find((pg) => pg.url === p.url);
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (fullPageObj && onSelectPage) {
                            onSelectPage(fullPageObj);
                            setSelectedCluster(null);
                          }
                        }}
                        className="p-3 bg-[#EBF3FA] border border-[#CBD8E6] hover:border-[#2563EB] rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[#172033] truncate">
                            {p.title || p.url}
                          </div>
                          <div className="text-[11px] font-mono text-[#526174] truncate">
                            {p.url}
                          </div>
                        </div>

                        {p.primary_keyword && (
                          <div className="shrink-0 font-sans">
                            <span className="px-2 py-0.5 bg-[#DCFCE7] text-[#16A34A] rounded text-[11px] font-semibold border border-[#BBE5C8]">
                              KW: {p.primary_keyword}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-[#DCE7F2] border-t border-[#CBD8E6] text-right">
              <button
                onClick={() => setSelectedCluster(null)}
                className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
