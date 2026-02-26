// Web Component: playlist simple (liste de morceaux) -> pilote un <my-audio-player>
// Communication:
// - Par API: cherche le player via l'attribut target="#id" et appelle player.setSource(url, meta) + player.play()
// - Émet aussi des événements: 'trackselect' (bubbles+composed) pour une approche 100% événements si besoin

class MyPlaylist extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.tracks = [];
    this.currentIndex = -1;
    this.shuffle = false;
    this.loop = false;
  }

  static get observedAttributes() {
    return ['tracks', 'target', 'shuffle', 'loop'];
  }

  attributeChangedCallback(name) {
    if (name === 'tracks') this.loadTracksFromAttr();
    if (name === 'shuffle') this.shuffle = this.hasAttribute('shuffle');
    if (name === 'loop') this.loop = this.hasAttribute('loop');
  }

  connectedCallback() {
    this.shuffle = this.hasAttribute('shuffle');
    this.loop = this.hasAttribute('loop');
    this.loadTracksFromAttr();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: Arial, sans-serif; }
        .wrap { background:#fff; border-radius:8px; padding:12px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
        .top { display:flex; gap:8px; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .buttons { display:flex; gap:8px; align-items:center; }
        button { cursor:pointer; border:1px solid #ddd; background:#f7f7f7; border-radius:6px; padding:6px 10px; }
        button:hover { background:#eee; }
        button[aria-pressed="true"] { background:#e8f5e9; border-color:#9ccc65; }
        ul { list-style:none; padding:0; margin:0; }
        li { display:flex; gap:10px; align-items:center; padding:8px; border-radius:6px; }
        li:hover { background:#fafafa; }
        li.active { background:#e3f2fd; }
        .title { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .meta { color:#666; font-size:12px; }
        .play { width:36px; }
      </style>
      <div class="wrap">
        <div class="top">
          <div class="buttons">
            <button id="prevBtn" class="play" title="Précédent">⏮</button>
            <button id="nextBtn" class="play" title="Suivant">⏭</button>
            <button id="shuffleBtn" aria-pressed="${this.shuffle}" title="Aléatoire">🔀</button>
            <button id="loopBtn" aria-pressed="${this.loop}" title="Loop">🔁</button>
          </div>
          <div class="meta" id="count"></div>
        </div>
        <ul id="list"></ul>
      </div>
    `;

    this.render();
    this.bindUi();

    this.bindPlayerEvents();
  }

  loadTracksFromAttr() {
    const raw = this.getAttribute('tracks');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.tracks = parsed;
    } catch (e) {
      console.error('[my-playlist] tracks attribute must be valid JSON array', e);
    }
  }

  getTargetPlayer() {
    const target = this.getAttribute('target');
    if (!target) return null;
    // autorise target="#id" ou "id"
    const sel = target.startsWith('#') ? target : `#${target}`;
    return document.querySelector(sel);
  }

  bindPlayerEvents() {
    const player = this.getTargetPlayer();
    if (!player) return;
    // Quand le player termine: next
    player.addEventListener('player-ended', () => this.next());
    // Si le player change de source (externe), on peut essayer de resynchroniser l’UI
    player.addEventListener('player-sourcechange', (e) => {
      const url = e.detail?.src;
      const idx = this.tracks.findIndex(t => t?.src === url);
      if (idx >= 0) this.setIndex(idx, { autoplay: false });
    });
  }

  bindUi() {
    this.shadowRoot.querySelector('#prevBtn').addEventListener('click', () => this.prev());
    this.shadowRoot.querySelector('#nextBtn').addEventListener('click', () => this.next());
    this.shadowRoot.querySelector('#shuffleBtn').addEventListener('click', (e) => {
      this.shuffle = !this.shuffle;
      e.currentTarget.setAttribute('aria-pressed', String(this.shuffle));
      if (this.shuffle) this.setAttribute('shuffle', '');
      else this.removeAttribute('shuffle');
    });
    this.shadowRoot.querySelector('#loopBtn').addEventListener('click', (e) => {
      this.loop = !this.loop;
      e.currentTarget.setAttribute('aria-pressed', String(this.loop));
      if (this.loop) this.setAttribute('loop', '');
      else this.removeAttribute('loop');
    });
  }

  render() {
    const list = this.shadowRoot.querySelector('#list');
    const count = this.shadowRoot.querySelector('#count');
    if (!list || !count) return;

    count.textContent = `${this.tracks.length} morceau(x)`;
    list.innerHTML = '';

    this.tracks.forEach((t, idx) => {
      const li = document.createElement('li');
      li.className = idx === this.currentIndex ? 'active' : '';
      const title = t?.title ?? `Piste ${idx + 1}`;
      const src = t?.src ?? '';

      li.innerHTML = `
        <button class="play" title="Jouer">▶</button>
        <div class="title">${title}</div>
        <div class="meta">${src ? '' : '(src manquant)'}</div>
      `;

      li.querySelector('button.play').addEventListener('click', () => this.setIndex(idx, { autoplay: true }));
      li.addEventListener('dblclick', () => this.setIndex(idx, { autoplay: true }));

      list.appendChild(li);
    });
  }

  setIndex(idx, { autoplay } = { autoplay: true }) {
    if (idx < 0 || idx >= this.tracks.length) return;
    this.currentIndex = idx;
    this.render();

    const track = this.tracks[idx];
    const detail = { index: idx, track };

    this.dispatchEvent(new CustomEvent('trackselect', { detail, bubbles: true, composed: true }));

    const player = this.getTargetPlayer();
    if (player && typeof player.setSource === 'function') {
      player.setSource(track.src, { title: track.title });
      if (autoplay && typeof player.play === 'function') player.play();
    }
  }

  pickNextIndex() {
    if (this.tracks.length === 0) return -1;
    if (this.shuffle) {
      if (this.tracks.length === 1) return 0;
      let n = this.currentIndex;
      while (n === this.currentIndex) n = Math.floor(Math.random() * this.tracks.length);
      return n;
    }
    const n = this.currentIndex + 1;
    if (n < this.tracks.length) return n;
    return this.loop ? 0 : -1;
  }

  pickPrevIndex() {
    if (this.tracks.length === 0) return -1;
    if (this.shuffle) return this.pickNextIndex();
    const p = this.currentIndex - 1;
    if (p >= 0) return p;
    return this.loop ? this.tracks.length - 1 : -1;
  }

  next() {
    const n = this.pickNextIndex();
    if (n !== -1) this.setIndex(n, { autoplay: true });
  }

  prev() {
    const p = this.pickPrevIndex();
    if (p !== -1) this.setIndex(p, { autoplay: true });
  }
}

customElements.define('my-playlist', MyPlaylist);


