/* jshint browser:true, jquery:true */

'use strict';

const encoding = 'utf8';

const _ = require('lodash');
const extendDeep = require('deep-extend');

const ace = require('brace');
require('brace/mode/json');
require('brace/theme/github');

const Library = require('../library');
const library = new Library('lo-rez/models.jsonl');
require('../organizer')('model').set(library);

const Viewer = require('./viewer.js');

const $main = $('main');
const $tabBar = $('main nav');

let Editor = function (zip) {
    let self = this;

    let $tab = $('<a />').text(zip.short);
    let $close = $('<i />').addClass('close icon');

    $tab.append($close);
    $tabBar.append($tab);

    let $pane = $('<article />');

    let $viewerSegment = $('<div class="ui segment" />');
    $viewerSegment.append('<div class="ui bottom right attached label">3D view</div>');

    let viewer = new Viewer();
    viewer.appendTo($viewerSegment);

    let $editorSegment = $('<div class="ui segment" />');
    $editorSegment.append('<div class="ui bottom right attached label">Model data</div>');

    let resolveModelDataChain = function () {
        let chainData = {};

        $editorSegment.find('.model [id^="editor-"]').each(function () {
            let $jsonEditor = $(this).removeClass('error');

            try {
                let data = JSON.parse($jsonEditor.prop('editor').getValue());
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

    let update = function () {
        let fullModelData = resolveModelDataChain();

        viewer.update(fullModelData);
    };

    let prependModelData;
    let loadParentModel;
    let loadModelData;

    loadParentModel = function (parentName) {
        loadModelData(`assets/minecraft/models/${parentName}.json`);
    };

    prependModelData = function (entryName, modelData) {
        let $editor = $('<div class="model" />');
        let $header = $('<div class="header" />').text(entryName);
        let editorId = _.uniqueId('editor-');
        let $jsonEditor = $('<div />').attr('id', editorId);

        $jsonEditor.text(modelData);

        $editor.append($header);
        $editor.append($jsonEditor);
        $editorSegment.prepend($editor);

        $editorSegment.prepend($editorSegment.find('.label'));

        let editor = ace.edit(editorId);
        let session = editor.getSession();

        let $saveButton = $('<button class="ui compact primary icon button"><i class="save icon"></i></button>');
        $saveButton.on('click', function () {
            library.set(entryName, editor.getValue(), function () {
                $jsonEditor.removeClass('changed');
            });
        });
        $editor.append($saveButton);

        editor.setTheme('ace/theme/github');
        editor.setOptions({
            maxLines: Infinity,
        });
        session.setMode('ace/mode/json');
        session.setUseWrapMode(true);

        editor.on('change', function () {
            $jsonEditor.addClass('changed');

            update();
        });

        $jsonEditor.prop('editor', editor);

        let parsedModelData = JSON.parse(modelData);
        if (_.has(parsedModelData, 'parent')) {
            _.defer(() => loadParentModel(parsedModelData.parent));
        }

        update();
    };

    loadModelData = function (entryName) {
        let modelData = library.get(entryName);

        if (!modelData) {
            let entry = zip.zip.getEntry(entryName);

            if (entry === null) {
                return;
            }

            modelData = entry.getData().toString(encoding);
        }

        prependModelData(entryName, modelData);
    };

    let $segments = $('<div class="ui segments" />');
    $segments.append($viewerSegment);
    $segments.append($editorSegment);

    self.show = function () {
        panes.forEach(d => d.hide());

        viewer.start();

        $tab.addClass('active');
        $pane.addClass('active');
    };

    self.hide = function () {
        viewer.stop();

        $tab.removeClass('active');
        $pane.removeClass('active');
    };

    self.kill = function () {
        self.hide();

        $tab.remove();
        $pane.remove();

        panes = _.without(panes, self);
    };

    $tab.on('click', self.show);
    $close.on('click', self.kill);

    $pane.append($segments);

    $main.append($pane);

    loadModelData(zip.entry.entryName);

    panes.push(self);
    self.show();

    return self;
};

Editor.applies = (entry) => /models\/(block).*\.json$/.test(entry.entryName);

Editor.getListEntry = function (zip, entry) {
    let caption = entry.entryName.replace(/^\/?assets\/minecraft\/models\//, '');

    let $file = $('<div />').addClass('item');
    let $icon = $('<i />').addClass('icon');
    let $content = $('<div />').addClass('content').text(caption);

    $file.prop('zip', {
        zip: zip,
        entry: entry,
        caption: caption,
        short: caption.match(/[\w\-_]+\.\w+$/)[0],
    });

    $file.on('click', function () {
        new Editor($(this).prop('zip'));
    });

    $icon.addClass('cube');

    if (library.get(entry.entryName)) {
        $icon.addClass('green');
    }

    $file.append($icon);
    $file.append($content);

    return $file;
};

const fs = require('fs');

Editor.export = function () {
    library.each(function (data, entryName) {
        var buffer = new Buffer(data, encoding);

        fs.writeFile('lo-rez/' + entryName, buffer, function (error) {
            if (error) {
                console.error(error);
            }
        });
    });
};

module.exports = Editor;
