'use strict';

const _ = require('lodash');

const Color = function ([newRed, newGreen, newBlue, newAlpha]) {
    let red = newRed;
    let green = newGreen;
    let blue = newBlue;
    let alpha = newAlpha;

    let valid = true;

    const identifiers = [];
    const references = [];

    this.id = function (setId) {
        identifiers.push(setId);
    };

    this.ids = function () {
        return identifiers;
    };

    this.invalidate = function () {
        valid = false;

        return this;
    };

    this.valid = function () {
        return valid;
    };

    this.set = function ([setRed, setGreen, setBlue, setAlpha]) {
        red = setRed;
        green = setGreen;
        blue = setBlue;
        alpha = setAlpha;

        return this;
    };

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
        const r = _.padStart(red.toString(16), 2, '0');
        const g = _.padStart(green.toString(16), 2, '0');
        const b = _.padStart(blue.toString(16), 2, '0');
        const a = _.padStart(alpha.toString(16), 2, '0');

        return `#${a}${r}${g}${b}`.toLowerCase();
    };

    this.rgba = function () {
        return `rgba(${red}, ${green}, ${blue}, ${alpha / 0xff})`;
    };

    this.rgb = function () {
        return `rgb(${red}, ${green}, ${blue})`;
    };

    this.link = function (colorHex) {
        references.push(colorHex);

        return this;
    };

    this.links = function () {
        const links = [this.hex()];

        return links.concat(references);
    };

    this.distance = function (color) {
        return Math.sqrt(
            Math.pow(red - color.red(), 2) +
            Math.pow(green - color.green(), 2) +
            Math.pow(blue - color.blue(), 2) +
            Math.pow(alpha - color.alpha(), 2)
        );
    };

    this.difference = function (color) {
        return (
            Math.abs(red - color.red()) +
            Math.abs(green - color.green()) +
            Math.abs(blue - color.blue()) +
            Math.abs(alpha - color.alpha())
        );
    };

    this.array = function () {
        return [red, green, blue, alpha];
    };

    return this;
};

Color.mix = function (colors) {
    return new Color([
        _.sumBy(colors, (d) => d.red()) / colors.length,
        _.sumBy(colors, (d) => d.green()) / colors.length,
        _.sumBy(colors, (d) => d.blue()) / colors.length,
        _.sumBy(colors, (d) => d.alpha()) / colors.length,
    ]);
};

module.exports = Color;
