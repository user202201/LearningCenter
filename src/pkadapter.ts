/**
 * PK, the contract of a SUBJECT ADAPTER. The shell (`pk.ts`: setup page "对战大厅", player cards, opening, countdown, the turned halves, results, finals, record,
 * sounds) knows nothing about a subject. An adapter is ONE file that supplies what is specific:
 *  - how it is called and where it lives (id, title, routes, entry card art, colour),
 *  - what is needed from the children (`load`, `check` = may this pair play, with the formal messages),
 *  - the items of a game (`make`: `{prompt, choices, answers}` per round, one list per side; the same list twice when both players get the same question),
 *  - how a prompt is shown (`present`: a big character, a word as text, or by voice) and how many rounds a game has (`rounds`),
 *  - the key of the record on this device (`recordKey`: a record is kept per subject and track, never mixed).
 * Adding a third subject (math, science ...) = write `pk-<subject>.ts` with an object of this type, register it in `ADAPTERS` (pk.ts), add two routes in
 * main.ts (`<setup>` and `<setup>/play`, before any pattern that would take "pk" for a child) and call `PK.homeSection("<id>")` on the subject's home.
 */
import type { Item } from "./pklogic";
import type { Kid } from "./model";

export interface PkMode { id: string; /** Chinese source text of the label (translated by i18n) */ label: string }
export interface PkCheck {
  /** may the game start */
  ok: boolean;
  /** formal messages for the setup page (warnings first); built with `h`, names as `user` text */
  msgs: HTMLElement[];
}
export interface PkAdapter<D = unknown> {
  id: string;
  /** the title and the one-line subtitle (Chinese source text; a getter when it depends on the language of the screen) */
  title(): string;
  sub(): string;
  /** colour of the hero band of the setup page */
  color: string;
  setupRoute: string;
  playRoute: string;
  /** where the back button of the setup page leads */
  backRoute: string;
  /** id of the entry card button and its drawing (SVG string, viewBox 0 0 120 80) */
  cardId: string;
  cardArt: string;
  /** the round picture in the hero band of the setup page */
  heroIcon(): Node;
  /** key of the record in `learn.pk.v1` (per subject AND track) */
  recordKey(): string;
  /** rounds of a game (the most; fewer when there is not enough data) */
  rounds: number;
  /** a prompt is shown as a big character, as a word, or by voice (a speaker button; the word as text where there is no voice) */
  present: "char" | "word" | "speech";
  /** true: both players get the same questions (one voice); false: each side its own */
  sameItems: boolean;
  /** modes the setup page offers as pills (the first is the default) */
  modes?: PkMode[];
  /** reads whatever the adapter needs of the children (from storage) */
  load(kids: Kid[]): Promise<D>;
  check(d: D, a: Kid, b: Kid, mode: string): PkCheck;
  /** the items of one game: [items of side 0, items of side 1] (null = no game possible) */
  make(d: D, a: Kid, b: Kid, seed: number, mode: string): [Item[], Item[]] | null;
  /** extra lines for the setup page (the rule of the word source, a missing voice ...) */
  info?(d: D, a: Kid | null, b: Kid | null, mode: string): HTMLElement[];
  /** voice of a "speech" subject: the language tag, and whether this device can say it */
  speech?: { lang(): string; available(): boolean };
}
