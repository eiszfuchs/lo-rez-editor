/* jshint browser:true */

'use strict';

const _ = require('lodash');

const Color = require('../color');

module.exports = function (src, callback) {
    let source = document.createElement('img');

    source.addEventListener('load', function () {
        let width = this.naturalWidth;
        let height = this.naturalHeight;

        let canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        let context = canvas.getContext('2d');
        context.drawImage(this, 0, 0);

        let palette = [];

        _.each(_.range(height), function (y) {
            _.each(_.range(width), function (x) {
                let pixel = context.getImageData(x, y, 1, 1);
                let data = pixel.data;
                let color = new Color(data);

                palette.push(color);
            });
        });

        callback({
            width: width,
            height: height,
            palette: _.uniqBy(palette, d => d.hex()),
        });
    });

    source.src = src;
};
