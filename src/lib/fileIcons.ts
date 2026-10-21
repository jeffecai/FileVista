import type { Entry } from '../types';

const modules = import.meta.glob('../assets/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function iconUrl(name: string): string {
  return modules[`../assets/icons/${name}.svg`] ?? modules['../assets/icons/generic.svg'];
}

const EXT_MAP: Record<string, string> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image',
  ico: 'image', avif: 'image', svg: 'image', tif: 'image', tiff: 'image', heic: 'image', heif: 'image',
  mp4: 'video', mkv: 'video', mov: 'video', avi: 'video', webm: 'video', wmv: 'video',
  flv: 'video', m4v: 'video', mpg: 'video', mpeg: 'video',
  mp3: 'audio', flac: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio', aac: 'audio',
  wma: 'audio', opus: 'audio', mid: 'audio', midi: 'audio',
  zip: 'archive', '7z': 'archive', rar: 'archive', tar: 'archive', gz: 'archive',
  xz: 'archive', bz2: 'archive', tgz: 'archive', cab: 'archive', lz4: 'archive', zst: 'archive',
  js: 'code', mjs: 'code', cjs: 'code', ts: 'code', tsx: 'code', jsx: 'code',
  css: 'code', scss: 'code', less: 'code', html: 'code', htm: 'code', xml: 'code',
  vue: 'code', svelte: 'code', py: 'code', rb: 'code', go: 'code', rs: 'code',
  java: 'code', c: 'code', h: 'code', cpp: 'code', hpp: 'code', cc: 'code', hh: 'code',
  cs: 'code', php: 'code', lua: 'code', sh: 'code', bash: 'code', zsh: 'code',
  ps1: 'code', bat: 'code', cmd: 'code', sql: 'code', graphql: 'code',
  txt: 'text', log: 'text', nfo: 'text', rtf: 'text',
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  json: 'json', jsonc: 'json',
  yml: 'config', yaml: 'config', toml: 'config', ini: 'config', cfg: 'config',
  conf: 'config', env: 'config', properties: 'config',
  pdf: 'pdf',
  doc: 'word', docx: 'word', odt: 'word',
  xls: 'excel', xlsx: 'excel', csv: 'excel', tsv: 'excel', ods: 'excel',
  ppt: 'ppt', pptx: 'ppt', odp: 'ppt',
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font', eot: 'font',
  db: 'database', sqlite: 'database', sqlite3: 'database', mdb: 'database', accdb: 'database',
  psd: 'design', ai: 'design', sketch: 'design', fig: 'design', xd: 'design',
  indd: 'design', afdesign: 'design',
  obj: 'cube', fbx: 'cube', blend: 'cube', stl: 'cube', '3ds': 'cube',
  gltf: 'cube', glb: 'cube', dae: 'cube',
  iso: 'disk', img: 'disk', dmg: 'disk', vhd: 'disk', vhdx: 'disk', vmdk: 'disk',
  lnk: 'link', url: 'link',
};

const NAME_MAP: Record<string, string> = {
  readme: 'markdown', 'readme.md': 'markdown', license: 'text', licence: 'text',
  changelog: 'markdown', 'changelog.md': 'markdown', makefile: 'config',
  dockerfile: 'config', '.gitignore': 'config', '.gitattributes': 'config',
  '.env': 'config', 'package-lock.json': 'json',
};

const FOLDER_ICONS = [
  'folder-blue', 'folder-teal', 'folder-violet',
  'folder-amber', 'folder-rose', 'folder-green',
];

export interface IconChoice {
  src: string;
  native: boolean;
}

export function folderIcon(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return iconUrl(FOLDER_ICONS[hash % FOLDER_ICONS.length]);
}

export function iconForEntry(entry: Entry): IconChoice {
  if (entry.category === 'folder') {
    return { src: folderIcon(entry.name), native: false };
  }

  const ext = entry.ext.replace(/^\./, '').toLowerCase();
  const named = NAME_MAP[entry.name.toLowerCase()];
  const mapped = named ?? EXT_MAP[ext];
  if (mapped) {
    if (mapped === 'link') return { src: iconUrl('link'), native: true };
    if (mapped === 'exe') return { src: iconUrl('exe'), native: true };
    return { src: iconUrl(mapped), native: false };
  }

  if (entry.category === 'app') {
    return { src: iconUrl(ext === 'lnk' || ext === 'url' ? 'link' : 'exe'), native: true };
  }
  if (entry.category === 'image') return { src: iconUrl('image'), native: false };
  if (entry.category === 'media') return { src: iconUrl('video'), native: false };
  if (entry.category === 'archive') return { src: iconUrl('archive'), native: false };
  if (entry.category === 'text') return { src: iconUrl('text'), native: false };
  if (entry.category === 'doc') return { src: iconUrl('text'), native: false };

  return { src: iconUrl('generic'), native: true };
}
