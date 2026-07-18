// Инлайн SVG-иконки игровой инфографики (вместо эмодзи). Собственные пути,
// нарисованы в стилистике открытых иконпаков (Lucide/game-icons): stroke 2px,
// сетка 24×24, currentColor — красятся из CSS.

const PATHS = {
  // Капля Звёздной Крови (мана) — заливка.
  drop: '<path fill="currentColor" d="M12 2C12 2 5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2 12 2Z"/>',
  // Четырёхлучевая звезда (Слава / звёздные монеты) — заливка.
  star: '<path fill="currentColor" d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z"/>',
  // Щит (броня).
  shield: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2.5l7.5 3.2V12c0 4.6-3.2 8-7.5 9.5C7.7 20 4.5 16.6 4.5 12V5.7Z"/>',
  // Клинок (атака героя).
  sword: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 4L9.5 14.5M20 4l-3.5.5L6 15l3 3 10.5-10.5ZM7 17l-3 3M9.5 19.5L4.5 14.5"/>',
  // Стопка карт (колода).
  deck: '<rect x="3.5" y="6.5" width="11" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M9 3.5h9.5A2 2 0 0 1 20.5 5.5V17"/>',
  // Веер карт (рука противника).
  hand: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="6" width="8" height="13" rx="1.5" transform="rotate(-12 7 12.5)"/><rect x="13" y="6" width="8" height="13" rx="1.5" transform="rotate(12 17 12.5)"/></g>',
};

export function svgIcon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `ico ico-${name} ${cls}`.trim();
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  return span;
}
