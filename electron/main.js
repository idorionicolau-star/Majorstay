const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');

// Permite reproduzir alertas sonoros sem requerer gesto prévio do utilizador
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Tenta importar electron-updater com fallback seguro caso ainda não esteja instalado
let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
} catch (e) {
  // autoUpdater não disponível localmente até ser instalado
}

const isDev = process.env.NODE_ENV === 'development';
const PRODUCTION_URL = process.env.MAJORSTAY_URL || 'https://stay.majorgroup.app';
const DEV_URL = process.env.ELECTRON_START_URL || 'http://localhost:9002';

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 680,
    title: 'MajorStay — Hotelaria & Gestão',
    backgroundColor: '#001827',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      partition: 'persist:majorstay_app',
    },
    autoHideMenuBar: true,
    show: false,
  });

  const targetUrl = isDev ? DEV_URL : PRODUCTION_URL;

  mainWindow.loadURL(targetUrl);

  // Exibir a janela apenas quando estiver pronta para evitar "flash" branco
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Em caso de falha de conexão com a internet, carrega a página offline amigável
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Ignora cancelamentos intencionais de navegação
    if (errorCode === -3) return;
    console.warn(`Falha ao carregar ${validatedURL}: ${errorDescription} (${errorCode})`);
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
  });

  // Links externos (WhatsApp, documentação, suporte) abrem no navegador padrão do Windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(PRODUCTION_URL) && !url.startsWith(DEV_URL) && !url.startsWith('https://majorstay.vercel.app')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupMenu();
  setupAutoUpdater();
}

// Configuração do Menu do Windows com atalhos de Hotelaria e POS
function setupMenu() {
  const template = [
    {
      label: 'Aplicação',
      submenu: [
        { label: 'Recarregar', accelerator: 'F5', click: () => mainWindow && mainWindow.reload() },
        { label: 'Recarregar Limpo', accelerator: 'Ctrl+F5', click: () => mainWindow && mainWindow.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        {
          label: 'Ecrã Inteiro (Modo Balcão/POS)',
          accelerator: 'F11',
          click: () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()),
        },
        { type: 'separator' },
        { label: 'Sair do MajorStay', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar Tudo' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Abrir Suporte WhatsApp',
          click: () => shell.openExternal('https://wa.me/258842333717'),
        },
        {
          label: 'Verificar Atualizações...',
          click: () => {
            if (autoUpdater) {
              autoUpdater.checkForUpdatesAndNotify();
            }
          },
        },
        // Ferramentas de programador só em desenvolvimento (não aparecem aos funcionários)
        ...(isDev
          ? [
              { type: 'separator' },
              {
                label: 'Ferramentas de Programador',
                accelerator: 'Ctrl+Shift+I',
                click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
              },
            ]
          : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Configuração de Auto-Atualização via GitHub Releases
function setupAutoUpdater() {
  if (!autoUpdater || isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('Atualização encontrada:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:update-available', info);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Atualização descarregada com sucesso:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:update-downloaded', info);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Erro na verificação de atualização:', err.message);
  });

  // Verifica atualizações 10 segundos após a abertura
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdatesAndNotify();
    } catch (e) {
      console.warn('Erro ao verificar atualizações automáticas:', e);
    }
  }, 10000);
}

// IPC Handlers para comunicação segura com a aplicação web
ipcMain.handle('desktop:get-version', () => app.getVersion());

ipcMain.handle('desktop:check-updates', async () => {
  if (!autoUpdater) return { supported: false };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { supported: true, updateInfo: result?.updateInfo };
  } catch (error) {
    return { supported: true, error: error.message };
  }
});

ipcMain.handle('desktop:toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const isFull = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(isFull);
  return isFull;
});

// Impressão Térmica Direta (Silent Print para impressoras de 80mm/58mm)
ipcMain.handle('desktop:print-silent', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'Janela não encontrada' };
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options.silent !== false,
        printBackground: true,
        deviceName: options.deviceName || '',
        margins: { marginType: 'none' },
      },
      (success, failureReason) => {
        if (!success) {
          resolve({ success: false, error: failureReason });
        } else {
          resolve({ success: true });
        }
      }
    );
  });
});

// Imprime só o recibo (HTML), em silêncio, na impressora predefinida do Windows (a térmica).
// Usa uma janela escondida para não imprimir a app inteira.
ipcMain.handle('desktop:print-html', async (event, html, options = {}) => {
  if (typeof html !== 'string' || html.length === 0 || html.length > 2_000_000) {
    return { success: false, error: 'Conteúdo inválido' };
  }
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return await new Promise((resolve) => {
      win.webContents.print(
        {
          silent: options.silent !== false,
          printBackground: true,
          deviceName: typeof options.deviceName === 'string' ? options.deviceName : '',
          margins: { marginType: 'none' },
        },
        (success, failureReason) => resolve(success ? { success: true } : { success: false, error: failureReason })
      );
    });
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : 'Falha ao imprimir' };
  } finally {
    setTimeout(() => { if (!win.isDestroyed()) win.close(); }, 1000);
  }
});

// Ciclo de Vida da Aplicação
app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
