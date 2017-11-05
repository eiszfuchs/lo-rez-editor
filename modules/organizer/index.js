const stash = {};

module.exports = (namespace) => ({
    set: (something) => {
        stash[namespace] = something;
    },

    get: () => {
        if (!stash.hasOwnProperty(namespace)) {
            return null;
        }

        return stash[namespace];
    },
});
