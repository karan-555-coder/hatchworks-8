// PORCELAIN INK — build-time light/dark inversion + palette + type remap (runs after scripts/build.mjs).
//
// Walks dist/ and rewrites colour literals in CSS (files, <style> blocks, style="" and SVG
// paint attributes) onto the Porcelain Ink palette (dark surfaces become paper, light text becomes ink), and swaps the font families.
// Markup, content and layout are never touched. `npm run build:original` skips this step.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// ---- colour maths --------------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

// Exact pins for the brand colours so the key tones land precisely.
const PIN = {
  '3abdbc': [228, 65, 43],   // brand teal      -> vermilion   #E4412B
  '3badbc': [214, 58, 38],
  '10758b': [176, 46, 30],   // deep teal       -> deep red    #B02E1E
  '1f7f7e': [188, 52, 34],
  '134872': [226, 221, 210], // navy surface    -> warm rule   #E2DDD2
  '151920': [244, 241, 234], // ink surface     -> porcelain   #F4F1EA
  '363943': [218, 213, 202],
  'e67a57': [62, 104, 150],  // coral accent    -> glacier ink #3E6896
  'e97845': [72, 114, 160],
  'bfefef': [150, 36, 22],   // teal tint text  -> oxide red
  'bfebef': [150, 36, 22],
  'daeff3': [60, 58, 54],
  '71c7d2': [196, 60, 40],
  'ffffff': [20, 22, 26],    // white text      -> ink         #14161A
  '000000': [244, 241, 234],
};

function mapRGB(r, g, b, mode) {
  const key = hex([r, g, b]).slice(1);
  let [h, s, l] = rgb2hsl(r, g, b);
  const inv = clamp(1 - .86 * l);            // invert lightness: dark surfaces -> paper, light text -> ink
  if (mode === 'grad' && s >= .14 && h >= 150 && h <= 300) return hsl2rgb(40, .22, clamp(1 - .32 * l, .8, .95));
  if (PIN[key]) return PIN[key];
  // near-black navies (surfaces) and near-white tints count as neutrals so they invert to paper/ink
  if (s < .14 || (l < .22 && s < .75) || (l > .9 && s < .5)) {
    if (l > .96) return PIN.ffffff;
    return inv > .5 ? hsl2rgb(42, .2, inv) : hsl2rgb(220, .1, inv);
  }
  if (h >= 150 && h <= 300) return hsl2rgb(8, .74, clamp(1 - .9 * l, .3, .62));   // cool accents -> vermilion family
  if (h > 300 || h < 60) return hsl2rgb(212, .42, clamp(1 - .9 * l, .3, .6));      // warm accents -> glacier blue
  return hsl2rgb(210, .2, inv);
}

const HEX = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
const ENC = /%23([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/g;
const RGB = /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/gi;

function expand(h) { return h.length <= 4 ? h.split('').map(c => c + c).join('') : h; }
function recolorValue(v, mode) {
  // filters that turned logos white (for dark surfaces) must render them as ink on paper
  v = v.replace(/invert\(\s*(1|100%)\s*\)/gi, 'invert(0)');
  return v
    .replace(HEX, (m, h) => {
      const e = expand(h), rgb = [0, 2, 4].map(i => parseInt(e.slice(i, i + 2), 16));
      return hex(mapRGB(...rgb, mode)) + (e.length === 8 ? e.slice(6) : '');
    })
    .replace(ENC, (m, h) => {
      const e = expand(h), rgb = [0, 2, 4].map(i => parseInt(e.slice(i, i + 2), 16));
      return '%23' + hex(mapRGB(...rgb, mode)).slice(1);
    })
    .replace(RGB, (m, r, g, b, a) => {
      // Faint cool glows (low alpha) were atmosphere on dark surfaces; on paper they become a
      // barely-there warm grey instead of large vermilion washes.
      const alpha = a == null ? 1 : (String(a).includes('%') ? parseFloat(a) / 100 : parseFloat(a));
      const [hh, ss] = rgb2hsl(+r, +g, +b);
      const [R, G, B] = alpha < .35 && ss >= .14 && hh >= 150 && hh <= 300 ? [150, 128, 96] : mapRGB(+r, +g, +b, mode);
      return a != null ? `rgba(${R}, ${G}, ${B}, ${a})` : `rgb(${R}, ${G}, ${B})`;
    });
}

const FONTS = v => v
  .replace(/(['"]?)Space Grotesk\1/gi, "'Instrument Serif'")
  .replace(/(['"]?)open sans\1/gi, "'Geist'");

// CSS: only rewrite declaration values (text after ':' up to ';' or '}'); @font-face untouched.
function recolorCSS(css) {
  const faces = [];
  css = css.replace(/@font-face\s*\{[^}]*\}/gi, m => `\u0000${faces.push(m) - 1}\u0000`);
  // Large gradient fields (backgrounds) turn cool hues into steel; accents elsewhere go sodium.
  css = css.replace(/([\w-]*)(\s*):([^;{}]+)/g, (m, prop, sp, val) =>
    prop + sp + ':' + recolorValue(val, /^background/i.test(prop) && /gradient\(/i.test(val) ? 'grad' : undefined));
  css = css.replace(/(font-family|--f[db]|--e-global-typography-[\w-]*-font-family)\s*:\s*([^;}]+)/gi, (m, k, v) => k + ':' + FONTS(v));
  css = css.replace(/(font\s*:[^;}]*)/gi, m => FONTS(m));
  return css.replace(/\u0000(\d+)\u0000/g, (m, i) => faces[+i]);
}

function recolorHTML(html) {
  return html
    .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, b, c) => a + recolorCSS(b) + c)
    .replace(/(<script(?![^>]*\bsrc=)(?![^>]*application\/(?:ld\+)?json)[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c) => a + recolorJS(b) + c)
    .replace(/\sstyle="([^"]*)"/gi, (m, v) => ` style="${recolorCSS(FONTS(v))}"`)
    .replace(/\s(fill|stroke|stop-color|flood-color)="([^"]*)"/gi, (m, k, v) => ` ${k}="${recolorValue(v)}"`);
}

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

// JS (canvas / inline-style colours): only quoted hex strings and rgb(a)(r,g,b prefixes.
function recolorJS(js) {
  return js
    .replace(/(['"])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\1/g, (m, q, h) => {
      const e = expand(h), rgb = [0, 2, 4].map(i => parseInt(e.slice(i, i + 2), 16));
      return q + hex(mapRGB(...rgb)) + q;
    })
    .replace(/(rgba?\(\s*)(\d{1,3})(\s*,\s*)(\d{1,3})(\s*,\s*)(\d{1,3})/g, (m, a, r, s1, g, s2, b) => {
      const [R, G, B] = mapRGB(+r, +g, +b);
      return `${a}${R}${s1}${G}${s2}${B}`;
    });
}

let n = 0;
for await (const file of walk(DIST)) {
  const ext = path.extname(file).toLowerCase();
  if (!['.css', '.html', '.svg', '.js'].includes(ext)) continue;
  if (/porcelain.(css|js)$/.test(file) || /dashicons|font-awesome|tabler|\.min\.js$|vendor/i.test(file)) continue;
  const src = await fs.readFile(file, 'utf8');
  const out = ext === '.css' ? recolorCSS(src) : ext === '.js' ? recolorJS(src) : recolorHTML(src);
  if (out !== src) { await fs.writeFile(file, out); n++; }
}
console.log(`Porcelain Ink: recoloured ${n} files`);
