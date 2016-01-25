/* jshint node:true, browser:true, jquery:true */

(function () {
    'use strict';

    require('electron').ipcRenderer.on('css', function (event, message) {
        $('head link[href*="' + message + '"]').each(function () {
            let $link = $(this);
            let href = $link.attr('href');

            $link.attr('href', href.replace(/\??(\d+)?$/, d => '?' + ((parseInt(d[1]) || 0) + 1)));
        });
    });

    const glob = require('glob');
    const fs = require('fs');
    const Zip = require('adm-zip');

    const extractor = require('../modules/extractor');
    const Library = require('../modules/library');
    const textureLibrary = new Library('lo-rez/textures.jsonl');
    const Pane = require('../modules/texture-editor');

    glob('versions/*.jar', function (error, files) {
        if (error) {
            console.error(error);
        }

        files.sort(); // better safe than sorry

        const $select = $('#versions');
        const $list = $('#files');

        let currentZip = null;

        $select.on('change', function () {
            let value = $select.find('option:selected').val();

            if (!value) {
                return;
            }

            $list.html('');

            let zip = new Zip(value);
            let entries = zip.getEntries();

            currentZip = zip;

            entries.forEach(function (entry) {
                if (!/textures\/(blocks|items)/.test(entry.entryName)) {
                    return;
                }

                let caption = entry.entryName.replace(/^\/?assets\/minecraft\/textures\//, '');

                let $file = $('<div />').addClass('item');
                let $icon = $('<i />').addClass('icon');
                let $content = $('<div />').addClass('content').text(caption);

                $file.prop('zip', {
                    caption: caption,
                    short: caption.match(/[\w\-_]+\.\w+$/)[0],
                    zip: zip,
                    entry: entry,
                });

                $icon.addClass('circle');

                fs.access('./lo-rez/' + entry.entryName, fs.R_OK | fs.W_OK, function (error) {
                    if (error) {
                        $icon.addClass('thin');
                    }
                });

                if (textureLibrary.get(entry.entryName)) {
                    $icon.addClass('green');
                }

                $file.append($icon);
                $file.append($content);

                $list.append($file);
            });
        });

        $list.on('click', '.item', function () {
            new Pane($(this).prop('zip'), textureLibrary);
        });

        files.forEach(function (file) {
            let $option = $('<option />').text(file);

            $select.append($option);
        });

        $('#export').on('click', function () {
            if (currentZip === null) {
                return false;
            }

            textureLibrary.each(function (d, i) {
                let src = 'data:image/png;base64,' + currentZip.getEntry(i).getData().toString('base64');

                extractor.extract(src, function (result) {
                    var data = extractor.applied(result, d).replace(/^data:image\/\w+;base64,/, '');
                    var buffer = new Buffer(data, 'base64');

                    fs.writeFile('lo-rez/' + i, buffer, function (error) {
                        if (error) {
                            console.error(error);
                        }
                    });
                });
            });

            return false;
        });
    });

    $('select').dropdown();
}());
