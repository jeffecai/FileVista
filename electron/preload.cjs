'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = async (channel, ...args) => {
  const response = await ipcRenderer.invoke(channel, ...args);
  if (!response || response.ok !== true) {
    throw new Error((response && response.error) || '操作失败');
  }
  return response.data;
};

const subscribe = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('folio', {
  platform: process.platform,

  listDir: (path, showHidden) => invoke('folio:listDir', path, showHidden),
  drives: () => invoke('folio:drives'),
  places: () => invoke('folio:places'),
  preview: (path) => invoke('folio:preview', path),
  thumbnails: (paths, size) => invoke('folio:thumbnails', paths, size),
  mkdir: (path) => invoke('folio:mkdir', path),
  rename: (from, to) => invoke('folio:rename', from, to),
  trash: (paths) => invoke('folio:trash', paths),
  reveal: (path) => invoke('folio:reveal', path),
  openPath: async (path) => {
    const error = await invoke('folio:openPath', path);
    if (error) throw new Error(error);
  },
  checkConflicts: (sources, destDir) => invoke('folio:checkConflicts', sources, destDir),
  transfer: (request) => invoke('folio:transfer', request),
  cancel: (opId) => invoke('folio:cancel', opId),
  loadSession: () => invoke('folio:session:load'),
  saveSession: (session) => invoke('folio:session:save', session),
  watch: (paths) => invoke('folio:watch', paths),
  copyText: (text) => invoke('folio:copyText', text),
  startDrag: (paths) => invoke('folio:startDrag', paths),
  takeDragSource: () => invoke('folio:takeDragSource'),
  compare: (paths) => invoke('folio:compare', paths),
  locateCompare: () => invoke('folio:compare:locate'),
  shellMenu: (path) => invoke('folio:shellMenu', path),
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return ''; }
  },
  win: (action) => invoke('folio:win', action),
  menu: (items) => invoke('folio:menu', { items }),

  onProgress: (callback) => subscribe('folio:progress', callback),
  onDirChanged: (callback) => subscribe('folio:dir-changed', callback),
  onWindowState: (callback) => subscribe('folio:window-state', callback),
});
