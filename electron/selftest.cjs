'use strict';

const fsp = require('fs/promises');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { toLong } = require('./paths.cjs');

module.exports = async function runSelfTest(svc) {
  const root = path.join(os.tmpdir(), `folio-selftest-${Date.now()}`);
  const results = [];
  const pending = new Map();
  const emit = (progress) => {
    const handler = pending.get(progress.opId);
    if (handler) handler(progress);
  };
  const waitDone = (opId, timeout = 20000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('等待操作超时')), timeout);
    pending.set(opId, (progress) => {
      if (progress.state === 'running') return;
      clearTimeout(timer);
      pending.delete(opId);
      resolve(progress);
    });
  });
  const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`);
  };

  try {
    await fsp.mkdir(path.join(root, 'src', 'nested'), { recursive: true });
    await fsp.writeFile(path.join(root, 'src', 'a.txt'), 'alpha');
    await fsp.writeFile(path.join(root, 'src', 'nested', 'b.txt'), 'beta');

    const listing = await svc.listDir(root, false);
    const srcEntry = listing.entries.find((entry) => entry.name === 'src');
    check('listDir 识别文件夹', Boolean(srcEntry && srcEntry.isDir));

    await svc.makeDir(path.join(root, 'dest'));
    await svc.rename(path.join(root, 'src', 'a.txt'), path.join(root, 'src', 'a2.txt'));
    check('rename', fs.existsSync(path.join(root, 'src', 'a2.txt')));

    const copy = await svc.transfer(
      { op: 'copy', sources: [path.join(root, 'src')], destDir: path.join(root, 'dest') },
      emit,
    );
    const copyResult = await waitDone(copy.opId);
    check('copy 完成', copyResult.state === 'done', JSON.stringify(copyResult.errors || []));
    check('copy 递归子文件', fs.existsSync(path.join(root, 'dest', 'src', 'nested', 'b.txt')));

    const skip = await svc.transfer(
      { op: 'copy', sources: [path.join(root, 'src')], destDir: path.join(root, 'dest'), policy: 'skip' },
      emit,
    );
    const skipResult = await waitDone(skip.opId);
    check('copy 冲突跳过', skipResult.state === 'done');

    const keep = await svc.transfer(
      { op: 'copy', sources: [path.join(root, 'src')], destDir: path.join(root, 'dest'), policy: 'keepboth' },
      emit,
    );
    const keepResult = await waitDone(keep.opId);
    check('copy 冲突保留两者', keepResult.state === 'done' && fs.existsSync(path.join(root, 'dest', 'src (2)')));

    await fsp.mkdir(path.join(root, 'emptyfolder'));
    const emptyCopy = await svc.transfer(
      { op: 'copy', sources: [path.join(root, 'emptyfolder')], destDir: path.join(root, 'dest') },
      emit,
    );
    const emptyResult = await waitDone(emptyCopy.opId);
    check('空文件夹复制计数', emptyResult.state === 'done' && emptyResult.done >= 1 && fs.existsSync(path.join(root, 'dest', 'emptyfolder')));

    const move = await svc.transfer(
      { op: 'move', sources: [path.join(root, 'src', 'nested')], destDir: path.join(root, 'dest') },
      emit,
    );
    const moveResult = await waitDone(move.opId);
    check('move 完成', moveResult.state === 'done');
    check('move 移除源', !fs.existsSync(path.join(root, 'src', 'nested')));

    let deep = root;
    for (let i = 0; i < 14; i += 1) deep = path.join(deep, `longdirectoryname${i}`);
    await fsp.mkdir(toLong(deep), { recursive: true });
    await fsp.writeFile(toLong(path.join(deep, 'x.txt')), 'x');
    const deepListing = await svc.listDir(deep, false);
    check('长路径 >260 字符', deep.length > 260 && deepListing.entries.some((entry) => entry.name === 'x.txt'), `长度 ${deep.length}`);

    const trashTarget = path.join(root, 'src', 'a2.txt');
    const trashErrors = await svc.trash([trashTarget]);
    check('删除到回收站', trashErrors.length === 0 && !fs.existsSync(trashTarget), trashErrors.join('; '));

    const missing = await svc.listDir(path.join(root, 'does-not-exist'));
    check('缺失路径返回错误', Boolean(missing.error), missing.error || '');

    const preview = await svc.preview(path.join(root, 'dest', 'src', 'nested', 'b.txt'));
    check('文本预览', preview.type === 'text' && preview.text === 'beta');

    const conflicts = await svc.checkConflicts([path.join(root, 'src')], path.join(root, 'dest'));
    check('冲突检测', conflicts.length === 1);

    const homeListing = await svc.listDir(os.homedir(), false);
    const homeHidden = await svc.listDir(os.homedir(), true);
    const appDataHidden = homeHidden.entries.some((entry) => entry.name.toLowerCase() === 'appdata');
    if (appDataHidden) {
      const visible = homeListing.entries.some((entry) => entry.name.toLowerCase() === 'appdata');
      check('Win32 隐藏属性：AppData 默认不显示', !visible);
      const appDataEntry = homeHidden.entries.find((entry) => entry.name.toLowerCase() === 'appdata');
      check('Win32 隐藏属性：可切换显示', Boolean(appDataEntry && appDataEntry.hidden));
      check('Win32 属性位 HIDDEN=0x2', Boolean(appDataEntry && typeof appDataEntry.attributes === 'number' && (appDataEntry.attributes & 2) === 2));
    } else {
      console.log('SKIP AppData 不在用户目录中，无法验证隐藏属性');
    }

    await fsp.rm(toLong(root), { recursive: true, force: true });
    const failed = results.filter((result) => !result.ok).length;
    console.log(`SELFTEST ${failed === 0 ? 'ALL_PASS' : 'FAILED'} ${results.length - failed}/${results.length}`);
    return failed === 0 ? 0 : 1;
  } catch (error) {
    console.error('SELFTEST_ERROR', error);
    try { await fsp.rm(toLong(root), { recursive: true, force: true }); } catch { /* ignore */ }
    return 2;
  }
};
