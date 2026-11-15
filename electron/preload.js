const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('desktop:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-updates'),
  printSilent: (options) => ipcRenderer.invoke('desktop:print-silent', options),
  printHtml: (html, options) => ipcRenderer.invoke('desktop:print-html', html, options),
  toggleFullscreen: () => ipcRenderer.invoke('desktop:toggle-fullscreen'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('desktop:update-available', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('desktop:update-downloaded', (_event, info) => callback(info));
  },
});
