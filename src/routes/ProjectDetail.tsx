import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listProjects } from '../lib/nexus';
import { loadReportFromZip, type LoadedReport } from '../lib/zipReport';

interface ReportState {
  forUrl: string | null;
  report: LoadedReport | null;
  error: Error | null;
}

export default function ProjectDetail() {
  const { project } = useParams<{ project: string }>();
  const projectName = project ? decodeURIComponent(project) : '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
    staleTime: 5 * 60 * 1000,
  });

  const current = useMemo(() => data?.find((p) => p.name === projectName), [data, projectName]);

  // Namespace selection by project so it auto-resets when navigating between projects.
  const [selection, setSelection] = useState<{ project: string; version: string } | null>(null);
  const selectedVersion = selection?.project === projectName ? selection.version : null;
  const active = current?.versions.find((v) => v.version === selectedVersion) ?? current?.latest;
  const activeUrl = active?.url ?? null;

  const [reportState, setReportState] = useState<ReportState>({
    forUrl: null,
    report: null,
    error: null,
  });

  useEffect(() => {
    if (!activeUrl) return;
    let cancelled = false;
    let loaded: LoadedReport | null = null;
    loadReportFromZip(activeUrl)
      .then((r) => {
        if (cancelled) {
          r.revoke();
          return;
        }
        loaded = r;
        setReportState({ forUrl: activeUrl, report: r, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReportState({
          forUrl: activeUrl,
          report: null,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
    return () => {
      cancelled = true;
      loaded?.revoke();
    };
  }, [activeUrl]);

  // Derive loading/report/error from whether the cached state matches the active URL.
  const matches = reportState.forUrl === activeUrl;
  const report = matches ? reportState.report : null;
  const reportError = matches ? reportState.error : null;
  const reportLoading = !!activeUrl && !report && !reportError;

  if (isLoading) return <p className="status">Loading…</p>;
  if (error) return <p className="status error">Failed to load: {(error as Error).message}</p>;
  if (!current) {
    return (
      <p className="status">
        Project not found. <Link to="/">Back to list</Link>
      </p>
    );
  }

  return (
    <div className="detail">
      <header className="detail-header">
        <div>
          <Link to="/" className="back">← All projects</Link>
          <h1>{current.name}</h1>
        </div>
        <label className="version-picker">
          Version:
          <select
            value={active!.version}
            onChange={(e) => setSelection({ project: projectName, version: e.target.value })}
          >
            {current.versions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version}
                {v === current.latest ? ' (latest)' : ''}
              </option>
            ))}
          </select>
          <a href={active!.url} target="_blank" rel="noreferrer" className="open-new">
            Download zip ↗
          </a>
        </label>
      </header>
      {reportError && (
        <p className="status error">Failed to render report: {reportError.message}</p>
      )}
      {reportLoading && <p className="status">Extracting report…</p>}
      {report && (
        <iframe
          key={report.url}
          src={report.url}
          title={`${current.name} ${active!.version}`}
          className="report-frame"
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
      )}
    </div>
  );
}
