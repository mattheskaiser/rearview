"use client";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

import { getReadyChecker, getRevision, loadChecker } from "./dictionary";

/** Where the user clicked a flagged word — drives the correction popover. */
export type SpellcheckWordClick = {
  word: string;
  from: number;
  to: number;
  rect: DOMRect;
};

type SpellcheckOptions = {
  onWordClick: (info: SpellcheckWordClick) => void;
};

const key = new PluginKey<SpellState>("spellcheck");
const WORD_RE = /[\p{L}][\p{L}’'-]*/gu;

type SpellState = { decos: DecorationSet; focused: boolean; rev: number };

function buildDecorations(doc: PMNode): DecorationSet {
  const checker = getReadyChecker();
  if (!checker) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const match of node.text.matchAll(WORD_RE)) {
      const word = match[0];
      if (word.length < 2 || /\d/.test(word) || checker.ok(word)) continue;
      const from = pos + (match.index ?? 0);
      decorations.push(
        Decoration.inline(from, from + word.length, {
          class: "spellcheck-error",
        }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * In-editor spell check. Flags unknown words with a red wavy underline while the
 * editor is focused (they disappear on blur), and reports clicks on a flagged
 * word so the caller can offer Replace / Ignore / Add. All checking is local.
 */
export const Spellcheck = Extension.create<SpellcheckOptions>({
  name: "spellcheck",

  addOptions() {
    return { onWordClick: () => {} };
  },

  addCommands() {
    return {
      recheckSpelling:
        () =>
        ({ dispatch, state, tr }) => {
          if (dispatch) dispatch(tr.setMeta(key, { recheck: true }));
          return !!state;
        },
    };
  },

  onCreate() {
    void loadChecker().then(() => this.editor.commands.recheckSpelling());
  },

  addProseMirrorPlugins() {
    const { onWordClick } = this.options;

    return [
      new Plugin<SpellState>({
        key,
        state: {
          init: (_, state) => ({
            decos: buildDecorations(state.doc),
            focused: false,
            rev: getRevision(),
          }),
          apply(tr, value, _old, newState) {
            const meta = tr.getMeta(key) as
              | { focused?: boolean; recheck?: boolean }
              | undefined;
            const focused = meta?.focused ?? value.focused;
            const recompute =
              tr.docChanged || meta?.recheck || getRevision() !== value.rev;
            return {
              decos: recompute
                ? buildDecorations(newState.doc)
                : value.decos.map(tr.mapping, tr.doc),
              focused,
              rev: getRevision(),
            };
          },
        },
        props: {
          decorations(state) {
            const self = key.getState(state);
            return self?.focused ? self.decos : DecorationSet.empty;
          },
          handleDOMEvents: {
            focus: (view) => {
              view.dispatch(view.state.tr.setMeta(key, { focused: true }));
              return false;
            },
            blur: (view) => {
              view.dispatch(view.state.tr.setMeta(key, { focused: false }));
              return false;
            },
          },
          handleClick(view, pos, event) {
            const self = key.getState(view.state);
            const hit = self?.decos.find(pos, pos)[0];
            if (!hit) return false;
            const target = event.target as HTMLElement | null;
            if (!target) return false;
            onWordClick({
              word: view.state.doc.textBetween(hit.from, hit.to),
              from: hit.from,
              to: hit.to,
              rect: target.getBoundingClientRect(),
            });
            return true;
          },
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spellcheck: { recheckSpelling: () => ReturnType };
  }
}
