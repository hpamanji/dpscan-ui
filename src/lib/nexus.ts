const BASE_URL = import.meta.env.VITE_NEXUS_BASE_URL as string;
const REPO = import.meta.env.VITE_NEXUS_REPO as string;

if (!BASE_URL || !REPO) {
  throw new Error('VITE_NEXUS_BASE_URL and VITE_NEXUS_REPO must be set');
}

export interface NexusAsset {
  downloadUrl: string;
  path: string;
  id: string;
  lastModified?: string;
}

export interface NexusComponent {
  id: string;
  repository: string;
  format: string;
  group: string | null;
  name: string;
  version: string | null;
  assets: NexusAsset[];
}

interface NexusListResponse {
  items: NexusComponent[];
  continuationToken: string | null;
}

export interface ReportVersion {
  version: string;
  url: string;
  lastModified?: string;
}

export interface Project {
  name: string;
  versions: ReportVersion[];
  latest: ReportVersion;
}

async function fetchAllComponents(): Promise<NexusComponent[]> {
  const all: NexusComponent[] = [];
  let token: string | null = null;
  do {
    const url = new URL(`${BASE_URL}/service/rest/v1/components`);
    url.searchParams.set('repository', REPO);
    if (token) url.searchParams.set('continuationToken', token);
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Nexus list failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as NexusListResponse;
    all.push(...body.items);
    token = body.continuationToken;
  } while (token);
  return all;
}

function findIndexAsset(c: NexusComponent): NexusAsset | undefined {
  return (
    c.assets.find((a) => a.path.endsWith('/index.html')) ??
    c.assets.find((a) => a.path.endsWith('index.html'))
  );
}

function parseProjectAndVersion(path: string): { project: string; version: string } | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 3) return null;
  return { project: parts[0], version: parts[1] };
}

export async function listProjects(): Promise<Project[]> {
  const components = await fetchAllComponents();
  const byProject = new Map<string, ReportVersion[]>();

  for (const c of components) {
    const asset = findIndexAsset(c);
    if (!asset) continue;
    const parsed = parseProjectAndVersion(asset.path);
    if (!parsed) continue;
    const list = byProject.get(parsed.project) ?? [];
    list.push({
      version: parsed.version,
      url: asset.downloadUrl,
      lastModified: asset.lastModified,
    });
    byProject.set(parsed.project, list);
  }

  const projects: Project[] = [];
  for (const [name, versions] of byProject) {
    versions.sort(sortVersionsDesc);
    projects.push({ name, versions, latest: versions[0] });
  }
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

function sortVersionsDesc(a: ReportVersion, b: ReportVersion): number {
  if (a.lastModified && b.lastModified) {
    return b.lastModified.localeCompare(a.lastModified);
  }
  return b.version.localeCompare(a.version, undefined, { numeric: true });
}
