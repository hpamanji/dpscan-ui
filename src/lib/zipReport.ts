import JSZip from 'jszip';

export interface LoadedReport {
  url: string;
  revoke: () => void;
}

const MIME: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

// Strips query / hash and normalises ./ paths
function normalise(ref: string): string {
  const q = ref.indexOf('?');
  const h = ref.indexOf('#');
  let end = ref.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return ref.slice(0, end).replace(/^\.\//, '');
}

export async function loadReportFromZip(zipUrl: string): Promise<LoadedReport> {
  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error(`Failed to fetch report archive: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const urls = new Map<string, string>();
  const created: string[] = [];

  // Materialise each non-HTML file as a Blob URL. HTML is handled after
  // we know the asset URL map so we can rewrite references inside it.
  const htmlFiles: Array<{ path: string; file: JSZip.JSZipObject }> = [];
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (/\.html?$/i.test(path)) {
      htmlFiles.push({ path, file });
      continue;
    }
    const blob = await file.async('blob');
    const typed = new Blob([blob], { type: mimeFor(path) });
    const u = URL.createObjectURL(typed);
    urls.set(path, u);
    created.push(u);
  }

  const indexEntry =
    htmlFiles.find((f) => f.path.toLowerCase() === 'index.html') ??
    htmlFiles.find((f) => f.path.toLowerCase().endsWith('/index.html')) ??
    htmlFiles[0];

  if (!indexEntry) {
    created.forEach(URL.revokeObjectURL);
    throw new Error('Archive contains no HTML report');
  }

  const baseDir = indexEntry.path.includes('/')
    ? indexEntry.path.slice(0, indexEntry.path.lastIndexOf('/') + 1)
    : '';

  const rawHtml = await indexEntry.file.async('string');
  const rewritten = rewriteHtml(rawHtml, urls, baseDir);

  const htmlBlob = new Blob([rewritten], { type: 'text/html' });
  const htmlUrl = URL.createObjectURL(htmlBlob);
  created.push(htmlUrl);

  return {
    url: htmlUrl,
    revoke: () => created.forEach(URL.revokeObjectURL),
  };
}

function rewriteHtml(html: string, urls: Map<string, string>, baseDir: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const attrTargets: Array<[string, string]> = [
    ['link', 'href'],
    ['script', 'src'],
    ['img', 'src'],
    ['source', 'src'],
    ['video', 'src'],
    ['audio', 'src'],
    ['iframe', 'src'],
    ['a', 'href'],
  ];

  for (const [tag, attr] of attrTargets) {
    for (const el of Array.from(doc.querySelectorAll(tag))) {
      const ref = el.getAttribute(attr);
      if (!ref) continue;
      if (/^(https?:|data:|blob:|mailto:|#)/i.test(ref)) continue;
      const target = baseDir + normalise(ref);
      const mapped = urls.get(target) ?? urls.get(normalise(ref));
      if (mapped) el.setAttribute(attr, mapped);
    }
  }

  // Inline elements with srcset (multiple URLs)
  for (const el of Array.from(doc.querySelectorAll('img[srcset], source[srcset]'))) {
    const srcset = el.getAttribute('srcset');
    if (!srcset) continue;
    const rewritten = srcset
      .split(',')
      .map((entry) => {
        const trimmed = entry.trim();
        const [ref, descriptor] = trimmed.split(/\s+/, 2);
        if (!ref || /^(https?:|data:|blob:)/i.test(ref)) return trimmed;
        const target = baseDir + normalise(ref);
        const mapped = urls.get(target) ?? urls.get(normalise(ref));
        return mapped ? `${mapped}${descriptor ? ' ' + descriptor : ''}` : trimmed;
      })
      .join(', ');
    el.setAttribute('srcset', rewritten);
  }

  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}
