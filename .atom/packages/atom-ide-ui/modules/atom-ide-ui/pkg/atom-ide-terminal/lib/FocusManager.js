"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FocusManager = exports.LastItemManager = void 0;

function _terminalView() {
  const data = require("./terminal-view.js");

  _terminalView = function () {
    return data;
  };

  return data;
}

function _log4js() {
  const data = require("log4js");

  _log4js = function () {
    return data;
  };

  return data;
}

function _analytics() {
  const data = require("../../../../nuclide-commons/analytics");

  _analytics = function () {
    return data;
  };

  return data;
}

/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 * @format
 */
const logger = (0, _log4js().getLogger)('terminal-focus-manager'); // These could be individual fields of LastItemManager, but by grouping them,
// we ensure they are always assigned together.

class LastItemManager {
  constructor() {
    this._last = null;
  }

  dispose() {
    if (this._last != null) {
      this._last.onWillRemoveSubscription.dispose();
    }
  }

  get item() {
    return this._last != null ? this._last.item : null;
  }

  onActiveItem(item) {
    const pane = atom.workspace.paneForItem(item);

    if (pane == null) {
      logger.error(`Suspicious: no pane for item: ${String(item)}`);
      return;
    }

    const last = this._last;

    if (last != null) {
      if (item === last.item) {
        return;
      }

      last.onWillRemoveSubscription.dispose();
    } // Subscribe to the destruction of the item. If it is destroyed, then
    // it should no longer be considered the last item focused.


    const onWillRemoveSubscription = pane.onWillRemoveItem(event => {
      if (event.item === item) {
        onWillRemoveSubscription.dispose();

        if (this._last != null && this._last.item === item) {
          this._last = null;
        }
      }
    });
    this._last = {
      item,
      onWillRemoveSubscription
    };
  }

}

exports.LastItemManager = LastItemManager;

class FocusManager {
  constructor() {
    this._lastTerminal = new LastItemManager();
    this._lastEditor = new LastItemManager();
    this._observeActivePaneItemSubscription = atom.workspace.observeActivePaneItem(this._onActivePaneItem.bind(this));
    this._observeActiveTextEditorSubscription = atom.workspace.observeActiveTextEditor(this._onActiveTextEditor.bind(this));
  }

  dispose() {
    this._observeActivePaneItemSubscription.dispose();

    this._lastTerminal.dispose();

    this._observeActiveTextEditorSubscription.dispose();

    this._lastEditor.dispose();
  }

  toggleFocus() {
    (0, _analytics().track)('toggle-terminal-focus');

    if (atom.workspace.getActivePaneItem() instanceof _terminalView().TerminalView) {
      const editor = this._lastEditor.item;

      if (editor != null) {
        focus(editor);
      }
    } else {
      this.focusTerminal();
    }
  }

  _onActivePaneItem(item) {
    if (item instanceof _terminalView().TerminalView) {
      this._lastTerminal.onActiveItem(item);
    }
  }

  _onActiveTextEditor(editor) {
    // Apparently `editor` can be null on startup.
    if (editor != null && editor !== this._lastEditor.item) {
      this._lastEditor.onActiveItem(editor);
    }
  }

  focusTerminal() {
    const lastTerminal = this._lastTerminal.item;

    if (lastTerminal != null) {
      focus(lastTerminal);
      return;
    }

    const someTerminal = findTerminal();

    if (someTerminal != null) {
      focus(someTerminal);
      return;
    } // TODO(mbolin): Decide whether to open a local or remote terminal.
    // Base it on the path of the active text editor?


    atom.notifications.addInfo('No terminal found.');
  }

}
/** Focus the specified Terminal. */


exports.FocusManager = FocusManager;

function focus(item) {
  const pane = atom.workspace.paneForItem(item);

  if (pane == null) {
    return;
  } // First we must activate the item within the pane, then we focus it.


  pane.activateItem(item);
  const view = atom.views.getView(item);
  view.focus();
}
/**
 * Traverses the panes and pane items and returns the first TerminalView it
 * finds, if any.
 */


function findTerminal() {
  for (const pane of atom.workspace.getPanes()) {
    for (const item of pane.getItems()) {
      if (item instanceof _terminalView().TerminalView) {
        return item;
      }
    }
  }

  return null;
}