/**
 * Animação de "salvou": um cartão fantasma sai do painel de confirmação e voa até o cartão de verdade na lista,
 * encolhendo para o tamanho dele. Ao chegar, o cartão real dá um pulo curto. Sem movimento quando o sistema pede.
 */
export function flyToCard(id: string, from: DOMRect | null, titulo: string, tags: string[], thumb: string) {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Espera o React desenhar o cartão atualizado.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const card = document.querySelector<HTMLElement>('#list [data-id="' + CSS.escape(id) + '"]');
    if (!card) return;
    const land = () => { card.classList.remove('landed'); void card.offsetWidth; card.classList.add('landed'); setTimeout(() => card.classList.remove('landed'), 700); };
    if (calm || !from || !card.animate) { land(); return; }
    let to = card.getBoundingClientRect();
    if (to.bottom < 0 || to.top > window.innerHeight) { card.scrollIntoView({ block: 'center' }); to = card.getBoundingClientRect(); }
    const g = document.createElement('div');
    g.className = 'fly-ghost';
    g.setAttribute('aria-hidden', 'true');
    if (thumb) { const im = document.createElement('img'); im.src = thumb; im.alt = ''; im.referrerPolicy = 'no-referrer'; g.appendChild(im); }
    const t = document.createElement('b'); t.textContent = titulo; g.appendChild(t);
    if (tags.length) { const s = document.createElement('span'); s.textContent = tags.join(', '); g.appendChild(s); }
    Object.assign(g.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: Math.min(from.height, 180) + 'px' });
    document.body.appendChild(g);
    card.style.visibility = 'hidden';
    // Anima posição e tamanho (não escala), para o texto não deformar no caminho.
    const fh = Math.min(from.height, 180);
    const mid = { left: (from.left + to.left) / 2 + 'px', top: Math.min(from.top, to.top) - 24 + 'px', width: (from.width + to.width) / 2 + 'px', height: (fh + to.height) / 2 + 'px' };
    const a = g.animate([
      { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: fh + 'px', transform: 'rotate(0deg)', borderRadius: '12px' },
      { ...mid, transform: 'rotate(-2deg)', offset: 0.5 },
      { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px', transform: 'rotate(0deg)', borderRadius: '8px' },
    ], { duration: 620, easing: 'cubic-bezier(.3, .7, .2, 1)', fill: 'forwards' });
    const end = () => { g.remove(); card.style.visibility = ''; land(); };
    a.onfinish = end; a.oncancel = end;
  }));
}
