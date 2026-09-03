import React, { useState } from 'react';
import { History, Eye, Trash2, Calendar, Globe, AlertTriangle } from 'lucide-react';
import { CrawlHistoryItem } from '../types';

interface CrawlHistoryTableProps {
  history: CrawlHistoryItem[];
  currentCrawlId?: number | null;
  onViewCrawl: (crawlId: number) => void;
  onDeleteCrawl: (crawlId: number) => void;
  loading: boolean;
}

export const CrawlHistoryTable: React.FC<CrawlHistoryTableProps> = ({
  history,
  currentCrawlId,
  onViewCrawl,
  onDeleteCrawl,
  loading,
}) => {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const confirmDelete = (crawlId: number) => {
    onDeleteCrawl(crawlId);
    setDeletingId(null);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl overflow-hidden shadow-sm space-y-0">
      
      {/* Header Bar */}
      <div className="p-4 bg-[#DCE7F2] border-b border-[#CBD8E6] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#DBEAFE] text-[#2563EB] rounded-lg">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#172033]">
              Crawl History Sessions
            </h3>
            <p className="text-xs text-[#526174]">
              Saved SQLite database records ({history.length} historical crawls)
            </p>
          </div>
        </div>

        {loading && (
          <span className="text-xs text-[#2563EB] font-mono animate-pulse">
            Updating history...
          </span>
        )}
      </div>

      {/* Confirmation Modal */}
      {deletingId !== null && (
        <div className="p-4 bg-[#FEE2E2] border-b border-[#FCA5A5] flex items-center justify-between gap-4 text-xs text-[#DC2626] animate-fadeIn">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
            <span>Are you sure you want to delete Crawl #{deletingId} from database history?</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDeletingId(null)}
              className="px-3 py-1 bg-[#F5F8FC] hover:bg-[#EDF3F9] text-[#172033] border border-[#CBD8E6] rounded font-semibold transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmDelete(deletingId)}
              className="px-3 py-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded font-semibold transition-colors shadow-sm"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#172033]">
          <thead className="bg-[#DCE7F2] text-[#334155] uppercase font-mono text-[11px] border-b border-[#CBD8E6]">
            <tr>
              <th className="py-3 px-4 w-16 text-center">ID</th>
              <th className="py-3 px-4">Domain & Target URL</th>
              <th className="py-3 px-4 text-center">Pages</th>
              <th className="py-3 px-4 text-center">Duration</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CBD8E6]/60 font-sans">
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#718096] font-mono">
                  No crawl history yet. Completed crawls will be automatically saved here.
                </td>
              </tr>
            ) : (
              history.map((item) => {
                const isSelected = currentCrawlId === item.crawl_id;
                return (
                  <tr
                    key={item.crawl_id}
                    className={`transition-colors ${
                      isSelected ? 'bg-[#DBEAFE]/50' : 'bg-[#F5F8FC] hover:bg-[#E8F0F7]'
                    }`}
                  >
                    {/* ID */}
                    <td className="py-3 px-4 text-center font-mono font-semibold text-[#526174]">
                      #{item.crawl_id}
                    </td>

                    {/* Domain & Target URL */}
                    <td className="py-3 px-4 max-w-sm">
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                        <div>
                          <span className="font-semibold text-[#172033] block">{item.domain}</span>
                          <span className="text-[11px] font-mono text-[#526174] truncate block" title={item.starting_url}>
                            {item.starting_url}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Pages */}
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="text-[#172033] font-bold">{item.total_pages}</span> pages{' '}
                      <span className="text-[#718096] text-[10px]">
                        ({item.successful_pages} OK / {item.failed_pages} ERR)
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 text-center font-mono text-[#526174]">
                      {item.duration_seconds}s
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-[#526174] text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-[#718096]" />
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onViewCrawl(item.crawl_id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                            isSelected
                              ? 'bg-[#2563EB] text-white shadow-sm'
                              : 'bg-[#DBEAFE] hover:bg-[#BFDBFE] text-[#2563EB] border border-[#BFCFE0]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'Viewing' : 'View'}</span>
                        </button>
                        <button
                          onClick={() => setDeletingId(item.crawl_id)}
                          className="p-1.5 bg-[#EDF3F9] hover:bg-[#FEE2E2] text-[#526174] hover:text-[#DC2626] border border-[#CBD8E6] hover:border-[#FCA5A5] rounded-lg transition-all"
                          title="Delete from database history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
