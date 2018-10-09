const $ = require('jquery');

require('electron').ipcRenderer.on('css', (event, message) => {
    $(`head link[href*="${message}"]`).each(function () {
        const $link = $(this);

        $link.attr('href',
            $link.attr('href').replace(/\??(\d+)?$/,
                (...d) => `?${(parseInt(d[1], 10) || 0) + 1}`));
    });
});

window.$ = $;
window.panes = [];
window.GlobalValues = {};
