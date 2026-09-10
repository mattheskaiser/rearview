declare module "nspell" {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    spell(word: string): { correct: boolean; forbidden: boolean; warn: boolean };
    add(word: string, model?: string): NSpell;
    remove(word: string): NSpell;
    dictionary(dic: string | Uint8Array): NSpell;
    personal(dic: string | Uint8Array): NSpell;
    wordCharacters(): string[] | undefined;
  }

  type Dictionary = { aff: string | Uint8Array; dic?: string | Uint8Array };

  function nspell(dictionary: Dictionary): NSpell;
  function nspell(dictionaries: Dictionary[]): NSpell;
  function nspell(aff: string | Uint8Array, dic?: string | Uint8Array): NSpell;

  export default nspell;
  export type { NSpell, Dictionary };
}
