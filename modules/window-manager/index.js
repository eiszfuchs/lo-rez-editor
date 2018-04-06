/* global $ */

const _ = require('lodash');
const doT = require('dot');

const tabTemplate = doT.template(`<li>
    <a>
        <span>{{=it.caption}}</span>

        <button class="delete is-small"></button>
    </a>
</li>`);

const makeTab = (caption) => $(tabTemplate({caption}));

const WindowManager = function () {
    const windows = [];
    let openWindow = null;

    this.close = (win) => {
        if (win.$listEntry) {
            win.$listEntry.removeClass('is-open');
        }

        win.editor.destroy();

        win.$tab.remove();
        win.$pane.remove();

        const removeIndex = _.indexOf(windows, win);

        _.pull(windows, win);

        if (win === openWindow) {
            if (windows.lenth > 0) {
                const openIndex = windows[Math.min(windows.length - 1, removeIndex)];

                this.open(_.nth(windows, openIndex));
            }
        }
    };

    this.open = (win) => {
        if (win === openWindow) {
            return;
        }

        if (openWindow) {
            openWindow.editor.deactivate();
        }

        win.$tab.addClass('is-active').siblings().removeClass('is-active');
        win.$pane.addClass('open').siblings().removeClass('open');

        openWindow = win;
        openWindow.editor.activate();
    };

    this.add = (editor, $listEntry = null) => {
        if (!editor.hasOwnProperty('getTab')) {
            throw Error("Editor doesn't provide tab");
        }

        if (!editor.hasOwnProperty('getPane')) {
            throw Error("Editor doesn't provide content");
        }

        if (!editor.hasOwnProperty('destroy')) {
            throw Error("Editor isn't able to pretend to free memory");
        }

        if (!editor.hasOwnProperty('activate') || !editor.hasOwnProperty('deactivate')) {
            throw Error('Editor cannot be activated');
        }

        const $tab = makeTab(editor.getTab());
        const $pane = editor.getPane().addClass('pane');

        $('main .tabs ul').append($tab);
        $('main section').append($pane);

        const win = {
            editor,
            $tab,
            $pane,
            $listEntry,
        };

        $tab.on('click', '.delete', () => {
            this.close(win);
        });

        $tab.on('click', () => {
            this.open(win);
        });

        if ($listEntry) {
            $listEntry.addClass('is-open');
        }

        windows.push(win);
        this.open(win);
    };

    this.proxy = ($entry) => ({
        add: (editor) => this.add(editor, $entry),
    });

    return this;
};

module.exports = new WindowManager();
