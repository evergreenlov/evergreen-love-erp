/**
 * Componente Calculadora de Costos, Catálogo y Cotizador por Foto (IA Gemini)
 */
const CostosComponent = {
    materiales: [],
    productos: [],
    ultimoCalculo: null,
    componentesSeleccionados: [],
    editingProductoId: null,

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando calculadora en pulgadas, desglose e IA...</p>
            </div>
        `;

        try {
            // Consultar materiales y productos costeados
            const [materialesRes, productosRes] = await Promise.all([
                EvergreenAPI.getMateriales(),
                EvergreenAPI.getProductos()
            ]);

            this.materiales = materialesRes.data || [];
            this.productos = productosRes.data || [];

            const maderasAcrilicos = this.materiales.filter(m => ['madera', 'acrilico', 'corcho', 'resina'].includes(m.tipo));
            const extrasHerrajes = this.materiales.filter(m => ['herrajes', 'empaques', 'imanes', 'pegamentos', 'pinturas', 'otros'].includes(m.tipo));

            // Select de material base
            let materialBaseOptions = '';
            if (maderasAcrilicos.length === 0) {
                materialBaseOptions = `<option value="0" disabled selected>Registre Basswood o Walnut en Inventario primero</option>`;
            } else {
                maderasAcrilicos.forEach(mat => {
                    materialBaseOptions += `
                        <option value="${mat.costo_hoja_unidad}" data-id="${mat.id}" data-w="${mat.tamano_ancho}" data-h="${mat.tamano_alto}">
                            ${mat.nombre} (${mat.espesor} in) - $${mat.costo_hoja_unidad.toFixed(2)} [${mat.tamano_ancho}"x${mat.tamano_alto}"]
                        </option>
                    `;
                });
            }

            // Listado de accesorios / componentes extras
            let extrasHTML = '';
            if (extrasHerrajes.length === 0) {
                extrasHTML = `<p style="font-size: 13px; color: #8c8270; font-style: italic;">No hay herrajes, empaques, imanes, pegamentos, pinturas u otros componentes en inventario.</p>`;
            } else {
                extrasHerrajes.forEach(ext => {
                    extrasHTML += `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--color-white); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 6px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13.5px; font-weight: 500;">
                                <input type="checkbox" class="extra-checkbox" data-id="${ext.id}" data-nombre="${ext.nombre}" data-costo="${ext.costo_hoja_unidad}" data-tipo="${ext.tipo}">
                                ${ext.nombre} ($${ext.costo_hoja_unidad.toFixed(2)}/ud)
                            </label>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-size: 12px; color: #8c8270;">Cant:</span>
                                <input type="number" class="extra-qty-input" value="1" min="1" disabled style="width: 50px; padding: 4px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 12.5px;">
                            </div>
                        </div>
                    `;
                });
            }

            // Filas de la tabla de catálogo
            let productRows = '';
            if (this.productos.length === 0) {
                productRows = `<tr><td colspan="6" style="text-align: center; color: #8c8270; padding: 24px;">No has costeado ni guardado productos aún.</td></tr>`;
            } else {
                this.productos.forEach(prod => {
                    productRows += `
                        <tr>
                            <td><strong>${prod.sku}</strong></td>
                            <td>${prod.nombre}</td>
                            <td>$${prod.costo_total.toFixed(2)}</td>
                            <td>$${prod.precio_final.toFixed(2)}</td>
                            <td>${((prod.precio_final - prod.costo_total) / prod.precio_final * 100).toFixed(0)}%</td>
                            <td style="text-align: right; white-space: nowrap;">
                                <button class="btn btn-secondary btn-edit-prod" style="padding: 6px 10px; font-size: 12px; color: var(--color-moss-green); border-color: rgba(95, 90, 48, 0.2); margin-right: 6px;" data-id="${prod.id}">
                                    <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
                                </button>
                                <button class="btn btn-secondary btn-delete-prod" style="padding: 6px 10px; font-size: 12px; color: var(--color-danger); border-color: rgba(153, 27, 27, 0.2);" data-id="${prod.id}">
                                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
            }

            // Banner de edición (visible sólo cuando se está editando un producto)
            const editingProd = this.editingProductoId ? this.productos.find(p => p.id === this.editingProductoId) : null;
            const editBanner = editingProd ? `
                <div id="edit-mode-banner" style="background: linear-gradient(135deg, #fff8e1, #fffde7); border: 2px solid #f9a825; border-radius: var(--radius-md); padding: 14px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i data-lucide="pencil" style="width:18px; height:18px; color:#f9a825; flex-shrink:0;"></i>
                        <div>
                            <strong style="font-size: 14px; color: #5d4037;">✏️ Editando Producto: ${editingProd.nombre}</strong>
                            <div style="font-size: 12px; color: #8c8270; margin-top: 2px;">SKU: ${editingProd.sku} — Modifica los valores en la calculadora y haz clic en <strong>"Guardar Cambios"</strong>.</div>
                        </div>
                    </div>
                    <button id="btn-cancelar-edicion" class="btn btn-secondary" style="white-space: nowrap; font-size: 12px; padding: 6px 12px;">
                        <i data-lucide="x" style="width:12px;height:12px;"></i> Cancelar Edición
                    </button>
                </div>
            ` : '';

            container.innerHTML = `
                ${editBanner}
                <div class="dashboard-grid" style="grid-template-columns: 1.2fr 1fr;">
                    
                    <!-- Formulario de Entrada y panel de IA -->
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        
                        <!-- Panel de Estimación por IA (Nuevo) -->
                        <div class="card" style="background: linear-gradient(135deg, var(--color-moss-green-light), transparent); border: 1px solid var(--color-moss-green-light); padding: 18px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                <strong style="font-size: 15px; color: var(--color-moss-green); display: flex; align-items: center; gap: 6px;">
                                    <i data-lucide="sparkles" style="width: 16px; height: 16px;"></i> Cotizador Automático por Foto (IA)
                                </strong>
                                <span style="font-size: 12px; color: var(--color-olive-brown); cursor: pointer; text-decoration: underline; font-weight: 500;" id="btn-config-gemini-key">
                                    Configurar Clave Gemini
                                </span>
                            </div>
                            <p style="font-size: 13px; color: var(--color-soft-black); opacity: 0.9; margin-bottom: 12px; line-height: 1.4;">
                                Sube la foto de tu llavero o producto terminado. La Inteligencia Artificial analizará el tipo de madera, herrajes adicionales y el tiempo estimado de láser para configurar la calculadora al instante.
                            </p>
                            
                            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <input type="file" id="ia-costo-file" accept="image/*" style="font-family: var(--font-primary); font-size: 13px; max-width: 250px;">
                                <button type="button" class="btn btn-primary" id="btn-analizar-foto-ia" style="padding: 8px 16px; font-size: 13px;">
                                    <i data-lucide="wand-2"></i> Estimar con IA
                                </button>
                            </div>
                            
                            <!-- Indicador de Carga IA -->
                            <div id="ia-analizando-loader" style="display: none; align-items: center; gap: 10px; font-size: 13px; color: var(--color-moss-green); margin-top: 12px; font-weight: 500;">
                                <div class="spinner" style="width: 16px; height: 16px; border-width: 2.5px; margin: 0;"></div>
                                <span>Gemini está analizando la imagen y consultando precios de Evergreen Love...</span>
                            </div>
                            
                            <!-- Caja de Resultados y Explicación de IA -->
                            <div id="ia-explicacion-box" style="display: none; background: var(--color-white); border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); padding: 12px; font-size: 13px; color: var(--color-soft-black); line-height: 1.4; margin-top: 12px; box-shadow: var(--shadow-sm);">
                            </div>
                        </div>

                        <!-- Bloque 1: Producto e Inventario Base -->
                        <div class="card">
                            <h3 class="card-title">Configuración de Pieza y Láser</h3>
                            <p style="color: #6c757d; font-size: 13.5px; margin-bottom: 16px;">Introduce las dimensiones en pulgadas para la base y los tiempos estimados de corte/grabado.</p>
                            
                            <form id="form-calculadora" style="display: flex; flex-direction: column; gap: 14px;">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-weight: 500; font-size: 13px;">Madera o Acrílico Base (Plancha)</label>
                                    <select id="costo-material-select" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                        ${materialBaseOptions}
                                    </select>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Ancho de la Pieza (in)</label>
                                        <input type="number" id="prod-ancho" value="2.0" step="0.1" min="0.1" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Alto de la Pieza (in)</label>
                                        <input type="number" id="prod-alto" value="2.0" step="0.1" min="0.1" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Tiempo Corte (min)</label>
                                        <input type="number" id="laser-corte" value="1.5" step="0.1" min="0" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Tiempo Grabado (min)</label>
                                        <input type="number" id="laser-grabado" value="1.0" step="0.1" min="0" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Mano de Obra ($)</label>
                                        <input type="number" id="costo-mano-obra" value="1.50" step="0.10" min="0" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Margen de Venta Deseado %</label>
                                        <input type="number" id="margen-ganancia" value="60" min="0" max="95" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                </div>
                            </form>
                        </div>

                        <!-- Bloque 2: Desglose de Componentes Físicos (Herrajes/Empaques/Chips) -->
                        <div class="card">
                            <h3 class="card-title">Desglose de Componentes de Llavero / Extras</h3>
                            <p style="color: #6c757d; font-size: 13.5px; margin-bottom: 16px;">Selecciona los accesorios adicionales (anillas, borlas, tags NFC, empaques) que componen la pieza final.</p>
                            
                            <div style="max-height: 250px; overflow-y: auto; padding-right: 4px;">
                                ${extrasHTML}
                            </div>

                            <button type="button" class="btn btn-primary" id="btn-calcular-costo" style="margin-top: 16px; width: 100%;">
                                <i data-lucide="calculator"></i> Calcular Costo de Producción
                            </button>
                        </div>
                    </div>

                    <!-- Resultados del Costeo Desglosado -->
                    <div class="card" style="background-color: var(--color-moss-green-light); border: 1px solid var(--color-moss-green); display: flex; flex-direction: column; justify-content: space-between; max-height: 600px;">
                        <div>
                            <h3 class="card-title" style="color: var(--color-moss-green);">Desglose del Costo (Pulgadas)</h3>
                            <p style="font-size: 13px; color: #8c8270;">Detalle minucioso de cada parte del producto costeo.</p>
                            
                            <div id="costo-desglose-lista" style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px; max-height: 320px; overflow-y: auto; padding-right: 4px;">
                                <div style="text-align: center; color: #8c8270; padding: 40px 10px; font-style: italic; font-size: 14px;">
                                    Haz clic en calcular o sube una foto con la IA para desglosar cada parte del producto.
                                </div>
                            </div>
                        </div>

                        <button class="btn btn-primary" id="btn-save-as-product" disabled style="margin-top: 20px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <i data-lucide="${this.editingProductoId ? 'check-circle' : 'save'}"></i> ${this.editingProductoId ? 'Guardar Cambios' : 'Guardar en Catálogo'}
                        </button>
                    </div>
                </div>

                <!-- Tabla de Productos ya Costeados -->
                <div class="card" style="margin-top: 24px;">
                    <h3 class="card-title">Catálogo de Productos y Costos en Pulgadas</h3>
                    <p style="color: #6c757d; font-size: 14px; margin-bottom: 16px;">Estos productos tienen desglosados sus componentes y restarán automáticamente existencias del inventario físico cuando inicies producción.</p>
                    
                    <div class="table-container">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Nombre Comercial</th>
                                    <th>Costo de Producción</th>
                                    <th>Precio de Venta</th>
                                    <th>Margen Real</th>
                                    <th style="text-align: right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${productRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Modales Dinámicos -->
                <div id="product-save-modal" class="modal-overlay" style="display: none;"></div>
                <div id="gemini-config-modal" class="modal-overlay" style="display: none;"></div>
            `;

            lucide.createIcons();
            this.setupListeners();

            // Si hay un producto en modo edición, aplicar sus valores a la calculadora
            if (this.editingProductoId) {
                const p = this.productos.find(prod => prod.id === this.editingProductoId);
                if (p) this._aplicarModoEdicion(p);
            }

        } catch (error) {
            container.innerHTML = `
                <div class="alert-card">
                    <i data-lucide="alert-octagon"></i>
                    <div>
                        <div class="alert-title">Error de Carga</div>
                        <div class="alert-desc">${error.message}</div>
                    </div>
                </div>
            `;
            lucide.createIcons();
        }
    },

    // Rellena la calculadora con los datos del producto a editar
    _aplicarModoEdicion(p) {
        // Cancelar edición
        const btnCancelar = document.getElementById('btn-cancelar-edicion');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => {
                this.editingProductoId = null;
                this.render('costos-container');
            });
        }

        // Seleccionar el material base del primer componente tipo madera/acrílico
        const selectMat = document.getElementById('costo-material-select');
        if (selectMat && p.componentes && p.componentes.length > 0) {
            const base = p.componentes.find(c => ['madera','acrilico','corcho','resina'].includes(c.material_tipo));
            if (base) {
                for (let i = 0; i < selectMat.options.length; i++) {
                    if (parseInt(selectMat.options[i].getAttribute('data-id')) === base.material_id) {
                        selectMat.selectedIndex = i;
                        break;
                    }
                }
            }
        }

        // Rellenar dimensiones y tiempos
        if (p.ancho) document.getElementById('prod-ancho').value = p.ancho;
        if (p.alto)  document.getElementById('prod-alto').value  = p.alto;
        if (p.tiempo_corte   !== undefined) document.getElementById('laser-corte').value    = p.tiempo_corte;
        if (p.tiempo_grabado !== undefined) document.getElementById('laser-grabado').value   = p.tiempo_grabado;
        if (p.costo_mano_obra !== undefined) document.getElementById('costo-mano-obra').value = p.costo_mano_obra;
        if (p.margen_ganancia !== undefined) document.getElementById('margen-ganancia').value = (p.margen_ganancia * 100).toFixed(0);

        // Marcar checkboxes de extras con cantidades guardadas
        const checkboxes = document.querySelectorAll('.extra-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = false;
            const parentDiv = cb.closest('div').parentElement;
            const qtyInput = parentDiv ? parentDiv.querySelector('.extra-qty-input') : null;
            if (qtyInput) { qtyInput.setAttribute('disabled', 'true'); qtyInput.value = 1; }
        });

        if (p.componentes) {
            const extras = p.componentes.filter(c => !['madera','acrilico','corcho','resina'].includes(c.material_tipo));
            extras.forEach(comp => {
                checkboxes.forEach(cb => {
                    if (parseInt(cb.getAttribute('data-id')) === comp.material_id) {
                        cb.checked = true;
                        const parentDiv = cb.closest('div').parentElement;
                        const qtyInput = parentDiv ? parentDiv.querySelector('.extra-qty-input') : null;
                        if (qtyInput) {
                            qtyInput.removeAttribute('disabled');
                            qtyInput.value = Math.round(comp.cantidad_usada) || 1;
                        }
                    }
                });
            });
        }

        // Activar botón y lanzar cálculo automáticamente
        const btnCalcular = document.getElementById('btn-calcular-costo');
        const btnSave = document.getElementById('btn-save-as-product');
        if (btnCalcular) btnCalcular.click();
        if (btnSave) btnSave.removeAttribute('disabled');
    },

    setupListeners() {
        const checkboxes = document.querySelectorAll('.extra-checkbox');
        const btnCalcular = document.getElementById('btn-calcular-costo');
        const btnSaveProduct = document.getElementById('btn-save-as-product');
        const btnConfigKey = document.getElementById('btn-config-gemini-key');
        const btnAnalizarIa = document.getElementById('btn-analizar-foto-ia');
        const iaFileInput = document.getElementById('ia-costo-file');

        if (btnSaveProduct) {
            btnSaveProduct.addEventListener('click', () => this.openSaveProductModal());
        }

        // Habilitar inputs de cantidad
        checkboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                const parentDiv = cb.closest('div').parentElement;
                const qtyInput = parentDiv.querySelector('.extra-qty-input');
                if (e.target.checked) {
                    qtyInput.removeAttribute('disabled');
                } else {
                    qtyInput.setAttribute('disabled', 'true');
                    qtyInput.value = 1;
                }
            });
        });

        // Configuración de Gemini Key (Modal)
        if (btnConfigKey) {
            btnConfigKey.addEventListener('click', () => this.openGeminiConfigModal());
        }

        // Estimar costos con IA (Llamada al backend)
        if (btnAnalizarIa && iaFileInput) {
            btnAnalizarIa.addEventListener('click', async () => {
                const file = iaFileInput.files[0];
                if (!file) {
                    alert("Por favor, selecciona una foto primero.");
                    return;
                }

                const geminiKey = localStorage.getItem('evergreen_gemini_key');
                if (!geminiKey) {
                    alert("Por favor, configura tu API Key de Gemini antes de realizar el análisis. Haz clic en 'Configurar Clave Gemini'.");
                    this.openGeminiConfigModal();
                    return;
                }

                const loader = document.getElementById('ia-analizando-loader');
                const explBox = document.getElementById('ia-explicacion-box');
                
                loader.style.display = 'flex';
                explBox.style.display = 'none';
                btnAnalizarIa.disabled = true;

                try {
                    const res = await EvergreenAPI.estimarCostoPorIA(file, geminiKey);
                    
                    if (res.status === 'success' && res.data) {
                        const iaData = res.data;
                        
                        // 1. Mostrar la explicación de la IA
                        explBox.innerHTML = `
                            <strong style="color: var(--color-moss-green); display: flex; align-items: center; gap: 4px;">
                                <i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i> Análisis de IA Completado
                            </strong>
                            <p style="margin-top: 6px; font-style: italic;">"${iaData.explicacion}"</p>
                            <div style="margin-top: 8px; font-size: 12px; color: #8c8270;">
                                • Material: <strong>${iaData.material_base}</strong><br>
                                • Herrajes: <strong>${iaData.herrajes_detectados.join(", ") || 'Ninguno'}</strong><br>
                                • Grabado: <strong>${iaData.densidad_grabado}</strong> (Corte: ${iaData.tiempo_corte_sugerido_minutos}m, Grabado: ${iaData.tiempo_grabado_sugerido_minutos}m)
                            </div>
                        `;
                        explBox.style.display = 'block';
                        lucide.createIcons();

                        // 2. Rellenar inputs de la calculadora automáticamente
                        
                        // Seleccionar material base
                        const selectMat = document.getElementById('costo-material-select');
                        let materialEncontrado = false;
                        for (let i = 0; i < selectMat.options.length; i++) {
                            const optionText = selectMat.options[i].text.toLowerCase();
                            const matchText = iaData.material_base.toLowerCase();
                            
                            // Buscar coincidencias aproximadas (ej. "Basswood" o "Walnut")
                            if (optionText.includes(matchText) || matchText.includes(optionText.split(" (")[0].toLowerCase())) {
                                selectMat.selectedIndex = i;
                                materialEncontrado = true;
                                break;
                            }
                        }
                        
                        if (!materialEncontrado && selectMat.options.length > 0) {
                            // Basswood por defecto si no lo encuentra de forma segura
                            selectMat.selectedIndex = 0;
                        }

                        // Configurar Tiempos
                        document.getElementById('laser-corte').value = iaData.tiempo_corte_sugerido_minutos || 1.5;
                        document.getElementById('laser-grabado').value = iaData.tiempo_grabado_sugerido_minutos || 1.0;

                        // Desmarcar todos los accesorios primero
                        checkboxes.forEach(cb => {
                            cb.checked = false;
                            const parentDiv = cb.closest('div').parentElement;
                            const qtyInput = parentDiv.querySelector('.extra-qty-input');
                            qtyInput.setAttribute('disabled', 'true');
                            qtyInput.value = 1;
                        });

                        // Marcar accesorios identificados por la IA
                        iaData.herrajes_detectados.forEach(iaHerr => {
                            checkboxes.forEach(cb => {
                                const hName = cb.getAttribute('data-nombre').toLowerCase();
                                const iaHName = iaHerr.toLowerCase();
                                
                                if (hName.includes(iaHName) || iaHName.includes(hName.split(" de ")[0])) {
                                    cb.checked = true;
                                    const parentDiv = cb.closest('div').parentElement;
                                    const qtyInput = parentDiv.querySelector('.extra-qty-input');
                                    qtyInput.removeAttribute('disabled');
                                    qtyInput.value = 1;
                                }
                            });
                        });

                        // 3. Ejecutar cálculo inmediato
                        btnCalcular.click();
                        
                    } else {
                        alert("No se pudo estructurar el análisis de la IA.");
                    }
                    
                } catch (err) {
                    alert("Error en el análisis de IA: " + err.message);
                } finally {
                    loader.style.display = 'none';
                    btnAnalizarIa.disabled = false;
                }
            });
        }

        // Ejecutar cálculo normal
        if (btnCalcular) {
            btnCalcular.addEventListener('click', () => {
                const selectMat = document.getElementById('costo-material-select');
                if (!selectMat || selectMat.value === "0" || selectMat.selectedIndex < 0) {
                    alert("Por favor, selecciona una plancha de madera o acrílico base.");
                    return;
                }

                const costoHoja = parseFloat(selectMat.value);
                const optSelected = selectMat.options[selectMat.selectedIndex];
                const matId = parseInt(optSelected.getAttribute('data-id'));
                const matNombre = optSelected.text.split(" (")[0];
                const anchoHoja = parseFloat(optSelected.getAttribute('data-w'));
                const altoHoja = parseFloat(optSelected.getAttribute('data-h'));
                
                const anchoProd = parseFloat(document.getElementById('prod-ancho').value) || 0;
                const altoProd = parseFloat(document.getElementById('prod-alto').value) || 0;
                const tiempoCorte = parseFloat(document.getElementById('laser-corte').value) || 0;
                const tiempoGrabado = parseFloat(document.getElementById('laser-grabado').value) || 0;
                const manoObra = parseFloat(document.getElementById('costo-mano-obra').value) || 0;
                const margen = parseFloat(document.getElementById('margen-ganancia').value) || 0;

                const areaHoja = anchoHoja * altoHoja;
                const areaProd = anchoProd * altoProd;
                const areaConDesperdicio = areaProd * 1.15;
                const costoPlanchaProporcional = (areaConDesperdicio / areaHoja) * costoHoja;

                this.componentesSeleccionados = [];
                let desgloseHTML = `
                    <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">Soporte Base:</strong>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px; font-weight: 500;">
                            <span>${matNombre} (${areaConDesperdicio.toFixed(2)} in² usados)</span>
                            <span>$${costoPlanchaProporcional.toFixed(2)}</span>
                        </div>
                    </div>
                `;

                this.componentesSeleccionados.push({
                    materialId: matId,
                    cantidad: areaConDesperdicio,
                    nombre: matNombre,
                    costoCalculado: costoPlanchaProporcional
                });

                let costoAccesoriosTotal = 0;
                let accesoriosHTML = '';

                checkboxes.forEach(cb => {
                    if (cb.checked) {
                        const extId = parseInt(cb.getAttribute('data-id'));
                        const extNombre = cb.getAttribute('data-nombre');
                        const extCostoUnitario = parseFloat(cb.getAttribute('data-costo'));
                        const parentDiv = cb.closest('div').parentElement;
                        const qty = parseInt(parentDiv.querySelector('.extra-qty-input').value) || 1;

                        const costoCalculado = extCostoUnitario * qty;
                        costoAccesoriosTotal += costoCalculado;

                        this.componentesSeleccionados.push({
                            materialId: extId,
                            cantidad: qty,
                            nombre: extNombre,
                            costoCalculado: costoCalculado
                        });

                        accesoriosHTML += `
                            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                                <span>${extNombre} (x${qty})</span>
                                <span>$${costoCalculado.toFixed(2)}</span>
                            </div>
                        `;
                    }
                });

                if (accesoriosHTML) {
                    desgloseHTML += `
                        <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                            <strong style="color: var(--color-moss-green); font-size: 13.5px;">Componentes y Accesorios Extras:</strong>
                            ${accesoriosHTML}
                        </div>
                    `;
                }

                const costoLaser = (tiempoCorte + tiempoGrabado) * 0.25;
                desgloseHTML += `
                    <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">Tiempos Láser ($0.25/min):</strong>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                            <span>Corte: ${tiempoCorte} min | Grabado: ${tiempoGrabado} min</span>
                            <span>$${costoLaser.toFixed(2)}</span>
                        </div>
                    </div>
                `;

                const costoTotal = costoPlanchaProporcional + costoAccesoriosTotal + costoLaser + manoObra;
                const factorMargen = 1 - (margen / 100);
                const precioSugerido = factorMargen > 0 ? (costoTotal / factorMargen) : costoTotal;
                const ganancia = precioSugerido - costoTotal;

                desgloseHTML += `
                    <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--color-moss-green); padding-top: 12px; margin-top: 14px; font-weight: 700; color: var(--color-moss-green); font-size: 15px;">
                        <span>COSTO TOTAL PRODUCCIÓN:</span>
                        <span>$${costoTotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: var(--color-terracotta); margin-top: 6px;">
                        <span>Precio Venta Sugerido:</span>
                        <span>$${precioSugerido.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 500; color: var(--color-success); margin-top: 4px;">
                        <span>Ganancia Estimada (${margen}%):</span>
                        <span>$${ganancia.toFixed(2)}</span>
                    </div>
                `;

                this.ultimoCalculo = {
                    tiempo_corte: tiempoCorte,
                    tiempo_grabado: tiempoGrabado,
                    costo_maquina: costoLaser,
                    costo_mano_obra: manoObra,
                    costo_total: costoTotal,
                    margen_ganancia: margen / 100,
                    precio_sugerido: precioSugerido
                };

                document.getElementById('costo-desglose-lista').innerHTML = desgloseHTML;
                btnSaveProduct.removeAttribute('disabled');
            });
        }

        // Editar productos costeados — cargar en la calculadora
        document.querySelectorAll('.btn-edit-prod').forEach(btn => {
            btn.addEventListener('click', () => {
                const prodId = parseInt(btn.getAttribute('data-id'));
                this.editingProductoId = prodId;
                this.render('costos-container');
            });
        });

        // Borrar productos costeados
        document.querySelectorAll('.btn-delete-prod').forEach(btn => {
            btn.addEventListener('click', async () => {
                const prodId = parseInt(btn.getAttribute('data-id'));
                if (confirm("¿Estás seguro de que deseas eliminar este producto costeado del catálogo?")) {
                    try {
                        await EvergreenAPI.deleteProducto(prodId);
                        this.render('costos-container');
                    } catch (err) {
                        alert("Error al eliminar producto: " + err.message);
                    }
                }
            });
        });
    },

    async openSaveProductModal() {
        const modal = document.getElementById('product-save-modal');
        const sugerido = this.ultimoCalculo.precio_sugerido;

        // Detectar modo edición
        const isEditing = !!this.editingProductoId;
        const editingProd = isEditing ? this.productos.find(p => p.id === this.editingProductoId) : null;

        // Cargar clientes B2B para la asignación opcional
        let clientes = [];
        try {
            const resCl = await EvergreenAPI.getClientes();
            clientes = resCl.data || [];
        } catch (e) {
            console.error("Error al obtener clientes B2B para costos:", e);
        }

        let b2bOptions = '<option value="">-- Venta General (Ninguno) --</option>';
        clientes.forEach(c => {
            const sel = (editingProd && editingProd.cliente_id === c.id) ? 'selected' : '';
            b2bOptions += `<option value="${c.id}" ${sel}>${c.nombre}</option>`;
        });

        const defSku      = editingProd ? editingProd.sku : '';
        const defNombre   = editingProd ? editingProd.nombre : '';
        const defDesc     = editingProd ? (editingProd.shopify_descripcion || '') : '';
        const defPrecio   = editingProd ? editingProd.precio_final.toFixed(2) : sugerido.toFixed(2);
        const defPersonal = editingProd ? editingProd.personalizado : 0;
        const defShTitulo = editingProd ? (editingProd.shopify_titulo || '') : '';
        const defShTags   = editingProd ? (editingProd.shopify_tags || '') : '';
        const defB2bPrecio = editingProd && editingProd.b2b_precio ? editingProd.b2b_precio.toFixed(2) : '';

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 500px; width: 90%; margin: 60px auto; position: relative;">
                <h3 class="card-title" style="color: ${isEditing ? '#f9a825' : 'inherit'}">
                    ${isEditing ? '✏️ Guardar Cambios del Producto' : 'Guardar en Catálogo'}
                </h3>
                ${isEditing ? `<p style="font-size:12px; color:#8c8270; margin: -8px 0 12px;">Actualizando: <strong>${editingProd.nombre}</strong> (SKU: ${editingProd.sku})</p>` : ''}
                
                <form id="product-save-form" style="display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px; display:flex; justify-content:space-between; align-items:center;">
                                <span>SKU Único</span>
                                <button type="button" id="btn-auto-sku" style="background:none; border:none; color:var(--color-moss-green); font-size:11px; cursor:pointer; padding:0; display:flex; align-items:center; gap:3px;"><i data-lucide="refresh-cw" style="width:12px;height:12px;"></i> Auto</button>
                            </label>
                            <input type="text" id="prod-sku" required value="${defSku}" placeholder="Ej. SKU-GAR-LLAV-01" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Nombre Comercial</label>
                            <input type="text" id="prod-nombre" required value="${defNombre}" placeholder="Ej. Llavero de Garita Walnut" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Descripción / Tamaño</label>
                        <input type="text" id="prod-descripcion" value="${defDesc}" placeholder='Ej. Tamaño: 3.5" x 2.2" | Madera Walnut de 1/8"' style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">${isEditing ? 'Reemplazar Foto del Producto (Opcional)' : 'Foto del Producto (Opcional)'}</label>
                        <input type="file" id="prod-foto" accept="image/*" style="font-family: var(--font-primary); font-size: 12px; padding: 6px 0; border: none; background: transparent; cursor: pointer;">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Precio Venta Final ($)</label>
                            <input type="number" id="prod-precio-final" step="0.01" value="${defPrecio}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Tipo de Venta</label>
                            <select id="prod-personalizado" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                <option value="0" ${defPersonal === 0 ? 'selected' : ''}>Estándar (Venta Directa)</option>
                                <option value="1" ${defPersonal === 1 ? 'selected' : ''}>Personalizado (Precio a Cotizar)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Asignación Opcional a Cliente B2B -->
                    <div style="background-color: var(--color-gray-light); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-gray-border); margin-top: 2px;">
                        <h4 style="font-size: 13px; font-weight: 600; color: var(--color-moss-green); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="users" style="width: 14px; height: 14px;"></i> Asignar a Cliente B2B (Opcional)
                        </h4>
                        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; font-size: 12px;">
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Seleccionar Cliente</label>
                                <select id="prod-b2b-cliente-id" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px; cursor:pointer; background-color: var(--color-white);">
                                    ${b2bOptions}
                                </select>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Precio Pactado B2B ($)</label>
                                <input type="number" step="0.01" id="prod-b2b-precio" placeholder="0.00" value="${defB2bPrecio}" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px;">
                            </div>
                        </div>
                    </div>

                    <div style="background-color: var(--color-gray-light); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-gray-border); margin-top: 2px;">
                        <h4 style="font-size: 13px; font-weight: 600; color: var(--color-moss-green); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> Automatización SEO Shopify
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Título Shopify Sugerido</label>
                                <input type="text" id="sh-titulo" value="${defShTitulo}" placeholder="Ej. Llavero de Madera - Garita del Viejo San Juan" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px;">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Tags Shopify</label>
                                <input type="text" id="sh-tags" value="${defShTags}" placeholder="llavero, madera, garita, artesanal" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px;">
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" id="btn-close-prod-modal" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1; background: ${isEditing ? '#f9a825' : ''}; border-color: ${isEditing ? '#f9a825' : ''}; color: ${isEditing ? '#fff' : ''}">
                            ${isEditing ? '✓ Guardar Cambios' : 'Guardar en Catálogo'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(62, 62, 62, 0.4)';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.zIndex = '1000';
        modal.style.display = 'block';

        lucide.createIcons();

        const inputNombre = document.getElementById('prod-nombre');
        const inputShTitulo = document.getElementById('sh-titulo');
        const inputShTags = document.getElementById('sh-tags');

        inputNombre.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val && !isEditing) {
                inputShTitulo.value = `${val} - Hecho en Puerto Rico`;
                const palabras = val.toLowerCase().replace(/[^a-zA-Záéíóúñ ]/g, "").split(" ");
                const tagsFiltrados = palabras.filter(p => p.length > 3 && !['para', 'con', 'desde', 'sobre'].includes(p));
                inputShTags.value = tagsFiltrados.join(", ");
            }
        });

        document.getElementById('btn-close-prod-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Evento para auto-generar SKU
        document.getElementById('btn-auto-sku').addEventListener('click', () => {
            const nombre = document.getElementById('prod-nombre').value.trim() || 'EVG';
            const base = nombre.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
            const rnd = Math.floor(1000 + Math.random() * 9000);
            document.getElementById('prod-sku').value = `SKU-${base}-${rnd}`;
        });

        document.getElementById('product-save-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const sku = document.getElementById('prod-sku').value.trim();
            const nombre = document.getElementById('prod-nombre').value.trim();
            const precioFinal = parseFloat(document.getElementById('prod-precio-final').value) || sugerido;
            const personalizado = parseInt(document.getElementById('prod-personalizado').value);
            const shTitulo = document.getElementById('sh-titulo').value.trim() || nombre;
            const shTags = document.getElementById('sh-tags').value.trim() || "evergreen, artesanal";
            const shDesc = document.getElementById('prod-descripcion').value.trim() || (isEditing ? '' : `Producto exclusivo de la marca Evergreen Love. Hecho artesanalmente a mano con detalles grabados y cortados en láser.`);

            const componentesBackend = this.componentesSeleccionados.map(c => ({
                material_id: c.materialId,
                cantidad_usada: c.cantidad,
                costo_calculado: c.costoCalculado
            }));

            // Leer dimensiones actuales de la calculadora
            const anchoActual = parseFloat(document.getElementById('prod-ancho')?.value) || 2.0;
            const altoActual  = parseFloat(document.getElementById('prod-alto')?.value)  || 2.0;

            const b2bClienteId = document.getElementById('prod-b2b-cliente-id').value;
            const b2bPrecio = parseFloat(document.getElementById('prod-b2b-precio').value);

            if (isEditing) {
                // --- MODO EDICIÓN: actualizar producto existente ---
                try {
                    await EvergreenAPI.updateProducto(this.editingProductoId, {
                        sku, nombre,
                        precio_final: precioFinal,
                        shopify_descripcion: shDesc,
                        personalizado,
                        shopify_titulo: shTitulo,
                        shopify_tags: shTags,
                        shopify_alt_text: `Fotografía de producto terminado de ${nombre}`,
                        cliente_id: b2bClienteId ? parseInt(b2bClienteId) : null,
                        b2b_precio: !isNaN(b2bPrecio) ? b2bPrecio : null,
                        ancho: anchoActual,
                        alto: altoActual,
                        tiempo_corte: this.ultimoCalculo.tiempo_corte,
                        tiempo_grabado: this.ultimoCalculo.tiempo_grabado,
                        costo_maquina: this.ultimoCalculo.costo_maquina,
                        costo_mano_obra: this.ultimoCalculo.costo_mano_obra,
                        costo_total: this.ultimoCalculo.costo_total,
                        margen_ganancia: this.ultimoCalculo.margen_ganancia,
                        precio_sugerido: this.ultimoCalculo.precio_sugerido,
                        componentes: componentesBackend
                    });

                    // Reemplazar foto si se seleccionó una nueva
                    const fotoFileInput = document.getElementById('prod-foto');
                    if (fotoFileInput && fotoFileInput.files && fotoFileInput.files.length > 0) {
                        await EvergreenAPI.subirFoto(fotoFileInput.files[0], null, this.editingProductoId, 'referencia');
                    }

                    modal.style.display = 'none';
                    this.editingProductoId = null;
                    await this.render('costos-container');
                } catch (err) {
                    alert("Error al actualizar el producto: " + err.message);
                }
            } else {
                // --- MODO CREACIÓN: registrar nuevo producto ---
                const productData = {
                    sku, nombre,
                    diseno_id: null,
                    ancho: anchoActual,
                    alto: altoActual,
                    tiempo_corte: this.ultimoCalculo.tiempo_corte,
                    tiempo_grabado: this.ultimoCalculo.tiempo_grabado,
                    costo_maquina: this.ultimoCalculo.costo_maquina,
                    costo_mano_obra: this.ultimoCalculo.costo_mano_obra,
                    costo_total: this.ultimoCalculo.costo_total,
                    margen_ganancia: this.ultimoCalculo.margen_ganancia,
                    precio_sugerido: this.ultimoCalculo.precio_sugerido,
                    precio_final: precioFinal,
                    personalizado,
                    shopify_titulo: shTitulo,
                    shopify_descripcion: shDesc,
                    shopify_tags: shTags,
                    shopify_alt_text: `Fotografía de producto terminado de ${nombre}`,
                    componentes: componentesBackend
                };

                try {
                    const res = await EvergreenAPI.createProducto(productData);
                    const nuevoProductoId = res.id;

                    const fotoFileInput = document.getElementById('prod-foto');
                    if (fotoFileInput && fotoFileInput.files && fotoFileInput.files.length > 0) {
                        try {
                            await EvergreenAPI.subirFoto(fotoFileInput.files[0], null, nuevoProductoId, 'referencia');
                        } catch (uploadError) {
                            console.error("Error al subir la foto desde costos:", uploadError);
                            alert("El producto fue guardado, pero hubo un error al subir la foto.");
                        }
                    }

                    if (b2bClienteId && !isNaN(b2bPrecio)) {
                        await EvergreenAPI.addProductoCatalogoCliente({
                            cliente_id: parseInt(b2bClienteId),
                            producto_id: nuevoProductoId,
                            precio_especial: b2bPrecio,
                            notas: "Asociado automáticamente durante el costeo."
                        });
                    }

                    modal.style.display = 'none';
                    this.render('costos-container');
                } catch (err) {
                    alert("Error al registrar el producto: " + err.message);
                }
            }
        });
    },

    openGeminiConfigModal() {
        const modal = document.getElementById('gemini-config-modal');
        const currentKey = localStorage.getItem('evergreen_gemini_key') || '';

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 450px; width: 90%; margin: 120px auto; position: relative;">
                <h3 class="card-title" style="display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="key" style="color: var(--color-moss-green);"></i> Configurar API Key de Gemini
                </h3>
                <p style="font-size: 13px; color: #6c757d; line-height: 1.4; margin-bottom: 14px;">
                    Para usar el cotizador visual por foto, necesitas ingresar tu API Key gratuita de Gemini. 
                    Si no tienes una, puedes generarla en 2 minutos en <a href="https://aistudio.google.com/" target="_blank" style="color: var(--color-terracotta); font-weight: 600; text-decoration: underline;">Google AI Studio</a>.
                </p>
                
                <form id="gemini-config-form" style="display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">API Key de Gemini</label>
                        <input type="password" id="gemini-key-input" value="${currentKey}" placeholder="Pega tu clave AIzaSy..." style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 6px;">
                        <button type="button" class="btn btn-secondary" id="btn-close-gemini-modal" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Guardar Clave</button>
                    </div>
                </form>
            </div>
        `;

        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(62, 62, 62, 0.4)';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.zIndex = '1000';
        modal.style.display = 'block';

        lucide.createIcons();

        document.getElementById('btn-close-gemini-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('gemini-config-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const keyVal = document.getElementById('gemini-key-input').value.trim();
            if (keyVal) {
                localStorage.setItem('evergreen_gemini_key', keyVal);
                alert("API Key de Gemini guardada correctamente de forma local en tu navegador.");
                modal.style.display = 'none';
            } else {
                localStorage.removeItem('evergreen_gemini_key');
                alert("API Key eliminada.");
                modal.style.display = 'none';
            }
        });
    },

    async openEditProductModal(productoId) {
        const p = this.productos.find(prod => prod.id === productoId);
        if (!p) return;

        let modal = document.getElementById('product-edit-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'product-edit-modal';
            document.body.appendChild(modal);
        }

        // Cargar clientes B2B para la asignación opcional
        let clientes = [];
        try {
            const resCl = await EvergreenAPI.getClientes();
            clientes = resCl.data || [];
        } catch (e) {
            console.error("Error al obtener clientes B2B para costos:", e);
        }

        let b2bOptions = '<option value="">-- Venta General (Ninguno) --</option>';
        clientes.forEach(c => {
            const isSelected = p.cliente_id === c.id ? 'selected' : '';
            b2bOptions += `<option value="${c.id}" ${isSelected}>${c.nombre}</option>`;
        });

        const b2bPrecioVal = p.b2b_precio ? p.b2b_precio.toFixed(2) : '';

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 500px; width: 90%; margin: 60px auto; position: relative; background: white; padding: 24px; border-radius: var(--radius-md); box-shadow: var(--shadow-lg);">
                <h3 class="card-title" style="margin-bottom:16px; color: var(--color-moss-green);">Editar Producto</h3>
                
                <form id="product-edit-form" style="display: flex; flex-direction: column; gap: 14px; text-align: left;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">SKU Único</label>
                            <input type="text" id="edit-prod-sku" required value="${p.sku || ''}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Nombre Comercial</label>
                            <input type="text" id="edit-prod-nombre" required value="${p.nombre || ''}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Descripción / Tamaño</label>
                        <input type="text" id="edit-prod-descripcion" value="${p.shopify_descripcion || ''}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Reemplazar Foto del Producto (Opcional)</label>
                        <input type="file" id="edit-prod-foto" accept="image/*" style="font-family: var(--font-primary); font-size: 12px; padding: 6px 0; border: none; background: transparent; cursor: pointer;">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Precio Venta Final ($)</label>
                            <input type="number" id="edit-prod-precio-final" step="0.01" value="${(p.precio_final || 0).toFixed(2)}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Tipo de Venta</label>
                            <select id="edit-prod-personalizado" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                                <option value="0" ${p.personalizado === 0 ? 'selected' : ''}>Estándar (Venta Directa)</option>
                                <option value="1" ${p.personalizado === 1 ? 'selected' : ''}>Personalizado (Precio a Cotizar)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Asignación Opcional a Cliente B2B -->
                    <div style="background-color: var(--color-gray-light); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-gray-border); margin-top: 2px;">
                        <h4 style="font-size: 13px; font-weight: 600; color: var(--color-moss-green); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="users" style="width: 14px; height: 14px;"></i> Asignar a Cliente B2B (Opcional)
                        </h4>
                        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; font-size: 12px;">
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Seleccionar Cliente</label>
                                <select id="edit-prod-b2b-cliente-id" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px; cursor:pointer; background-color: var(--color-white);">
                                    ${b2bOptions}
                                </select>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Precio Pactado B2B ($)</label>
                                <input type="number" step="0.01" id="edit-prod-b2b-precio" placeholder="0.00" value="${b2bPrecioVal}" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px;">
                            </div>
                        </div>
                    </div>

                    <div style="background-color: var(--color-gray-light); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-gray-border); margin-top: 2px;">
                        <h4 style="font-size: 13px; font-weight: 600; color: var(--color-moss-green); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> Automatización SEO Shopify
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Título Shopify Sugerido</label>
                                <input type="text" id="edit-sh-titulo" placeholder="Ej. Llavero de Madera - Garita del Viejo San Juan" value="${p.shopify_titulo || ''}" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px;">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Tags Shopify</label>
                                <input type="text" id="edit-sh-tags" placeholder="llavero, madera, garita, artesanal" value="${p.shopify_tags || ''}" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px;">
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('product-edit-modal').style.display='none'" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1; background: var(--color-moss-green); color: white; border: none; padding: 10px; border-radius: var(--radius-sm); cursor: pointer; font-family: var(--font-primary); font-weight: 500; font-size: 13px;">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        `;

        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(62, 62, 62, 0.4)';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.zIndex = '1000';
        modal.style.display = 'block';

        lucide.createIcons();

        const form = document.getElementById('product-edit-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const sku = document.getElementById('edit-prod-sku').value.trim();
            const nombre = document.getElementById('edit-prod-nombre').value.trim();
            const desc = document.getElementById('edit-prod-descripcion').value.trim();
            const precioFinal = parseFloat(document.getElementById('edit-prod-precio-final').value) || 0;
            const personalizado = parseInt(document.getElementById('edit-prod-personalizado').value);
            const shTitulo = document.getElementById('edit-sh-titulo').value.trim() || nombre;
            const shTags = document.getElementById('edit-sh-tags').value.trim() || "evergreen, artesanal";

            const clienteId = parseInt(document.getElementById('edit-prod-b2b-cliente-id').value) || null;
            const b2bPrecio = parseFloat(document.getElementById('edit-prod-b2b-precio').value) || null;

            try {
                // Actualizar info principal
                await EvergreenAPI.updateProducto(productoId, {
                    sku: sku,
                    nombre: nombre,
                    precio_final: precioFinal,
                    shopify_descripcion: desc,
                    personalizado: personalizado,
                    shopify_titulo: shTitulo,
                    shopify_tags: shTags,
                    cliente_id: clienteId,
                    b2b_precio: b2bPrecio
                });

                // Reemplazar foto si se seleccionó una
                const fotoFileInput = document.getElementById('edit-prod-foto');
                if (fotoFileInput && fotoFileInput.files && fotoFileInput.files.length > 0) {
                    const file = fotoFileInput.files[0];
                    await EvergreenAPI.subirFoto(file, null, productoId, 'referencia');
                }

                modal.style.display = 'none';
                await this.render('costos-container');
            } catch (err) {
                alert("Error al actualizar producto: " + err.message);
            }
        });
    }
};
