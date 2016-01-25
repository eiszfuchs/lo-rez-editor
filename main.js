/* jshint node:true */

'use strict';

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

var mainWindow = null;

const fs = require('fs');
const less = require('less');

const staticFolder = 'static/';

const compile = function (filename) {
    if (filename.endsWith('.less')) {
        let source = staticFolder + filename;
        let target = source.replace('.less', '.css');

        fs.readFile(source, 'utf8', function (error, data) {
            less.render(data, {}, function (error, output) {
                if (error) {
                    return;
                }

                fs.writeFile(target, output.css, 'utf8', function (error) {
                    if (error) {
                        return;
                    }

                    if (mainWindow === null) {
                        return;
                    }

                    mainWindow.webContents.send('css', target);
                });
            });
        });
    }
};

fs.watch(staticFolder, { persistent: true, recursive: true }, function (event, filename) {
    compile(filename);
});

compile('index.less');

app.on('window-all-closed', function () {
    // if (process.platform != 'darwin') {}

    app.quit();
});

app.on('ready', function () {
    mainWindow = new BrowserWindow({
        'auto-hide-menu-bar': true,
        width: 720,
        height: 480,
        webPreferences: {},
    });
    mainWindow.loadURL('file://' + __dirname + '/views/index.html');

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
});
