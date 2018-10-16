const fs = require('fs');
const _ = require('lodash');

const encoding = 'utf8';
const newline = '\n';

// http://jsonlines.org/
const format = function (data) {
    const storageKeys = _.keys(data).sort();
    const lines = [];

    // will save object sorted by keys
    _.each(storageKeys, function (d) {
        lines.push(JSON.stringify({
            name: d,
            value: data[d],
        }));
    });

    // End files with newline character
    return lines.join(newline) + newline;
};

const parse = function (lines) {
    const data = {};

    _.each(lines.split(newline), function (d) {
        if (!d) {
            return true;
        }

        const parsed = JSON.parse(d);

        data[parsed.name] = parsed.value;
    });

    return data;
};

module.exports = function (savePath, options = {}) {
    const self = this;

    const {cleanup} = options;

    let storage = {};

    if (!fs.existsSync(savePath)) {
        fs.closeSync(fs.openSync(savePath, 'a'));
    }

    fs.readFile(savePath, encoding, function (error, data) {
        if (error) {
            console.error(error);

            return;
        }

        storage = parse(data);
    });

    const save = _.throttle(function (callback) {
        if (cleanup) {
            storage = _.pickBy(storage, cleanup);
        }

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

    // TODO: Could you please return a Promise
    self.set = function (name, value, callback) {
        storage[name] = value;

        save(callback);
    };

    self.get = function (name) {
        return storage[name];
    };

    self.has = function (name) {
        return storage.hasOwnProperty(name);
    };

    self.each = function (callback) {
        _.each(storage, callback);
    };

    return self;
};
