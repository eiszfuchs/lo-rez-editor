/* global $ */

const _ = require('lodash');

const Color = require('../color');

const inArray = (array, value) => _.indexOf(array, value) >= 0;

const PixelPanel = function ($editor, scale, size) {
    const self = this;

    let palette = [];
    let selectedColor = null;

    let drawing = false;
    let overEditor = null;

    const setEditorValue = function ($cell, color) {
        $cell.attr('data-color', color).trigger('refresh');
    };

    const getEditorValue = function ($cell) {
        return $cell.attr('data-color');
    };

    const getEditorCell = function (x, y) {
        return $editor.find(`[data-x="${x}"][data-y="${y}"]`);
    };

    self.setPalette = (newPalette = []) => {
        palette = newPalette;
    };

    self.setSelected = (newColor = null) => {
        selectedColor = newColor;
    };

    self.pixels = (pixels = []) => {
        if (pixels.length > 0) {
            let index = 0;

            $editor.find('.cell').each(function () {
                const $cell = $(this);
                const color = pixels[index];

                $cell.attr('data-legacy-color', color);

                if (palette.hasOwnProperty(color)) {
                    $cell.attr('data-color', color);
                }

                index += 1;
            });

            $editor.trigger('refresh');

            return self;
        }

        $editor.find('.cell').each(function () {
            const $cell = $(this);
            const color = $cell.attr('data-color');

            if (typeof color === 'undefined') {
                pixels.push(null);
            } else {
                pixels.push(parseInt(color, 10));
            }
        });

        return pixels;
    };

    self.refresh = _.throttle(() => {
        if (palette.length < 1) {
            return false;
        }

        $editor.find('.cell').each(function () {
            const $cell = $(this);
            const color = $cell.attr('data-color');

            let colorValue = 'transparent';

            if (typeof color !== 'undefined') {
                if (palette.hasOwnProperty(color)) {
                    colorValue = palette[color].rgba();
                }
            }

            $cell.css('background-color', colorValue);
        });
    }, 75);

    self.build = (width, height) => {
        $editor.css({
            width: `${width * scale}px`,
            height: `${height * scale}px`,
        });

        _.each(_.range(height), (y) => {
            const $row = $('<div class="row" />');

            _.each(_.range(width), (x) => {
                const $cell = $('<div class="cell" />');

                $cell.attr('data-x', x);
                $cell.attr('data-y', y);

                $row.append($cell);
            });

            $editor.append($row);
        });
    };

    const fillNode = function (x, y, color, visited = []) {
        const $fillCell = getEditorCell(x, y);

        if (inArray(visited, $fillCell[0])) {
            return;
        }

        const oldValue = getEditorValue($fillCell);

        setEditorValue($fillCell, color);
        visited.push($fillCell[0]);

        _.each([
            [+1, 0],
            [-1, 0],
            [0, +1],
            [0, -1],
        ], function (d) {
            const $cell = getEditorCell(x + d[0], y + d[1]);
            const value = getEditorValue($cell);

            if (value === oldValue) {
                fillNode(x + d[0], y + d[1], color, visited);
            }
        });
    };

    const fillEditor = function () {
        fillNode(overEditor.x, overEditor.y, selectedColor);
    };

    self.build(size, size);

    $(document).on('mouseup', function () {
        drawing = false;
    });

    // inefficient code for better understanding
    const matchKey = (char) => char.charCodeAt(0);

    $(document).on('keypress', function (event) {
        const char = event.charCode;

        if (char === matchKey('f') && overEditor) {
            fillEditor();
        }
    });

    $editor.on('refresh', self.refresh);

    $editor.on('mouseenter', '.cell', function () {
        const $cell = $(this);
        const x = parseInt($cell.attr('data-x'), 10);
        const y = parseInt($cell.attr('data-y'), 10);

        overEditor = {x, y};

        $editor.trigger('over-pixel', {x, y});
    });

    $editor.on('mouseleave', function () {
        overEditor = null;

        $editor.trigger('mouse-out');
    });

    $editor.on('mousedown', function () {
        drawing = true;
    });

    $editor.on('mousedown mousemove', '.cell', function (event) {
        event.preventDefault();

        if (!drawing && event.type === 'mousemove') {
            return;
        }

        setEditorValue($(this), selectedColor);
    });

    return self;
};

PixelPanel.getColors = (src) =>
    new Promise((resolve) => {
        const source = document.createElement('img');
        const colors = [];

        source.addEventListener('load', function () {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            canvas.width = this.naturalWidth;
            canvas.height = this.naturalHeight;

            context.drawImage(this, 0, 0);

            for (let y = 0; y < this.naturalHeight; y += 1) {
                for (let x = 0; x < this.naturalWidth; x += 1) {
                    const pixel = context.getImageData(x, y, 1, 1);
                    const data = pixel.data;
                    const color = new Color(data);

                    colors.push(color);
                }
            }

            resolve(colors);
        });

        source.setAttribute('src', src);
    });

module.exports = PixelPanel;
