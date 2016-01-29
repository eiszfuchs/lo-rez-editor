/* jshint browser:true, jquery:true */

(function () {
    'use strict';

    require('electron').ipcRenderer.on('css', function (event, message) {
        $('head link[href*="' + message + '"]').each(function () {
            let $link = $(this);
            let href = $link.attr('href');

            $link.attr('href', href.replace(/\??(\d+)?$/, d => '?' + ((parseInt(d[1]) || 0) + 1)));
        });
    });

    const _ = require('lodash');

    const ZipOrganizer = require('../modules/organizer')('zip');

    const glob = require('glob');
    const Zip = require('adm-zip');

    let Editors = [];

    glob('modules/*-editor', function (error, files) {
        if (error) {
            console.error(error);
        }

        files.forEach(function (file) {
            Editors.push(require(`../${file}`));
        });
    });

    glob('versions/*.jar', function (error, files) {
        if (error) {
            console.error(error);
            return;
        }

        files.sort(); // better safe than sorry

        const $select = $('#versions');
        const $list = $('#files');

        $select.on('change', function () {
            let value = $select.find('option:selected').val();

            if (!value) {
                return;
            }

            $list.html('');

            let zip = new Zip(value);
            let entries = zip.getEntries();

            ZipOrganizer.set(zip);

            entries.forEach(function (entry) {
                Editors.forEach(function (Pane) {
                    if (!Pane.applies(entry)) {
                        return true;
                    }

                    $list.append(Pane.getListEntry(zip, entry));
                });
            });

            $list.append($list.find('.item').sort(function (a, b) {
                a = $(a).prop('zip').short;
                b = $(b).prop('zip').short;

                if (a > b) {
                    return 1;
                } else if (b > a) {
                    return -1;
                }

                return 0;
            }));
        });

        files.forEach(function (file) {
            let $option = $('<option />').text(file);

            $select.append($option);
        });

        $('#filter input').on('keyup', _.debounce(function () {
            let query = $(this).val();

            $list.find('.item').each(function () {
                let $item = $(this);
                let zip = $item.prop('zip');

                if (!zip) {
                    return true;
                }

                $item.toggleClass('hidden', !zip.entry.entryName.includes(query));
            });
        }, 100));

        $('#export').on('click', function () {
            if (ZipOrganizer.get() === null) {
                return false;
            }

            Editors.forEach(function (Pane) {
                Pane.export();
            });

            return false;
        });
    });

    $('select').dropdown();
}());
