/* jshint node:true */

'use strict';

const fs = require('fs');
const _ = require('lodash');

const encoding = 'utf8';
const newline = '\n';

// http://jsonlines.org/
const format = function (data) {
    let storageKeys = _.keys(data).sort();
    let lines = [];

    // will save object sorted by keys
    _.each(storageKeys, function (d) {
        lines.push(JSON.stringify({
            name: d,
            value: data[d],
        }));
    });

    return lines.join(newline);
};

const parse = function (lines) {
    let data = {};

    _.each(lines.split(newline), function (d) {
        if (!d) {
            return true;
        }

        d = JSON.parse(d);
        data[d.name] = d.value;
    });

    return data;
};

module.exports = function (savePath) {
    let self = this;

    let storage = {};

    fs.readFile(savePath, encoding, function (error, data) {
        if (error) {
            console.error(error);
            return;
        }

        storage = parse(data);
    });

    let save = _.throttle(function (callback) {
        fs.writeFile(savePath, format(storage), encoding, function (error) {
            if (error) {
                console.error(error);
                return;
            }

            if (callback) {
                callback();
            }
        });
    }, 500);

    self.set = function (name, value, callback) {
        storage[name] = value;

        save(callback);
    };

    self.get = function (name) {
        return storage[name];
    };

    self.each = function (callback) {
        _.each(storage, callback);
    };

    return self;
};
