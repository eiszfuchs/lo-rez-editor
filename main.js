const {app, BrowserWindow} = require('electron');

// https://github.com/atom/electron/issues/647
// http://electron.atom.io/docs/api/app/#appsetpathname-path
// This basically makes the application portable.
app.setPath('userData', `${__dirname}/.electron/`);

// https://github.com/electron/electron/issues/8217
// Model editor won't work on my old Macbook, haha
app.commandLine.appendSwitch('ignore-gpu-blacklist');

const fs = require('fs');
const less = require('less');

const staticFolder = 'static/';

let mainWindow;

const compile = (filename, callback) => {
    if (!filename.endsWith('.less')) {
        return;
    }

    const target = filename.replace('.less', '.css');

    fs.readFile(filename, 'utf8', (readError, data) => {
        if (readError) {
            return;
        }

        less.render(data, {}, (renderError, output) => {
            if (renderError) {
                console.error(renderError);

                return;
            }

            fs.writeFile(target, output.css, 'utf8', (writeError) => {
                if (writeError) {
                    console.error(writeError);

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
};

fs.watch(staticFolder, {
    persistent: true,
    recursive: true,
}, (event, filename) => {
    compile(`${staticFolder}${filename}`);
});

app.on('ready', () => {
    compile(`${staticFolder}index.less`, () => {
        mainWindow = new BrowserWindow({
            center: true,

            width: 800,
            minWidth: 770,
            height: 520,
            minHeight: 520,

            useContentSize: true,
            autoHideMenuBar: true,
            webPreferences: {
                devTools: true,
                webgl: true,
            },
        });

        mainWindow.loadFile('views/index.html');
        // mainWindow.webContents.openDevTools();

        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
