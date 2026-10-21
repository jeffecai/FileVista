'use strict';

const fsp = require('fs/promises');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { shell, app } = require('electron');
const { toLong, assertPath, joinSafe, uniqueName } = require('./paths.cjs');

const FILE_ATTRIBUTE_HIDDEN = 0x2;

let getFileAttributes = null;
try {
  if (process.platform === 'win32') {
    const koffi = require('koffi');
    const kernel32 = koffi.load('kernel32.dll');
    const GetFileAttributesW = kernel32.func('uint32 __stdcall GetFileAttributesW(str16 lpFileName)');
    getFileAttributes = (fullPath) => {
      try {
        const value = GetFileAttributesW(toLong(fullPath));
        return value === 0xffffffff ? null : Number(value);
      } catch {
        return null;
      }
    };
  }
} catch (err) {
  console.warn('Win32 属性读取不可用，使用名称启发式: ' + err.message);
}

const HIDDEN_NAMES = new Set([
  'appdata', 'application data', 'cookies', 'local settings', 'my documents', 'nethood',
  'printhood', 'recent', 'sendto', 'start menu', 'templates', 'desktop.ini',
  'system volume information', '$recycle.bin', 'config.msi', 'recovery',
  'documents and settings', 'pagefile.sys', 'hiberfil.sys', 'swapfile.sys',
]);

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif', '.svg']);
const TEXT_EXT = new Set([
  '.txt', '.md', '.markdown', '.json', '.jsonc', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.css', '.scss', '.html', '.htm', '.xml', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
  '.log', '.csv', '.tsv', '.sql', '.sh', '.ps1', '.bat', '.cmd', '.py', '.rb', '.go', '.rs',
  '.java', '.c', '.h', '.cpp', '.hpp', '.cs', '.php', '.lua', '.vue', '.svelte', '.gitignore',
  '.env', '.editorconfig', '.lock',
]);
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

class CancelledError extends Error {
  constructor() { super('已取消'); this.name = 'CancelledError'; }
}

function friendly(err) {
  const code = err && err.code;
  if (code === 'EACCES' || code === 'EPERM') return '没有访问权限';
  if (code === 'ENOENT') return '路径不存在';
  if (code === 'ENOTDIR') return '这不是一个文件夹';
  if (code === 'EBUSY') return '文件正被其他程序占用';
  if (code === 'ENOSPC') return '磁盘空间不足';
  if (code === 'EROFS') return '只读磁盘';
  if (code === 'ENAMETOOLONG') return '路径过长';
  return (err && err.message) || '未知错误';
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

function extOf(name) {
  const ext = path.win32.extname(name).toLowerCase();
  return ext;
}

function categoryOf(name, isDir) {
  if (isDir) return 'folder';
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return 'image';
  if (['.mp4', '.mkv', '.mov', '.avi', '.webm', '.mp3', '.flac', '.wav', '.m4a', '.ogg'].includes(ext)) return 'media';
  if (['.zip', '.7z', '.rar', '.tar', '.gz', '.xz', '.bz2', '.iso'].includes(ext)) return 'archive';
  if (['.exe', '.msi', '.bat', '.cmd', '.ps1', '.lnk'].includes(ext)) return 'app';
  if (TEXT_EXT.has(ext)) return 'text';
  if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) return 'doc';
  return 'file';
}

function isHiddenName(name) {
  if (name.startsWith('.')) return true;
  const lower = name.toLowerCase();
  if (HIDDEN_NAMES.has(lower)) return true;
  if (lower.startsWith('ntuser.')) return true;
  return false;
}

async function listDir(input, showHidden = false) {
  let dir;
  try {
    dir = assertPath(input);
  } catch (err) {
    return { path: input, entries: [], error: friendly(err) };
  }
  try {
    const dirents = await fsp.readdir(toLong(dir), { withFileTypes: true });
    const entries = await mapLimit(dirents, 40, async (d) => {
      const full = joinSafe(dir, d.name);
      let stat = null;
      try { stat = await fsp.lstat(toLong(full)); } catch { /* keep dirent info */ }
      const isLink = Boolean(stat && stat.isSymbolicLink());
      let linkTargetIsDir = false;
      if (isLink) {
        try { linkTargetIsDir = (await fsp.stat(toLong(full))).isDirectory(); } catch { /* broken link */ }
      }
      const isDir = stat ? (stat.isDirectory() || (isLink && linkTargetIsDir)) : d.isDirectory();
      const attributes = getFileAttributes ? getFileAttributes(full) : null;
      const attributeHidden = attributes !== null && (attributes & FILE_ATTRIBUTE_HIDDEN) !== 0;
      return {
        name: d.name,
        path: full,
        isDir,
        isSymlink: isLink,
        size: isDir ? null : (stat ? stat.size : null),
        mtime: stat ? stat.mtimeMs : null,
        category: categoryOf(d.name, isDir),
        ext: extOf(d.name),
        hidden: attributeHidden || isHiddenName(d.name),
        attributes,
      };
    });
    const visible = showHidden ? entries : entries.filter((e) => !e.hidden);
    return { path: dir, entries: visible };
  } catch (err) {
    return { path: dir, entries: [], error: friendly(err) };
  }
}

async function drives() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const found = await mapLimit(letters, 10, async (letter) => {
    const root = `${letter}:\\`;
    try {
      const s = await fsp.statfs(root);
      return {
        path: root,
        label: `${letter}:`,
        total: Number(s.blocks) * Number(s.bsize),
        free: Number(s.bavail) * Number(s.bsize),
      };
    } catch {
      return null;
    }
  });
  return found.filter(Boolean);
}

function safeAppPath(name) {
  try { return app.getPath(name); } catch { return null; }
}

function places() {
  const home = safeAppPath('home');
  const list = [];
  const push = (label, p, kind) => { if (p) list.push({ label, path: p, kind }); };
  push('主目录', home, 'home');
  push('桌面', safeAppPath('desktop'), 'desktop');
  push('下载', safeAppPath('downloads'), 'downloads');
  push('文档', safeAppPath('documents'), 'documents');
  push('图片', safeAppPath('pictures'), 'pictures');
  push('音乐', safeAppPath('music'), 'music');
  push('视频', safeAppPath('videos'), 'videos');
  return list;
}

async function preview(input) {
  let target;
  try {
    target = assertPath(input);
  } catch (err) {
    return { type: 'error', path: input, name: '未知', message: friendly(err) };
  }
  try {
    const stat = await fsp.lstat(toLong(target));
    const name = path.win32.basename(target);
    const base = { path: target, name, size: stat.size, mtime: stat.mtimeMs };
    if (stat.isDirectory()) {
      let count = 0;
      try { count = (await fsp.readdir(toLong(target))).length; } catch { /* ignore */ }
      return { ...base, type: 'dir', entryCount: count };
    }
    const ext = extOf(name);
    if (IMAGE_EXT.has(ext) && stat.size <= 12 * 1024 * 1024) {
      const buf = await fsp.readFile(toLong(target));
      const mime = MIME[ext] || 'application/octet-stream';
      return { ...base, type: 'image', dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
    }
    if (TEXT_EXT.has(ext) || stat.size <= 128 * 1024) {
      const handle = await fsp.open(toLong(target), 'r');
      try {
        const max = 256 * 1024;
        const length = Math.min(stat.size, max);
        const buf = Buffer.alloc(length);
        await handle.read(buf, 0, length, 0);
        if (!buf.includes(0)) {
          return {
            ...base,
            type: 'text',
            text: buf.toString('utf8'),
            truncated: stat.size > length,
          };
        }
      } finally {
        await handle.close();
      }
    }
    return { ...base, type: 'meta' };
  } catch (err) {
    return { type: 'error', path: input, name: path.win32.basename(input), message: friendly(err) };
  }
}

async function makeDir(input) {
  const dir = assertPath(input);
  await fsp.mkdir(toLong(dir));
}

async function rename(from, to) {
  const src = assertPath(from);
  const dst = assertPath(to);
  if (src === dst) return;
  try { await fsp.lstat(toLong(dst)); throw new Error('目标名称已存在'); } catch (err) {
    if (err && err.code !== 'ENOENT') throw err;
  }
  await fsp.rename(toLong(src), toLong(dst));
}

async function trash(paths) {
  const errors = [];
  for (const p of paths) {
    try {
      await shell.trashItem(assertPath(p));
    } catch (err) {
      errors.push(`${path.win32.basename(p)}: ${friendly(err)}`);
    }
  }
  return errors;
}

async function openPath(input) {
  const target = assertPath(input);
  const error = await shell.openPath(target);
  return error || null;
}

async function reveal(input) {
  shell.showItemInFolder(assertPath(input));
}

async function checkConflicts(sources, destDir) {
  const dir = assertPath(destDir);
  const conflicts = [];
  for (const src of sources) {
    const name = path.win32.basename(src);
    const dest = joinSafe(dir, name);
    if (fs.existsSync(toLong(dest))) {
      conflicts.push({ name, src, dest });
    }
  }
  return conflicts;
}

const OPS = new Map();

function resolveDestination(dest, policy) {
  if (!fs.existsSync(toLong(dest))) return dest;
  if (policy === 'skip') return null;
  if (policy === 'keepboth') return uniqueName(path.win32.dirname(dest), path.win32.basename(dest), false);
  return dest;
}

async function copyTree(src, dst, state, policy, onFile) {
  if (state.cancelled) throw new CancelledError();
  const srcLong = toLong(src);
  const stat = await fsp.lstat(srcLong);

  if (stat.isSymbolicLink()) {
    if (state.cancelled) throw new CancelledError();
    let finalDst = dst;
    if (fs.existsSync(toLong(dst))) {
      if (policy === 'skip') return;
      if (policy === 'keepboth') finalDst = uniqueName(path.win32.dirname(dst), path.win32.basename(dst), true);
      else await fsp.rm(toLong(dst), { force: true, recursive: true });
    }
    const linkTarget = await fsp.readlink(srcLong);
    try {
      await fsp.symlink(linkTarget, toLong(finalDst), 'junction');
    } catch {
      await fsp.symlink(linkTarget, toLong(finalDst), 'file');
    }
    onFile(src);
    return;
  }

  if (stat.isDirectory()) {
    if (state.cancelled) throw new CancelledError();
    await fsp.mkdir(toLong(dst), { recursive: true }).catch((err) => {
      if (err.code !== 'EEXIST') throw err;
    });
    onFile(src, 0);
    const names = await fsp.readdir(srcLong);
    for (const name of names) {
      if (state.cancelled) throw new CancelledError();
      await copyTree(joinSafe(src, name), joinSafe(dst, name), state, policy, onFile);
    }
    return;
  }

  let finalDst = dst;
  if (fs.existsSync(toLong(dst))) {
    if (policy === 'skip') return;
    if (policy === 'keepboth') finalDst = uniqueName(path.win32.dirname(dst), path.win32.basename(dst), false);
    else await fsp.rm(toLong(dst), { force: true, recursive: true });
  }
  try {
    await fsp.copyFile(srcLong, toLong(finalDst));
  } catch (err) {
    await fsp.rm(toLong(finalDst), { force: true }).catch(() => {});
    throw err;
  }
  onFile(src, stat.size);
}

async function moveOne(src, destDir, state, policy, onFile) {
  const name = path.win32.basename(src);
  let dest = resolveDestination(joinSafe(destDir, name), policy);
  if (!dest) return;
  if (fs.existsSync(toLong(dest)) && policy === 'replace') {
    await fsp.rm(toLong(dest), { force: true, recursive: true });
  }
  try {
    await fsp.rename(toLong(src), toLong(dest));
    onFile(src);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await copyTree(src, dest, state, policy, onFile);
    await fsp.rm(toLong(src), { force: true, recursive: true });
  }
}

async function runTransfer(opId, op, sources, destDir, policy, state, emit) {
  let done = 0;
  let lastEmit = 0;
  const errors = [];
  const notify = (current, force = false) => {
    const now = Date.now();
    if (force || now - lastEmit > 120) {
      lastEmit = now;
      emit({
        opId, op, done, total: sources.length, current,
        state: state.cancelled ? 'cancelled' : 'running',
      });
    }
  };
  const onFile = (file) => {
    done += 1;
    notify(path.win32.basename(file));
  };

  try {
    for (const src of sources) {
      if (state.cancelled) throw new CancelledError();
      try {
        if (op === 'copy') {
          const finalDst = resolveDestination(joinSafe(destDir, path.win32.basename(src)), policy);
          if (finalDst) await copyTree(src, finalDst, state, policy, onFile);
        } else {
          await moveOne(src, destDir, state, policy, onFile);
        }
      } catch (err) {
        if (err instanceof CancelledError) throw err;
        errors.push(`${path.win32.basename(src)}: ${friendly(err)}`);
      }
    }
    notify('', true);
    emit({ opId, op, done, total: sources.length, current: '', state: 'done', errors });
  } catch (err) {
    const cancelled = err instanceof CancelledError;
    emit({
      opId, op, done, total: sources.length, current: '',
      state: cancelled ? 'cancelled' : 'error',
      errors: cancelled ? errors : [...errors, friendly(err)],
    });
  } finally {
    OPS.delete(opId);
  }
}

async function transfer(req, emit) {
  const { op, sources, destDir } = req;
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('没有选中任何文件');
  const dir = assertPath(destDir);
  const policy = ['replace', 'skip', 'keepboth'].includes(req.policy) ? req.policy : 'replace';
  const opId = req.opId || crypto.randomUUID();
  const state = { cancelled: false };
  OPS.set(opId, state);
  const normalized = sources.map((s) => assertPath(s));
  setImmediate(() => runTransfer(opId, op === 'move' ? 'move' : 'copy', normalized, dir, policy, state, emit));
  return { opId };
}

function cancel(opId) {
  const state = OPS.get(opId);
  if (state) state.cancelled = true;
}

module.exports = {
  listDir, drives, places, preview, makeDir, rename, trash, openPath, reveal,
  checkConflicts, transfer, cancel,
};
