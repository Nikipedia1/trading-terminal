/**
 * Preload — safe bridge (no Node APIs exposed to renderer by default).
 */
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('nacsDesktop', {
  isDesktop: true,
  platform: process.platform,
})
