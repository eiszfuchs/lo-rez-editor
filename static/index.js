/* global $ */

{
    const _ = require('lodash');
    const glob = require('glob');
    const Zip = require('adm-zip');

    const ZipOrganizer = require('../modules/organizer')('zip');
    const VersionsOrganizer = require('../modules/organizer')('versions');
    const PaneOrganizer = require('../modules/window-manager');

    const Library = require('../modules/library');
    const versions = new Library('lo-rez/versions.jsonl');
    const ignorance = new Library('lo-rez/ignorance.jsonl', {
        cleanup: (value) => value,
    });

    VersionsOrganizer.set(versions);

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

    let currentVersion = null;
    const $versionSelect = $('#versions');
    const $list = $('#files');
    const $progress = $('#replacement-progress');

    let listCache = {};
    let listChecks = [];

    const $filter = $('#filter');
    const $ignoranceFilter = $('#ignorance-filter');

    $list.data('ignorance', ignorance);

    const invalidClassified = [
        '.has-null',
        '.has-export-error',
        '.version-mismatch',
        '.verified-error',
    ].join(', ');

    const ignoredClassified = [
        '.is-ignored',
    ].join(', ');

    const definedClassified = [
        '.is-defined',
    ].join(', ');

    const checkCoverage = () => {
        const $entries = $list.find('.list-entry');
        const totalEntries = $entries.length;

        let ignoredEntries = 0;
        let definedEntries = 0;
        let invalidEntries = 0;

        $entries.each(function () {
            const $entry = $(this);

            if (!$entry.is(invalidClassified)) {
                if ($entry.is(ignoredClassified)) {
                    ignoredEntries += 1;
                } else if ($entry.is(definedClassified)) {
                    definedEntries += 1;
                }
            } else {
                invalidEntries += 1;
            }
        });

        const percentIgnored = (ignoredEntries / totalEntries) * 100;
        const percentFinished = (definedEntries / totalEntries) * 100;
        const percentInvalid = (invalidEntries / totalEntries) * 100;

        $progress
            .find('.bar.ignored')
            .css('width', `${percentIgnored}%`);

        $progress
            .find('.bar.finished')
            .css('width', `${percentFinished}%`);

        $progress
            .find('.bar.invalid')
            .css('width', `${percentInvalid}%`);

        $progress
            .find('.content strong')
            .text(`${(percentIgnored + percentFinished).toFixed(1)}%`);
    };

    const isPre14 = (version) => {
        const [major, minor] = version.split('.');

        return parseInt(major, 10) === 1 && parseInt(minor, 10) <= 13;
    };

    const isCompatible = (checkVersion, targetVersion) => {
        if (!checkVersion) {
            return false;
        }

        /* The major texture update happened with 1.14, so the jump towards
         * this version is everything we need to care about, at least for now.
         */
        const checkIsPre14 = isPre14(checkVersion);
        const targetIsPre14 = isPre14(targetVersion);

        return checkIsPre14 === targetIsPre14;
    };

    const checkListEntry = () => {
        const entriesLeftToCheck = listChecks.length > 0;

        $progress.toggleClass('validating', entriesLeftToCheck);

        if (entriesLeftToCheck) {
            const $entry = listChecks.shift();
            const properties = $entry.prop('zip');

            const ignored = Boolean(ignorance.get(properties.entry.entryName));

            if (properties.editor.hasOwnProperty('verifyListEntry')) {
                properties.editor.verifyListEntry(properties, $entry);
            }

            const defined = $entry.is('.is-defined');

            if (!ignored && defined) {
                const entryVersion = versions.get(properties.entry.entryName);
                const versionsMatch = isCompatible(entryVersion, currentVersion);

                $entry.toggleClass('version-mismatch', !versionsMatch);
            }

            checkCoverage();
        }

        requestAnimationFrame(checkListEntry);
    };

    checkListEntry();

    const refreshList = () => {
        const $entries = $list.find('.list-entry');

        listChecks = [];

        $entries.each(function () {
            const $entry = $(this);
            const properties = $entry.prop('zip');

            properties.editor.refreshListEntry(properties, $entry);

            const ignored = Boolean(ignorance.get(properties.entry.entryName));

            $entry.toggleClass('is-ignored', ignored);

            listChecks.push($entry);
        });

        checkCoverage();
    };

    const includesQuery = (zip) =>
        (query) => zip.entry.entryName.includes(query);

    const filterList = () => {
        const fullQuery = $filter.val().trim();
        const queries = fullQuery.split(/\s+/).map((d) => d.trim());

        if (queries.indexOf('grey') >= 0) {
            queries[queries.indexOf('grey')] = 'gray';
        }

        $list.toggleClass('hide-ignored', !$ignoranceFilter.prop('checked'));

        $list.find('li').each(function () {
            const $item = $(this);
            const zip = $item.prop('zip');

            let hidden = fullQuery !== '';

            if (_.every(queries, includesQuery(zip))) {
                hidden = false;
            }

            $item.toggleClass('hidden', hidden);
        });
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

            currentVersion = value.replace('versions/', '').replace('.jar', '');

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

            listCache = {};

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

                    const $entry = Pane
                        .getListEntry(PaneOrganizer, zip, entry)
                        .addClass('list-entry');

                    $list.append($entry);

                    listCache[entry.entryName] = $entry;
                });
            });

            refreshList();
            filterList();
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

    window.getSelectedVersion = () => currentVersion;

    window.getListEntry = (name) => listCache[name];
}
