/**
 * CotizacionModal — Modal de solicitud de cotización para catálogo público y B2B.
 * Uso: CotizacionModal.open({ productoId, productoNombre, precioFinal, fuente, clienteB2bId })
 */
const CotizacionModal = {
    _ready: false,

    _init() {
        if (this._ready) return;
        this._ready = true;

        const style = document.createElement('style');
        style.textContent = `
            #cotiz-overlay {
                display: none; position: fixed; inset: 0;
                background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
                z-index: 9000; align-items: center; justify-content: center;
                padding: 20px; box-sizing: border-box;
            }
            #cotiz-overlay.open { display: flex; }
            #cotiz-modal {
                background: #fff; border-radius: 20px;
                width: 100%; max-width: 560px; max-height: 90vh;
                overflow-y: auto; padding: 36px 32px;
                box-shadow: 0 24px 60px rgba(0,0,0,0.18);
                position: relative; font-family: var(--font-primary, 'Outfit', sans-serif);
            }
            #cotiz-modal h2 {
                font-family: var(--font-secondary, 'Playfair Display', serif);
                font-size: 22px; color: #1e1e1e; margin: 0 0 6px;
            }
            #cotiz-modal .cotiz-subtitle {
                font-size: 13px; color: #8c8270; margin: 0 0 24px;
            }
            #cotiz-modal .cotiz-field {
                display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px;
            }
            #cotiz-modal label {
                font-size: 12.5px; font-weight: 600; color: #444;
            }
            #cotiz-modal input, #cotiz-modal textarea, #cotiz-modal select {
                padding: 10px 12px; border: 1px solid #e0d9ce; border-radius: 10px;
                font-family: inherit; font-size: 13px; color: #222;
                background: #fafaf8; outline: none; transition: border-color 0.15s;
            }
            #cotiz-modal input:focus, #cotiz-modal textarea:focus {
                border-color: var(--color-moss-green, #5f7830);
            }
            #cotiz-modal textarea { resize: vertical; min-height: 90px; }
            #cotiz-modal .cotiz-producto-label {
                background: #f7f3ee; border-radius: 10px; padding: 10px 14px;
                font-size: 13px; color: #555; font-weight: 500;
                border: 1px solid #e8e0d5;
            }
            #cotiz-file-list {
                font-size: 11.5px; color: #666; margin-top: 6px;
                display: flex; flex-wrap: wrap; gap: 6px;
            }
            .cotiz-file-chip {
                background: #eef4e6; color: #5f7830; border-radius: 20px;
                padding: 3px 10px; font-size: 11px; font-weight: 600;
            }
            #cotiz-btn-submit {
                width: 100%; padding: 13px; background: var(--color-terracotta, #c0634c);
                color: white; border: none; border-radius: 12px;
                font-family: inherit; font-size: 14px; font-weight: 700;
                cursor: pointer; margin-top: 6px;
                display: flex; align-items: center; justify-content: center; gap: 8px;
                transition: filter 0.2s, transform 0.2s;
            }
            #cotiz-btn-submit:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
            #cotiz-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
            #cotiz-close {
                position: absolute; top: 16px; right: 16px;
                width: 32px; height: 32px; border-radius: 50%; border: none;
                background: #f0ece4; cursor: pointer; font-size: 16px; color: #555;
                display: flex; align-items: center; justify-content: center;
            }
            #cotiz-close:hover { background: #e0d9ce; }
            #cotiz-success {
                display: none; text-align: center; padding: 20px 0;
            }
            #cotiz-success .cotiz-check {
                font-size: 48px; margin-bottom: 12px;
            }
            #cotiz-success h3 {
                font-family: var(--font-secondary, serif); font-size: 20px;
                color: #5f7830; margin: 0 0 8px;
            }
            #cotiz-success p { font-size: 13px; color: #666; margin: 0 0 20px; }
            #cotiz-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
            @media(max-width: 500px) {
                #cotiz-modal { padding: 24px 18px; }
                #cotiz-grid { grid-template-columns: 1fr; }
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

                <div id="cotiz-form-wrap">
                    <h2>Solicitar Cotización</h2>
                    <p class="cotiz-subtitle">Cuéntanos sobre tu proyecto y te enviaremos una propuesta personalizada.</p>

                    <div id="cotiz-producto-wrap" class="cotiz-field" style="display:none;">
                        <label>Producto de interés</label>
                        <div id="cotiz-producto-label" class="cotiz-producto-label"></div>
                    </div>

                    <!-- Campos de personalización dinámicos (se inyectan si el producto los tiene) -->
                    <div id="cotiz-campos-wrap" style="display:none;border:1.5px solid #c5d9a8;border-radius:12px;padding:14px 16px;background:#f6faf0;margin-bottom:4px;">
                        <div style="font-size:11.5px;font-weight:700;color:#5f7830;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                            <span>✨</span> Personalización del Producto
                        </div>
                        <div id="cotiz-campos-inner"></div>
                    </div>

                    <div class="cotiz-grid" id="cotiz-grid">
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
                            multiple style="font-size:12px; padding:6px 0; border:none; background:transparent; cursor:pointer;">
                        <div id="cotiz-file-list"></div>
                    </div>

                    <div id="cotiz-error" style="display:none; color:#c0634c; font-size:12.5px; background:#fff5f5; border-radius:8px; padding:10px 14px; margin-bottom:8px;"></div>

                    <button id="cotiz-btn-submit" type="button">
                        <i data-lucide="send" style="width:15px;height:15px;"></i>
                        Enviar Solicitud
                    </button>
                </div>

                <div id="cotiz-success">
                    <div class="cotiz-check">✅</div>
                    <h3>¡Solicitud recibida!</h3>
                    <p>Hemos recibido tu cotización. Nos comunicaremos contigo muy pronto a través de tu email o teléfono.</p>
                    <button onclick="CotizacionModal.close()" style="padding:10px 28px; background:#5f7830; color:white; border:none; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer;">
                        Cerrar
                    </button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('cotiz-close').addEventListener('click', () => this.close());
        overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });

        document.getElementById('cotiz-archivos').addEventListener('change', e => {
            const files = Array.from(e.target.files).slice(0, 5);
            const list = document.getElementById('cotiz-file-list');
            list.innerHTML = files.map(f =>
                `<span class="cotiz-file-chip">📎 ${f.name}</span>`
            ).join('');
        });

        document.getElementById('cotiz-btn-submit').addEventListener('click', () => this._submit());

        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    _context: {},
    _campos: [],

    _renderCampoInput(c) {
        const req = c.requerido ? ' <span style="color:#c0634c;">*</span>' : '';
        const extra = c.costo_adicional > 0 ? ` <span style="color:#c0634c;font-size:10.5px;">(+$${Number(c.costo_adicional).toFixed(2)})</span>` : '';
        const labelHtml = `<label style="font-size:12.5px;font-weight:600;color:#444;margin-bottom:4px;display:block;">${c.etiqueta}${req}${extra}</label>`;
        const base = `style="width:100%;padding:8px 10px;border:1px solid #d4e6b5;border-radius:8px;font-size:13px;background:#fff;box-sizing:border-box;"`;
        let input = '';
        if (c.tipo === 'texto')    input = `<input type="text" id="cotiz-campo-${c.id}" ${base}>`;
        else if (c.tipo === 'textarea') input = `<textarea id="cotiz-campo-${c.id}" rows="2" ${base}></textarea>`;
        else if (c.tipo === 'fecha')    input = `<input type="date" id="cotiz-campo-${c.id}" ${base}>`;
        else if (c.tipo === 'checkbox') input = `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" id="cotiz-campo-${c.id}" style="width:15px;height:15px;"> Sí</label>`;
        else if (c.tipo === 'select') {
            const opts = (c.opciones || '').split(',').map(o => o.trim()).filter(Boolean);
            input = `<select id="cotiz-campo-${c.id}" ${base}><option value="">-- Selecciona --</option>${opts.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
        } else if (c.tipo === 'archivo') {
            input = `<input type="file" id="cotiz-campo-${c.id}" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.svg" style="font-size:12px;">`;
        }
        return `<div style="margin-bottom:10px;" data-campo-id="${c.id}" data-campo-tipo="${c.tipo}" data-campo-etiqueta="${c.etiqueta.replace(/"/g,'&quot;')}" data-campo-requerido="${c.requerido}">${labelHtml}${input}</div>`;
    },

    async open({ productoId = null, productoNombre = null, precioFinal = null, fuente = 'publico', clienteB2bId = null } = {}) {
        this._init();
        this._context = { productoId, productoNombre, precioFinal, fuente, clienteB2bId };
        this._campos = [];

        // Reset form
        ['cotiz-nombre', 'cotiz-email', 'cotiz-telefono', 'cotiz-desc', 'cotiz-presupuesto'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const fileInput = document.getElementById('cotiz-archivos');
        if (fileInput) fileInput.value = '';
        document.getElementById('cotiz-file-list').innerHTML = '';
        document.getElementById('cotiz-error').style.display = 'none';
        document.getElementById('cotiz-form-wrap').style.display = 'block';
        document.getElementById('cotiz-success').style.display = 'none';

        // Rellenar producto
        const prodWrap = document.getElementById('cotiz-producto-wrap');
        const prodLabel = document.getElementById('cotiz-producto-label');
        if (productoNombre) {
            const precio = precioFinal ? ` — $${parseFloat(precioFinal).toFixed(2)}` : '';
            prodLabel.textContent = `${productoNombre}${precio}`;
            prodWrap.style.display = 'flex';
        } else {
            prodWrap.style.display = 'none';
        }

        // Limpiar sección de campos dinámicos
        const camposWrap = document.getElementById('cotiz-campos-wrap');
        const camposInner = document.getElementById('cotiz-campos-inner');
        camposWrap.style.display = 'none';
        camposInner.innerHTML = '';

        const overlay = document.getElementById('cotiz-overlay');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        document.getElementById('cotiz-nombre').focus();

        // Cargar campos dinámicos si hay productoId
        const descLabel = document.getElementById('cotiz-desc-label');
        if (productoId) {
            try {
                const apiBase = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : window.location.origin + '/api';
                const res = await fetch(`${apiBase}/productos/${productoId}/campos-personalizacion/publico`);
                if (res.ok) {
                    const data = await res.json();
                    const campos = data.data || data.campos || [];
                    if (campos.length > 0) {
                        this._campos = campos;
                        camposInner.innerHTML = campos.map(c => this._renderCampoInput(c)).join('');
                        camposWrap.style.display = 'block';
                        // Con campos, la descripción pasa a ser "Notas adicionales" y opcional
                        if (descLabel) descLabel.innerHTML = 'Notas adicionales <span style="color:#aaa;font-weight:400;">(opcional)</span>';
                        document.getElementById('cotiz-desc').placeholder = 'Alguna indicación extra para el equipo…';
                    }
                }
            } catch (_) {}
        }
        if (this._campos.length === 0 && descLabel) {
            descLabel.innerHTML = 'Descripción del proyecto <span style="color:#c0634c;">*</span>';
            document.getElementById('cotiz-desc').placeholder = 'Describe qué necesitas: dimensiones, material, cantidad, evento o uso, personalización deseada…';
        }
    },

    close() {
        const overlay = document.getElementById('cotiz-overlay');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    },

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

        // Recolectar y validar campos dinámicos
        const camposData = []; // [{campo_id, etiqueta, tipo, valor}]
        const camposArchivos = {}; // {campo_id: File}
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

        // Si no hay campos, la descripción es requerida
        if (camposData.length === 0 && !desc) {
            errorEl.textContent = 'Por favor describe tu proyecto.';
            errorEl.style.display = 'block';
            return;
        }

        const fileInput = document.getElementById('cotiz-archivos');
        const refFiles = fileInput.files ? Array.from(fileInput.files).slice(0, 5) : [];

        // Payload de cotización (descripción = notas adicionales solamente)
        const formData = new FormData();
        formData.append('nombre_cliente', nombre);
        formData.append('email', email);
        if (tel) formData.append('telefono', tel);
        if (this._context.productoId) formData.append('producto_id', this._context.productoId);
        formData.append('descripcion', desc);
        if (presu) formData.append('presupuesto_aprox', parseFloat(presu));
        formData.append('fuente', this._context.fuente || 'publico');
        if (this._context.clienteB2bId) formData.append('cliente_b2b_id', this._context.clienteB2bId);
        refFiles.forEach(f => formData.append('archivos', f));

        const btn = document.getElementById('cotiz-btn-submit');
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" style="width:15px;height:15px;"></i> Enviando…';
        errorEl.style.display = 'none';

        try {
            const apiBase = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : window.location.origin + '/api';

            // 1. Crear cotización
            const response = await fetch(`${apiBase}/cotizaciones`, { method: 'POST', body: formData });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Error al enviar');
            }
            const result = await response.json();
            const cotizacionId = result.id;

            // 2. Guardar respuestas estructuradas de campos (si hay)
            if (camposData.length > 0 && cotizacionId) {
                const fd2 = new FormData();
                fd2.append('respuestas_json', JSON.stringify(camposData));
                for (const [campoId, file] of Object.entries(camposArchivos)) {
                    fd2.append(`archivo_${campoId}`, file);
                }
                await fetch(`${apiBase}/cotizaciones/${cotizacionId}/personalizacion/respuestas`, {
                    method: 'POST',
                    body: fd2
                }).catch(() => {}); // silencioso — cotización ya creada
            }

            document.getElementById('cotiz-form-wrap').style.display = 'none';
            document.getElementById('cotiz-success').style.display = 'block';
        } catch (err) {
            errorEl.textContent = 'Error: ' + err.message;
            errorEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="send" style="width:15px;height:15px;"></i> Enviar Solicitud';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
};
