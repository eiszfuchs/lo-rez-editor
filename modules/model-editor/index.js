/* global $ */

const encoding = 'utf8';

const _ = require('lodash');
const doT = require('dot');
const extendDeep = require('deep-extend');

const ace = require('brace');

require('brace/mode/json');
require('brace/theme/github');

const Library = require('../library');
const library = new Library('lo-rez/models.jsonl');

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

        editor.setTheme('ace/theme/github');
        editor.setOptions({
            maxLines: Infinity,
        });

        const session = editor.getSession();

        session.setMode('ace/mode/json');
        session.setUseWrapMode(true);

        editor.on('change', function () {
            $jsonEditor.addClass('changed');

            update();
        });

        $jsonEditor.prop('editor', editor);

        const $saveButton = $jsonEditor.find('.js-save');

        $saveButton.on('click', () => {
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
        viewer.stop();
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
        const buffer = new Buffer(data, encoding);

        fs.writeFile(`lo-rez/${entryName}`, buffer, function (error) {
            if (error) {
                console.error(error);
            }
        });
    });
};

module.exports = Editor;
