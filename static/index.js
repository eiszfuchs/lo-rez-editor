/* global $ */

{
    const _ = require('lodash');
    const glob = require('glob');
    const Zip = require('adm-zip');

    const ZipOrganizer = require('../modules/organizer')('zip');
    const PaneOrganizer = require('../modules/window-manager');

    const Editors = [];

    glob('modules/*-editor', function (error, files) {
        if (error) {
            console.error(error);

            return;
        }

        files.forEach(function (file) {
            Editors.push(require(`../${file}`));
        });
    });

    const $versionSelect = $('#versions');
    const $list = $('#files');

    glob('versions/*.jar', function (error, files) {
        if (error) {
            console.error(error);

            return;
        }

        files.sort().forEach(function (file) {
            $versionSelect.append($('<option />')
                .text(file.replace('versions/', ''))
                .val(file));
        });

        $versionSelect.on('change', function () {
            const value = $versionSelect.find('option:selected').val();

            if (!value) {
                return;
            }

            // TODO: Make this asynchronous
            const zip = new Zip(value);

            ZipOrganizer.set(zip);
            $list.html('');

            zip.getEntries().sort((a, b) => {
                if (a.entryName > b.entryName) {
                    return 1;
                } else if (b.entryName > a.entryName) {
                    return -1;
                }

                return 0;
            }).forEach((entry) => {
                Editors.forEach((Pane) => {
                    if (!Pane.applies(entry)) {
                        return;
                    }

                    $list.append(Pane.getListEntry(PaneOrganizer, zip, entry));
                });
            });
        });
    });

    $('#filter').on('keyup', _.debounce(function () {
        const query = $(this).val();

        if (!query) {
            $list.find('li').removeClass('hidden');

            return;
        }

        $list.find('li').each(function () {
            const $item = $(this);
            const zip = $item.prop('zip');

            if (!zip) {
                return;
            }

            $item.toggleClass('hidden', !zip.entry.entryName.includes(query));
        });
    }, 100));

    $('#export').on('click', () => {
        if (ZipOrganizer.get() === null) {
            return false;
        }

        Editors.forEach((Pane) => {
            Pane.export();
        });

        return false;
    });
}
