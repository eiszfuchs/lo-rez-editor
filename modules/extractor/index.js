'use strict';

const _ = require('lodash');

const Color = require('../color');
const Palette = require('../palette');

module.exports = function (src, callback) {
    const source = document.createElement('img');

    source.addEventListener('load', function () {
        const width = this.naturalWidth;
        const height = this.naturalHeight;

        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');

        context.drawImage(this, 0, 0);

        const palette = [];

        _.each(_.range(height), function (y) {
            _.each(_.range(width), function (x) {
                const pixel = context.getImageData(x, y, 1, 1);
                const data = pixel.data;
                const color = new Color(data);

                palette.push(color);
            });
        });

        callback({
            width: width,
            height: height,
            palette: Palette.cleanup(palette),
        });
    });

    source.src = src;
};
