/* global $ */

const doT = require('dot');
const _ = require('lodash');

const tabTemplate = doT.template(`<li>
    <a>
        <span>{{=it.caption}}</span>

        <button class="delete is-small"></button>
    </a>
</li>`);

const makeTab = (caption) => $(tabTemplate({caption}));

const WindowManager = function () {
    const windows = [];

    this.close = (win) => {
        // open closest tab if closed one was active
        if (win.$tab.hasClass('is-active')) {
            const tabIndex = win.$tab.index();
            var closestTab = tabIndex + 1;

            if (tabIndex == windows.length-1) {
                closestTab = tabIndex - 1;
            }

            this.open(_.nth(windows, closestTab));
        }

        // remove closed window from array
        _.pull(windows, win);

        win.editor.destroy();

        win.$tab.remove();
        win.$pane.remove();
    };

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

        if (!editor.hasOwnProperty('destroy')) {
            throw Error("Editor isn't able to pretend to free memory");
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

        $tab.on('click', '.delete', () => {
            this.close(win);
        });

        // close on middle mouse button click
        $tab.on('mouseup', (e) => {
            if (e.which == 2) {
                this.close(win);
            }
        });

        $tab.on('click', () => {
            this.open(win);
        });

        windows.push(win);
        this.open(win);
    };

    return this;
};

module.exports = new WindowManager();
