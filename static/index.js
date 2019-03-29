/* global $ */

{
    const _ = require('lodash');
    const glob = require('glob');
    const Zip = require('adm-zip');

    const ZipOrganizer = require('../modules/organizer')('zip');
    const PaneOrganizer = require('../modules/window-manager');

    const Library = require('../modules/library');
    const ignorance = new Library('lo-rez/ignorance.jsonl', {
        cleanup: (value) => value,
    });

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

    $list.data('ignorance', ignorance);

    const refreshList = () => {
        const $entries = $list.find('.list-entry');
        const totalEntries = $entries.length;

        let definedEntries = 0;

        $entries.each(function () {
            const $entry = $(this);
            const properties = $entry.prop('zip');

            properties.editor.refreshListEntry(properties, $entry);

            const ignored = Boolean(ignorance.get(properties.entry.entryName));

            $entry.toggleClass('is-ignored', ignored);

            if ($entry.is('.is-defined, .is-ignored')) {
                definedEntries += 1;
            }
        });

        const percentFinished = (definedEntries / totalEntries) * 100;

        $('#replacement-progress')
            .find('.bar')
            .css('width', `${percentFinished}%`)
            .end()
            .find('.content strong')
            .text(`${percentFinished.toFixed(1)}%`);
    };

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

            let packFormat = 3;
            const packMeta = zip.getEntry('pack.mcmeta');

            if (packMeta) {
                const packMetaData = packMeta.getData().toString('utf8');
                const packData = JSON.parse(packMetaData);

                packFormat = packData.pack.pack_format || packFormat;
            }

            window.GlobalValues.packFormat = packFormat;

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

                    $list.append(Pane.getListEntry(PaneOrganizer, zip, entry)
                        .addClass('list-entry'));
                });
            });

            refreshList();
        });

        if (files.length === 1) {
            setTimeout(function () {
                $versionSelect
                    .find('option')
                    .last()
                    .prop('selected', true)
                    .siblings()
                    .prop('selected', false)
                    .trigger('change');
            }, 300);
        }
    });

    $list
        .on('refresh', _.debounce(refreshList, 100));

    const $filter = $('#filter');
    const $ignoranceFilter = $('#ignorance-filter');

    const filterList = () => {
        const fullQuery = $filter.val().trim();
        const queries = fullQuery.split(/\s+/).map((d) => d.trim());

        $list.toggleClass('hide-ignored', !$ignoranceFilter.prop('checked'));

        $list.find('li').each(function () {
            const $item = $(this);
            const zip = $item.prop('zip');

            let hidden = fullQuery !== '';

            if (_.every(queries,
                (query) => zip.entry.entryName.includes(query)
            )) {
                hidden = false;
            }

            $item.toggleClass('hidden', hidden);
        });
    };

    $filter
        .on('keyup', _.debounce(filterList, 100));

    $ignoranceFilter
        .on('change', _.debounce(filterList, 100));

    const $export = $('#export');

    $export.on('click', () => {
        $export.addClass('is-loading');

        if (ZipOrganizer.get() === null) {
            return false;
        }

        _.defer(() => {
            Editors.forEach((Pane) => {
                // TODO: These are asynchronous, but do not return Promise
                Pane.export();
            });

            $export.removeClass('is-loading');
        });

        return false;
    });
}
