'use strict';

let stash = {};

module.exports = (namespace) => ({
    set: function (something) {
        stash[namespace] = something;
    },

    get: function () {
        if (!stash.hasOwnProperty(namespace)) {
            return null;
        }

        return stash[namespace];
    },
});
