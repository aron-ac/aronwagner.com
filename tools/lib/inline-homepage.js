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
  if (!html.includes('data-inline=')) return html;
  const critical = readFileSync(sources['assets/homepage/theme-critical.css'], 'utf8');
  const paper = critical.match(/--paper:\s*(#[\da-f]+);/i)?.[1];
  if (!paper) throw new Error('The critical theme stylesheet must define --paper');
  return html
    .replace('name="theme-color" content=""', `name="theme-color" content="${paper}"`)
    .replace(/<(script|style) data-inline="([^"]+)"><\/\1>/g, (_, tag, filename) => {
      if (!Object.hasOwn(sources, filename)) throw new Error(`Unknown inline source: ${filename}`);
      return `<${tag}>\n${readFileSync(sources[filename], 'utf8')}</${tag}>`;
    });
}
