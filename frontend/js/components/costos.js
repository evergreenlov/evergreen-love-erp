/**
 * Componente Calculadora de Costos, Catálogo y Cotizador por Foto (IA Gemini)
 */
const CostosComponent = {
    materiales: [],
    productos: [],
    ultimoCalculo: null,
    componentesSeleccionados: [],
    editingProductoId: null,
    tarifas: { tarifa_hora_laser: 15.0, tarifa_hora_labor: 18.0 },

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando calculadora en pulgadas, desglose e IA...</p>
            </div>
        `;

        try {
            // Consultar materiales, productos y tarifas globales
            const [materialesRes, productosRes, configRes] = await Promise.all([
                EvergreenAPI.getMateriales(),
                EvergreenAPI.getProductos(),
                EvergreenAPI.getConfiguracion().catch(() => ({ data: { tarifa_hora_laser: 15.0, tarifa_hora_labor: 18.0 } }))
            ]);

            this.materiales = materialesRes.data || [];
            this.productos = productosRes.data || [];
            this.tarifas = configRes.data || { tarifa_hora_laser: 15.0, tarifa_hora_labor: 18.0 };

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
                                <button class="btn btn-secondary btn-remover-fondo" title="Remover fondo (rembg)" style="padding: 6px 10px; font-size: 12px; color: #6c8ebf; border-color: rgba(108,142,191,0.3); margin-right: 6px;" data-id="${prod.id}" data-sku="${prod.sku}">
                                    <i data-lucide="image-off" style="width: 14px; height: 14px;"></i>
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

                                <!-- Tipo de producto y complejidad -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Tipo de Producto</label>
                                        <select id="tipo-producto" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                            <option value="llavero">Llavero</option>
                                            <option value="garita">Garita</option>
                                            <option value="shadow_box">Shadow Box</option>
                                            <option value="ornamento">Ornamento</option>
                                            <option value="portada_libreta">Portada de Libreta</option>
                                            <option value="personalizado">Personalizado</option>
                                            <option value="otro">Otro</option>
                                        </select>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;" title="Multiplica el costo de labor: Simple ×1.0 · Media ×1.3 · Compleja ×1.6">Complejidad <span style="color:#aaa;font-size:11px;">(afecta labor)</span></label>
                                        <select id="complejidad-producto" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                            <option value="simple">Simple (×1.0)</option>
                                            <option value="media">Media (×1.3)</option>
                                            <option value="compleja">Compleja (×1.6)</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Material base -->
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-weight: 500; font-size: 13px;">Madera o Acrílico Base (Plancha)</label>
                                    <select id="costo-material-select" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                        ${materialBaseOptions}
                                    </select>
                                </div>

                                <!-- Dimensiones -->
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

                                <!-- Tiempos láser -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Tiempo Corte Láser (min)</label>
                                        <input type="number" id="laser-corte" value="1.5" step="0.1" min="0" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Tiempo Grabado Láser (min)</label>
                                        <input type="number" id="laser-grabado" value="1.0" step="0.1" min="0" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                </div>

                                <!-- Tiempos de labor -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Tiempo Pintura/Capa (min)</label>
                                        <input type="number" id="tiempo-pintura" value="0" step="0.5" min="0" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Capas de Pintura</label>
                                        <input type="number" id="capas-pintura" value="1" step="1" min="1" max="10" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Tiempo Ensamblaje (min)</label>
                                        <input type="number" id="tiempo-ensamblaje" value="0" step="0.5" min="0" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                </div>

                                <!-- Resina -->
                                <div style="border:1px solid #e8d5c4;border-radius:8px;padding:12px;background:#fffaf7;">
                                    <label style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;cursor:pointer;margin-bottom:10px;">
                                        <input type="checkbox" id="usa-resina" style="width:15px;height:15px;accent-color:var(--color-moss-green);"
                                            onchange="document.getElementById('resina-fields').style.display=this.checked?'grid':'none'">
                                        Usar Resina en este producto
                                    </label>
                                    <div id="resina-fields" style="display:none;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Cantidad (ml)</label>
                                            <input type="number" id="resina-ml" value="0" step="1" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #e8d5c4;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Costo/ml ($)</label>
                                            <input type="number" id="resina-costo-ml" value="0" step="0.001" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #e8d5c4;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Tiempo activo (min) <span style="color:#c0392b;font-size:10px;">cobra labor</span></label>
                                            <input type="number" id="resina-tiempo-activo" value="0" step="1" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #e8d5c4;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Tiempo curado (min) <span style="color:#aaa;font-size:10px;">referencia</span></label>
                                            <input type="number" id="resina-tiempo-curado" value="0" step="5" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #e8d5c4;font-family:var(--font-primary);">
                                        </div>
                                    </div>
                                </div>

                                <!-- Ajuste manual + margen + modo precio -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Ajuste Manual / Extras ($) <span style="color:#aaa;font-size:11px;">opcional</span></label>
                                        <input type="number" id="costo-mano-obra" value="0.00" step="0.10" min="0" placeholder="0.00" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Margen Retail (%)</label>
                                        <input type="number" id="margen-ganancia" value="60" min="0" max="95" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Margen Wholesale (%) <span style="color:#aaa;font-size:11px;">opcional</span></label>
                                        <input type="number" id="margen-wholesale" value="30" min="0" max="80" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
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

                    <!-- Panel derecho: tarifas + desglose -->
                    <div style="display: flex; flex-direction: column; gap: 20px;">

                    <!-- Panel Tarifas Globales -->
                    <div class="card" style="border: 1px solid #c8d9a0; background: #f8faf3;">
                        <h3 class="card-title" style="font-size: 14px; margin-bottom: 10px;">⚙️ Tarifas Globales de Producción</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 500; font-size: 12px; color: #555;">Láser ($/hora)</label>
                                <input type="number" id="tarifa-laser" value="${this.tarifas.tarifa_hora_laser.toFixed(2)}" step="0.50" min="0.01" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #c8d9a0; font-family: var(--font-primary); font-size: 13px;">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 500; font-size: 12px; color: #555;">Labor / Mano de Obra ($/hora)</label>
                                <input type="number" id="tarifa-labor" value="${this.tarifas.tarifa_hora_labor.toFixed(2)}" step="0.50" min="0.01" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #c8d9a0; font-family: var(--font-primary); font-size: 13px;">
                            </div>
                        </div>
                        <button id="btn-guardar-tarifas" class="btn btn-secondary" style="width:100%; font-size: 12px; padding: 6px; color: var(--color-moss-green); border-color: var(--color-moss-green);">
                            <i data-lucide="save" style="width:13px;height:13px;"></i> Guardar Tarifas
                        </button>
                    </div>

                    <!-- Resultados del Costeo Desglosado -->
                    <div class="card" style="background-color: var(--color-moss-green-light); border: 1px solid var(--color-moss-green); display: flex; flex-direction: column; justify-content: space-between; flex: 1;">
                        <div>
                            <h3 class="card-title" style="color: var(--color-moss-green);">Desglose del Costo</h3>
                            <p style="font-size: 13px; color: #8c8270;">Láser a $${this.tarifas.tarifa_hora_laser.toFixed(2)}/hr · Labor a $${this.tarifas.tarifa_hora_labor.toFixed(2)}/hr</p>
                            
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

                    </div><!-- fin panel derecho -->
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

        // Rellenar dimensiones, tiempos y campos del motor de costeo
        if (p.ancho) document.getElementById('prod-ancho').value = p.ancho;
        if (p.alto)  document.getElementById('prod-alto').value  = p.alto;
        if (p.tiempo_corte   !== undefined) document.getElementById('laser-corte').value    = p.tiempo_corte;
        if (p.tiempo_grabado !== undefined) document.getElementById('laser-grabado').value   = p.tiempo_grabado;
        if (p.margen_ganancia !== undefined) document.getElementById('margen-ganancia').value = (p.margen_ganancia * 100).toFixed(0);
        // Nuevos campos motor de costeo
        if (p.tipo_producto) { const sel = document.getElementById('tipo-producto'); if (sel) sel.value = p.tipo_producto; }
        if (p.complejidad)   { const sel = document.getElementById('complejidad-producto'); if (sel) sel.value = p.complejidad; }
        if (p.capas          !== undefined && p.capas !== null) document.getElementById('capas-pintura').value   = p.capas;
        if (p.tiempo_pintura !== undefined && p.tiempo_pintura !== null) document.getElementById('tiempo-pintura').value  = p.tiempo_pintura;
        if (p.tiempo_ensamblaje !== undefined && p.tiempo_ensamblaje !== null) document.getElementById('tiempo-ensamblaje').value = p.tiempo_ensamblaje;
        // Resina
        const usaResinaEl = document.getElementById('usa-resina');
        if (usaResinaEl) {
            usaResinaEl.checked = !!p.usa_resina;
            const resinaFields = document.getElementById('resina-fields');
            if (resinaFields) resinaFields.style.display = p.usa_resina ? 'grid' : 'none';
        }
        if (p.cantidad_resina_ml !== undefined) { const el = document.getElementById('resina-ml'); if (el) el.value = p.cantidad_resina_ml; }
        if (p.costo_resina_por_ml !== undefined) { const el = document.getElementById('resina-costo-ml'); if (el) el.value = p.costo_resina_por_ml; }
        // tiempo_resina_activo_min / curado (con fallback a legacy tiempo_resina_min)
        const activoVal = p.tiempo_resina_activo_min ?? p.tiempo_resina_min ?? 0;
        const curadoVal = p.tiempo_resina_curado_min ?? 0;
        const elActivo = document.getElementById('resina-tiempo-activo'); if (elActivo) elActivo.value = activoVal;
        const elCurado = document.getElementById('resina-tiempo-curado'); if (elCurado) elCurado.value = curadoVal;
        // Ajuste manual: no se guarda como campo separado, se infiere como sobrante si es necesario
        document.getElementById('costo-mano-obra').value = 0;

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

        // Guardar tarifas globales
        const btnGuardarTarifas = document.getElementById('btn-guardar-tarifas');
        if (btnGuardarTarifas) {
            btnGuardarTarifas.addEventListener('click', async () => {
                const laser = parseFloat(document.getElementById('tarifa-laser').value);
                const labor = parseFloat(document.getElementById('tarifa-labor').value);
                if (!laser || !labor || laser <= 0 || labor <= 0) {
                    alert('Las tarifas deben ser mayores a $0');
                    return;
                }
                btnGuardarTarifas.disabled = true;
                btnGuardarTarifas.textContent = 'Guardando...';
                try {
                    await EvergreenAPI.updateConfiguracion({ tarifa_hora_laser: laser, tarifa_hora_labor: labor });
                    CostosComponent.tarifas = { tarifa_hora_laser: laser, tarifa_hora_labor: labor };
                    btnGuardarTarifas.textContent = '✓ Tarifas guardadas';
                    setTimeout(() => {
                        btnGuardarTarifas.disabled = false;
                        btnGuardarTarifas.innerHTML = '<i data-lucide="save" style="width:13px;height:13px;"></i> Guardar Tarifas';
                        lucide.createIcons();
                    }, 2000);
                } catch (err) {
                    alert('Error al guardar tarifas: ' + err.message);
                    btnGuardarTarifas.disabled = false;
                    btnGuardarTarifas.textContent = 'Guardar Tarifas';
                }
            });
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
                const tiempoPinturaCapa = parseFloat(document.getElementById('tiempo-pintura').value) || 0;
                const capas = parseInt(document.getElementById('capas-pintura').value) || 1;
                const tiempoEnsamblaje = parseFloat(document.getElementById('tiempo-ensamblaje').value) || 0;
                const ajusteManual = parseFloat(document.getElementById('costo-mano-obra').value) || 0;
                const complejidad = document.getElementById('complejidad-producto').value || 'simple';
                const tipoProducto = document.getElementById('tipo-producto').value || 'otro';
                const margen = parseFloat(document.getElementById('margen-ganancia').value) || 0;
                // Resina
                const usaResina = document.getElementById('usa-resina')?.checked ? 1 : 0;
                const resinaMl = parseFloat(document.getElementById('resina-ml')?.value) || 0;
                const resinaCostoPorMl = parseFloat(document.getElementById('resina-costo-ml')?.value) || 0;
                const resinaActivo = parseFloat(document.getElementById('resina-tiempo-activo')?.value) || 0;
                const resinaCurado = parseFloat(document.getElementById('resina-tiempo-curado')?.value) || 0;
                const margenWholesale = parseFloat(document.getElementById('margen-wholesale')?.value) || 0;

                // Tarifas desde estado del componente (ya cargadas desde API)
                const tarifaLaser = CostosComponent.tarifas.tarifa_hora_laser;
                const tarifaLabor = CostosComponent.tarifas.tarifa_hora_labor;
                const factorComplejidad = complejidad === 'compleja' ? 1.6 : complejidad === 'media' ? 1.3 : 1.0;

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

                // === Motor de Costeo Inteligente ===
                const costoLaser = (tiempoCorte + tiempoGrabado) / 60 * tarifaLaser;
                const tiempoPinturaTotal = tiempoPinturaCapa * capas;
                const costoPintura = tiempoPinturaTotal / 60 * tarifaLabor * factorComplejidad;
                const costoEnsamblaje = tiempoEnsamblaje / 60 * tarifaLabor;
                // Resina
                const costoResinaMaterial = usaResina ? resinaMl * resinaCostoPorMl : 0;
                const costoResinaLabor = usaResina ? resinaActivo / 60 * tarifaLabor : 0;
                const costoResinaTotal = costoResinaMaterial + costoResinaLabor;
                const costoManoObra = costoPintura + costoEnsamblaje + ajusteManual;

                // Desglose — Láser
                desgloseHTML += `
                    <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">Láser ($${tarifaLaser.toFixed(2)}/hr):</strong>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                            <span>Corte: ${tiempoCorte} min · Grabado: ${tiempoGrabado} min</span>
                            <span>$${costoLaser.toFixed(2)}</span>
                        </div>
                    </div>
                `;

                // Desglose — Pintura
                if (tiempoPinturaTotal > 0) {
                    desgloseHTML += `
                    <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">Pintura ($${tarifaLabor.toFixed(2)}/hr · ×${factorComplejidad}):</strong>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                            <span>${tiempoPinturaCapa} min/capa · ${capas} capa${capas!==1?'s':''} = ${tiempoPinturaTotal.toFixed(1)} min</span>
                            <span>$${costoPintura.toFixed(2)}</span>
                        </div>
                    </div>
                    `;
                }

                // Desglose — Ensamblaje
                if (tiempoEnsamblaje > 0) {
                    desgloseHTML += `
                    <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">Ensamblaje ($${tarifaLabor.toFixed(2)}/hr):</strong>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                            <span>${tiempoEnsamblaje} min</span>
                            <span>$${costoEnsamblaje.toFixed(2)}</span>
                        </div>
                    </div>
                    `;
                }

                // Desglose — Ajuste manual
                if (ajusteManual > 0) {
                    desgloseHTML += `
                    <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">Ajuste Manual / Extras:</strong>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                            <span>Costo especial adicional</span>
                            <span>$${ajusteManual.toFixed(2)}</span>
                        </div>
                    </div>
                    `;
                }

                // Desglose — Resina
                if (usaResina) {
                    desgloseHTML += `
                    <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">Resina:</strong>
                        <div style="font-size: 13px; margin-top: 4px; display:flex;flex-direction:column;gap:3px;">
                            <div style="display:flex;justify-content:space-between;">
                                <span>Material: ${resinaMl} ml × $${resinaCostoPorMl.toFixed(3)}</span>
                                <span>$${costoResinaMaterial.toFixed(2)}</span>
                            </div>
                            ${costoResinaLabor > 0 ? `
                            <div style="display:flex;justify-content:space-between;">
                                <span>Labor activa: ${resinaActivo} min</span>
                                <span>$${costoResinaLabor.toFixed(2)}</span>
                            </div>` : ''}
                            ${resinaCurado > 0 ? `
                            <div style="display:flex;justify-content:space-between;color:#aaa;font-size:12px;">
                                <span>⏱ Curado estimado: ${resinaCurado} min (sin costo de labor)</span>
                                <span>—</span>
                            </div>` : ''}
                        </div>
                    </div>
                    `;
                }

                const costoTotal = costoPlanchaProporcional + costoAccesoriosTotal + costoLaser + costoManoObra + costoResinaTotal;
                const factorRetail = 1 - (margen / 100);
                const precioSugerido = factorRetail > 0 ? (costoTotal / factorRetail) : costoTotal;
                const gananciaRetail = precioSugerido - costoTotal;
                const factorWholesale = 1 - (margenWholesale / 100);
                const precioWholesale = factorWholesale > 0 ? (costoTotal / factorWholesale) : costoTotal;
                const gananciaWholesale = precioWholesale - costoTotal;

                desgloseHTML += `
                    <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--color-moss-green); padding-top: 12px; margin-top: 14px; font-weight: 700; color: var(--color-moss-green); font-size: 15px;">
                        <span>COSTO TOTAL PRODUCCIÓN:</span>
                        <span>$${costoTotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: var(--color-terracotta); margin-top: 6px;">
                        <span>Retail (${margen}% margen):</span>
                        <span>$${precioSugerido.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 500; color: var(--color-success); margin-top: 2px;">
                        <span>Ganancia Retail:</span>
                        <span>$${gananciaRetail.toFixed(2)}</span>
                    </div>
                    ${margenWholesale > 0 ? `
                    <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: #1976d2; margin-top: 8px;border-top:1px dashed #cde;padding-top:8px;">
                        <span>Wholesale (${margenWholesale}% margen):</span>
                        <span>$${precioWholesale.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; color: #64b5f6; margin-top: 2px;">
                        <span>Ganancia Wholesale:</span>
                        <span>$${gananciaWholesale.toFixed(2)}</span>
                    </div>` : ''}
                `;

                this.ultimoCalculo = {
                    tiempo_corte: tiempoCorte,
                    tiempo_grabado: tiempoGrabado,
                    tiempo_pintura: tiempoPinturaCapa,
                    capas: capas,
                    tiempo_ensamblaje: tiempoEnsamblaje,
                    complejidad: complejidad,
                    tipo_producto: tipoProducto,
                    costo_maquina: costoLaser,
                    costo_mano_obra: costoManoObra,
                    ajuste_manual: ajusteManual,
                    costo_total: costoTotal,
                    margen_ganancia: margen / 100,
                    precio_sugerido: precioSugerido,
                    usa_resina: usaResina,
                    cantidad_resina_ml: resinaMl,
                    costo_resina_por_ml: resinaCostoPorMl,
                    tiempo_resina_activo_min: resinaActivo,
                    tiempo_resina_curado_min: resinaCurado,
                    margen_wholesale: margenWholesale,
                    precio_wholesale: margenWholesale > 0 ? precioWholesale : null,
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

        // Remover fondo con rembg
        document.querySelectorAll('.btn-remover-fondo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const prodId = parseInt(btn.getAttribute('data-id'));
                const sku = btn.getAttribute('data-sku');
                const icon = btn.querySelector('i');
                btn.disabled = true;
                if (icon) { icon.setAttribute('data-lucide', 'loader-2'); lucide.createIcons(); }

                try {
                    const res = await EvergreenAPI.removerFondo(prodId);
                    btn.disabled = false;
                    if (icon) { icon.setAttribute('data-lucide', 'image-off'); lucide.createIcons(); }
                    btn.style.color = '#5f7a45';
                    btn.title = 'Fondo removido ✓ — volver a procesar';
                    alert(`✓ Fondo removido para ${sku}.\nEl catálogo B2B usará ahora la versión con fondo transparente.`);
                    this.render('costos-container');
                } catch (err) {
                    btn.disabled = false;
                    if (icon) { icon.setAttribute('data-lucide', 'image-off'); lucide.createIcons(); }
                    alert(`Error al remover fondo de ${sku}: ${err.message}`);
                }
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

        const _esc = (s) => (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const defSku      = editingProd ? _esc(editingProd.sku) : '';
        const defNombre   = editingProd ? _esc(editingProd.nombre) : '';
        const defDesc     = editingProd ? _esc(editingProd.shopify_descripcion || '') : '';
        const defPrecio   = editingProd ? editingProd.precio_final.toFixed(2) : sugerido.toFixed(2);
        const defPersonal = editingProd ? editingProd.personalizado : 0;
        const defShTitulo = editingProd ? _esc(editingProd.shopify_titulo || '') : '';
        const defShTags   = editingProd ? _esc(editingProd.shopify_tags || '') : '';
        const defB2bPrecio   = editingProd && editingProd.b2b_precio ? editingProd.b2b_precio.toFixed(2) : '';
        const defWholesale12 = editingProd && editingProd.precio_wholesale_12 ? editingProd.precio_wholesale_12.toFixed(2) : '';
        const defWholesale24 = editingProd && editingProd.precio_wholesale_24 ? editingProd.precio_wholesale_24.toFixed(2) : '';
        const defWholesale50 = editingProd && editingProd.precio_wholesale_50 ? editingProd.precio_wholesale_50.toFixed(2) : '';

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
                        <label style="font-weight: 500; font-size: 13px;">${isEditing ? 'Reemplazar Foto Principal (Opcional)' : 'Foto del Producto (Opcional)'}</label>
                        <input type="file" id="prod-foto" accept="image/*" style="font-family: var(--font-primary); font-size: 12px; padding: 6px 0; border: none; background: transparent; cursor: pointer;">
                    </div>

                    ${isEditing ? `
                    <div style="background:#f7f3ee; border-radius:10px; padding:14px; border:1px solid #e8e0d5;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <h4 style="font-size:13px; font-weight:600; color:#5f7830; margin:0; display:flex; align-items:center; gap:6px;">
                                <i data-lucide="images" style="width:14px;height:14px;"></i> Galería de Fotos
                            </h4>
                            <span style="font-size:11px; color:#8c8270;">Se muestran en el catálogo en orden de galería</span>
                        </div>
                        <div id="foto-galeria-grid" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; min-height:40px;">
                            <div style="font-size:12px; color:#aaa; font-style:italic; padding:8px 0;">Cargando fotos...</div>
                        </div>
                        <div style="border-top:1px solid #e8e0d5; padding-top:12px;">
                            <div style="font-size:12px; font-weight:600; color:#555; margin-bottom:8px;">+ Agregar foto</div>
                            <div style="display:grid; grid-template-columns:1fr 1.5fr auto; gap:8px; align-items:end;">
                                <div style="display:flex; flex-direction:column; gap:3px;">
                                    <label style="font-size:11px; font-weight:500; color:#666;">Tipo</label>
                                    <select id="nueva-foto-tipo" style="padding:6px 8px; border-radius:6px; border:1px solid #ddd; font-size:12px; font-family:var(--font-primary); background:white;">
                                        <option value="frontal">Frontal</option>
                                        <option value="lateral">Lateral</option>
                                        <option value="detalle">Detalle</option>
                                        <option value="empaque">Empaque</option>
                                        <option value="referencia" selected>Referencia</option>
                                    </select>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:3px;">
                                    <label style="font-size:11px; font-weight:500; color:#666;">Archivo</label>
                                    <input type="file" id="nueva-foto-file" accept="image/*" style="font-size:11px; padding:4px 0; border:none; background:transparent; cursor:pointer;">
                                </div>
                                <button type="button" id="btn-subir-nueva-foto" style="padding:6px 12px; background:#5f7830; color:white; border:none; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; height:32px;">
                                    Subir
                                </button>
                            </div>
                            <div id="nueva-foto-status" style="font-size:11px; margin-top:6px; display:none;"></div>
                        </div>
                    </div>` : ''}

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

                    <!-- Asignación Opcional a Cliente B2B + Precios Wholesale -->
                    <div style="background-color: var(--color-gray-light); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-gray-border); margin-top: 2px;">
                        <h4 style="font-size: 13px; font-weight: 600; color: var(--color-moss-green); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="users" style="width: 14px; height: 14px;"></i> Precios B2B / Wholesale (Opcional)
                        </h4>
                        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; font-size: 12px; margin-bottom:10px;">
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Asignar a Cliente (precio especial)</label>
                                <select id="prod-b2b-cliente-id" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px; cursor:pointer; background-color: var(--color-white);">
                                    ${b2bOptions}
                                </select>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-weight: 500;">Precio Especial ($) <span style="color:#aaa;font-weight:400;">override</span></label>
                                <input type="number" step="0.01" id="prod-b2b-precio" placeholder="0.00" value="${defB2bPrecio}" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 12px;">
                            </div>
                        </div>
                        <div style="border-top:1px solid #e0d8cc;padding-top:10px;">
                            <div style="font-size:11px;font-weight:600;color:#6a7d52;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.4px;">Precios por Nivel (aplican automáticamente)</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 12px;">
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <label style="font-weight: 500; color:#2d6a9f;">Precio B2B 12+ ($)</label>
                                    <input type="number" step="0.01" id="prod-wholesale-12" placeholder="0.00" value="${defWholesale12}"
                                        style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid #b8d4f0; font-size: 12px; background:#f5f9ff;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <label style="font-weight: 500; color:#1a5276;">Precio B2B 24+ ($)</label>
                                    <input type="number" step="0.01" id="prod-wholesale-24" placeholder="0.00" value="${defWholesale24}"
                                        style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid #a9c5e8; font-size: 12px; background:#eef5fb;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <label style="font-weight: 500; color:#154360;">Precio Distribuidor 50+ ($)</label>
                                    <input type="number" step="0.01" id="prod-wholesale-50" placeholder="0.00" value="${defWholesale50}"
                                        style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid #85b4d4; font-size: 12px; background:#e8f2f9;">
                                </div>
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

        // Galería de fotos (solo en modo edición)
        if (isEditing && this.editingProductoId) {
            this.renderFotoGaleria(this.editingProductoId);

            const btnSubir = document.getElementById('btn-subir-nueva-foto');
            if (btnSubir) {
                btnSubir.addEventListener('click', async () => {
                    const fileInput  = document.getElementById('nueva-foto-file');
                    const tipoSelect = document.getElementById('nueva-foto-tipo');
                    const statusEl   = document.getElementById('nueva-foto-status');
                    if (!fileInput.files || fileInput.files.length === 0) {
                        alert('Selecciona un archivo primero.');
                        return;
                    }
                    btnSubir.disabled = true;
                    btnSubir.textContent = '...';
                    statusEl.style.display = 'none';
                    try {
                        await EvergreenAPI.subirFoto(fileInput.files[0], null, this.editingProductoId, tipoSelect.value);
                        fileInput.value = '';
                        statusEl.textContent = '✓ Foto subida correctamente.';
                        statusEl.style.color = '#5f7830';
                        statusEl.style.display = 'block';
                        await this.renderFotoGaleria(this.editingProductoId);
                    } catch (err) {
                        statusEl.textContent = '✗ Error: ' + err.message;
                        statusEl.style.color = '#c0634c';
                        statusEl.style.display = 'block';
                    } finally {
                        btnSubir.disabled = false;
                        btnSubir.textContent = 'Subir';
                    }
                });
            }
        }

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

            const b2bClienteId   = document.getElementById('prod-b2b-cliente-id').value;
            const b2bPrecio      = parseFloat(document.getElementById('prod-b2b-precio').value);
            const wholesale12Val = parseFloat(document.getElementById('prod-wholesale-12').value) || null;
            const wholesale24Val = parseFloat(document.getElementById('prod-wholesale-24').value) || null;
            const wholesale50Val = parseFloat(document.getElementById('prod-wholesale-50').value) || null;

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
                        componentes: componentesBackend,
                        tipo_producto: this.ultimoCalculo.tipo_producto,
                        capas: this.ultimoCalculo.capas,
                        complejidad: this.ultimoCalculo.complejidad,
                        tiempo_pintura: this.ultimoCalculo.tiempo_pintura,
                        tiempo_ensamblaje: this.ultimoCalculo.tiempo_ensamblaje,
                        usa_resina: this.ultimoCalculo.usa_resina,
                        cantidad_resina_ml: this.ultimoCalculo.cantidad_resina_ml,
                        costo_resina_por_ml: this.ultimoCalculo.costo_resina_por_ml,
                        tiempo_resina_activo_min: this.ultimoCalculo.tiempo_resina_activo_min,
                        tiempo_resina_curado_min: this.ultimoCalculo.tiempo_resina_curado_min,
                        precio_wholesale_12: wholesale12Val,
                        precio_wholesale_24: wholesale24Val,
                        precio_wholesale_50: wholesale50Val,
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
                    componentes: componentesBackend,
                    tipo_producto: this.ultimoCalculo.tipo_producto,
                    capas: this.ultimoCalculo.capas,
                    complejidad: this.ultimoCalculo.complejidad,
                    tiempo_pintura: this.ultimoCalculo.tiempo_pintura,
                    tiempo_ensamblaje: this.ultimoCalculo.tiempo_ensamblaje,
                    usa_resina: this.ultimoCalculo.usa_resina,
                    cantidad_resina_ml: this.ultimoCalculo.cantidad_resina_ml,
                    costo_resina_por_ml: this.ultimoCalculo.costo_resina_por_ml,
                    tiempo_resina_activo_min: this.ultimoCalculo.tiempo_resina_activo_min,
                    tiempo_resina_curado_min: this.ultimoCalculo.tiempo_resina_curado_min,
                    precio_wholesale_12: wholesale12Val,
                    precio_wholesale_24: wholesale24Val,
                    precio_wholesale_50: wholesale50Val,
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

    async renderFotoGaleria(productoId) {
        const grid = document.getElementById('foto-galeria-grid');
        if (!grid) return;

        const TIPO_LABELS = {
            transparente: 'Transparente', frontal: 'Frontal', lateral: 'Lateral',
            detalle: 'Detalle', empaque: 'Empaque', referencia: 'Referencia',
            antes: 'Antes', final: 'Final', material: 'Material'
        };
        const TIPO_COLORS = {
            transparente: '#6c8ebf', frontal: '#5f7830', lateral: '#8a6a3c',
            detalle: '#c0634c', empaque: '#8c8270', referencia: '#aaa'
        };

        try {
            const res = await EvergreenAPI.getFotosProducto(productoId);
            const fotos = res.data || [];

            if (fotos.length === 0) {
                grid.innerHTML = '<div style="font-size:12px; color:#aaa; font-style:italic; padding:8px 0;">Sin fotos cargadas aún.</div>';
                return;
            }

            grid.innerHTML = fotos.map(f => {
                const ruta = f.ruta_publica;
                const label = TIPO_LABELS[f.tipo_foto] || f.tipo_foto;
                const color = TIPO_COLORS[f.tipo_foto] || '#aaa';
                const imgSrc = ruta ? `${window.location.origin}${ruta}` : '';
                return `<div style="position:relative; width:80px; text-align:center;" data-foto-id="${f.id}">
                    <div style="width:80px; height:80px; border-radius:8px; overflow:hidden; background:#f0ece4; border:1.5px solid #e0d9ce; display:flex; align-items:center; justify-content:center;">
                        ${imgSrc
                            ? `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                               <div style="display:none; width:100%; height:100%; align-items:center; justify-content:center; color:#ccc; font-size:11px;">Sin imagen</div>`
                            : `<div style="color:#ccc; font-size:11px;">Sin ruta</div>`}
                    </div>
                    <div style="font-size:10px; font-weight:700; color:${color}; margin-top:4px; text-transform:uppercase; letter-spacing:0.4px;">${label}</div>
                    <button class="btn-del-foto" data-id="${f.id}" title="Eliminar foto" style="position:absolute; top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; background:#e74c3c; color:white; border:none; cursor:pointer; font-size:12px; line-height:20px; padding:0; text-align:center; box-shadow:0 1px 4px rgba(0,0,0,0.2);">✕</button>
                </div>`;
            }).join('');

            grid.querySelectorAll('.btn-del-foto').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const fotoId = parseInt(btn.dataset.id, 10);
                    if (!confirm('¿Eliminar esta foto? Se borrará del disco y del catálogo.')) return;
                    try {
                        await EvergreenAPI.deleteFoto(fotoId);
                        await this.renderFotoGaleria(productoId);
                    } catch (err) {
                        alert('Error al eliminar: ' + err.message);
                    }
                });
            });
        } catch (err) {
            grid.innerHTML = `<div style="font-size:12px; color:#c0634c;">Error al cargar fotos: ${err.message}</div>`;
        }
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
                        <input type="text" id="edit-prod-descripcion" value="${(p.shopify_descripcion || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
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
