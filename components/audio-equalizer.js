// Web Component pour l'égaliseur graphique avec plusieurs bandes de fréquences

class AudioEqualizer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.filters = [];
        // Bandes de fréquences pour l'égaliseur (Hz)
        this.eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    margin: 15px 0;
                }
                .eq-container {
                    display: flex;
                    gap: 5px;
                    align-items: flex-end;
                    margin-top: 10px;
                    padding: 10px;
                    background: white;
                    border-radius: 4px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .eq-band {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .eq-band label {
                    font-size: 10px;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                .eq-slider {
                    writing-mode: bt-lr;
                    -webkit-appearance: slider-vertical;
                    width: 30px;
                    height: 100px;
                }
                h3 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                    color: #333;
                }
            </style>
            <h3>Égaliseur Graphique</h3>
            <div class="eq-container" id="eqContainer"></div>
        `;

        this.createEQControls();
    }

    createEQControls() {
        const eqContainer = this.shadowRoot.querySelector('#eqContainer');

        this.eqFrequencies.forEach((freq, index) => {
            const bandDiv = document.createElement('div');
            bandDiv.className = 'eq-band';

            const label = document.createElement('label');
            label.textContent = freq < 1000 ? `${freq}Hz` : `${freq/1000}kHz`;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'eq-slider';
            slider.min = '-12';
            slider.max = '12';
            slider.step = '0.1';
            slider.value = '0';
            slider.id = `eqSlider${index}`;

            bandDiv.appendChild(label);
            bandDiv.appendChild(slider);
            eqContainer.appendChild(bandDiv);

            // Écouteur pour chaque bande
            slider.addEventListener('input', (e) => {
                const gain = parseFloat(e.target.value);
                if (this.filters[index]) {
                    this.filters[index].gain.value = gain;
                }
                // Émettre un événement personnalisé
                this.dispatchEvent(new CustomEvent('eq-change', {
                    detail: { index, frequency: freq, gain }
                }));
            });
        });
    }

    setFilters(filters) {
        this.filters = filters;
    }

    getFilters() {
        return this.filters;
    }
}

customElements.define('audio-equalizer', AudioEqualizer);

