/**
 * NACS Lab Terminal — Electron main process (desktop).
 * Dev: loads Vite http://localhost:5173
 * Prod: loads dist/index.html (file://)
 */
const { app, BrowserWindow, shell, Menu, nativeTheme } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

/** Optional: open the live Cloudflare deployment instead of local dist */
const REMOTE_URL = process.env.NACS_DESKTOP_URL || ''

function createWindow() {
  nativeTheme.themeSource = 'dark'

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#05070a',
    title: 'NACS Lab Terminal',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
    if (isDev) win.webContents.openDevTools({ mode: 'detach' })
  })

  // External links → system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const allowed =
      url.startsWith('http://localhost') ||
      url.startsWith('file://') ||
      (REMOTE_URL && url.startsWith(REMOTE_URL))
    if (!allowed && (url.startsWith('http://') || url.startsWith('https://'))) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })

  if (REMOTE_URL) {
    void win.loadURL(REMOTE_URL)
  } else if (isDev) {
    void win.loadURL(DEV_URL)
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  return win
}

function buildMenu() {
  const template = [
    {
      label: 'NACS Lab',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }, { role: 'front' }],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
