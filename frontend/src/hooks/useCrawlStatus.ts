import { useState, useEffect, useRef } from 'react';
import { CrawlStatusResponse } from '../types';
import { fetchCrawlStatus } from '../services/crawlService';

export const useCrawlStatus = (
  crawlId: number | null,
  enabled: boolean,
  pollInterval: number = 1500
) => {
  const [statusData, setStatusData] = useState<CrawlStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  const activeCrawlIdRef = useRef<number | null>(crawlId);
  activeCrawlIdRef.current = crawlId;

  useEffect(() => {
    if (!enabled || !crawlId) {
      setIsPolling(false);
      setStatusData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    let timerId: ReturnType<typeof setInterval> | null = null;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    const checkStatus = async () => {
      if (!isMounted || !activeCrawlIdRef.current) return;
      try {
        const data = await fetchCrawlStatus(activeCrawlIdRef.current);
        if (!isMounted) return;

        consecutiveErrors = 0;
        setStatusData(data);
        setError(null);

        // Stop polling if status reached terminal state
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          setIsPolling(false);
          if (timerId) clearInterval(timerId);
        }
      } catch (err) {
        if (!isMounted) return;
        consecutiveErrors += 1;
        const msg = err instanceof Error ? err.message : 'Failed to fetch status update';
        console.warn(
          `[useCrawlStatus] Status poll attempt for #${activeCrawlIdRef.current} failed (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${msg}`
        );

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setError(msg);
          setIsPolling(false);
          if (timerId) clearInterval(timerId);
        }
      }
    };

    setIsPolling(true);

    // Initial immediate poll
    checkStatus();

    // Periodic polling interval
    timerId = setInterval(checkStatus, pollInterval);

    // Guaranteed cleanup on component unmount or dependencies change
    return () => {
      isMounted = false;
      setIsPolling(false);
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [crawlId, enabled, pollInterval]);

  return { statusData, error, isPolling };
};
