const {app, BrowserWindow} = require('electron');

// https://github.com/atom/electron/issues/647
// http://electron.atom.io/docs/api/app/#appsetpathname-path
// This basically makes the application portable.
app.setPath('userData', `${__dirname}/.electron/`);

const fs = require('fs');
const less = require('less');

const staticFolder = 'static/';

let mainWindow;

function compile (filename, callback) {
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

                    if (callback) {
                        callback();
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

app.on('ready', function () {
    compile('index.less', function () {
        mainWindow = new BrowserWindow({
            autoHideMenuBar: true,
            width: 740,
            height: 520,
            webPreferences: {
                webgl: true,
            },
        });

        mainWindow.loadURL(`file://${__dirname}/views/index.html`);
        // mainWindow.webContents.openDevTools();

        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
