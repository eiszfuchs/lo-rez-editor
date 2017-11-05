/* global $ */

const doT = require('dot');

const tabTemplate = doT.template(`<li>
    <a>
        <span>{{=it.caption}}</span>
    </a>
</li>`);

const makeTab = (caption) => $(tabTemplate({caption}));

const WindowManager = function () {
    const windows = [];

    this.open = (win) => {
        win.$tab.addClass('is-active').siblings().removeClass('is-active');
        win.$pane.addClass('open').siblings().removeClass('open');
    };

    this.add = (editor) => {
        if (!editor.hasOwnProperty('getTab')) {
            throw Error("Editor doesn't provide tab");
        }

        if (!editor.hasOwnProperty('getPane')) {
            throw Error("Editor doesn't provide content");
        }

        const $tab = makeTab(editor.getTab());
        const $pane = editor.getPane().addClass('pane');

        $('main .tabs ul').append($tab);
        $('main section').append($pane);

        const win = {
            editor,
            $tab,
            $pane,
        };

        $tab.on('click', () => {
            this.open(win);
        });

        windows.push(win);
        this.open(win);
    };

    return this;
};

module.exports = new WindowManager();
