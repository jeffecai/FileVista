'use strict';

const { app, BrowserWindow, ipcMain, Menu, Tray, clipboard, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const svc = require('./fs-service.cjs');
const runSelfTest = require('./selftest.cjs');
const runDragTest = require('./dragtest.cjs');
const compare = require('./compare.cjs');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const isSelfTest = process.argv.includes('--selftest');
const isDragTest = process.argv.includes('--dragtest');

if (isDragTest) {
  app.setPath('userData', path.join(require('os').tmpdir(), 'filevista-dragtest-profile'));
}
const appIcon = path.join(__dirname, '..', 'assets', 'FileVista.ico');
const smokeArg = process.argv.find((a) => a.startsWith('--smoke='));
const smokePath = smokeArg ? path.resolve(smokeArg.slice('--smoke='.length)) : null;
const dragIcon = path.join(__dirname, '..', 'assets', 'icon-256.png');
const shellMenuExe = path.join(__dirname, '..', 'native', 'ShellMenu.exe');

let mainWindow = null;
let dragSource = null;
let tray = null;
let isQuitting = false;
let closeHintShown = false;

function humanError(err) {
  const code = err && err.code;
  if (code === 'EEXIST') return '同名文件已存在';
  if (code === 'ENOENT') return '路径不存在';
  if (code === 'EACCES' || code === 'EPERM') return '没有访问权限';
  if (code === 'EINVAL') return '名称无效';
  if (code === 'ENOTEMPTY') return '文件夹不是空的';
  if (code === 'EBUSY') return '文件正被其他程序占用';
  if (code === 'ENAMETOOLONG') return '路径过长';
  return (err && err.message) || '操作失败';
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { ok: true, data: await fn(event, ...args) };
    } catch (err) {
      return { ok: false, error: humanError(err) };
    }
  });
}

/* ---------------- session ---------------- */

const sessionFile = () => path.join(app.getPath('userData'), 'session.json');
const windowFile = () => path.join(app.getPath('userData'), 'window.json');

async function readJson(file) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return null; }
}

async function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(tmp, JSON.stringify(value), 'utf8');
  await fsp.rename(tmp, file);
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(windowFile(), 'utf8');
    const state = JSON.parse(raw);
    if (state && Number.isFinite(state.width) && Number.isFinite(state.height)) return state;
  } catch { /* first run */ }
  return { width: 1360, height: 860 };
}

/* ---------------- watchers ---------------- */

const watchersBySender = new Map();

function watchDirs(sender, paths) {
  const key = sender.id;
  const previous = watchersBySender.get(key);
  if (previous) {
    for (const watcher of previous.values()) {
      try { watcher.close(); } catch { /* ignore */ }
    }
  }
  const map = new Map();
  watchersBySender.set(key, map);
  for (const dir of paths) {
    if (map.has(dir)) continue;
    try {
      let timer = null;
      const watcher = fs.watch(dir, { persistent: false }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          if (!sender.isDestroyed()) sender.send('folio:dir-changed', dir);
        }, 260);
      });
      watcher.on('error', () => {});
      map.set(dir, watcher);
    } catch { /* unreadable / network path */ }
  }
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, ms);
  };
}

/* ---------------- window ---------------- */

function createWindow() {
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 560,
    show: false,
    frame: false,
    backgroundColor: '#F8F8F5',
    title: 'FileVista',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow = win;
  Menu.setApplicationMenu(null);
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => { event.preventDefault(); });

  try {
    const thumbarIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon-16.png'));
    const thumbarReady = win.setThumbarButtons([
      {
        tooltip: '退出 FileVista',
        icon: thumbarIcon,
        click: () => { isQuitting = true; app.quit(); },
      },
    ]);
    if (!thumbarReady) console.error('THUMBAR_NOT_AVAILABLE');
  } catch (err) {
    console.error('THUMBAR_FAIL ' + err.message);
  }

  let painted = false;
  let contentReady = false;
  let shown = false;
  const showWhenReady = () => {
    if (shown || !painted || !contentReady || win.isDestroyed()) return;
    shown = true;
    if (state.maximized) win.maximize();
    win.show();
  };
  win.once('ready-to-show', () => {
    painted = true;
    showWhenReady();
  });
  const onRendererReady = (event) => {
    if (event.sender !== win.webContents) return;
    contentReady = true;
    showWhenReady();
  };
  ipcMain.on('folio:ready', onRendererReady);
  win.on('closed', () => ipcMain.removeListener('folio:ready', onRendererReady));
  setTimeout(() => {
    if (shown) return;
    painted = true;
    contentReady = true;
    showWhenReady();
  }, 1200);

  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const bounds = mainWindow.getNormalBounds();
    writeJson(windowFile(), { ...bounds, maximized: mainWindow.isMaximized() }).catch(() => {});
  };
  win.on('resize', debounce(saveBounds, 400));
  win.on('move', debounce(saveBounds, 400));
  win.on('close', saveBounds);
  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.setSkipTaskbar(true);
    win.hide();
    if (tray && !closeHintShown) {
      closeHintShown = true;
      try {
        tray.displayBalloon({
          title: 'FileVista',
          content: '已隐藏到托盘。双击托盘图标恢复，右键可退出。',
          iconType: 'info',
        });
      } catch { /* balloons may be disabled */ }
    }
  });

  win.on('maximize', () => {
    if (!win.webContents.isDestroyed()) win.webContents.send('folio:window-state', { maximized: true });
  });
  win.on('unmaximize', () => {
    if (!win.webContents.isDestroyed()) win.webContents.send('folio:window-state', { maximized: false });
  });

  win.webContents.on('did-finish-load', async () => {
    if (!smokePath) return;
    const shot = async (file) => {
      const image = await win.webContents.capturePage();
      await fsp.writeFile(file, image.toPNG());
    };
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const settle = () => Promise.race([
      win.webContents.executeJavaScript("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))"),
      wait(900),
    ]);
    const uiState = () => win.webContents.executeJavaScript("JSON.stringify({palette:!!document.querySelector('.palette-scrim'),preview:!!document.querySelector('.preview'),leftActive:!!document.querySelector('.pane.is-active .pane-label'),activeLabel:document.querySelector('.pane.is-active .pane-label')?.textContent||null})");
    const key = (keyCode, modifiers = []) => {
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    };
    try {
      await wait(3200);
      await settle();
      if (process.env.FV_SMOKE_PLAIN) {
        console.log('STATE_PLAIN=' + await uiState());
        await shot(smokePath);
        if (process.env.FV_SMOKE_TOGGLES) {
          key('2', ['control', 'alt']);
          await wait(1000);
          await settle();
          console.log('STATE_QUAD=' + await uiState());
          await shot(smokePath.replace(/\.png$/, '-quad.png'));
          key('5', ['control', 'alt']);
          await wait(1400);
          await settle();
          console.log('STATE_XLARGE=' + await uiState());
          await shot(smokePath.replace(/\.png$/, '-xlarge.png'));
        }
        console.log('SMOKE_OK ' + smokePath);
        app.exit(0);
        return;
      }
      console.log('STATE_MAIN=' + await uiState());
      await shot(smokePath);
      key('K', ['control']);
      await wait(500);
      await settle();
      console.log('STATE_PALETTE=' + await uiState());
      await shot(smokePath.replace(/\.png$/, '-palette.png'));
      key('Escape');
      await wait(400);
      console.log('AFTER_ESCAPE=' + await uiState());
      key('Tab');
      await wait(200);
      console.log('AFTER_TAB=' + await uiState());
      key('Down');
      await wait(150);
      key('Space');
      await wait(700);
      await settle();
      console.log('STATE_PREVIEW=' + await uiState());
      await shot(smokePath.replace(/\.png$/, '-preview.png'));
      console.log('SMOKE_OK ' + smokePath);
    } catch (err) {
      console.error('SMOKE_FAIL ' + err.message);
    } finally {
      app.exit(0);
    }
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  const wcId = win.webContents.id;
  win.on('closed', () => {
    const map = watchersBySender.get(wcId);
    if (map) {
      for (const watcher of map.values()) {
        try { watcher.close(); } catch { /* ignore */ }
      }
    }
    watchersBySender.delete(wcId);
    if (mainWindow === win) mainWindow = null;
  });
}

/* ---------------- IPC ---------------- */

handle('folio:listDir', (_event, dir, showHidden) => svc.listDir(dir, showHidden));
handle('folio:drives', () => svc.drives());
handle('folio:places', () => svc.places());
handle('folio:preview', async (_event, target) => {
  const data = await svc.preview(target);
  if (data && data.type === 'image') {
    try {
      const image = nativeImage.createFromPath(target);
      if (!image.isEmpty()) {
        const size = image.getSize();
        data.width = size.width;
        data.height = size.height;
      }
    } catch { /* ignore */ }
  }
  return data;
});
const thumbnailCache = new Map();
handle('folio:thumbnails', async (_event, paths, size) => {
  const list = Array.isArray(paths)
    ? paths.filter((p) => typeof p === 'string' && p.length > 0).slice(0, 80)
    : [];
  const dim = Math.min(512, Math.max(32, Number(size) || 200));
  const out = {};
  const loadOne = async (target) => {
    try {
      const stat = await fsp.stat(target);
      const key = `${target}|${stat.mtimeMs}|${dim}`;
      if (thumbnailCache.has(key)) {
        out[target] = thumbnailCache.get(key);
        return;
      }
      const image = await nativeImage.createThumbnailFromPath(target, { width: dim, height: dim });
      const url = image && !image.isEmpty() ? image.toDataURL() : null;
      thumbnailCache.set(key, url);
      while (thumbnailCache.size > 600) {
        const first = thumbnailCache.keys().next().value;
        if (!first) break;
        thumbnailCache.delete(first);
      }
      out[target] = url;
    } catch {
      out[target] = null;
    }
  };
  for (let index = 0; index < list.length; index += 6) {
    await Promise.all(list.slice(index, index + 6).map(loadOne));
  }
  return out;
});
handle('folio:mkdir', (_event, target) => svc.makeDir(target));
handle('folio:rename', (_event, from, to) => svc.rename(from, to));
handle('folio:trash', (_event, targets) => svc.trash(targets));
handle('folio:openPath', (_event, target) => svc.openPath(target));
handle('folio:reveal', (_event, target) => svc.reveal(target));
handle('folio:checkConflicts', (_event, sources, destDir) => svc.checkConflicts(sources, destDir));
handle('folio:transfer', (event, request) => svc.transfer(request, (progress) => {
  if (!event.sender.isDestroyed()) event.sender.send('folio:progress', progress);
}));
handle('folio:cancel', (_event, opId) => svc.cancel(opId));
handle('folio:session:load', async () => (await readJson(sessionFile())) || null);
handle('folio:session:save', async (_event, session) => { await writeJson(sessionFile(), session); });
handle('folio:watch', (event, paths) => { watchDirs(event.sender, Array.isArray(paths) ? paths : []); });
handle('folio:copyText', (_event, text) => { clipboard.writeText(String(text)); });
handle('folio:startDrag', (event, paths) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const files = Array.isArray(paths) ? paths.filter((p) => typeof p === 'string' && p.length > 0) : [];
  if (!win || files.length === 0) return false;
  try {
    let icon = nativeImage.createFromPath(dragIcon);
    if (icon.isEmpty()) icon = nativeImage.createFromPath(appIcon);
    dragSource = { paths: files, at: Date.now() };
    win.webContents.startDrag({ file: files[0], files, icon });
    return true;
  } catch (err) {
    console.error('START_DRAG_FAIL ' + err.message);
    return false;
  }
});
handle('folio:takeDragSource', () => {
  if (!dragSource) return null;
  const fresh = Date.now() - dragSource.at < 10000;
  const paths = dragSource.paths;
  dragSource = null;
  return fresh ? paths : null;
});
handle('folio:compare', (_event, paths) => compare.comparePaths(paths));
handle('folio:compare:locate', () => compare.locate());
handle('folio:shellMenu', async (_event, target) => {
  if (typeof target !== 'string' || target.length === 0) throw new Error('无效路径');
  if (!fs.existsSync(shellMenuExe)) throw new Error('原生菜单组件缺失');
  const child = spawn(shellMenuExe, ['--path', target], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return new Promise((resolve) => {
    let settled = false;
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      resolve(code === 0 || code === null);
    });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(true);
    }, 400);
  });
});
handle('folio:win', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  if (action === 'min') win.minimize();
  if (action === 'max') {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
  if (action === 'close') win.close();
  return { maximized: win.isMaximized() };
});
handle('folio:menu', (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return new Promise((resolve) => {
    if (!win || !payload || !Array.isArray(payload.items)) {
      resolve(null);
      return;
    }
    const template = payload.items.map((item) => {
      if (item.type === 'separator') return { type: 'separator' };
      return {
        label: item.label,
        enabled: item.enabled !== false,
        click: () => resolve(item.id),
      };
    });
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win, callback: () => resolve(null) });
  });
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.filevista.app');

  function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setSkipTaskbar(false);
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }

  function createTray() {
    if (tray) return;
    const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon-32.png'));
    tray = new Tray(icon);
    tray.setToolTip('FileVista');
    tray.on('double-click', showMainWindow);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示 FileVista', click: showMainWindow },
      { type: 'separator' },
      { label: '退出 FileVista', click: () => { isQuitting = true; app.quit(); } },
    ]));
  }

  app.on('second-instance', (_event, argv) => {
    if (argv.includes('--quit')) {
      isQuitting = true;
      app.quit();
      return;
    }
    showMainWindow();
  });

  app.on('before-quit', () => { isQuitting = true; });

  app.whenReady().then(async () => {
    if (process.argv.includes('--quit')) {
      app.exit(0);
      return;
    }
    try {
      app.setUserTasks([
        {
          program: process.execPath,
          arguments: `"${app.getAppPath()}" --quit`,
          iconPath: appIcon,
          iconIndex: 0,
          title: '退出 FileVista',
          description: '彻底退出 FileVista',
        },
      ]);
    } catch (err) {
      console.error('SET_USER_TASKS_FAIL ' + err.message);
    }
    if (process.argv.includes('--bctest-compare')) {
      const fsx = require('fs');
      const osx = require('os');
      const dir = fsx.mkdtempSync(path.join(osx.tmpdir(), 'bc-test-'));
      const left = path.join(dir, 'left file.txt');
      const right = path.join(dir, 'right file.txt');
      fsx.writeFileSync(left, 'a');
      fsx.writeFileSync(right, 'b');
      try {
        await compare.comparePaths([left, right]);
        await new Promise((resolve) => setTimeout(resolve, 900));
        console.log('BC_COMPARE_LAUNCHED');
      } catch (err) {
        console.log('BC_COMPARE_FAIL ' + err.message);
      }
      app.exit(0);
      return;
    }
    if (process.argv.includes('--bctest')) {
      const found = compare.resolve(true);
      console.log('BC_PATH=' + (found || 'NOT_FOUND'));
      await new Promise((resolve) => setTimeout(resolve, 300));
      app.exit(found ? 0 : 1);
      return;
    }
    if (isSelfTest) {
      const code = await runSelfTest(svc);
      app.exit(code);
      return;
    }
    if (isDragTest) {
      await runDragTest({ createWindow, sessionFile });
      return;
    }
    createWindow();
    createTray();
    if (smokePath) {
      setTimeout(() => {
        console.error('SMOKE_TIMEOUT');
        app.exit(3);
      }, 25000);
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => { app.quit(); });
}
