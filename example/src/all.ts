// Default import works too, but keeps every key in the bundle
import lang from '../texts/en_US.lang';

const text: 'Saved recipe "%s"' = lang['example.saved'];
console.log(text, Object.keys(lang).length);
