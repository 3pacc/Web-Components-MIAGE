// Web Component pour le réglage de balance stéréo

class AudioBalance extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.pannerNode = null;
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    margin: 10px 0;
                }
                .control-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
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
            </style>
            <div class="control-group">
                <label>Balance :</label>
                <input type="range" id="balanceSlider" min="-1" max="1" step="0.01" value="0">
                <webaudio-knob id="balanceKnob" value="0" min="-1" max="1" step="0.01" diameter="60"></webaudio-knob>
            </div>
        `;

        this.defineListeners();
    }

    defineListeners() {
        const balanceSlider = this.shadowRoot.querySelector('#balanceSlider');
        const balanceKnob = this.shadowRoot.querySelector('#balanceKnob');

        balanceSlider.addEventListener('input', (e) => {
            const balance = parseFloat(e.target.value);
            if (this.pannerNode) {
                this.pannerNode.pan.value = balance;
            }
            if (balanceKnob) {
                balanceKnob.value = balance;
            }
            // Émettre un événement personnalisé
            this.dispatchEvent(new CustomEvent('balance-change', {
                detail: { balance }
            }));
        });

        if (balanceKnob) {
            balanceKnob.addEventListener('input', (e) => {
                const balance = parseFloat(e.target.value);
                if (this.pannerNode) {
                    this.pannerNode.pan.value = balance;
                }
                balanceSlider.value = balance;
                // Émettre un événement personnalisé
                this.dispatchEvent(new CustomEvent('balance-change', {
                    detail: { balance }
                }));
            });
        }
    }

    setPannerNode(pannerNode) {
        this.pannerNode = pannerNode;
    }
}

customElements.define('audio-balance', AudioBalance);

