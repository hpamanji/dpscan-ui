import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listProjects } from '../lib/nexus';

export default function ProjectsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <p className="status">Loading projects…</p>;
  if (error) return <p className="status error">Failed to load: {(error as Error).message}</p>;
  if (!data || data.length === 0) return <p className="status">No reports found in the Nexus repository.</p>;

  return (
    <div className="projects">
      <h1>Dependency Reports</h1>
      <p className="subtitle">{data.length} project{data.length === 1 ? '' : 's'}</p>
      <ul className="project-list">
        {data.map((p) => (
          <li key={p.name}>
            <Link to={`/p/${encodeURIComponent(p.name)}`}>
              <span className="project-name">{p.name}</span>
              <span className="project-meta">
                latest: {p.latest.version}
                {p.latest.lastModified && ` · ${formatDate(p.latest.lastModified)}`}
                {' · '}{p.versions.length} report{p.versions.length === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}
