// Web Component pour visualiser le signal audio (fréquences, waveform, volume)

class AudioVisualizer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.analyser = null;
        this.animationFrameId = null;
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    margin: 15px 0;
                }
                .visualizations {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-top: 10px;
                }
                .visualization {
                    background: white;
                    border-radius: 4px;
                    padding: 10px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .visualization h3 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                    color: #333;
                }
                canvas {
                    width: 100%;
                    height: 150px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: #000;
                }
                .volume-visualization {
                    margin-top: 10px;
                }
                .volume-visualization canvas {
                    height: 60px;
                }
            </style>
            <div class="visualizations">
                <div class="visualization">
                    <h3>Analyseur de Fréquences (FFT)</h3>
                    <canvas id="frequencyCanvas"></canvas>
                </div>
                <div class="visualization">
                    <h3>Waveform en Temps Réel</h3>
                    <canvas id="waveformCanvas"></canvas>
                </div>
            </div>
            <div class="visualization volume-visualization">
                <h3>Niveau de Volume</h3>
                <canvas id="volumeCanvas"></canvas>
            </div>
        `;
    }

    disconnectedCallback() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    setAnalyser(analyserNode) {
        this.analyser = analyserNode;
        if (this.analyser) {
            this.startVisualization();
        }
    }

    startVisualization() {
        if (!this.analyser) return;

        const frequencyCanvas = this.shadowRoot.querySelector('#frequencyCanvas');
        const waveformCanvas = this.shadowRoot.querySelector('#waveformCanvas');
        const volumeCanvas = this.shadowRoot.querySelector('#volumeCanvas');

        const freqCtx = frequencyCanvas.getContext('2d');
        const waveCtx = waveformCanvas.getContext('2d');
        const volCtx = volumeCanvas.getContext('2d');

        // Définir la taille des canvas
        frequencyCanvas.width = frequencyCanvas.offsetWidth;
        frequencyCanvas.height = frequencyCanvas.offsetHeight;
        waveformCanvas.width = waveformCanvas.offsetWidth;
        waveformCanvas.height = waveformCanvas.offsetHeight;
        volumeCanvas.width = volumeCanvas.offsetWidth;
        volumeCanvas.height = 60;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const waveformArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.animationFrameId = requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(dataArray);

            this.analyser.getByteTimeDomainData(waveformArray);

            freqCtx.fillStyle = '#000';
            freqCtx.fillRect(0, 0, frequencyCanvas.width, frequencyCanvas.height);

            const barWidth = (frequencyCanvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * frequencyCanvas.height;

                const r = barHeight + 25 * (i / bufferLength);
                const g = 250 * (i / bufferLength);
                const b = 50;

                freqCtx.fillStyle = `rgb(${r},${g},${b})`;
                freqCtx.fillRect(x, frequencyCanvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }

            waveCtx.fillStyle = '#000';
            waveCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

            waveCtx.lineWidth = 2;
            waveCtx.strokeStyle = '#0f0';
            waveCtx.beginPath();

            const sliceWidth = waveformCanvas.width / bufferLength;
            let waveX = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = waveformArray[i] / 128.0;
                const y = (v * waveformCanvas.height) / 2;

                if (i === 0) {
                    waveCtx.moveTo(waveX, y);
                } else {
                    waveCtx.lineTo(waveX, y);
                }

                waveX += sliceWidth;
            }

            waveCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
            waveCtx.stroke();

            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const volumeLevel = (average / 255) * volumeCanvas.width;

            volCtx.fillStyle = '#000';
            volCtx.fillRect(0, 0, volumeCanvas.width, volumeCanvas.height);

            const gradient = volCtx.createLinearGradient(0, 0, volumeLevel, 0);
            gradient.addColorStop(0, '#0f0');
            gradient.addColorStop(0.7, '#ff0');
            gradient.addColorStop(1, '#f00');

            volCtx.fillStyle = gradient;
            volCtx.fillRect(0, 0, volumeLevel, volumeCanvas.height);

            volCtx.fillStyle = '#fff';
            volCtx.font = '14px Arial';
            volCtx.fillText(`Volume: ${Math.round((average / 255) * 100)}%`, 10, 20);
        };

        draw();
    }
}

customElements.define('audio-visualizer', AudioVisualizer);

