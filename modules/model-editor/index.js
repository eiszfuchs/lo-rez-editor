/* global $, ace */

const encoding = 'utf8';

const _ = require('lodash');
const doT = require('dot');
const extendDeep = require('deep-extend');

const prettier = require('prettier');

const Library = require('../library');
const library = new Library('lo-rez/models.jsonl');
const versions = require('../organizer')('versions').get();

require('../organizer')('model').set(library);

const Viewer = require('./viewer.js');

const entryTemplate = doT.template(`<li>
    <i class="{{=it.icon}}"></i>
    {{=it.caption}}
</li>`);

const editorTemplate = doT.template(`<div class="ui-column">
    <div class="model-viewer"></div>

    <div class="model-editors rest"></div>
</div>`);

const aceRowTemplate = doT.template(`<div class="model-editor">
    <div class="header">
        <div>{{=it.header}}</div>

        <button class="js-ignore button is-info is-small">Ignore</button>

        <button class="js-restore button is-danger is-small">Restore</button>

        <button class="js-auto-uv button is-info is-small">Auto UV</button>

        <button class="js-save button is-info is-small">Save</button>
    </div>

    <div class="js-editor" id="{{=it.id}}"></div>
</div>`);

const Editor = function (paneManager, zip) {
    const self = this;

    const source = zip.entry.getData();

    const $pane = $(editorTemplate({
        source,
    }));

    const ignorance = $('#files').data('ignorance');

    const $viewer = $pane.find('.model-viewer');
    const $editors = $pane.find('.model-editors');

    const viewer = new Viewer();

    viewer.appendTo($viewer);

    const loadOriginalModelData = (entryName) => {
        const entry = zip.zip.getEntry(entryName);

        if (entry === null) {
            return '';
        }

        return entry.getData().toString(encoding);
    };

    const loadModelData = (entryName) => {
        let modelData = library.get(entryName);

        if (!modelData) {
            modelData = loadOriginalModelData(entryName);
        }

        return modelData;
    };

    const getParentModelPath = (parentName) =>
        `assets/minecraft/models/${parentName}.json`;

    const resolveModelDataChain = function () {
        let chainData = {};

        $editors.find('.model-editor').each(function () {
            const $jsonEditor = $(this).removeClass('error');

            try {
                const data = JSON.parse($jsonEditor.prop('editor').getValue());

                chainData = extendDeep(chainData, data);
            } catch (exception) {
                console.error(exception);

                $jsonEditor.addClass('error');

                return false;
            }
        });

        delete chainData.parent;

        return chainData;
    };

    const update = function () {
        viewer.update(resolveModelDataChain());
    };

    const buildEditor = (modelName = zip.entry.entryName) => {
        const modelDataJson = loadModelData(modelName);

        const editorId = _.uniqueId('editor-');
        const $jsonEditor = $(aceRowTemplate({
            id: editorId,
            header: modelName,
        }));

        $jsonEditor.find('.js-editor').text(modelDataJson);
        $editors.prepend($jsonEditor);

        const editor = ace.edit(editorId);
        const session = editor.getSession();

        editor.setTheme('ace/theme/github');
        editor.setOptions({
            maxLines: Infinity,
            showInvisibles: true,
        });

        session.setOptions({
            mode: 'ace/mode/json',
            newLineMode: 'unix',
            useSoftTabs: true,
        });

        editor.on('change', function () {
            $jsonEditor.addClass('changed');

            update();
        });

        $jsonEditor.prop('editor', editor);

        const $autoUvButton = $jsonEditor.find('.js-auto-uv');

        $autoUvButton.on('click', () => {
            const content = JSON.parse(editor.getValue());

            _.each(content.elements, (element) => {
                if (!_.has(element, 'faces')) {
                    return;
                }

                const [[fromX, toX], [fromY, toY], [fromZ, toZ]] = [
                    [Math.min(element.from[0], element.to[0]), Math.max(element.from[0], element.to[0])],
                    [Math.min(element.from[1], element.to[1]), Math.max(element.from[1], element.to[1])],
                    [Math.min(element.from[2], element.to[2]), Math.max(element.from[2], element.to[2])],
                ];

                if (_.entries(element.faces).length === 0) {
                    element.faces = {
                        up:    {texture: '#texture', uv: [16 - fromX, toZ, 16 - toX, fromZ]},
                        down:  {texture: '#texture', uv: [fromX, 16 - toZ, toX, 16 - fromZ]},

                        south: {texture: '#texture', uv: [fromX, 16 - toY, toX, 16 - fromY]},
                        north: {texture: '#texture', uv: [16 - fromX, 16 - toY, 16 - toX, 16 - fromY]},

                        east:  {texture: '#texture', uv: [16 - fromZ, 16 - toY, 16 - toZ, 16 - fromY]},
                        west:  {texture: '#texture', uv: [fromZ, 16 - toY, toZ, 16 - fromY]},
                    };
                }
            });

            editor.setValue(prettier.format(JSON.stringify(content), {
                parser: 'json',
                tabWidth: 4,
                printWidth: 79,
                bracketSpacing: true,
                endOfLine: 'lf',
            }));
        });

        const $saveButton = $jsonEditor.find('.js-save');

        $saveButton.on('click', () => {
            versions.set(modelName, window.getSelectedVersion());
            library.set(modelName, editor.getValue(), () => {
                $jsonEditor.removeClass('changed');

                $('#files').trigger('refresh');
            });
        });

        const $restoreButton = $jsonEditor.find('.js-restore');

        $restoreButton.on('click', () => {
            editor.setValue(loadOriginalModelData(modelName));
        });

        const $ignoreButton = $jsonEditor.find('.js-ignore');
        const refreshIgnore = () => {
            const isIgnored = Boolean(ignorance.get(modelName));
            const isSaved = Boolean(library.get(modelName));

            $jsonEditor.toggleClass('is-ignored', isIgnored);
            $jsonEditor.toggleClass('is-saved', isSaved);

            $ignoreButton.text('Ignore');
            if (isIgnored) {
                $ignoreButton.text('Unignore');
            }
        };

        $ignoreButton.on('click', () => {
            ignorance.set(modelName, !ignorance.get(modelName));
            refreshIgnore();

            $('#files').trigger('refresh');
        });

        refreshIgnore();

        const modelData = JSON.parse(modelDataJson);

        if (_.has(modelData, 'parent')) {
            buildEditor(getParentModelPath(modelData.parent));
        }

        update();
    };

    self.getTab = () => zip.short;

    self.getPane = () => $pane;

    self.activate = () => {
        viewer.start();
    };

    self.deactivate = () => {
        viewer.stop();
    };

    self.destroy = () => {
        viewer.destroy();
    };

    _.defer(buildEditor);

    return paneManager.add(self);
};

const appliesExpression = /models\/(block).*\.json$/;

Editor.applies = (entry) => {
    if (entry.entryName.indexOf('debug') >= 0) {
        return false;
    }

    return appliesExpression.test(entry.entryName);
};

Editor.getListEntry = (paneOrganizer, zip, entry) => {
    const caption = entry.entryName
        .replace(/^\/?assets\/minecraft\/models\//, '');

    const $entry = $(entryTemplate({
        caption: caption,
        icon: 'fa fa-cube',
    })).prop('zip', {
        zip: zip,
        entry: entry,
        editor: Editor,
        caption: caption,
        short: caption.match(/[\w\-_]+\.\w+$/)[0],
    });

    $entry.on('click', function () {
        if ($entry.is('.is-open')) {
            return;
        }

        new Editor(paneOrganizer.proxy($entry), $(this).prop('zip'));
    });

    return $entry;
};

Editor.refreshListEntry = (properties, $entry) => {
    const entry = properties.entry;
    const definition = library.get(entry.entryName);
    const isDefined = typeof definition !== 'undefined';

    $entry.toggleClass('is-defined', isDefined);
};

const fs = require('fs');

Editor.export = function () {
    library.each(function (data, entryName) {
        const buffer = Buffer.from(data, encoding);

        fs.writeFile(`lo-rez/${entryName}`, buffer, function (error) {
            if (error) {
                console.error(error);
            }
        });
    });
};

module.exports = Editor;
