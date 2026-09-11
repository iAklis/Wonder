// Languages glyph from Lucide, ISC license; see public/icons/LUCIDE-LICENSE.txt.
// Shared by the UI, Firefox's dynamic icon and the PNG/SVG asset generator.
export const iconPaths = [
  'm5 8 6 6',
  'm4 14 6-6 2-3',
  'M2 5h12',
  'M7 2h1',
  'm22 22-5-10-5 10',
  'M14 18h6',
];
const escapeAttribute = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[char]));
export function createIconSvg({ color = '#fff', background = '#171717', opacity = 1 } = {}) {
  const tile = background === null ? '' : `<rect width="24" height="24" rx="5" fill="${escapeAttribute(background)}"/>`;
  const transform = background === null ? '' : ' transform="translate(4 4) scale(0.666666667)"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${tile}<g fill="none" stroke="${escapeAttribute(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${escapeAttribute(opacity)}"${transform}>${iconPaths.map(d => `<path d="${d}"/>`).join('')}</g></svg>`;
}
