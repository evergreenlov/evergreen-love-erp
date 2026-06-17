/**
 * CotizacionModal — Modal de solicitud de cotización para catálogo público y B2B.
 * Uso: CotizacionModal.open({ productoId, productoNombre, precioFinal, preciosVolumen,
 *                             imagenUrl, galeria, fuente, clienteB2bId })
 *
 * v8: + multiselect live cost sum, + extended material campo detection.
 * El flujo de submit, los endpoints y el guardado de respuestas NO cambian.
 */
const CotizacionModal = {
    _ready: false,
    _context: {},
    _campos: [],
    _materialSel: null,
    _tamanoSel: null,
    _tipoEvento: null,
    _showMaterial: false,
    _showTamano: false,
    _galeria: [],
    _preciosVolumen: null,
    _extraCost: 0,

    _MATERIALES: [
        { id: 'basswood',              nombre: 'Basswood',              bg: '#D4B48C', desc: 'Madera de tilo' },
        { id: 'walnut',                nombre: 'Walnut',                bg: '#4A2417', desc: 'Nogal oscuro' },
        { id: 'mahogany',              nombre: 'Mahogany',              bg: '#7D2C1C', desc: 'Caoba rojiza' },
        { id: 'acrilico_transparente', nombre: 'Acrílico Transparente', bg: 'checker', desc: 'Cristal claro' },
        { id: 'acrilico_negro',        nombre: 'Acrílico Negro',        bg: '#141414', desc: 'Negro brillante' },
        { id: 'acrilico_blanco',       nombre: 'Acrílico Blanco',       bg: '#F2F2F2', desc: 'Blanco neutro', border: '#ccc' },
    ],

    _TAMANOS: ['4"', '6"', '8"', '10"', 'Personalizado'],

    _EVENTOS: ['Cumpleaños', 'Boda', 'Iglesia', 'Escuela', 'Corporativo', 'Regalo Personal', 'Otro'],

    _WHATSAPP_NUMBER: '17873334444',

    _init() {
        if (this._ready) return;
        this._ready = true;

        const style = document.createElement('style');
        style.textContent = `
            /* ── Overlay ── */
            #cotiz-overlay {
                display: none; position: fixed; inset: 0;
                background: rgba(0,0,0,0.52); backdrop-filter: blur(4px);
                z-index: 9000; align-items: center; justify-content: center;
                padding: 16px; box-sizing: border-box;
            }
            #cotiz-overlay.open { display: flex; }

            /* ── Modal shell ── */
            #cotiz-modal {
                background: #fff; border-radius: 20px;
                width: 100%; max-width: 860px; max-height: 90vh;
                display: flex; flex-direction: column;
                box-shadow: 0 24px 64px rgba(0,0,0,0.22);
                position: relative;
                font-family: var(--font-primary,'Outfit',sans-serif);
                overflow: hidden;
            }

            /* ── Header ── */
            #cotiz-modal-header {
                padding: 20px 28px 14px; border-bottom: 1px solid #f0ece4; flex-shrink: 0;
            }
            #cotiz-modal-header h2 {
                font-family: var(--font-secondary,'Playfair Display',serif);
                font-size: 19px; color: #1e1e1e; margin: 0 0 3px;
            }
            #cotiz-modal-header .cotiz-subtitle {
                font-size: 12px; color: #8c8270; margin: 0;
            }

            /* ── Body 40/60 ── */
            #cotiz-body { display: flex; flex: 1; overflow: hidden; min-height: 0; }

            /* ── LEFT: Preview ── */
            #cotiz-preview-col {
                width: 40%; min-width: 200px; background: #f7f3ee;
                display: flex; flex-direction: column; padding: 20px 18px;
                gap: 14px; overflow-y: auto; border-right: 1px solid #ede7db;
                flex-shrink: 0;
            }
            #cotiz-preview-img-wrap {
                position: relative; border-radius: 14px; overflow: hidden;
                background: #ede7db; aspect-ratio: 1; width: 100%;
            }
            #cotiz-preview-img { width: 100%; height: 100%; object-fit: cover; display: none; }
            #cotiz-preview-placeholder {
                position: absolute; inset: 0; display: flex; flex-direction: column;
                align-items: center; justify-content: center; gap: 6px; color: #bbb;
            }
            #cotiz-preview-placeholder-icon { font-size: 38px; }
            #cotiz-preview-placeholder-txt { font-size: 11px; color: #bbb; text-align: center; line-height: 1.4; }
            #cotiz-preview-text-overlay {
                position: absolute; inset: 0; display: flex;
                align-items: flex-end; justify-content: center;
                padding-bottom: 14px; pointer-events: none;
            }
            #cotiz-preview-text-val {
                background: rgba(0,0,0,0.58); color: #fff; font-size: 12.5px;
                font-weight: 600; padding: 4px 12px; border-radius: 20px;
                max-width: 90%; text-align: center; word-break: break-word;
                display: none; transition: opacity 0.2s;
            }

            /* Product info below image */
            #cotiz-preview-info { display: flex; flex-direction: column; gap: 4px; }
            #cotiz-preview-nombre { font-size: 13.5px; font-weight: 700; color: #2a2014; line-height: 1.3; }
            #cotiz-preview-precio { font-size: 13px; color: #5f7830; font-weight: 600; }
            #cotiz-preview-mat-badge {
                display: none; align-items: center; gap: 5px;
                font-size: 11px; color: #5f7830; background: #e8f2d8;
                border-radius: 20px; padding: 3px 10px; width: fit-content;
                margin-top: 2px; font-weight: 600;
            }
            #cotiz-preview-tam-badge {
                display: none; align-items: center; gap: 5px;
                font-size: 11px; color: #7a6840; background: #f3eddf;
                border-radius: 20px; padding: 3px 10px; width: fit-content;
                font-weight: 600;
            }

            /* ── Volume pricing table ── */
            #cotiz-vol-wrap {
                background: #fff; border: 1px solid #e8e0d5; border-radius: 10px;
                overflow: hidden; display: none;
            }
            #cotiz-vol-wrap table {
                width: 100%; border-collapse: collapse; font-size: 11px;
            }
            #cotiz-vol-wrap thead th {
                background: #f3eddf; color: #7a6840; font-weight: 700;
                padding: 5px 7px; text-align: center; font-size: 10px;
                text-transform: uppercase; letter-spacing: 0.4px;
            }
            #cotiz-vol-wrap tbody td {
                padding: 5px 7px; text-align: center; border-top: 1px solid #f0ece4;
                color: #3a3228; font-weight: 500;
            }
            #cotiz-vol-wrap tbody tr:nth-child(even) td { background: #faf8f5; }
            #cotiz-vol-wrap tbody tr.cotiz-vol-best td {
                color: #5f7830; font-weight: 700; background: #f0f7e6;
            }
            .cotiz-vol-save {
                font-size: 10px; color: #5f7830; font-weight: 700;
                background: #e8f2d8; border-radius: 20px; padding: 2px 7px;
                display: inline-block;
            }
            #cotiz-vol-msg {
                font-size: 10.5px; color: #5f7830; font-weight: 600;
                text-align: center; padding: 6px 8px; background: #f0f7e6;
                border-top: 1px solid #d4e6b5;
            }

            /* Thumbnail strip */
            #cotiz-thumbs {
                display: none; flex-wrap: wrap; gap: 6px; margin-top: 4px;
            }
            .cotiz-thumb {
                width: 48px; height: 48px; border-radius: 7px; overflow: hidden;
                border: 2px solid transparent; cursor: pointer;
                background: #ede7db; flex-shrink: 0;
                transition: border-color 0.15s, transform 0.1s;
            }
            .cotiz-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .cotiz-thumb.active { border-color: #5f7830; }
            .cotiz-thumb:hover:not(.active) { border-color: #c5d9a8; transform: scale(1.05); }
            @media(max-width:640px) {
                #cotiz-thumbs { display: none !important; }
                #cotiz-vol-wrap { display: none !important; }
            }

            /* ── RIGHT: Form column ── */
            #cotiz-form-col {
                flex: 1; overflow-y: auto; padding: 18px 22px 22px;
                display: flex; flex-direction: column; min-width: 0;
            }
            #cotiz-form-wrap { display: flex; flex-direction: column; }

            /* Section blocks */
            .cotiz-section-block {
                background: #f9f6f1; border: 1px solid #ede7db; border-radius: 12px;
                padding: 13px 15px; margin-bottom: 14px;
            }
            .cotiz-section-title {
                font-size: 10.5px; font-weight: 700; color: #5f7830;
                text-transform: uppercase; letter-spacing: 0.7px;
                margin: 0 0 10px; display: flex; align-items: center; gap: 5px;
            }

            /* ── Material cards ── */
            #cotiz-material-grid {
                display: grid; grid-template-columns: repeat(3,1fr); gap: 7px;
            }
            .cotiz-mat-card {
                display: flex; flex-direction: column; align-items: center; gap: 4px;
                padding: 9px 5px; border-radius: 10px; cursor: pointer;
                border: 2px solid transparent; background: #fff;
                transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
                text-align: center;
            }
            .cotiz-mat-card:hover { border-color: #c5d9a8; transform: translateY(-1px); }
            .cotiz-mat-card.selected {
                border-color: #5f7830; box-shadow: 0 0 0 3px rgba(95,120,48,0.14);
            }
            .cotiz-mat-swatch {
                width: 38px; height: 38px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1);
            }
            .cotiz-mat-swatch.checker {
                background-image:
                    linear-gradient(45deg,#a8c4d8 25%,transparent 25%),
                    linear-gradient(-45deg,#a8c4d8 25%,transparent 25%),
                    linear-gradient(45deg,transparent 75%,#a8c4d8 75%),
                    linear-gradient(-45deg,transparent 75%,#a8c4d8 75%);
                background-size: 8px 8px;
                background-position: 0 0,0 4px,4px -4px,-4px 0;
                background-color: rgba(210,235,252,0.4);
                border: 1px solid #9ab8cc;
            }
            .cotiz-mat-name { font-size: 10px; font-weight: 700; color: #3a3228; line-height: 1.2; }
            .cotiz-mat-desc { font-size: 9px; color: #999; line-height: 1.2; }

            /* ── Size chips ── */
            #cotiz-tamano-chips { display: flex; flex-wrap: wrap; gap: 6px; }
            .cotiz-tam-chip {
                padding: 5px 14px; border-radius: 20px; border: 1.5px solid #d4c9b8;
                background: #fff; font-size: 12px; font-weight: 600; color: #555;
                cursor: pointer; transition: all 0.15s; user-select: none;
            }
            .cotiz-tam-chip:hover { border-color: #5f7830; color: #5f7830; }
            .cotiz-tam-chip.selected { background: #5f7830; color: #fff; border-color: #5f7830; }
            #cotiz-tamano-custom {
                display: none; gap: 7px; align-items: center; margin-top: 10px; flex-wrap: wrap;
            }
            #cotiz-tamano-custom input {
                width: 68px; padding: 6px 9px; border: 1px solid #e0d9ce;
                border-radius: 8px; font-size: 12.5px; text-align: center;
                background: #fafaf8; outline: none; font-family: inherit;
            }
            #cotiz-tamano-custom input:focus { border-color: #5f7830; }
            #cotiz-tamano-custom span { font-size: 12px; color: #777; }

            /* ── Tipo de evento ── */
            #cotiz-evento-grid {
                display: flex; flex-wrap: wrap; gap: 6px;
            }
            .cotiz-evento-chip {
                padding: 5px 13px; border-radius: 20px; border: 1.5px solid #d4c9b8;
                background: #fff; font-size: 12px; font-weight: 500; color: #555;
                cursor: pointer; transition: all 0.15s; user-select: none;
            }
            .cotiz-evento-chip:hover { border-color: #5f7830; color: #5f7830; }
            .cotiz-evento-chip.selected { background: #5f7830; color: #fff; border-color: #5f7830; }

            /* ── Dynamic campos section ── */
            #cotiz-campos-wrap {
                border: 1.5px solid #c5d9a8; border-radius: 12px;
                padding: 13px 15px; background: #f6faf0; margin-bottom: 14px; display: none;
            }
            .cotiz-campos-header {
                font-size: 10.5px; font-weight: 700; color: #5f7830;
                text-transform: uppercase; letter-spacing: 0.6px;
                margin-bottom: 10px; display: flex; align-items: center; gap: 5px;
            }

            /* ── Standard form fields ── */
            .cotiz-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 11px; }
            #cotiz-form-col label { font-size: 12px; font-weight: 600; color: #444; }
            #cotiz-form-col input:not([type=file]):not([type=checkbox]),
            #cotiz-form-col textarea,
            #cotiz-form-col select {
                padding: 9px 12px; border: 1px solid #e0d9ce; border-radius: 10px;
                font-family: inherit; font-size: 13px; color: #222;
                background: #fafaf8; outline: none; transition: border-color 0.15s;
                box-sizing: border-box;
            }
            #cotiz-form-col input:focus, #cotiz-form-col textarea:focus, #cotiz-form-col select:focus {
                border-color: var(--color-moss-green,#5f7830);
            }
            #cotiz-form-col textarea { resize: vertical; min-height: 68px; }
            .cotiz-producto-label {
                background: #f7f3ee; border-radius: 10px; padding: 9px 13px;
                font-size: 12.5px; color: #555; font-weight: 500; border: 1px solid #e8e0d5;
            }
            #cotiz-file-list {
                font-size: 11px; color: #666; margin-top: 5px;
                display: flex; flex-wrap: wrap; gap: 5px;
            }
            .cotiz-file-chip {
                background: #eef4e6; color: #5f7830; border-radius: 20px;
                padding: 2px 10px; font-size: 10.5px; font-weight: 600;
            }

            /* ── Action buttons ── */
            #cotiz-actions { display: flex; gap: 8px; margin-top: 6px; flex-direction: column; }
            #cotiz-btn-whatsapp {
                width: 100%; padding: 13px;
                background: #25d366;
                color: white; border: none; border-radius: 12px;
                font-family: inherit; font-size: 14px; font-weight: 700;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center; gap: 8px;
                transition: filter 0.2s, transform 0.15s;
            }
            #cotiz-btn-whatsapp:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
            #cotiz-btn-cotizacion {
                width: 100%; padding: 12px;
                background: var(--color-terracotta,#c0634c);
                color: white; border: none; border-radius: 12px;
                font-family: inherit; font-size: 13px; font-weight: 700;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center; gap: 8px;
                transition: filter 0.2s, transform 0.15s;
            }
            #cotiz-btn-cotizacion:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
            #cotiz-btn-cotizacion:disabled,
            #cotiz-btn-whatsapp:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
            #cotiz-error {
                display: none; color: #c0634c; font-size: 12px;
                background: #fff5f5; border-radius: 8px; padding: 9px 13px; margin-bottom: 8px;
            }
            #cotiz-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }

            /* ── Close button ── */
            #cotiz-close {
                position: absolute; top: 14px; right: 14px;
                width: 32px; height: 32px; border-radius: 50%; border: none;
                background: #f0ece4; cursor: pointer; font-size: 15px; color: #555;
                display: flex; align-items: center; justify-content: center; z-index: 2;
            }
            #cotiz-close:hover { background: #e0d9ce; }

            /* ── Success screen ── */
            #cotiz-success {
                display: none; flex-direction: column; align-items: center;
                justify-content: center; text-align: center; padding: 40px 24px; flex: 1;
            }
            #cotiz-success .cotiz-check { font-size: 46px; margin-bottom: 12px; }
            #cotiz-success h3 {
                font-family: var(--font-secondary,serif); font-size: 19px;
                color: #5f7830; margin: 0 0 8px;
            }
            #cotiz-success p { font-size: 13px; color: #666; margin: 0 0 20px; }

            /* ── Mobile ── */
            @media(max-width: 640px) {
                #cotiz-modal { max-width: 100%; border-radius: 18px 18px 0 0; max-height: 96vh; }
                #cotiz-body { flex-direction: column; }
                #cotiz-preview-col {
                    width: 100%; min-width: 0; border-right: none;
                    border-bottom: 1px solid #ede7db;
                    flex-direction: row; align-items: center;
                    padding: 10px 14px; gap: 12px;
                }
                #cotiz-preview-img-wrap { width: 72px; height: 72px; flex-shrink: 0; aspect-ratio: unset; }
                #cotiz-preview-info { flex: 1; }
                #cotiz-preview-nombre { font-size: 12.5px; }
                #cotiz-material-grid { grid-template-columns: repeat(3,1fr); }
                #cotiz-grid { grid-template-columns: 1fr; }
                #cotiz-modal-header { padding: 14px 16px 10px; }
                #cotiz-form-col { padding: 14px 16px 18px; }
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'cotiz-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div id="cotiz-modal">
                <button id="cotiz-close" aria-label="Cerrar">✕</button>

                <div id="cotiz-modal-header">
                    <h2>Solicitar Cotización</h2>
                    <p class="cotiz-subtitle">Cuéntanos sobre tu proyecto y te enviamos una propuesta personalizada.</p>
                </div>

                <div id="cotiz-body">

                    <!-- ── LEFT: Vista previa ── -->
                    <div id="cotiz-preview-col">
                        <div id="cotiz-preview-img-wrap">
                            <img id="cotiz-preview-img" alt="Vista previa del producto">
                            <div id="cotiz-preview-placeholder">
                                <div id="cotiz-preview-placeholder-icon">🌿</div>
                                <div id="cotiz-preview-placeholder-txt">Vista previa<br>del producto</div>
                            </div>
                            <div id="cotiz-preview-text-overlay">
                                <span id="cotiz-preview-text-val"></span>
                            </div>
                        </div>
                        <div id="cotiz-preview-info">
                            <div id="cotiz-preview-nombre"></div>
                            <div id="cotiz-preview-precio"></div>
                            <div id="cotiz-extras-line" style="font-size:11px;color:#c0634c;display:none;"></div>
                            <div id="cotiz-preview-mat-badge"></div>
                            <div id="cotiz-preview-tam-badge"></div>
                        </div>

                        <!-- Tabla de precios por volumen -->
                        <div id="cotiz-vol-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Cantidad</th>
                                        <th>Precio c/u</th>
                                        <th>Ahorro</th>
                                    </tr>
                                </thead>
                                <tbody id="cotiz-vol-tbody"></tbody>
                            </table>
                            <div id="cotiz-vol-msg" style="display:none;"></div>
                        </div>

                        <!-- Thumbnail strip -->
                        <div id="cotiz-thumbs"></div>
                    </div>

                    <!-- ── RIGHT: Formulario ── -->
                    <div id="cotiz-form-col">
                        <div id="cotiz-form-wrap">

                            <!-- Producto de interés -->
                            <div id="cotiz-producto-wrap" class="cotiz-field" style="display:none;">
                                <label>Producto de interés</label>
                                <div id="cotiz-producto-label" class="cotiz-producto-label"></div>
                            </div>

                            <!-- Tamaños visuales -->
                            <div id="cotiz-tamano-wrap" class="cotiz-section-block" style="display:none;">
                                <div class="cotiz-section-title">📐 Tamaño</div>
                                <div id="cotiz-tamano-chips"></div>
                                <div id="cotiz-tamano-custom">
                                    <span>Ancho</span>
                                    <input type="number" id="cotiz-tamano-ancho" placeholder="5" min="1" max="48" step="0.5">
                                    <span>" &times; Alto</span>
                                    <input type="number" id="cotiz-tamano-alto" placeholder="7" min="1" max="48" step="0.5">
                                    <span>"</span>
                                </div>
                            </div>

                            <!-- Materiales visuales -->
                            <div id="cotiz-material-wrap" class="cotiz-section-block" style="display:none;">
                                <div class="cotiz-section-title">🪵 Material</div>
                                <div id="cotiz-material-grid"></div>
                            </div>

                            <!-- Tipo de evento -->
                            <div id="cotiz-evento-wrap" class="cotiz-section-block">
                                <div class="cotiz-section-title">🎉 Tipo de Evento</div>
                                <div id="cotiz-evento-grid"></div>
                            </div>

                            <!-- Campos de personalización dinámicos -->
                            <div id="cotiz-campos-wrap">
                                <div class="cotiz-campos-header">✨ Personalización del Producto</div>
                                <div id="cotiz-campos-inner"></div>
                            </div>

                            <!-- Nombre + Teléfono -->
                            <div id="cotiz-grid">
                                <div class="cotiz-field">
                                    <label>Nombre <span style="color:#c0634c;">*</span></label>
                                    <input type="text" id="cotiz-nombre" placeholder="Tu nombre completo" required>
                                </div>
                                <div class="cotiz-field">
                                    <label>Teléfono</label>
                                    <input type="tel" id="cotiz-telefono" placeholder="(787) 000-0000">
                                </div>
                            </div>

                            <div class="cotiz-field">
                                <label>Email <span style="color:#c0634c;">*</span></label>
                                <input type="email" id="cotiz-email" placeholder="tu@email.com" required>
                            </div>

                            <div class="cotiz-field">
                                <label id="cotiz-desc-label">Descripción del proyecto <span style="color:#c0634c;">*</span></label>
                                <textarea id="cotiz-desc" placeholder="Describe qué necesitas: dimensiones, material, cantidad, evento o uso, personalización deseada…"></textarea>
                            </div>

                            <div class="cotiz-field">
                                <label>Presupuesto aproximado (opcional)</label>
                                <input type="number" id="cotiz-presupuesto" step="0.01" min="0" placeholder="$0.00">
                            </div>

                            <div class="cotiz-field">
                                <label>Imágenes de referencia (hasta 5 — jpg, png, pdf)</label>
                                <input type="file" id="cotiz-archivos" accept=".jpg,.jpeg,.png,.pdf"
                                    multiple style="font-size:12px;padding:6px 0;border:none;background:transparent;cursor:pointer;">
                                <div id="cotiz-file-list"></div>
                            </div>

                            <div id="cotiz-error"></div>

                            <div id="cotiz-actions">
                                <button id="cotiz-btn-whatsapp" type="button">
                                    🟢 Solicitar por WhatsApp
                                </button>
                                <button id="cotiz-btn-cotizacion" type="button">
                                    🟫 Solicitar Cotización Formal
                                </button>
                            </div>
                        </div>

                        <div id="cotiz-success">
                            <div class="cotiz-check">✅</div>
                            <h3>¡Solicitud recibida!</h3>
                            <p>Hemos recibido tu cotización. Nos comunicaremos contigo muy pronto a través de tu email o teléfono.</p>
                            <button onclick="CotizacionModal.close()" style="padding:10px 28px;background:#5f7830;color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        // ── Event listeners ──

        document.getElementById('cotiz-close').addEventListener('click', () => this.close());
        overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });

        document.getElementById('cotiz-archivos').addEventListener('change', e => {
            const files = Array.from(e.target.files).slice(0, 5);
            document.getElementById('cotiz-file-list').innerHTML =
                files.map(f => `<span class="cotiz-file-chip">📎 ${f.name}</span>`).join('');
        });

        document.getElementById('cotiz-btn-whatsapp').addEventListener('click', () => this._submitWhatsApp());
        document.getElementById('cotiz-btn-cotizacion').addEventListener('click', () => this._submit());

        // Material card selection (event delegation)
        document.getElementById('cotiz-material-grid').addEventListener('click', e => {
            const card = e.target.closest('.cotiz-mat-card');
            if (card) this._selectMaterial(card.dataset.matId);
        });

        // Size chip selection (event delegation)
        document.getElementById('cotiz-tamano-chips').addEventListener('click', e => {
            const chip = e.target.closest('.cotiz-tam-chip');
            if (chip) this._selectTamano(chip.dataset.tam);
        });

        // Tipo de evento selection (event delegation)
        document.getElementById('cotiz-evento-grid').addEventListener('click', e => {
            const chip = e.target.closest('.cotiz-evento-chip');
            if (chip) this._selectEvento(chip.dataset.evento);
        });

        // Custom size inputs → update preview badge
        document.getElementById('cotiz-tamano-ancho').addEventListener('input', () => this._updateTamanoBadge());
        document.getElementById('cotiz-tamano-alto').addEventListener('input', () => this._updateTamanoBadge());

        // Live text preview from first 'texto' campo
        document.getElementById('cotiz-campos-inner').addEventListener('input', e => {
            const wrap = e.target.closest('[data-campo-tipo="texto"]');
            if (!wrap) return;
            const val = e.target.value;
            const textVal = document.getElementById('cotiz-preview-text-val');
            textVal.textContent = val;
            textVal.style.display = val ? 'block' : 'none';
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // ── Render material grid ──
    _renderMaterialGrid() {
        const grid = document.getElementById('cotiz-material-grid');
        if (!grid) return;
        grid.innerHTML = this._MATERIALES.map(m => {
            const cls = m.bg === 'checker' ? 'cotiz-mat-swatch checker' : 'cotiz-mat-swatch';
            const style = m.bg !== 'checker'
                ? `background:${m.bg};${m.border ? `border-color:${m.border};` : ''}`
                : '';
            return `<div class="cotiz-mat-card" data-mat-id="${m.id}">
                <div class="${cls}" style="${style}"></div>
                <div class="cotiz-mat-name">${m.nombre}</div>
                <div class="cotiz-mat-desc">${m.desc}</div>
            </div>`;
        }).join('');
    },

    // ── Render size chips ──
    _renderTamanoChips() {
        const wrap = document.getElementById('cotiz-tamano-chips');
        if (!wrap) return;
        wrap.innerHTML = this._TAMANOS.map(t =>
            `<div class="cotiz-tam-chip" data-tam="${t}">${t}</div>`
        ).join('');
    },

    // ── Render tipo de evento chips ──
    _renderEventoChips() {
        const grid = document.getElementById('cotiz-evento-grid');
        if (!grid) return;
        grid.innerHTML = this._EVENTOS.map(ev =>
            `<div class="cotiz-evento-chip" data-evento="${ev}">${ev}</div>`
        ).join('');
    },

    // ── Render volume pricing table ──
    _renderVolumen(precios) {
        const wrap = document.getElementById('cotiz-vol-wrap');
        const tbody = document.getElementById('cotiz-vol-tbody');
        const msg   = document.getElementById('cotiz-vol-msg');
        if (!wrap || !tbody || !precios) return;

        const rows = [
            { qty: '1 ud',   price: precios.p1  },
            { qty: '12 uds', price: precios.p12 },
            { qty: '24 uds', price: precios.p24 },
            { qty: '50 uds', price: precios.p50 },
        ].filter(r => r.price != null && r.price > 0);

        if (rows.length < 2) { wrap.style.display = 'none'; return; }

        const base = rows[0].price;
        tbody.innerHTML = rows.map((r, i) => {
            const pct = i === 0 ? 0 : Math.round((1 - r.price / base) * 100);
            const isBest = i === rows.length - 1;
            const saveHtml = pct > 0
                ? `<span class="cotiz-vol-save">-${pct}%</span>`
                : '<span style="color:#bbb;font-size:10px;">—</span>';
            return `<tr${isBest ? ' class="cotiz-vol-best"' : ''}>
                <td>${r.qty}</td>
                <td>$${Number(r.price).toFixed(2)}</td>
                <td>${saveHtml}</td>
            </tr>`;
        }).join('');

        // Savings message for best tier
        const best = rows[rows.length - 1];
        if (rows.length > 1 && best.price < base) {
            const pct = Math.round((1 - best.price / base) * 100);
            msg.textContent = `🎉 Ahorra ${pct}% al ordenar ${rows[rows.length - 1].qty}`;
            msg.style.display = 'block';
        } else {
            msg.style.display = 'none';
        }

        wrap.style.display = 'block';
    },

    // ── Recalculate extras from multiselect checkboxes ──
    _updateExtraCost() {
        let extra = 0;
        for (const c of (this._campos || [])) {
            if (c.tipo !== 'multiselect') continue;
            const container = document.getElementById(`cotiz-campo-${c.id}`);
            if (!container) continue;
            container.querySelectorAll('input[type=checkbox]:checked').forEach(cb => {
                extra += parseFloat(cb.dataset.costo) || 0;
            });
        }
        this._extraCost = extra;
        const base = parseFloat(this._context.precioFinal) || 0;
        const precioEl  = document.getElementById('cotiz-preview-precio');
        const extrasEl  = document.getElementById('cotiz-extras-line');
        if (precioEl && base > 0) {
            precioEl.textContent = `$${(base + extra).toFixed(2)}`;
        }
        if (extrasEl) {
            if (extra > 0 && base > 0) {
                extrasEl.textContent = `Base $${base.toFixed(2)} + materiales $${extra.toFixed(2)}`;
                extrasEl.style.display = 'block';
            } else {
                extrasEl.style.display = 'none';
            }
        }
    },

    // ── Select material ──
    _selectMaterial(id) {
        this._materialSel = id;
        document.querySelectorAll('.cotiz-mat-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.matId === id);
        });
        const mat = this._MATERIALES.find(m => m.id === id);
        const badge = document.getElementById('cotiz-preview-mat-badge');
        if (mat && badge) {
            badge.textContent = '🪵 ' + mat.nombre;
            badge.style.display = 'inline-flex';
        }
    },

    // ── Select size ──
    _selectTamano(t) {
        this._tamanoSel = t;
        document.querySelectorAll('.cotiz-tam-chip').forEach(c => {
            c.classList.toggle('selected', c.dataset.tam === t);
        });
        const customWrap = document.getElementById('cotiz-tamano-custom');
        if (customWrap) customWrap.style.display = t === 'Personalizado' ? 'flex' : 'none';
        this._updateTamanoBadge();
    },

    // ── Select tipo de evento ──
    _selectEvento(ev) {
        this._tipoEvento = ev;
        document.querySelectorAll('.cotiz-evento-chip').forEach(c => {
            c.classList.toggle('selected', c.dataset.evento === ev);
        });
    },

    // ── Update size badge in preview ──
    _updateTamanoBadge() {
        const badge = document.getElementById('cotiz-preview-tam-badge');
        if (!badge || !this._tamanoSel) return;
        let label = this._tamanoSel;
        if (this._tamanoSel === 'Personalizado') {
            const a = (document.getElementById('cotiz-tamano-ancho')?.value || '').trim();
            const h = (document.getElementById('cotiz-tamano-alto')?.value || '').trim();
            if (a && h) label = `${a}" × ${h}"`;
            else if (a) label = `${a}" (ancho)`;
            else label = 'Personalizado';
        }
        badge.textContent = '📐 ' + label;
        badge.style.display = 'inline-flex';
    },

    // ── Update preview image ──
    _updatePreviewImg(imagenUrl) {
        const img = document.getElementById('cotiz-preview-img');
        const ph  = document.getElementById('cotiz-preview-placeholder');
        if (imagenUrl) {
            img.src = imagenUrl;
            img.style.display = 'block';
            if (ph) ph.style.display = 'none';
            img.onerror = () => {
                img.style.display = 'none';
                if (ph) ph.style.display = 'flex';
            };
        } else {
            img.style.display = 'none';
            img.src = '';
            if (ph) ph.style.display = 'flex';
        }
    },

    // ── Thumbnail strip ──
    _renderThumbs() {
        const wrap = document.getElementById('cotiz-thumbs');
        if (!wrap) return;
        if (!this._galeria || this._galeria.length < 2) {
            wrap.style.display = 'none';
            wrap.innerHTML = '';
            return;
        }
        wrap.style.display = 'flex';
        wrap.innerHTML = this._galeria.map((img, i) => {
            const url = (typeof getFullImageUrl === 'function')
                ? getFullImageUrl(img.ruta_imagen)
                : img.ruta_imagen;
            return `<div class="cotiz-thumb${i === 0 ? ' active' : ''}" data-idx="${i}" data-url="${url}">
                <img src="${url}" alt="${img.alt_text || ''}" onerror="this.parentElement.style.display='none'">
            </div>`;
        }).join('');
        wrap.querySelectorAll('.cotiz-thumb').forEach(thumb => {
            thumb.addEventListener('click', () => {
                const url = thumb.dataset.url;
                this._updatePreviewImg(url);
                wrap.querySelectorAll('.cotiz-thumb').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
    },

    // ── Campo input renderer ──
    _renderCampoInput(c) {
        const req   = c.requerido ? ' <span style="color:#c0634c;">*</span>' : '';
        const extra = c.costo_adicional > 0
            ? ` <span style="color:#c0634c;font-size:10.5px;">(+$${Number(c.costo_adicional).toFixed(2)})</span>`
            : '';
        const labelHtml = `<label style="font-size:12.5px;font-weight:600;color:#444;margin-bottom:4px;display:block;">${c.etiqueta}${req}${extra}</label>`;
        const base = `style="width:100%;padding:8px 10px;border:1px solid #d4e6b5;border-radius:8px;font-size:13px;background:#fff;box-sizing:border-box;"`;
        let input = '';
        if      (c.tipo === 'texto')    input = `<input type="text" id="cotiz-campo-${c.id}" ${base}>`;
        else if (c.tipo === 'textarea') input = `<textarea id="cotiz-campo-${c.id}" rows="2" ${base}></textarea>`;
        else if (c.tipo === 'fecha')    input = `<input type="date" id="cotiz-campo-${c.id}" ${base}>`;
        else if (c.tipo === 'checkbox') input = `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" id="cotiz-campo-${c.id}" style="width:15px;height:15px;"> Sí</label>`;
        else if (c.tipo === 'select') {
            const opts = (c.opciones || '').split(',').map(o => o.trim()).filter(Boolean);
            input = `<select id="cotiz-campo-${c.id}" ${base}><option value="">-- Selecciona --</option>${opts.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
        } else if (c.tipo === 'multiselect') {
            const opts = (c.opciones || '').split(',').map(o => {
                const [nombre, costo] = o.trim().split('|');
                return { nombre: (nombre||'').trim(), costo: parseFloat(costo) || 0 };
            }).filter(o => o.nombre);
            input = `<div id="cotiz-campo-${c.id}" style="display:flex;flex-direction:column;gap:6px;padding:4px 0;">${opts.map(o =>
                `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;font-weight:normal;">
                    <input type="checkbox" value="${o.nombre}" data-costo="${o.costo}" style="width:14px;height:14px;accent-color:#5f7830;">
                    ${o.nombre}${o.costo > 0 ? ` <span style="color:#c0634c;font-size:11px;">(+$${o.costo.toFixed(2)})</span>` : ''}
                </label>`).join('')}</div>`;
        } else if (c.tipo === 'archivo') {
            input = `<input type="file" id="cotiz-campo-${c.id}" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.svg" style="font-size:12px;">`;
        }
        return `<div style="margin-bottom:10px;" data-campo-id="${c.id}" data-campo-tipo="${c.tipo}" data-campo-etiqueta="${c.etiqueta.replace(/"/g,'&quot;')}" data-campo-requerido="${c.requerido}">${labelHtml}${input}</div>`;
    },

    // ── Build WhatsApp message ──
    _buildWhatsAppMsg() {
        const nombre  = document.getElementById('cotiz-nombre').value.trim();
        const email   = document.getElementById('cotiz-email').value.trim();
        const tel     = document.getElementById('cotiz-telefono').value.trim();
        const desc    = document.getElementById('cotiz-desc').value.trim();
        const presu   = document.getElementById('cotiz-presupuesto').value.trim();

        const prod    = this._context.productoNombre || '';
        const precio  = this._context.precioFinal
            ? ` ($${parseFloat(this._context.precioFinal).toFixed(2)})` : '';
        const mat     = this._materialSel
            ? this._MATERIALES.find(m => m.id === this._materialSel)?.nombre : null;
        const tam     = this._tamanoSel
            ? (this._tamanoSel === 'Personalizado'
                ? (() => {
                    const a = document.getElementById('cotiz-tamano-ancho')?.value || '';
                    const h = document.getElementById('cotiz-tamano-alto')?.value || '';
                    return (a && h) ? `${a}" × ${h}"` : 'Personalizado';
                  })()
                : this._tamanoSel)
            : null;

        let lines = ['🌿 *Solicitud de Cotización — Evergreen Love*', ''];
        if (nombre) lines.push(`👤 *Nombre:* ${nombre}`);
        if (email)  lines.push(`📧 *Email:* ${email}`);
        if (tel)    lines.push(`📞 *Teléfono:* ${tel}`);
        lines.push('');
        if (prod)   lines.push(`📦 *Producto:* ${prod}${precio}`);
        if (mat)    lines.push(`🪵 *Material:* ${mat}`);
        if (tam)    lines.push(`📐 *Tamaño:* ${tam}`);
        if (this._tipoEvento) lines.push(`🎉 *Evento:* ${this._tipoEvento}`);
        if (presu)  lines.push(`💰 *Presupuesto:* $${presu}`);
        if (desc) { lines.push(''); lines.push(`📝 *Descripción:*\n${desc}`); }

        // Dynamic campos
        for (const c of (this._campos || [])) {
            if (c.tipo === 'archivo') continue;
            const el = document.getElementById(`cotiz-campo-${c.id}`);
            if (!el) continue;
            if (c.tipo === 'multiselect') {
                const checked = Array.from(el.querySelectorAll('input[type=checkbox]:checked'));
                const vals = checked.map(cb => parseFloat(cb.dataset.costo) > 0 ? `${cb.value} (+$${parseFloat(cb.dataset.costo).toFixed(2)})` : cb.value);
                if (vals.length) lines.push(`• *${c.etiqueta}:* ${vals.join(', ')}`);
                continue;
            }
            const val = c.tipo === 'checkbox' ? (el.checked ? 'Sí' : '') : el.value.trim();
            if (val) lines.push(`• *${c.etiqueta}:* ${val}`);
        }

        return lines.join('\n');
    },

    // ── WhatsApp submit ──
    _submitWhatsApp() {
        const nombre = document.getElementById('cotiz-nombre').value.trim();
        const email  = document.getElementById('cotiz-email').value.trim();
        const errorEl = document.getElementById('cotiz-error');
        if (!nombre || !email) {
            errorEl.textContent = 'Por favor completa nombre y email antes de continuar.';
            errorEl.style.display = 'block';
            return;
        }
        errorEl.style.display = 'none';
        const msg = this._buildWhatsAppMsg();
        const url = `https://wa.me/${this._WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    },

    // ── Open modal ──
    async open({ productoId = null, productoNombre = null, precioFinal = null,
                 preciosVolumen = null, imagenUrl = null, galeria = [],
                 fuente = 'publico', clienteB2bId = null } = {}) {
        this._init();
        this._context = { productoId, productoNombre, precioFinal, fuente, clienteB2bId };
        this._campos = [];
        this._materialSel = null;
        this._tamanoSel = null;
        this._tipoEvento = null;
        this._showMaterial = false;
        this._showTamano = false;
        this._galeria = Array.isArray(galeria) ? galeria : [];
        this._preciosVolumen = preciosVolumen || null;
        this._extraCost = 0;

        // Reset form fields
        ['cotiz-nombre','cotiz-email','cotiz-telefono','cotiz-desc','cotiz-presupuesto'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const fi = document.getElementById('cotiz-archivos');
        if (fi) fi.value = '';
        document.getElementById('cotiz-file-list').innerHTML = '';
        document.getElementById('cotiz-error').style.display = 'none';
        document.getElementById('cotiz-form-wrap').style.display = 'flex';
        document.getElementById('cotiz-success').style.display = 'none';

        // Reset dynamic sections
        document.getElementById('cotiz-campos-wrap').style.display = 'none';
        document.getElementById('cotiz-campos-inner').innerHTML = '';
        document.getElementById('cotiz-material-wrap').style.display = 'none';
        document.getElementById('cotiz-tamano-wrap').style.display = 'none';
        document.getElementById('cotiz-tamano-custom').style.display = 'none';
        document.getElementById('cotiz-preview-mat-badge').style.display = 'none';
        document.getElementById('cotiz-preview-tam-badge').style.display = 'none';
        const textVal = document.getElementById('cotiz-preview-text-val');
        textVal.textContent = '';
        textVal.style.display = 'none';

        // Tipo de evento chips always rendered
        this._renderEventoChips();

        // Preview: product info
        const nombre = document.getElementById('cotiz-preview-nombre');
        const precio = document.getElementById('cotiz-preview-precio');
        if (nombre) nombre.textContent = productoNombre || '';
        if (precio) precio.textContent = precioFinal ? `$${parseFloat(precioFinal).toFixed(2)}` : '';
        this._updatePreviewImg(imagenUrl);
        this._renderThumbs();
        this._renderVolumen(this._preciosVolumen);

        // Producto label (right column)
        const prodWrap  = document.getElementById('cotiz-producto-wrap');
        const prodLabel = document.getElementById('cotiz-producto-label');
        if (productoNombre) {
            const p = precioFinal ? ` — $${parseFloat(precioFinal).toFixed(2)}` : '';
            prodLabel.textContent = `${productoNombre}${p}`;
            prodWrap.style.display = 'flex';
        } else {
            prodWrap.style.display = 'none';
        }

        // Show overlay
        const overlay = document.getElementById('cotiz-overlay');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        document.getElementById('cotiz-nombre').focus();

        // Load dynamic campos
        const descLabel = document.getElementById('cotiz-desc-label');
        if (productoId) {
            try {
                const apiBase = (typeof API_BASE_URL !== 'undefined')
                    ? API_BASE_URL
                    : window.location.origin + '/api';
                const res = await fetch(`${apiBase}/productos/${productoId}/campos-personalizacion/publico`);
                if (res.ok) {
                    const data = await res.json();
                    const campos = data.data || data.campos || [];
                    if (campos.length > 0) {
                        this._campos = campos;
                        document.getElementById('cotiz-campos-inner').innerHTML =
                            campos.map(c => this._renderCampoInput(c)).join('');
                        document.getElementById('cotiz-campos-wrap').style.display = 'block';
                        if (descLabel) {
                            descLabel.innerHTML = 'Notas adicionales <span style="color:#aaa;font-weight:400;">(opcional)</span>';
                        }
                        document.getElementById('cotiz-desc').placeholder = 'Alguna indicación extra para el equipo…';

                        // Live price update when multiselect checkboxes change
                        document.getElementById('cotiz-campos-inner').addEventListener('change', e => {
                            if (e.target.type === 'checkbox') this._updateExtraCost();
                        });
                        this._updateExtraCost();

                        // Show material cards unless a campo for material/madera/acrílico exists
                        const hasMaterialCampo = campos.some(c => {
                            const e = c.etiqueta.toLowerCase();
                            return e.includes('material') || e.includes('madera') || e.includes('acril');
                        });
                        this._showMaterial = !hasMaterialCampo;
                        if (this._showMaterial) {
                            this._renderMaterialGrid();
                            document.getElementById('cotiz-material-wrap').style.display = 'block';
                        }

                        // Show size chips unless a "Tamaño"/"Tamano"/"Size" campo already exists
                        const hasTamanoCampo = campos.some(c => {
                            const e = c.etiqueta.toLowerCase();
                            return e.includes('tamaño') || e.includes('tamano') || e.includes('tama') || e.includes('size');
                        });
                        this._showTamano = !hasTamanoCampo;
                        if (this._showTamano) {
                            this._renderTamanoChips();
                            document.getElementById('cotiz-tamano-wrap').style.display = 'block';
                        }
                    }
                }
            } catch (_) {}
        }

        if (this._campos.length === 0 && descLabel) {
            descLabel.innerHTML = 'Descripción del proyecto <span style="color:#c0634c;">*</span>';
            document.getElementById('cotiz-desc').placeholder =
                'Describe qué necesitas: dimensiones, material, cantidad, evento o uso, personalización deseada…';
        }
    },

    close() {
        const overlay = document.getElementById('cotiz-overlay');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    },

    // ── Submit (cotización formal) ──
    async _submit() {
        const nombre  = document.getElementById('cotiz-nombre').value.trim();
        const email   = document.getElementById('cotiz-email').value.trim();
        const desc    = document.getElementById('cotiz-desc').value.trim();
        const tel     = document.getElementById('cotiz-telefono').value.trim();
        const presu   = document.getElementById('cotiz-presupuesto').value.trim();
        const errorEl = document.getElementById('cotiz-error');

        if (!nombre || !email) {
            errorEl.textContent = 'Por favor completa nombre y email.';
            errorEl.style.display = 'block';
            return;
        }
        if (!email.includes('@')) {
            errorEl.textContent = 'Ingresa un email válido.';
            errorEl.style.display = 'block';
            return;
        }

        // ── Recolectar campos dinámicos ──
        const camposData    = [];
        const camposArchivos = {};

        // Inject material selection (if visible and selected)
        if (this._showMaterial && this._materialSel) {
            const mat = this._MATERIALES.find(m => m.id === this._materialSel);
            if (mat) camposData.push({ campo_id: null, etiqueta: 'Material', tipo: 'select', valor: mat.nombre });
        }

        // Inject size selection (if visible and selected)
        if (this._showTamano && this._tamanoSel) {
            let tamVal = this._tamanoSel;
            if (tamVal === 'Personalizado') {
                const a = (document.getElementById('cotiz-tamano-ancho')?.value || '').trim();
                const h = (document.getElementById('cotiz-tamano-alto')?.value || '').trim();
                if (a && h) tamVal = `${a}" × ${h}"`;
                else if (a) tamVal = `${a}"`;
                else tamVal = 'Personalizado';
            }
            camposData.push({ campo_id: null, etiqueta: 'Tamaño', tipo: 'select', valor: tamVal });
        }

        // Dynamic campos
        for (const c of (this._campos || [])) {
            const el = document.getElementById(`cotiz-campo-${c.id}`);
            if (!el) continue;

            if (c.tipo === 'archivo') {
                if (c.requerido && (!el.files || el.files.length === 0)) {
                    errorEl.textContent = `El campo "${c.etiqueta}" es obligatorio.`;
                    errorEl.style.display = 'block';
                    el.style.outline = '2px solid #c0634c';
                    return;
                }
                if (el.files && el.files.length > 0) camposArchivos[c.id] = el.files[0];
                camposData.push({ campo_id: c.id, etiqueta: c.etiqueta, tipo: 'archivo', valor: '' });
            } else if (c.tipo === 'multiselect') {
                const checked = Array.from(el.querySelectorAll('input[type=checkbox]:checked'));
                if (c.requerido && checked.length === 0) {
                    errorEl.textContent = `Selecciona al menos una opción en "${c.etiqueta}".`;
                    errorEl.style.display = 'block';
                    el.style.outline = '2px solid #c0634c';
                    return;
                }
                el.style.outline = '';
                const vals = checked.map(cb => parseFloat(cb.dataset.costo) > 0 ? `${cb.value} (+$${parseFloat(cb.dataset.costo).toFixed(2)})` : cb.value);
                if (vals.length) camposData.push({ campo_id: c.id, etiqueta: c.etiqueta, tipo: 'multiselect', valor: vals.join(', ') });
            } else {
                let valor = c.tipo === 'checkbox' ? (el.checked ? 'Sí' : 'No') : el.value.trim();
                if (c.requerido && !valor) {
                    errorEl.textContent = `El campo "${c.etiqueta}" es obligatorio.`;
                    errorEl.style.display = 'block';
                    el.style.borderColor = '#c0634c';
                    return;
                }
                if (valor) camposData.push({ campo_id: c.id, etiqueta: c.etiqueta, tipo: c.tipo, valor });
            }
        }

        if (camposData.length === 0 && !desc) {
            errorEl.textContent = 'Por favor describe tu proyecto.';
            errorEl.style.display = 'block';
            return;
        }

        const fileInput = document.getElementById('cotiz-archivos');
        const refFiles  = fileInput.files ? Array.from(fileInput.files).slice(0, 5) : [];

        const formData = new FormData();
        formData.append('nombre_cliente', nombre);
        formData.append('email', email);
        if (tel) formData.append('telefono', tel);
        if (this._context.productoId) formData.append('producto_id', this._context.productoId);
        formData.append('descripcion', desc);
        if (presu) formData.append('presupuesto_aprox', parseFloat(presu));
        formData.append('fuente', this._context.fuente || 'publico');
        if (this._context.clienteB2bId) formData.append('cliente_b2b_id', this._context.clienteB2bId);
        if (this._tipoEvento) formData.append('tipo_evento', this._tipoEvento);
        refFiles.forEach(f => formData.append('archivos', f));

        const btnWa  = document.getElementById('cotiz-btn-whatsapp');
        const btnCot = document.getElementById('cotiz-btn-cotizacion');
        if (btnWa)  btnWa.disabled  = true;
        if (btnCot) btnCot.disabled = true;
        if (btnCot) btnCot.innerHTML = '⏳ Enviando…';
        errorEl.style.display = 'none';

        try {
            const apiBase = (typeof API_BASE_URL !== 'undefined')
                ? API_BASE_URL
                : window.location.origin + '/api';

            // 1. Crear cotización
            const response = await fetch(`${apiBase}/cotizaciones`, { method: 'POST', body: formData });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Error al enviar');
            }
            const result = await response.json();
            const cotizacionId = result.id;

            // 2. Guardar respuestas estructuradas (material + tamaño + campos dinámicos)
            if (camposData.length > 0 && cotizacionId) {
                const fd2 = new FormData();
                fd2.append('respuestas_json', JSON.stringify(camposData));
                for (const [campoId, file] of Object.entries(camposArchivos)) {
                    fd2.append(`archivo_${campoId}`, file);
                }
                await fetch(`${apiBase}/cotizaciones/${cotizacionId}/personalizacion/respuestas`, {
                    method: 'POST', body: fd2
                }).catch(() => {});
            }

            document.getElementById('cotiz-form-wrap').style.display = 'none';
            document.getElementById('cotiz-success').style.display = 'flex';
        } catch (err) {
            errorEl.textContent = 'Error: ' + err.message;
            errorEl.style.display = 'block';
        } finally {
            if (btnWa)  btnWa.disabled  = false;
            if (btnCot) btnCot.disabled = false;
            if (btnCot) btnCot.innerHTML = '🟫 Solicitar Cotización Formal';
        }
    }
};
