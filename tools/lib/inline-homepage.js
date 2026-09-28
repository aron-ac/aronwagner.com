import { readFileSync } from 'node:fs';

const sources = {
  'assets/homepage/theme-critical.css': new URL(
    '../../assets/homepage/theme-critical.css',
    import.meta.url,
  ),
  'assets/homepage/theme-bootstrap.js': new URL(
    '../../assets/homepage/theme-bootstrap.js',
    import.meta.url,
  ),
};

// The same expansion runs in development and production. The bootstrap remains
// inline before first paint, while its source is linted like all other scripts.
export function inlineHomepage(html) {
  if (!/\bdata-inline(?=[\s=>/])/.test(html)) return html;
  const critical = readFileSync(sources['assets/homepage/theme-critical.css'], 'utf8');
  const paper = critical.match(/--paper:\s*(#[\da-f]+);/i)?.[1];
  if (!paper) throw new Error('The critical theme stylesheet must define --paper');
  return html
    .replace('name="theme-color" content=""', `name="theme-color" content="${paper}"`)
    .replace(
      /<link\b([^>]*\bdata-inline(?=[\s=>/])[^>]*)>|<script\b([^>]*\bdata-inline(?=[\s=>/])[^>]*)><\/script>/g,
      (_, linkAttributes, scriptAttributes) => {
        const tag = linkAttributes === undefined ? 'script' : 'style';
        const attributes = linkAttributes ?? scriptAttributes;
        const filename = attributes.match(/\b(?:href|src)="([^"]+)"/)?.[1];
        const expected =
          tag === 'style'
            ? 'assets/homepage/theme-critical.css'
            : 'assets/homepage/theme-bootstrap.js';
        if (filename !== expected) throw new Error(`Unknown inline ${tag} source: ${filename}`);
        return `<${tag}>\n${readFileSync(sources[filename], 'utf8')}</${tag}>`;
      },
    );
}
