import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listProjects } from '../lib/nexus';

export default function ProjectDetail() {
  const { project } = useParams<{ project: string }>();
  const projectName = project ? decodeURIComponent(project) : '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
    staleTime: 5 * 60 * 1000,
  });

  const current = useMemo(() => data?.find((p) => p.name === projectName), [data, projectName]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  if (isLoading) return <p className="status">Loading…</p>;
  if (error) return <p className="status error">Failed to load: {(error as Error).message}</p>;
  if (!current) {
    return (
      <p className="status">
        Project not found. <Link to="/">Back to list</Link>
      </p>
    );
  }

  const active = current.versions.find((v) => v.version === selectedVersion) ?? current.latest;

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
            value={active.version}
            onChange={(e) => setSelectedVersion(e.target.value)}
          >
            {current.versions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version}
                {v === current.latest ? ' (latest)' : ''}
              </option>
            ))}
          </select>
          <a href={active.url} target="_blank" rel="noreferrer" className="open-new">
            Open ↗
          </a>
        </label>
      </header>
      <iframe
        key={active.url}
        src={active.url}
        title={`${current.name} ${active.version}`}
        className="report-frame"
      />
    </div>
  );
}
