'use strict';

const _ = require('lodash');

let Color = function (data) {
    var red = data[0];
    var green = data[1];
    var blue = data[2];
    var alpha = data[3];

    this.red = function () {
        return red;
    };

    this.green = function () {
        return green;
    };

    this.blue = function () {
        return blue;
    };

    this.alpha = function () {
        return alpha;
    };

    this.hex = function () {
        let r = _.padStart(red.toString(16), 2, '0');
        let g = _.padStart(green.toString(16), 2, '0');
        let b = _.padStart(blue.toString(16), 2, '0');
        let a = _.padStart(alpha.toString(16), 2, '0');

        return '#' + a + r + g + b;
    };

    this.rgba = function () {
        return `rgba(${red}, ${green}, ${blue}, ${alpha / 0xff})`;
    };

    this.rgb = function () {
        return `rgb(${red}, ${green}, ${blue})`;
    };

    this.distance = function (color) {
        return Math.sqrt(
            Math.pow(red - color.red(), 2) +
            Math.pow(green - color.green(), 2) +
            Math.pow(blue - color.blue(), 2) +
            Math.pow(alpha - color.alpha(), 2) );
    };

    this.array = function () {
        return [red, green, blue, alpha];
    };

    return this;
};

Color.mix = function (colors) {
    return new Color([
        _.sumBy(colors, d => d.red()) / colors.length,
        _.sumBy(colors, d => d.green()) / colors.length,
        _.sumBy(colors, d => d.blue()) / colors.length,
        _.sumBy(colors, d => d.alpha()) / colors.length,
    ]);
};

module.exports = Color;
