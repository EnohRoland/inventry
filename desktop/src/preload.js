const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  createAdmin: (payload) => ipcRenderer.invoke('create-admin', payload),
});
