'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDragTest({ createWindow, sessionFile }) {
  const root = path.join(os.tmpdir(), 'filevista-dragtest-data');
  const srcDir = path.join(root, 'src');
  const destDir = path.join(root, 'dest');
  await fsp.rm(root, { recursive: true, force: true });
  await fsp.mkdir(srcDir, { recursive: true });
  await fsp.mkdir(destDir, { recursive: true });
  const file = path.join(srcDir, 'dropped.txt');
  await fsp.writeFile(file, 'dropped from outside');
  const file2 = path.join(srcDir, 'dropped2.txt');
  await fsp.writeFile(file2, 'second');

  await fsp.mkdir(path.dirname(sessionFile()), { recursive: true });
  await fsp.writeFile(sessionFile(), JSON.stringify({
    version: 1,
    activePane: 'left',
    showHidden: false,
    compact: false,
    previewOpen: false,
    panes: {
      left: { tabs: [{ path: destDir, sort: { key: 'name', dir: 'asc' } }], activeIndex: 0 },
      right: { tabs: [{ path: srcDir, sort: { key: 'name', dir: 'asc' } }], activeIndex: 0 },
    },
  }));

  createWindow();
  const win = require('electron').BrowserWindow.getAllWindows()[0];
  await sleep(3500);

  const rect = await win.webContents.executeJavaScript(`(() => {
    const el = document.querySelector('.pane-slot .list-scroll');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  })()`);

  if (!rect) {
    console.log('DRAGTEST_FAIL no list rect');
    require('electron').app.exit(1);
    return;
  }

  const x = Math.round(rect.x + rect.width / 2);
  const y = Math.round(rect.y + rect.height / 2);
  const data = {
    items: [{ mimeType: 'text/uri-list', data: 'file:///' + file.replace(/\\/g, '/') }],
    files: [file, file2],
    dragOperationsMask: 1,
  };

  try {
    win.webContents.debugger.attach('1.3');
    for (const type of ['dragEnter', 'dragOver', 'drop']) {
      await win.webContents.debugger.sendCommand('Input.dispatchDragEvent', { type, x, y, data });
      await sleep(150);
    }
  } catch (err) {
    console.log('DRAGTEST_FAIL cdp ' + err.message);
    require('electron').app.exit(1);
    return;
  }

  await sleep(2000);
  const copied = fs.existsSync(path.join(destDir, 'dropped.txt'))
    && fs.existsSync(path.join(destDir, 'dropped2.txt'));
  const size = copied ? fs.statSync(path.join(destDir, 'dropped.txt')).size : 0;
  console.log(`DRAGTEST_${copied ? 'PASS' : 'FAIL'} copied=${copied} size=${size} point=${x},${y}`);
  require('electron').app.exit(copied ? 0 : 1);
}

module.exports = runDragTest;
