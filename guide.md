# Guide — Lecteur Web Component + Web Audio (Séances 3/4)

Ce dossier contient un **lecteur audio en Web Component** basé sur l’API **Web Audio**, ainsi que des **composants enfants** (balance, égaliseur, visualisations) et un **composant playlist**.

L’objectif : avoir une architecture **modulaire** où chaque fonctionnalité est encapsulée dans un composant, et où la communication se fait via une **API simple** (méthodes publiques) + **événements CustomEvent**.

---

## 1) Organisation des fichiers

Dans `lecteurWebComponent/` :

- `index.html` : page de test qui charge les librairies + composants et instancie le lecteur + playlist.
- `components/audioplayer.js` : composant principal `my-audio-player` (le “player”).
- `components/audio-balance.js` : composant `audio-balance` (balance stéréo).
- `components/audio-equalizer.js` : composant `audio-equalizer` (égaliseur graphique).
- `components/audio-visualizer.js` : composant `audio-visualizer` (FFT, waveform, volume).
- `components/my-playlist.js` : composant `my-playlist` (playlist simple).
- `components/libs/web-audioControls.js` : librairie (custom elements type `webaudio-knob`, etc.).

---

## 2) Point critique : CORS + Web Audio

Quand on utilise :

- un élément HTML `<audio src="https://...">` **et**
- `audioContext.createMediaElementSource(audioElement)`

alors la source distante **doit autoriser CORS**, sinon le navigateur bloque/neutralise le flux audio (ou empêche certaines opérations).

Pour éviter ça dans le projet, `index.html` utilise des sources Wikimedia (CORS OK).

---

## 3) Architecture générale (conceptuelle)

### 3.1 Web Components

- Le composant **père** est `my-audio-player`.
- Il **instancie** dans son shadow DOM :
  - `<audio-balance>`
  - `<audio-equalizer>`
  - `<audio-visualizer>`
- Le composant `my-playlist` est un **composant externe** qui pilote le player.

### 3.2 Graphe Web Audio

Dans `my-audio-player`, on construit le graphe suivant :

```
HTMLAudioElement
  -> MediaElementSourceNode (source)
  -> BiquadFilterNode x N (EQ en série)
  -> GainNode (volume)
  -> StereoPannerNode (balance)
  -> AnalyserNode (visualisations)
  -> AudioDestinationNode (haut-parleurs)
```

Le point important :
- `GainNode` permet de régler le volume proprement (plutôt que `audio.volume`).
- `StereoPannerNode` règle la balance gauche/droite.
- `BiquadFilterNode` en mode `"peaking"` sert à faire un égaliseur multi-bande.
- `AnalyserNode` permet de récupérer des données pour FFT et waveform.

---

## 4) `index.html` (page de test)

Rôle :
- Charger la librairie `web-audioControls.js` (pour que `<webaudio-knob>` existe).
- Charger les composants (scripts `type="module"`).
- Instancier `my-audio-player` et `my-playlist`.

Points clés :
- Le player a un `id` (`player1`).
- La playlist a un attribut `target="#player1"` pour piloter le player.
- La playlist reçoit un attribut `tracks='[...]'` (JSON).

---

## 5) `my-audio-player` (`components/audioplayer.js`)

### 5.1 Responsabilité

`my-audio-player` est le composant **central**. Il :

- encapsule un `<audio>` HTML
- construit le graphe Web Audio
- expose une API publique minimale (changer de piste / play / pause)
- fournit une UI :
  - Play/Pause
  - volume (slider + knob)
  - timeline (temps courant/durée, barre “played”, barre “buffered”, slider seek)
- connecte les composants enfants (balance, eq, visualizer)

### 5.2 Variables principales

Le constructeur initialise :

- `this.audioContext` : `AudioContext`
- `this.source` : `MediaElementSourceNode`
- `this.analyser` : `AnalyserNode`
- `this.gainNode` : `GainNode`
- `this.stereoPanner` : `StereoPannerNode`
- `this.eqFilters` : tableau de `BiquadFilterNode`
- `this.eqFrequencies` : fréquences des bandes EQ (Hz)

### 5.3 `connectedCallback()`

À l’insertion du composant dans la page :

1) lit l’attribut `src`
2) injecte le HTML/CSS dans le shadow DOM
3) appelle :
   - `initWebAudio()` : construit le graphe audio
   - `defineListeners()` : attache les listeners (play/pause/volume/timeline)
   - `initSubComponents()` : passe des références audio aux composants enfants

4) écoute aussi l’événement `trackselect` (utile si un composant externe choisit un track).

### 5.4 `initWebAudio()`

1) crée `AudioContext`
2) crée `createMediaElementSource(audioElement)`
3) crée :
   - `AnalyserNode` (fftSize/smoothing)
   - `GainNode`
   - `StereoPannerNode`
   - N filtres EQ (`BiquadFilterNode` type `"peaking"`)
4) connecte les nodes dans le bon ordre (source -> EQ -> gain -> panner -> analyser -> destination)

### 5.5 `initSubComponents()`

Donne aux composants enfants l’accès aux nodes dont ils ont besoin :

- `audio-balance.setPannerNode(this.stereoPanner)`
- `audio-equalizer.setFilters(this.eqFilters)`
- `audio-visualizer.setAnalyser(this.analyser)`

Chaque enfant reste **responsable de son UI** et de ses listeners.

### 5.6 `defineListeners()`

Gère :

- Play/Pause :
  - au click Play : `resume()` si contexte suspendu, puis `audio.play()`
  - au click Pause : `audio.pause()`
  - logs d’erreurs `audio.play()` (Promise rejetée), logs sur `audio.error`

- Volume :
  - slider + knob -> `this.gainNode.gain.value`

- Timeline (API `<audio>`):
  - `loadedmetadata` : durée connue
  - `timeupdate` : temps courant
  - `progress` : partie bufferisée (via `audio.buffered`)
  - slider seek -> `audio.currentTime = ...`

### 5.7 API publique (méthodes)

`my-audio-player` expose :

- `setSource(src, meta = {})`
  - change `audio.src`, fait `audio.load()`
  - émet l’événement `player-sourcechange`

- `play()`
  - reprend le contexte audio si suspendu
  - lance `audio.play()`

- `pause()`
  - lance `audio.pause()`

### 5.8 Événements émis par `my-audio-player`

Pour faciliter la communication avec d’autres composants :

- `player-sourcechange` : `{ src, ...meta }`
- `player-loadedmetadata` : `{ duration, src }`
- `player-timeupdate` : `{ currentTime, duration }`
- `player-ended` : `{ src }`
- `player-play` / `player-pause`

Tous sont émis avec `bubbles: true, composed: true`, pour traverser shadow DOM / DOM.

---

## 6) `audio-balance` (`components/audio-balance.js`)

### 6.1 Responsabilité

UI + logique de balance stéréo.

### 6.2 Entrée (dépendance)

`my-audio-player` lui injecte une référence :

- `setPannerNode(pannerNode)` où `pannerNode` est un `StereoPannerNode`.

### 6.3 UI

- slider `[-1..1]`
- knob `[-1..1]`

Les deux sont synchronisés. À chaque changement :

- `pannerNode.pan.value = balance`
- dispatch `balance-change` (utile si on veut écouter en dehors)

---

## 7) `audio-equalizer` (`components/audio-equalizer.js`)

### 7.1 Responsabilité

UI d’un égaliseur graphique multi-bande.

### 7.2 Entrée (dépendance)

`my-audio-player` injecte les filtres :

- `setFilters(filters)` où `filters` est un tableau de `BiquadFilterNode`.

### 7.3 UI

Pour chaque bande :

- un slider vertical de gain (en dB) : `-12..+12`
- au changement :
  - `filters[i].gain.value = gain`
  - dispatch `eq-change` : `{ index, frequency, gain }`

---

## 8) `audio-visualizer` (`components/audio-visualizer.js`)

### 8.1 Responsabilité

Affichage :

- FFT (spectre)
- waveform (temps réel)
- volume (barre)

### 8.2 Entrée (dépendance)

`my-audio-player` injecte l’analyser :

- `setAnalyser(analyserNode)` où `analyserNode` est un `AnalyserNode`.

### 8.3 Boucle d’animation

Le composant utilise `requestAnimationFrame` :

- `getByteFrequencyData()` pour le spectre
- `getByteTimeDomainData()` pour la waveform
- le “volume” est estimé via une moyenne simple du tableau de fréquences (approche pédagogique)

---

## 9) `my-playlist` (`components/my-playlist.js`)

### 9.1 Responsabilité

Affiche une liste de morceaux et pilote le player.

### 9.2 Entrées (attributs)

- `tracks='[...]'` : JSON array, ex :

```json
[
  { "title": "Hardstyle kick", "src": "https://..." },
  { "title": "Closed HiHat", "src": "https://..." }
]
```

- `target="#player1"` : sélecteur du player à piloter.
- `shuffle` : présent/absent (mode aléatoire).
- `loop` : présent/absent (boucle).

### 9.3 Communication

Deux modes en même temps (pédagogique, pratique) :

1) **API directe** (si `target` est fourni) :
   - appelle `player.setSource(track.src)`
   - puis `player.play()`

2) **Événements** :
   - dispatch `trackselect` (bubbles+composed)
   - le player écoute `trackselect` et peut jouer la piste

### 9.4 Auto-next

La playlist écoute `player-ended` sur le player cible et lance `next()`.

---

## 10) Évolutions conseillées (Séance 4)

### 10.1 API multimédia (HTMLMediaElement)

À ajouter/expérimenter côté player :

- affichage `audio.currentSrc`, `audio.duration`, `audio.currentTime`
- events utiles :
  - `loadedmetadata`, `canplay`, `play`, `pause`, `timeupdate`, `progress`, `ended`, `seeking`, `seeked`
- barre de progression plus avancée :
  - gestion multi-ranges `audio.buffered` (pas seulement le dernier range)

Documentation : `https://www.w3.org/2010/05/video/mediaevents.html`

### 10.2 Playlist avancée

- suppression/reorder (drag’n’drop)
- persistance (localStorage)
- ajout dynamique de tracks (API `addTrack()`)

### 10.3 Communication entre composants

Vous avez 3 styles possibles (et on peut mixer) :

1) **Parent instancie les enfants dans son shadow DOM** (ce qu’on fait ici)
2) **Composants enfants “slottés”** :
   - `<my-player><my-equalizer slot="..."></my-equalizer></my-player>`
3) **Communication uniquement par événements** (plus découplé)

---

## 11) Dépannage rapide

- Pas de son ?
  - vérifier la console (logs ajoutés dans `audioplayer.js`)
  - tester une URL Wikimedia (CORS OK)
  - tester en local via un serveur (Live Server/VSCode) plutôt que double clic fichier

- Visualisations figées ?
  - vérifier que `audio-visualizer.setAnalyser(...)` est appelé
  - vérifier que l’audio joue bien (volume, context resume)

---

## 12) “Checklist” d’évaluation (pour vous)

- [ ] Les knobs fonctionnent (lib chargée avant)
- [ ] Le volume agit via `GainNode`
- [ ] La balance agit via `StereoPannerNode`
- [ ] L’EQ agit via `BiquadFilterNode` (peaking)
- [ ] FFT + waveform + volume bougent quand ça joue
- [ ] La timeline affiche currentTime/duration
- [ ] La playlist lance une piste et passe au suivant à la fin


