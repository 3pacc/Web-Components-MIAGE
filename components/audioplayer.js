// ici un web component qui encapsule un lecteur audio HTML5 avec Web Audio API
// Utilise des composants séparés pour : balance, égaliseur, visualisations

class AudioPlayer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        this.audioContext = null;
        this.source = null;
        this.analyser = null;
        this.gainNode = null;
        this.stereoPanner = null;
        this.eqFilters = [];
        
        this.eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    }

    connectedCallback() {
        this.src = this.getAttribute('src');
        console.log("AudioPlayer : src attribute : " + this.src);

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    background: #f5f5f5;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                audio {
                    width: 100%;
                    margin-bottom: 15px;
                }
                .controls {
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                    margin-bottom: 15px;
                }
                button {
                    padding: 10px 20px;
                    cursor: pointer;
                    border: none;
                    border-radius: 4px;
                    background: #4CAF50;
                    color: white;
                    font-size: 14px;
                }
                button:hover {
                    background: #45a049;
                }
                button#pauseButton {
                    background: #f44336;
                }
                button#pauseButton:hover {
                    background: #da190b;
                }
                .control-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 10px 0;
                }
                label {
                    font-weight: bold;
                    min-width: 80px;
                }
                input[type="range"] {
                    width: 150px;
                }
                webaudio-knob {
                    display: inline-block;
                    vertical-align: middle;
                }
                .timeline {
                    margin: 8px 0 14px 0;
                }
                .time-row {
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    font-size:12px;
                    color:#333;
                    margin-bottom:6px;
                }
                .bar {
                    position:relative;
                    height:10px;
                    border-radius:999px;
                    background:#e0e0e0;
                    overflow:hidden;
                }
                .bar .buffered {
                    position:absolute;
                    left:0; top:0; bottom:0;
                    width:0%;
                    background:#bdbdbd;
                }
                .bar .played {
                    position:absolute;
                    left:0; top:0; bottom:0;
                    width:0%;
                    background:#64b5f6;
                }
                input[type="range"].seek {
                    width:100%;
                    margin-top:8px;
                }
            </style>
            <audio id="myplayer" src="${this.src}" crossorigin="anonymous"></audio>
            
            <div class="controls">
                <button id="playButton">▶ Play</button>
                <button id="pauseButton">⏸ Pause</button>
            </div>

            <div class="timeline">
                <div class="time-row">
                    <span id="currentTime">0:00</span>
                    <span id="duration">0:00</span>
                </div>
                <div class="bar" aria-label="Progression">
                    <div class="buffered" id="bufferedBar"></div>
                    <div class="played" id="playedBar"></div>
                </div>
                <input class="seek" id="seekSlider" type="range" min="0" max="1000" value="0">
            </div>
            
            <div class="control-group">
                <label>Volume :</label>
                <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="0.5">
                <webaudio-knob id="volumeKnob" value="0.5" min="0" max="1" step="0.01" diameter="60"></webaudio-knob>
            </div>
            
            <audio-balance id="balanceControl"></audio-balance>
            <audio-equalizer id="equalizerControl"></audio-equalizer>
            <audio-visualizer id="visualizerControl"></audio-visualizer>
        `;

        this.initWebAudio();
        this.defineListeners();
        this.initSubComponents();

        this.addEventListener('trackselect', (e) => {
            const track = e.detail?.track;
            if (track?.src) {
                this.setSource(track.src, { title: track.title });
                this.play();
            }
        });
    }

    disconnectedCallback() {
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    initWebAudio() {
        const audioElement = this.shadowRoot.querySelector('#myplayer');
        
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        this.source = this.audioContext.createMediaElementSource(audioElement);
        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 0.5;
        
        this.stereoPanner = this.audioContext.createStereoPanner();
        this.stereoPanner.pan.value = 0;
        
        this.eqFilters = this.eqFrequencies.map(freq => {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1;
            filter.gain.value = 0;
            return filter;
        });
        
        let currentNode = this.source;
        
        this.eqFilters.forEach(filter => {
            currentNode.connect(filter);
            currentNode = filter;
        });
        
        currentNode.connect(this.gainNode);
        currentNode = this.gainNode;
        
        currentNode.connect(this.stereoPanner);
        currentNode = this.stereoPanner;
        
        currentNode.connect(this.analyser);
        
        currentNode.connect(this.audioContext.destination);
    }

    initSubComponents() {
        const balanceControl = this.shadowRoot.querySelector('#balanceControl');
        if (balanceControl) {
            balanceControl.setPannerNode(this.stereoPanner);
        }

        const equalizerControl = this.shadowRoot.querySelector('#equalizerControl');
        if (equalizerControl) {
            equalizerControl.setFilters(this.eqFilters);
        }

        const visualizerControl = this.shadowRoot.querySelector('#visualizerControl');
        if (visualizerControl) {
            visualizerControl.setAnalyser(this.analyser);
        }
    }

    defineListeners() {
        const audioElement = this.shadowRoot.querySelector('#myplayer');
        const playButton = this.shadowRoot.querySelector('#playButton');
        const pauseButton = this.shadowRoot.querySelector('#pauseButton');
        const volumeSlider = this.shadowRoot.querySelector('#volumeSlider');
        const volumeKnob = this.shadowRoot.querySelector('#volumeKnob');
        const seekSlider = this.shadowRoot.querySelector('#seekSlider');
        const currentTimeEl = this.shadowRoot.querySelector('#currentTime');
        const durationEl = this.shadowRoot.querySelector('#duration');
        const bufferedBar = this.shadowRoot.querySelector('#bufferedBar');
        const playedBar = this.shadowRoot.querySelector('#playedBar');

        // Logs utiles (CORS / chargement / codec)
        audioElement.addEventListener('error', () => {
            console.error('Audio element error:', audioElement.error);
        });
        audioElement.addEventListener('canplay', () => {
            console.log('Audio canplay. duration=', audioElement.duration);
        });

        audioElement.addEventListener('loadedmetadata', () => {
            this.dispatchEvent(new CustomEvent('player-loadedmetadata', {
                detail: { duration: audioElement.duration, src: audioElement.currentSrc || audioElement.src },
                bubbles: true,
                composed: true
            }));
        });

        audioElement.addEventListener('ended', () => {
            this.dispatchEvent(new CustomEvent('player-ended', {
                detail: { src: audioElement.currentSrc || audioElement.src },
                bubbles: true,
                composed: true
            }));
        });

        const startAudioContext = () => {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        };

        playButton.addEventListener('click', () => {
            startAudioContext();
            const p = audioElement.play();
            if (p && typeof p.catch === 'function') {
                p.catch((err) => console.error('audioElement.play() failed:', err));
            }
        });

        pauseButton.addEventListener('click', () => {
            audioElement.pause();
        });

        audioElement.addEventListener('play', () => {
            this.dispatchEvent(new CustomEvent('player-play', { bubbles: true, composed: true }));
        });
        audioElement.addEventListener('pause', () => {
            this.dispatchEvent(new CustomEvent('player-pause', { bubbles: true, composed: true }));
        });

        const fmt = (secs) => {
            if (!Number.isFinite(secs) || secs < 0) secs = 0;
            const m = Math.floor(secs / 60);
            const s = Math.floor(secs % 60);
            return `${m}:${String(s).padStart(2, '0')}`;
        };

        const updateBuffered = () => {
            if (!bufferedBar) return;
            try {
                const dur = audioElement.duration;
                if (!Number.isFinite(dur) || dur <= 0) return;
                const b = audioElement.buffered;
                if (!b || b.length === 0) return;
                const end = b.end(b.length - 1);
                bufferedBar.style.width = `${Math.min(100, (end / dur) * 100)}%`;
            } catch {
            }
        };

        const updateTimeUi = () => {
            const dur = audioElement.duration;
            const t = audioElement.currentTime;
            if (durationEl) durationEl.textContent = fmt(dur);
            if (currentTimeEl) currentTimeEl.textContent = fmt(t);
            if (playedBar && Number.isFinite(dur) && dur > 0) {
                playedBar.style.width = `${Math.min(100, (t / dur) * 100)}%`;
            }
            if (seekSlider && Number.isFinite(dur) && dur > 0) {
                // 0..1000 pour éviter les floats bizarres
                seekSlider.value = String(Math.floor((t / dur) * 1000));
            }

            this.dispatchEvent(new CustomEvent('player-timeupdate', {
                detail: { currentTime: t, duration: dur },
                bubbles: true,
                composed: true
            }));
        };

        audioElement.addEventListener('timeupdate', updateTimeUi);
        audioElement.addEventListener('progress', updateBuffered);
        audioElement.addEventListener('durationchange', () => {
            updateBuffered();
            updateTimeUi();
        });

        if (seekSlider) {
            seekSlider.addEventListener('input', (e) => {
                const dur = audioElement.duration;
                if (!Number.isFinite(dur) || dur <= 0) return;
                const v = parseFloat(e.target.value); // 0..1000
                audioElement.currentTime = (v / 1000) * dur;
                updateTimeUi();
            });
        }

        volumeSlider.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            this.gainNode.gain.value = volume;
            if (volumeKnob) {
                volumeKnob.value = volume;
            }
        });

        if (volumeKnob) {
            volumeKnob.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                this.gainNode.gain.value = volume;
                volumeSlider.value = volume;
            });
        }
    }

    setSource(src, meta = {}) {
        const audioElement = this.shadowRoot?.querySelector('#myplayer');
        if (!audioElement) return;
        audioElement.src = src;
        audioElement.load();

        this.dispatchEvent(new CustomEvent('player-sourcechange', {
            detail: { src, ...meta },
            bubbles: true,
            composed: true
        }));
    }

    play() {
        const audioElement = this.shadowRoot?.querySelector('#myplayer');
        if (!audioElement) return;
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return audioElement.play();
    }

    pause() {
        const audioElement = this.shadowRoot?.querySelector('#myplayer');
        if (!audioElement) return;
        audioElement.pause();
    }
}

customElements.define('my-audio-player', AudioPlayer);


