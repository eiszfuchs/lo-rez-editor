const _ = require('lodash');

const isColorNeighbor = (color1, color2) => {
    const diff = color1.difference(color2);

    return diff > 0 && diff <= 3;
};

const thereAreNeighbors = (colors) =>
    colors.filter((color) =>
        colors.filter((compareColor) =>
            isColorNeighbor(color, compareColor)
        ).length > 0
    ).length > 0;

module.exports = {
    cleanup: (colors) => {
        let palette = _.uniqBy(colors, (d) => d.hex());

        for (let c = 0; c < palette.length; c += 1) {
            palette[c].id(c);
        }

        let maxDifference = 0;

        palette.forEach((color) => {
            palette.forEach((compareColor) => {
                maxDifference = Math.max(maxDifference,
                    color.difference(compareColor));
            });
        });

        // Not much variety to compress
        if (maxDifference <= 15) {
            return palette;
        }

        while (thereAreNeighbors(palette)) {
            const neighborSets = palette.map(
                (color) => [color, palette.filter(
                    (compareColor) => isColorNeighbor(color, compareColor)
                )]
            ).filter(([color, neighbors]) => neighbors.length > 0);

            let maxNeighbors = 0;

            neighborSets.forEach(
                ([color, neighbors]) => {
                    maxNeighbors = Math.max(maxNeighbors, neighbors.length);
                }
            );

            for (let c = neighborSets.length - 1; c >= 0; c -= 1) {
                const [color, neighbors] = neighborSets[c];

                if (neighbors.length === maxNeighbors) {
                    neighbors.forEach((neighbor) => {
                        neighbor.ids().forEach(
                            (colorId) => color.id(colorId)
                        );

                        neighbor.links().forEach(
                            (colorHex) => color.link(colorHex)
                        );

                        neighbor.invalidate();
                    });

                    break;
                }
            }

            palette = _.uniqBy(
                palette.filter((d) => d.valid()),
                (d) => d.hex()
            );
        }

        return palette;
    },
};
