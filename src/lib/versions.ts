// otoge-db stores a song's version as a number code. songmeta already saves it as `version_code`
// Any code missing from this list simply shows no version band, so add new versions as they release.
// Check which codes your data has with:  db.songmeta.distinct("version_code")
export const VERSION_NAMES: Record<string, string> = {
    '10000': 'maimai',
    '11000': 'maimai PLUS',
    '12000': 'GreeN',
    '13000': 'GreeN PLUS',
    '14000': 'ORANGE',
    '15000': 'ORANGE PLUS',
    '16000': 'PiNK',
    '17000': 'PiNK PLUS',
    '18000': 'MURASAKi',
    '18500': 'MURASAKi PLUS',
    '19000': 'MiLK',
    '19500': 'MiLK PLUS',
    '19900': 'FiNALE',
    '20000': 'DX',
    '20500': 'DX PLUS',
    '21000': 'Splash',
    '21500': 'Splash PLUS',
    '22000': 'UNiVERSE',
    '22500': 'UNiVERSE PLUS',
    '23000': 'FESTiVAL',
    '23500': 'FESTiVAL PLUS',
    '24000': 'BUDDiES',
    '24500': 'BUDDiES PLUS',
    '25000': 'PRiSM',
    '25500': 'PRiSM PLUS',
    '26000': 'CiRCLE',
    '26500': 'CiRCLE PLUS',
    '27000': 'MAGiCAL', // japan only so far
};

const BASES = Object.keys(VERSION_NAMES).map(Number).sort((a, b) => a - b);
const IN_ORDER = BASES.map((b) => VERSION_NAMES[String(b)]);

// the international best 15's versions, newest first. named rather than "the last two in
// the list", since the list also has versions only japan has so far (MAGICAL). update
// these when the international version changes
export const NEW_POOL_VERSIONS = ['CiRCLE PLUS', 'CiRCLE'];
// the newest version in the best 35 ("PRiSM PLUS and below")
export const NEWEST_OLD_POOL_VERSION = IN_ORDER[IN_ORDER.indexOf(NEW_POOL_VERSIONS[NEW_POOL_VERSIONS.length - 1]) - 1];
// versions newer than international's, newest first: only in the japanese scores (lib/jp-scores.ts)
export const JAPAN_AHEAD_VERSIONS = IN_ORDER.slice(IN_ORDER.indexOf(NEW_POOL_VERSIONS[0]) + 1).reverse();

// otoge-db codes are a version's base code plus an update number (11000 = maimai PLUS, 11007 = its 7th update),
// so pick the highest base that is <= the code. Codes past the newest known version return undefined.
export function versionName(code?: string | number | null): string | undefined {
    if (code == null) return undefined;
    const n = Number(code);
    if (!Number.isFinite(n)) return undefined;
    let base: number | undefined;
    for (const b of BASES) {
        if (b <= n) base = b;
        else break;
    }
    if (base === undefined) return undefined;
    if (base === BASES[BASES.length - 1] && n >= base + 500) return undefined;
    return VERSION_NAMES[String(base)];
}

// one base color per game version; the PLUS release of a version reuses it as a gradient
const VERSION_COLORS: Record<string, string> = {
    MAIMAI: '#6b6b70',
    GREEN: '#3fae5a',
    ORANGE: '#e8891c',
    PINK: '#e86ba5',
    MURASAKI: '#8b5cd6',
    MILK: '#b98f7d',
    FINALE: '#c9a227',
    DX: '#3b82f6',
    SPLASH: '#1fb0d6',
    UNIVERSE: '#4f5bd5',
    FESTIVAL: '#f0742a',
    BUDDIES: '#d9538f',
    PRISM: '#9a6bdc',
    CIRCLE: '#ec6fc0',
    MAGICAL: '#3ab6a0',
};

// returns a CSS `background` value (solid color, or gradient for PLUS versions)
export function versionColor(version?: string): string {
    const upper = (version ?? '').toUpperCase().trim();
    const isPlus = /\bPLUS$/.test(upper);
    const key = upper.replace(/\s*PLUS$/, '').replace(/^MAIMAI\s+DX$/, 'DX');
    const base = VERSION_COLORS[key];
    if (!base) return '#6b6b70';
    return isPlus ? `linear-gradient(90deg, ${base}, color-mix(in srgb, ${base} 60%, white))` : base;
}