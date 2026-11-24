import { RawMessage } from '@minecraft/server';

import * as lang from '../texts/en_US.lang';
import type { LangArgs, LangKey } from '../texts/en_US.lang';

// The package only gives data and types; the RawMessage helper is yours to name and shape
export function translate<K extends LangKey>(key: K, ...args: LangArgs[K]): RawMessage {
  return { translate: key, with: args };
}

const text: 'Hello!' = lang['example.greeting'];

console.log(text);
console.log(JSON.stringify(translate('example.saved', 'Iron Sword')));
console.log(JSON.stringify(translate('example.moved', 'a', 'b')));

// @ts-expect-error unknown key
translate('example.missing');
// @ts-expect-error example.saved needs one argument
translate('example.saved');
// @ts-expect-error example.percent takes no arguments (%% is an escape)
translate('example.percent', 'x');
