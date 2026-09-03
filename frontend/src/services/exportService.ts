import { CrawlResponse, PageResponse, DiagnosticsResponse } from '../types';

/** Helper to trigger browser file download using Blob and Object URL */
const triggerFileDownload = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Get current ISO date string YYYY-MM-DD */
const getCurrentDateString = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

/** Helper to classify HTTP status code */
const getStatusCategory = (code: number | null, success: boolean): string => {
  if (!code || !success) return 'Crawl Error';
  if (code >= 200 && code < 300) return '2xx Success';
  if (code >= 300 && code < 400) return '3xx Redirect';
  if (code >= 400 && code < 500) return '4xx Client Error';
  if (code >= 500 && code < 600) return '5xx Server Error';
  return 'Unknown Status';
};

/** CSV Cell Escaping Helper */
const escapeCSVCell = (val: string | number | boolean | null | undefined): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};

/**
 * 1. CSV Export Generator
 */
export const exportToCSV = (
  crawlData: CrawlResponse,
  pagesToExport?: PageResponse[],
  customFilename?: string
): void => {
  const pages = pagesToExport && pagesToExport.length > 0 ? pagesToExport : crawlData.pages || [];
  const filename = customFilename || `webatlas-crawl-${getCurrentDateString()}.csv`;

  const headers = [
    '#',
    'URL',
    'Normalized URL',
    'Page Title',
    'HTTP Status',
    'Status Category',
    'Depth',
    'Parent URL',
    'Content Type',
    'Response Time (s)',
    'Internal Links Count',
    'External Links Count',
    'Crawl Success',
    'Error Message',
  ];

  const rows = pages.map((p, index) => [
    escapeCSVCell(index + 1),
    escapeCSVCell(p.url),
    escapeCSVCell(p.normalized_url),
    escapeCSVCell(p.title || 'Untitled'),
    escapeCSVCell(p.status_code !== null ? p.status_code : 'ERR'),
    escapeCSVCell(getStatusCategory(p.status_code, p.crawl_success)),
    escapeCSVCell(p.depth ?? 0),
    escapeCSVCell(p.parent_url || 'Root Target'),
    escapeCSVCell(p.content_type || 'text/html'),
    escapeCSVCell(p.response_time !== undefined ? p.response_time.toFixed(3) : '0.000'),
    escapeCSVCell(p.internal_links ? p.internal_links.length : 0),
    escapeCSVCell(p.external_links ? p.external_links.length : 0),
    escapeCSVCell(p.crawl_success ? 'TRUE' : 'FALSE'),
    escapeCSVCell(p.error_message || ''),
  ]);

  // UTF-8 BOM prefix for Excel compatibility
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
};

/**
 * 2. JSON Export Generator
 */
export const exportToJSON = (
  crawlData: CrawlResponse,
  pagesToExport?: PageResponse[],
  customFilename?: string
): void => {
  const pages = pagesToExport && pagesToExport.length > 0 ? pagesToExport : crawlData.pages || [];
  const filename = customFilename || `webatlas-crawl-${getCurrentDateString()}.json`;

  let redirects = 0;
  let clientErrors = 0;
  let serverErrors = 0;
  let crawlErrors = 0;
  let success = 0;

  pages.forEach((p) => {
    const code = p.status_code;
    if (!code || !p.crawl_success) crawlErrors++;
    else if (code >= 200 && code < 300) success++;
    else if (code >= 300 && code < 400) redirects++;
    else if (code >= 400 && code < 500) clientErrors++;
    else if (code >= 500 && code < 600) serverErrors++;
  });

  const exportPayload = {
    project: 'WebAtlas',
    exported_at: new Date().toISOString(),
    crawl: {
      crawl_id: crawlData.crawl_id || null,
      starting_url: crawlData.starting_url,
      normalized_starting_url: crawlData.normalized_starting_url,
      domain: crawlData.domain,
      duration_seconds: crawlData.duration_seconds,
      completed_at: crawlData.completed_at,
    },
    summary: {
      total_pages_exported: pages.length,
      total_pages_crawled: crawlData.total_pages,
      successful_pages: success,
      redirects: redirects,
      client_errors: clientErrors,
      server_errors: serverErrors,
      crawl_errors: crawlErrors,
      max_depth_reached: crawlData.max_depth_reached,
      total_internal_links: crawlData.total_internal_links,
      total_external_links: crawlData.total_external_links,
    },
    pages: pages,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  triggerFileDownload(jsonString, filename, 'application/json;charset=utf-8;');
};

/** XML escaping helper */
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * 3. Sitemap.xml Export Generator
 */
export const exportToSitemapXml = (
  crawlData: CrawlResponse,
  pagesToExport?: PageResponse[],
  customFilename?: string
): void => {
  const pages = pagesToExport && pagesToExport.length > 0 ? pagesToExport : crawlData.pages || [];
  const filename = customFilename || 'sitemap.xml';

  const domain = crawlData.domain;

  // Filter only eligible internal, successful URLs (http/https, no fragment, status < 400)
  const eligiblePages = pages.filter((p) => {
    if (!p.url || !p.crawl_success) return false;
    if (p.status_code !== null && p.status_code >= 400) return false;

    try {
      const parsed = new URL(p.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      if (parsed.hash && parsed.hash.trim() !== '') return false;
      if (domain && !parsed.hostname.toLowerCase().includes(domain.toLowerCase())) return false;
      return true;
    } catch {
      return false;
    }
  });

  // Deduplicate by URL
  const uniqueUrls = Array.from(new Set(eligiblePages.map((p) => p.url)));

  const urlElements = uniqueUrls
    .map(
      (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
  </url>`
    )
    .join('\n');

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;

  triggerFileDownload(xmlContent, filename, 'application/xml;charset=utf-8;');
};

/**
 * 4. HTML Crawl Report Generator
 */
export const exportToHTMLReport = (
  crawlData: CrawlResponse,
  diagnostics?: DiagnosticsResponse | null,
  pagesToExport?: PageResponse[],
  customFilename?: string
): void => {
  const pages = pagesToExport && pagesToExport.length > 0 ? pagesToExport : crawlData.pages || [];
  const filename = customFilename || `webatlas-report-${getCurrentDateString()}.html`;

  let redirects = 0;
  let clientErrors = 0;
  let serverErrors = 0;
  let crawlErrors = 0;
  let success = 0;
  let totalRespTime = 0;

  pages.forEach((p) => {
    const code = p.status_code;
    totalRespTime += p.response_time || 0;
    if (!code || !p.crawl_success) crawlErrors++;
    else if (code >= 200 && code < 300) success++;
    else if (code >= 300 && code < 400) redirects++;
    else if (code >= 400 && code < 500) clientErrors++;
    else if (code >= 500 && code < 600) serverErrors++;
  });

  const avgRespTimeMs = pages.length > 0 ? Math.round((totalRespTime / pages.length) * 1000) : 0;
  const brokenPages = pages.filter((p) => !p.crawl_success || (p.status_code !== null && p.status_code >= 400));

  const healthScore = diagnostics?.health_score ?? (crawlErrors + clientErrors + serverErrors === 0 ? 100 : Math.max(40, 100 - (crawlErrors + clientErrors + serverErrors) * 10));

  const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebAtlas Crawl Report - ${escapeXml(crawlData.domain)}</title>
  <style>
    :root {
      --bg: #EAF1F8;
      --card-bg: #F5F8FC;
      --header-bg: #DCE7F2;
      --border: #CBD8E6;
      --primary: #2563EB;
      --text: #172033;
      --muted: #526174;
      --success: #16A34A;
      --warning: #D97706;
      --error: #DC2626;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta-tag {
      background: var(--header-bg);
      padding: 6px 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      border: 1px solid var(--border);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .card-value {
      font-size: 24px;
      font-weight: 800;
      font-family: monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      font-size: 13px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 12px;
      text-align: left;
    }
    th {
      background: var(--header-bg);
      font-family: monospace;
      font-size: 11px;
      text-transform: uppercase;
    }
    tr:nth-child(even) {
      background: var(--card-bg);
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: bold;
      font-size: 11px;
    }
    .badge-2xx { background: #DCFCE7; color: #16A34A; }
    .badge-3xx { background: #FEF3C7; color: #D97706; }
    .badge-4xx { background: #FEE2E2; color: #DC2626; }
    .print-btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      margin-bottom: 20px;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { border: none; shadow: none; padding: 0; max-width: 100%; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <button onclick="window.print()" class="print-btn">Print Report / Save PDF</button>

    <div class="header">
      <div>
        <div class="brand">🌐 WebAtlas Crawl Report</div>
        <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">
          Target Domain: <strong>${escapeXml(crawlData.domain)}</strong>
        </div>
      </div>
      <div style="text-align: right;">
        <div class="meta-tag">Crawl ID: #${crawlData.crawl_id || 'Live'}</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">
          Generated: ${new Date().toLocaleString()}
        </div>
      </div>
    </div>

    <div style="margin-bottom: 24px; font-size: 13px;">
      <strong>Starting URL:</strong> <a href="${escapeXml(crawlData.starting_url)}" target="_blank">${escapeXml(crawlData.starting_url)}</a> &bull;
      <strong>Duration:</strong> ${(crawlData.duration_seconds || 0).toFixed(2)} seconds
    </div>

    <h3 style="font-size: 16px; margin-bottom: 12px;">Executive Crawl Summary</h3>
    <div class="grid">
      <div class="card">
        <div class="card-title">Total Pages</div>
        <div class="card-value" style="color: var(--primary);">${pages.length}</div>
      </div>
      <div class="card">
        <div class="card-title">Successful (2xx)</div>
        <div class="card-value" style="color: var(--success);">${success}</div>
      </div>
      <div class="card">
        <div class="card-title">Redirects (3xx)</div>
        <div class="card-value" style="color: var(--warning);">${redirects}</div>
      </div>
      <div class="card">
        <div class="card-title">Errors (4xx / 5xx / ERR)</div>
        <div class="card-value" style="color: var(--error);">${clientErrors + serverErrors + crawlErrors}</div>
      </div>
      <div class="card">
        <div class="card-title">Health Score</div>
        <div class="card-value" style="color: ${healthScore >= 90 ? 'var(--success)' : healthScore >= 75 ? 'var(--warning)' : 'var(--error)'};">
          ${healthScore}/100
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Avg Response Time</div>
        <div class="card-value" style="font-size: 18px; color: var(--text);">${avgRespTimeMs} ms</div>
      </div>
      <div class="card">
        <div class="card-title">Max Depth Reached</div>
        <div class="card-value" style="font-size: 18px; color: var(--text);">Depth ${crawlData.max_depth_reached}</div>
      </div>
      <div class="card">
        <div class="card-title">Internal Links</div>
        <div class="card-value" style="font-size: 18px; color: #6366F1;">${crawlData.total_internal_links}</div>
      </div>
      <div class="card">
        <div class="card-title">External Links</div>
        <div class="card-value" style="font-size: 18px; color: #0891B2;">${crawlData.total_external_links}</div>
      </div>
    </div>

    ${
      brokenPages.length > 0
        ? `<h3 style="font-size: 16px; margin-top: 32px; color: var(--error);">Broken & Error Pages (${brokenPages.length})</h3>
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>Status</th>
          <th>Parent</th>
          <th>Error Detail</th>
        </tr>
      </thead>
      <tbody>
        ${brokenPages
          .map(
            (p) => `<tr>
          <td style="font-family: monospace; word-break: break-all;">${escapeXml(p.url)}</td>
          <td><span class="status-badge badge-4xx">${p.status_code || 'ERR'}</span></td>
          <td style="font-family: monospace;">${escapeXml(p.parent_url || 'Root')}</td>
          <td style="color: var(--error);">${escapeXml(p.error_message || 'HTTP error code returned')}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>`
        : `<div style="padding: 12px; background: #DCFCE7; border: 1px solid #BBE5C8; border-radius: 8px; color: #16A34A; font-weight: bold; font-size: 13px; margin-top: 24px;">
      ✓ Zero broken pages or crawl errors detected.
    </div>`
    }

    <h3 style="font-size: 16px; margin-top: 32px;">Discovered Pages Directory</h3>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Title & URL</th>
          <th>Status</th>
          <th>Depth</th>
          <th>Response</th>
        </tr>
      </thead>
      <tbody>
        ${pages
          .map(
            (p, idx) => `<tr>
          <td style="font-family: monospace; text-align: center;">${idx + 1}</td>
          <td>
            <strong>${escapeXml(p.title || 'Untitled')}</strong><br/>
            <span style="font-family: monospace; font-size: 11px; color: var(--muted);">${escapeXml(p.url)}</span>
          </td>
          <td>
            <span class="status-badge ${
              !p.status_code || !p.crawl_success ? 'badge-4xx' : p.status_code < 300 ? 'badge-2xx' : p.status_code < 400 ? 'badge-3xx' : 'badge-4xx'
            }">${p.status_code || 'ERR'}</span>
          </td>
          <td style="font-family: monospace; text-align: center;">d=${p.depth}</td>
          <td style="font-family: monospace;">${Math.round((p.response_time || 0) * 1000)} ms</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); text-align: center;">
      Generated by WebAtlas &bull; Intelligent Website Crawler & Site Mapper
    </div>
  </div>
</body>
</html>`;

  triggerFileDownload(reportHtml, filename, 'text/html;charset=utf-8;');
};
