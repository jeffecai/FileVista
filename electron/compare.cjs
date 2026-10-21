'use strict';

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app, dialog, BrowserWindow } = require('electron');

let cached = null;

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const current = readSettings();
  const next = { ...current, ...patch };
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf8');
  } catch { /* ignore */ }
}

function exists(value) {
  return typeof value === 'string' && value.length > 0 && fs.existsSync(value);
}

function fromRegistry() {
  for (const version of ['5', '4', '3']) {
    for (const hive of ['HKLM', 'HKCU']) {
      const key = `${hive}\\SOFTWARE\\Scooter Software\\Beyond Compare ${version}`;
      for (const view of [[], ['/reg:32']]) {
        try {
          const output = execFileSync('reg', ['query', key, '/v', 'ExePath', ...view], {
            encoding: 'utf8',
            windowsHide: true,
          });
          const match = output.match(/ExePath\s+REG_SZ\s+(.+)/);
          if (match && exists(match[1].trim())) return match[1].trim();
        } catch { /* key absent */ }
      }
    }
  }
  return null;
}

function candidates() {
  const bases = [
    process.env.ProgramW6432,
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs') : null,
  ].filter(Boolean);
  const list = [];
  for (const base of bases) {
    for (const version of ['5', '4', '3']) {
      list.push(path.join(base, `Beyond Compare ${version}`, 'BCompare.exe'));
    }
  }
  return list;
}

function resolve(force = false) {
  if (!force && exists(cached)) return cached;
  const saved = readSettings().bcompare;
  if (exists(saved)) {
    cached = saved;
    return cached;
  }
  const registry = fromRegistry();
  if (registry) {
    cached = registry;
    return cached;
  }
  for (const candidate of candidates()) {
    if (exists(candidate)) {
      cached = candidate;
      return cached;
    }
  }
  cached = null;
  return null;
}

async function locate() {
  const window = BrowserWindow.getFocusedWindow();
  const options = {
    title: '选择 BCompare.exe',
    properties: ['openFile'],
    filters: [{ name: 'BCompare.exe', extensions: ['exe'] }],
  };
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  const chosen = result.filePaths[0];
  if (!exists(chosen)) return null;
  writeSettings({ bcompare: chosen });
  cached = chosen;
  return chosen;
}

async function comparePaths(paths) {
  if (!Array.isArray(paths) || paths.length !== 2) {
    throw new Error('请选择两个项目再比较');
  }
  for (const target of paths) {
    if (!exists(target)) throw new Error(`路径不存在: ${target}`);
  }
  let exe = resolve();
  if (!exe) exe = await locate();
  if (!exe) throw new Error('未找到 Beyond Compare');
  const child = spawn(exe, paths, { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
  return true;
}

module.exports = { resolve, locate, comparePaths };
