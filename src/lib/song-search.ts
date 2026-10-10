import { toNormalWidth } from './leaderboard';

/**
 * Song search, by title or by its romaji (title_romaji, from rating-scraper/romaji.js).
 * For "ウミユリ海底譚" (romaji "umiyuri kaiteitan"), all of these find it:
 *
 *   ウミユリ, 海底         part of the title
 *   umiyuri, kaiteitan     part of the romaji
 *   umiyuri kaiteitan      several words: each has to be in there somewhere
 *   umiyurikaiteitan       spaces don't matter
 *   kaitetan               long vowels don't matter either ("tokyo" finds "toukyou")
 *
 * Katakana words are often English, so they can be searched in English too, by how they
 * sound: "end mark" finds エンドマークに希望と涙を添えて ("endomaaku"), "satellite" finds
 * 幻想のサテライト ("sateraito"). Both sides are boiled down to their consonants, spelled
 * the way Japanese would ("end mark" and "endomaaku" are both "ndmk"). That's loose, so
 * it's only tried for a query with at least SOUND_MIN consonants, it has to start at
 * the start of a word, and those matches count for less: songMatcher scores them 1, and a real match 2, so they can be listed after.
 *
 * Full-width letters count as normal ones, and case doesn't matter.
 */

const fold = (text: string) => toNormalWidth(String(text ?? '')).normalize('NFKC').toLowerCase();

// "toukyou" -> "tokyo", "chuuningu" -> "chuningu", "kaitei" -> "kaite": the long vowels
// people often leave out when typing romaji
const shortVowels = (text: string) => text.replace(/([aiueo])\1/g, '$1').replace(/ou/g, 'o').replace(/ei/g, 'e');

const noSpaces = (text: string) => text.replace(/\s+/g, '');

const SOUND_MIN = 3;
const SOUND_MIN_WITHOUT_R = 4; // with the r's gone there's less to go on, so ask for more

/**
 * Roughly how a word sounds, as its consonants, with English and romanized Japanese
 * spelled the same way: l is r, v is b, ch/ts are t, sh is s, an r with no vowel after
 * it is silent ("mark"), doubled letters count once, and vowels (and y, w) are dropped.
 *   "end mark" -> "ndmk", "endomaaku" -> "ndmk"
 *   "satellite" -> "strt", "sateraito" -> "strt"
 *   "tuning" -> "tnng", "chuuningu" -> "tnng"
 */
function sound(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/ck|qu/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/th|sh/g, 's')
    .replace(/ch|ts/g, 't')
    .replace(/l/g, 'r')
    .replace(/v/g, 'b')
    .replace(/r(?![aeiouy])/g, '')
    .replace(/[aeiouyw]/g, '')
    .replace(/h(?=[^aeiou]|$)/g, '')
    .replace(/(.)\1+/g, '$1');
}

// japanese puts a vowel after every r ("doppelganger" is "dopperugengaa"), so sounds are
// also compared with the r's left out
const withoutR = (consonants: string) => consonants.replace(/r/g, '').replace(/(.)\1+/g, '$1');

/**
 * A search query, ready to test songs against: (title, romaji) -> 2 for a match, 1 for
 * one that only sounds right (katakana English), 0.5 for one that sounds right if you
 * ignore the r's, 0 for none. Build it once per query,
 * not once per song.
 */
export function songMatcher(query: string) {
  const q = fold(query).trim();
  if (!q) return () => 2;
  const words = q.split(/\s+/);
  const qJoined = noSpaces(q);
  const qShort = shortVowels(qJoined);
  const qSound = sound(qJoined);
  const qSoundNoR = withoutR(qSound);

  return (title: string, romaji?: string | null) => {
    const text = `${fold(title)} ${romaji ?? ''}`;
    // every word somewhere in the title or the romaji
    if (words.every((w) => text.includes(w))) return 2;
    // or the query as one run, ignoring spaces, then also ignoring long vowels
    const joined = noSpaces(text);
    if (joined.includes(qJoined)) return 2;
    if (!romaji) return 0;
    if (shortVowels(noSpaces(romaji)).includes(qShort)) return 2;
    // or how it sounds, for katakana English ("end mark" finds "endomaaku"), starting at
    // the start of one of the romaji's words (anywhere at all matches far too much)
    const romajiWords = romaji.split(' ');
    let best = 0;
    for (let i = 0; i < romajiWords.length; i++) {
      const from = sound(romajiWords.slice(i).join(''));
      if (qSound.length >= SOUND_MIN && from.startsWith(qSound)) return 1;
      if (qSoundNoR.length >= SOUND_MIN_WITHOUT_R && withoutR(from).startsWith(qSoundNoR)) best = 0.5;
    }
    return best;
  };
}
