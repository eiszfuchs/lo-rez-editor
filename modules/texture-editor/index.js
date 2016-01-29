/* jshint browser:true, jquery:true */

'use strict';

const _ = require('lodash');

const Library = require('../library');
const library = new Library('lo-rez/textures.jsonl');
require('../organizer')('texture').set(library);

const $main = $('main');
const $tabBar = $('main nav');

const Color = require('../color');

const sourceScale = 10;

const inArray = (array, value) => _.indexOf(array, value) >= 0;

let Editor = function (zip) {
    let self = this;

    let $tab = $('<a />').text(zip.short);
    let $close = $('<i />').addClass('close icon');
    $tab.append($close);
    $tabBar.append($tab);

    let $pane = $('<article />');

    let $colors = $('<ul />').addClass('palette');
    let $source = $('<img />').addClass('source')
        .attr('src', 'data:image/png;base64,' + zip.entry.getData().toString('base64'));

    let $segments = $('<div class="ui horizontal loading segments" />');
    let $previews = $('<div class="ui horizontal previews segments" />');

    let palette = [];
    let selectedColor = null;

    let $editor = $('<div />').addClass('editor');
    _.each(_.range(8), function (y) {
        let $row = $('<div />').addClass('row');

        _.each(_.range(8), function (x) {
            let $cell = $('<div />').addClass('cell');
            $cell.attr('data-x', x);
            $cell.attr('data-y', y);

            $row.append($cell);
        });

        $editor.append($row);
    });

    let drawing = false;
    let overEditor = null;
    let context;

    const getColorsAt = function (x, y, width, height) {
        let result = [];

        if (x < 0 || y < 0) {
            return result;
        }

        if ((x + width) > context.width) {
            return result;
        }

        if ((y + height) > context.height) {
            return result;
        }

        let data = context.getImageData(x, y, width, height).data;
        _.each(_.range(width * height), function (d) {
            result.push(new Color(data.slice(d * 4, (d + 1) * 4)));
        });

        return result;
    };

    const highlightColors = function (picked) {
        $colors.find('li').removeClass('picked').each(function () {
            let $color = $(this);
            let color = palette[$color.index()].hex();

            $color.toggleClass('picked', inArray(picked, color));
        });
    };

    const getPaletteIndex = function (color) {
        return _.findIndex(palette, d => d.hex() === color.hex());
    };

    const setEditorValue = function ($cell, color) {
        $cell.attr('data-color', color).trigger('refresh');
        $editor.parent().addClass('orange');
    };

    const getEditorValue = function ($cell) {
        return $cell.attr('data-color');
    };

    const getEditorCell = function (x, y) {
        return $editor.find(`[data-x="${x}"][data-y="${y}"]`);
    };

    const fillNode = function (x, y, color, visited) {
        if (typeof visited === 'undefined') {
            visited = [];
        }

        let $fillCell = getEditorCell(x, y);

        if (inArray(visited, $fillCell[0])) {
            return;
        }

        let oldValue = getEditorValue($fillCell);

        setEditorValue($fillCell, color);
        visited.push($fillCell[0]);

        _.each([
            [+1, 0],
            [-1, 0],
            [0, +1],
            [0, -1],
        ], function (d) {
            let $cell = getEditorCell(x + d[0], y + d[1]);
            let value = getEditorValue($cell);

            if (value == oldValue) {
                fillNode(x + d[0], y + d[1], color, visited);
            }
        });
    };

    const fillEditor = function () {
        fillNode(overEditor.x, overEditor.y, selectedColor);
    };

    // inefficient code for better understanding
    const matchKey = (char) => char.charCodeAt(0);

    $(document).on('keypress', function (event) {
        let char = event.charCode;

        if (char >= matchKey('1') && char <= matchKey('4')) {
            $colors.find('.picked').eq(char - 49).click();
        }

        if (char === matchKey('f') && overEditor) {
            fillEditor();
        }
    });

    $source.on('mousemove', function (event) {
        if (!context) {
            return;
        }

        let x = Math.floor(event.offsetX / sourceScale);
        let y = Math.floor(event.offsetY / sourceScale);

        let detected = _.map(getColorsAt(x, y, 1, 1), d => d.hex());
        highlightColors(detected);
    });

    $source.on('mouseleave', function () {
        $colors.find('li').removeClass('picked');
    });

    $editor.on('mouseenter', '.cell', function () {
        if (!context) {
            return;
        }

        let $cell = $(this);
        let x = parseInt($cell.attr('data-x'));
        let y = parseInt($cell.attr('data-y'));

        overEditor = {x, y};

        let detected = _.map(getColorsAt(x * 2, y * 2, 2, 2), d => d.hex());
        highlightColors(detected);
    });

    $editor.on('mouseleave', function () {
        $colors.find('li').removeClass('picked');

        overEditor = null;
    });

    $editor.on('mousedown', function () {
        drawing = true;
    });

    $(document).on('mouseup', function () {
        drawing = false;
    });

    $editor.on('mousedown mousemove', '.cell', function (event) {
        event.preventDefault();

        if (!drawing && event.type === 'mousemove') {
            return;
        }

        setEditorValue($(this), selectedColor);
    });

    $editor.on('refresh', _.debounce(function () {
        if (palette.length < 1) {
            return false;
        }

        let scale = 4;

        let preview = $('<canvas />')[0];
        preview.width = 8 * scale;
        preview.height = 8 * scale;

        let previewContext = preview.getContext('2d');

        $editor.find('.cell').each(function () {
            let $cell = $(this);
            let color = $cell.attr('data-color');

            let colorValue = 'transparent';

            if (typeof color !== 'undefined') {
                if (palette.hasOwnProperty(color)) {
                    colorValue = palette[color].rgba();
                }
            }

            $cell.css('background-color', colorValue);

            let x = parseInt($cell.attr('data-x'));
            let y = parseInt($cell.attr('data-y'));

            previewContext.fillStyle = colorValue;
            previewContext.fillRect(x * scale, y * scale, scale, scale);
        });

        $previews.find('.segment').eq(1).css('background-image', 'url(' + preview.toDataURL() + ')');

        return false;
    }, 50));

    $source.on('load', function () {
        $source.width(this.naturalWidth * sourceScale);
        $source.height(this.naturalHeight * sourceScale);

        $segments.removeClass('loading');

        let canvas = $('<canvas />')[0];
        canvas.width = this.naturalWidth;
        canvas.height = this.naturalHeight;

        context = canvas.getContext('2d');
        context.drawImage(this, 0, 0);

        let scale = 2;

        let preview = $('<canvas />')[0];
        preview.width = canvas.width * scale;
        preview.height = canvas.height * scale;

        let previewContext = preview.getContext('2d');

        for (let y = 0; y < this.naturalHeight; y++) {
            for (let x = 0; x < this.naturalWidth; x++) {
                let pixel = context.getImageData(x, y, 1, 1);
                let data = pixel.data;
                let color = new Color(data);

                previewContext.fillStyle = color.rgba();
                previewContext.fillRect(x * scale, y * scale, scale, scale);

                palette.push(color);
            }
        }

        $previews.find('.segment').eq(0).css('background-image', 'url(' + preview.toDataURL() + ')');

        palette = _.uniqBy(palette, d => d.hex());

        palette.forEach(function (color, index) {
            let $entry = $('<li />');
            let $b = $('<b />').css({
                color: color.rgb(),
                backgroundColor: color.rgba(),
            });

            $entry.on('click', function () {
                $entry.addClass('selected').siblings().removeClass('selected');
                selectedColor = index;
            });

            $entry.append($b);
            $colors.append($entry);
        });

        $editor.trigger('refresh');
    });

    self.show = function () {
        panes.forEach(d => d.hide());

        $tab.addClass('active');
        $pane.addClass('active');
    };

    self.hide = function () {
        $tab.removeClass('active');
        $pane.removeClass('active');
    };

    self.kill = function () {
        $tab.remove();
        $pane.remove();

        panes = _.without(panes, self);
    };

    $tab.on('click', self.show);
    $close.on('click', self.kill);

    self.pixels = function (pixels) {
        if (pixels) {
            let index = 0;

            $editor.find('.cell').each(function () {
                let $cell = $(this);
                $cell.attr('data-color', pixels[index++]);
            });

            $editor.trigger('refresh');

            return self;
        }

        pixels = [];

        $editor.find('.cell').each(function () {
            let $cell = $(this);
            let color = $cell.attr('data-color');

            if (typeof color === 'undefined') {
                pixels.push(null);
            } else {
                pixels.push(parseInt(color));
            }
        });

        return pixels;
    };

    self.pixels(library.get(zip.entry.entryName));

    self.save = function () {
        library.set(zip.entry.entryName, self.pixels(), function () {
            $editor.parent().removeClass('orange');
        });
    };

    let $autoPilotAction = $('<button class="compact ui left floated button" />')
        .text('Auto pilot')
        .on('click', function () {
            $editor.find('.cell').each(function () {
                let $cell = $(this);
                let x = parseInt($cell.attr('data-x'));
                let y = parseInt($cell.attr('data-y'));

                let colors = getColorsAt(x * 2, y * 2, 2, 2);
                let average = Color.mix(colors);
                colors = _.sortBy(colors, d => d.distance(average)); // .reverse();
                $cell.attr('data-color', getPaletteIndex(colors[0]));
            }).end().trigger('refresh');
        });

    let $saveAction = $('<button class="compact ui primary right floated button" />')
        .text('Save')
        .on('click', self.save);

    $previews.append('<div class="ui preview segment" />');
    $previews.append('<div class="ui preview segment" />');

    $segments.append($source);
    $source.wrap('<div class="ui segment" />').after('<div class="ui bottom left attached label">Original</div>');
    $segments.append($editor);
    $editor.wrap('<div class="ui segment" />').after('<div class="ui bottom right attached label">Remix</div>');

    $pane.append($colors);
    $pane.append(`<div class="hotkeys">Hotkeys:
        <div class="ui label">1-4<div class="detail">Change color</div></div>
        <div class="ui label">F<div class="detail">Fill</div></div>
        </div>`);
    $pane.append($segments);
    $pane.append($previews);

    $pane.append($autoPilotAction);
    $pane.append($saveAction);

    $main.append($pane);

    panes.push(self);
    self.show();

    return self;
};

Editor.applies = (entry) => /textures\/(blocks|items).*\.png$/.test(entry.entryName);

Editor.getListEntry = function (zip, entry) {
    let caption = entry.entryName.replace(/^\/?assets\/minecraft\/textures\//, '');

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

    $icon.addClass('square');

    if (library.get(entry.entryName)) {
        $icon.addClass('green');
    }

    $file.append($icon);
    $file.append($content);

    return $file;
};

const fs = require('fs');
const extractor = require('../extractor');
const painter = require('../painter');
const ZipOrganizer = require('../organizer')('zip');

Editor.export = function () {
    let currentZip = ZipOrganizer.get();

    library.each(function (d, i) {
        let src = 'data:image/png;base64,' + currentZip.getEntry(i).getData().toString('base64');

        extractor(src, function (result) {
            var data = painter(result, d).replace(/^data:image\/\w+;base64,/, '');
            var buffer = new Buffer(data, 'base64');

            fs.writeFile('lo-rez/' + i, buffer, function (error) {
                if (error) {
                    console.error(error);
                }
            });
        });
    });
};

module.exports = Editor;
