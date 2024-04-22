const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

// Create the main window when Electron has finished initializing
app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, '../build', 'slippi-stats-doubles-icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the main HTML file
  mainWindow.loadFile('src/index.html');

  ipcMain.on('select-folder-dialog', (event) => {
      dialog.showOpenDialog({
          properties: ['openDirectory']
      }).then(result => {
          if (!result.canceled && result.filePaths.length > 0) {
              event.sender.send('selected-directory', result.filePaths[0]);
          } else {
              event.sender.send('selected-directory', null);
          }
      }).catch(err => {
          console.error(err);
          event.sender.send('selected-directory', null);
      });
  });

  // Listen for the 'open-folder' event from the renderer process
  ipcMain.on('open-folder', (event, folderPath) => {
    // Check if the folderPath is valid
    if (folderPath) {
        // Open the selected folder on the user's machine
        shell.openPath(folderPath)
            .then(() => {
                console.log('Folder opened successfully');
            })
            .catch(err => {
                console.error('Error opening folder:', err);
            });
    } else {
        // Show an alert if no folder is selected
        dialog.showMessageBox(mainWindow, {
            message: 'Please select a folder first.',
            buttons: ['OK']
        });
    }
  });

});
