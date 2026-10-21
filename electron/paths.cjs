'use strict';

const path = require('path');

/** Convert a normal absolute Windows path to an extended-length path for fs calls. */
function toLong(p) {
  if (process.platform !== 'win32') return p;
  if (typeof p !== 'string' || p.length === 0) throw new Error('Invalid path');
  if (p.startsWith('\\\\?\\')) return p;
  const abs = path.win32.resolve(p);
  if (abs.startsWith('\\\\')) return '\\\\?\\UNC\\' + abs.slice(2);
  return '\\\\?\\' + abs;
}

/** Strip the extended prefix for display. */
function fromLong(p) {
  if (typeof p !== 'string') return p;
  if (p.startsWith('\\\\?\\UNC\\')) return '\\\\' + p.slice(8);
  if (p.startsWith('\\\\?\\')) return p.slice(4);
  return p;
}

function assertPath(p) {
  if (typeof p !== 'string' || p.trim().length === 0) {
    throw new Error('路径为空');
  }
  if (!path.win32.isAbsolute(p)) {
    throw new Error('必须是绝对路径: ' + p);
  }
  return path.win32.normalize(p);
}

function joinSafe(dir, name) {
  return path.win32.join(dir, name);
}

function parentOf(p) {
  const parent = path.win32.dirname(p);
  return parent === p ? null : parent;
}

function uniqueName(dir, name, isDir) {
  const ext = isDir ? '' : path.win32.extname(name);
  const base = isDir ? name : name.slice(0, name.length - ext.length);
  for (let i = 2; i < 10000; i += 1) {
    const candidate = path.win32.join(dir, `${base} (${i})${ext}`);
    if (!require('fs').existsSync(toLong(candidate))) return candidate;
  }
  throw new Error('无法生成不重复的文件名');
}

module.exports = { toLong, fromLong, assertPath, joinSafe, parentOf, uniqueName };
