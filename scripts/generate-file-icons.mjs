import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'src', 'assets', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const cardShape = 'M11 5h17l10 10v25a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z';
const fold = '<path d="M28 5l10 10H28z" fill="#fff" opacity=".28"/>';

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="__C1__"/>
      <stop offset="1" stop-color="__C2__"/>
    </linearGradient>
  </defs>
  ${inner}
</svg>
`;
}

function write(name, c1, c2, glyph) {
  const inner = `<path d="${cardShape}" fill="url(#g)"/>${fold}<g stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".96">${glyph}</g>`;
  const content = svg(inner).replace('__C1__', c1).replace('__C2__', c2);
  fs.writeFileSync(path.join(outDir, `${name}.svg`), content, 'utf8');
}

function writeFolder(name, c1, c2) {
  const inner = `<path d="M4 40V16a4 4 0 0 1 4-4h8l4 4h16a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="url(#g)"/><path d="M4 22h36v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#fff" opacity=".18"/><path d="M4 22h36" stroke="#fff" opacity=".55" stroke-width="1.2"/>`;
  const content = svg(inner).replace('__C1__', c1).replace('__C2__', c2);
  fs.writeFileSync(path.join(outDir, `${name}.svg`), content, 'utf8');
}

write('image', '#0F7C86', '#35B7B0', '<rect x="14" y="20" width="20" height="15" rx="2"/><circle cx="19" cy="25" r="1.6" fill="#fff" stroke="none"/><path d="M14.5 32.5l5-4.5 4 3.5 4.5-4 5 5"/>');
write('video', '#553A9E', '#8E6BE8', '<rect x="14" y="20" width="20" height="15" rx="2"/><path d="M21.5 24.5l7.5 4.5-7.5 4.5z" fill="#fff" stroke="none"/>');
write('audio', '#963B5F', '#DE7295', '<path d="M16 30v6M20.5 26v14M25 23v20M29.5 27v12M34 31v4"/>');
write('archive', '#8C6318', '#D9A441', '<rect x="18" y="19" width="12" height="21" rx="2"/><path d="M24 21v3M24 26v3M24 31v3"/><rect x="21.5" y="35" width="5" height="3" rx="1" fill="#fff" stroke="none"/>');
write('code', '#2B3F8C', '#5574E0', '<path d="M19.5 22l-5 7 5 7M28.5 22l5 7-5 7M26.5 19l-5 20"/>');
write('text', '#4A5568', '#8A97A8', '<path d="M15 22h18M15 27h18M15 32h11"/>');
write('markdown', '#2F4F5F', '#5C8598', '<path d="M14 34V22l5 6 5-6v12M31 23v10M28 30l3 3 3-3"/>');
write('pdf', '#9E2F2F', '#D9574E', '<text x="24" y="33.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#fff" stroke="none">PDF</text>');
write('word', '#1F4FA3', '#3D7BD9', '<text x="24" y="35" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="none">W</text>');
write('excel', '#1E6B45', '#3AA36B', '<text x="24" y="35" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="none">X</text>');
write('ppt', '#9E4A1B', '#DE7B3A', '<text x="24" y="35" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="none">P</text>');
write('json', '#4A3670', '#7C63A8', '<text x="24" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#fff" stroke="none">{ }</text>');
write('config', '#555B66', '#8A92A3', '<circle cx="24" cy="29" r="4"/><path d="M24 20v3M24 35v3M15 29h3M30 29h3M17.6 22.6l2.1 2.1M28.3 33.3l2.1 2.1M30.4 22.6l-2.1 2.1M19.7 33.3l-2.1 2.1"/>');
write('font', '#6B3FA0', '#9B6FD0', '<text x="24" y="34.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#fff" stroke="none">Aa</text>');
write('database', '#17607A', '#2E9CB8', '<ellipse cx="24" cy="22" rx="8" ry="3"/><path d="M16 22v12c0 1.7 3.6 3 8 3s8-1.3 8-3V22"/><path d="M16 28c0 1.7 3.6 3 8 3s8-1.3 8-3"/>');
write('design', '#8A2F5E', '#C45A8E', '<path d="M16 36l3-9 9-9 4 4-9 9-7 5z"/><path d="M25 22l4 4"/>');
write('cube', '#4A3A8C', '#7A63C9', '<path d="M24 18l9 5v10l-9 5-9-5V23z"/><path d="M15 23l9 5 9-5M24 28v10"/>');
write('disk', '#3A4A5A', '#6A7F94', '<circle cx="24" cy="29" r="9"/><circle cx="24" cy="29" r="2.5" fill="#fff" stroke="none"/><path d="M24 20v3"/>');
write('exe', '#2F3A46', '#56697D', '<rect x="14" y="20" width="20" height="16" rx="2"/><path d="M14 25h20"/><circle cx="17.5" cy="22.5" r="1" fill="#fff" stroke="none"/>');
write('link', '#196B6B', '#35A3A3', '<path d="M21 27l7-7M19 31a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 0M29 25a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7 0"/>');
write('generic', '#6E747C', '#A6ABB3', '<path d="M15 22h18M15 27h18M15 32h10"/>');

const folders = [
  ['folder-blue', '#2F5FA8', '#5B8DEF'],
  ['folder-teal', '#157A7A', '#2FB5A8'],
  ['folder-violet', '#5A3E9E', '#8E6BE8'],
  ['folder-amber', '#8C6318', '#D9A441'],
  ['folder-rose', '#8E3157', '#D0668F'],
  ['folder-green', '#2C6B45', '#4FA36B'],
];
for (const [name, c1, c2] of folders) writeFolder(name, c1, c2);

console.log(`Generated ${fs.readdirSync(outDir).length} icons in ${outDir}`);
