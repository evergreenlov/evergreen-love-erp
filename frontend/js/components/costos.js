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
                        <option value="${mat.costo_hoja_unidad_con_ivu ?? mat.costo_hoja_unidad}" data-id="${mat.id}" data-w="${mat.tamano_ancho}" data-h="${mat.tamano_alto}">
                            ${mat.nombre} (${mat.espesor} in) - $${(mat.costo_hoja_unidad_con_ivu ?? mat.costo_hoja_unidad).toFixed(2)} c/IVU [${mat.tamano_ancho}"x${mat.tamano_alto}"]
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
                                <input type="checkbox" class="extra-checkbox" data-id="${ext.id}" data-nombre="${ext.nombre}" data-costo="${ext.costo_hoja_unidad_con_ivu ?? ext.costo_hoja_unidad}" data-tipo="${ext.tipo}">
                                ${ext.nombre} ($${(ext.costo_hoja_unidad_con_ivu ?? ext.costo_hoja_unidad).toFixed(2)}/ud)
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
                    // Detectar si el costo de algún material cambió desde el último cálculo
                    let costoMaterialVivo = 0;
                    let costoMaterialSnapshot = 0;
                    (prod.componentes || []).forEach(c => {
                        const vivoConIvu = c.costo_hoja_unidad_con_ivu ?? (c.costo_hoja_unidad * (1 + (c.ivu ?? 11.5) / 100));
                        costoMaterialVivo     += (vivoConIvu ?? 0) * (c.cantidad_usada ?? 1);
                        costoMaterialSnapshot += (c.costo_calculado ?? 0);
                    });
                    const diffMaterial = Math.abs(costoMaterialVivo - costoMaterialSnapshot);
                    const costoStale = diffMaterial > 0.01;
                    const staleIcon = costoStale
                        ? `<span title="El precio de uno o más materiales cambió. Abre y recalcula para actualizar." style="color:#e67e22;font-size:13px;margin-left:4px;cursor:help;">⚠️</span>`
                        : '';

                    productRows += `
                        <tr>
                            <td><strong>${prod.sku}</strong></td>
                            <td>${prod.nombre}</td>
                            <td>$${prod.costo_total.toFixed(2)}${staleIcon}</td>
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
                        
                        <!-- Panel de Estimación por IA (DESACTIVADO TEMPORALMENTE) -->
                        <div class="card" style="background: #f5f5f5; border: 1px solid #ddd; padding: 18px; opacity: 0.7;">
                            <div style="display: flex; align-items: center; gap: 8px; color: #8c8270;">
                                <i data-lucide="sparkles" style="width: 16px; height: 16px;"></i>
                                <strong style="font-size: 14px;">Cotizador Automático por Foto (IA)</strong>
                            </div>
                            <p style="font-size: 13px; color: #8c8270; margin-top: 8px; margin-bottom: 0;">
                                Estimación con IA temporalmente desactivada. Use la calculadora manual.
                            </p>
                        </div>

                        <!-- Bloque 1: Producto e Inventario Base -->
                        <div class="card">
                            <h3 class="card-title">Configuración de Pieza y Láser</h3>
                            <p style="color: #6c757d; font-size: 13.5px; margin-bottom: 16px;">Introduce las dimensiones en pulgadas para la base y los tiempos estimados de corte/grabado.</p>

                            <form id="form-calculadora" style="display: flex; flex-direction: column; gap: 14px;">

                                <!-- Tipo de Producción (Láser / Sublimación) -->
                                <div style="display: flex; gap: 0; border: 2px solid var(--color-moss-green); border-radius: var(--radius-sm); overflow: hidden; font-size: 13px; font-weight: 600;">
                                    <label id="lbl-laser" style="flex:1; text-align:center; padding:10px; cursor:pointer; background:var(--color-moss-green); color:#fff; display:flex; align-items:center; justify-content:center; gap:6px;">
                                        <input type="radio" name="tipo-produccion" id="tipo-produccion-laser" value="laser" checked style="display:none;">
                                        🔵 Láser
                                    </label>
                                    <label id="lbl-sublimacion" style="flex:1; text-align:center; padding:10px; cursor:pointer; background:#fff; color:#666; display:flex; align-items:center; justify-content:center; gap:6px; border-left:2px solid var(--color-moss-green);">
                                        <input type="radio" name="tipo-produccion" id="tipo-produccion-sublimacion" value="sublimacion" style="display:none;">
                                        🔴 Sublimación
                                    </label>
                                </div>

                                <!-- Toggle Simple / Avanzado -->
                                <div style="display:flex; align-items:center; justify-content:space-between; background:var(--color-gray-light); border:1px solid var(--color-gray-border); border-radius:var(--radius-sm); padding:8px 14px;">
                                    <span style="font-size:12.5px; font-weight:600; color:var(--color-olive-brown);">Formulario</span>
                                    <div style="display:flex; gap:0; border:1px solid var(--color-gray-border); border-radius:20px; overflow:hidden; font-size:12px; font-weight:600;">
                                        <label id="lbl-modo-simple" style="padding:5px 14px; cursor:pointer; background:var(--color-moss-green); color:#fff; display:flex; align-items:center; gap:5px; transition:background 0.15s;">
                                            <input type="radio" name="modo-formulario" id="modo-formulario-simple" value="simple" checked style="display:none;">
                                            ⚡ Simple
                                        </label>
                                        <label id="lbl-modo-avanzado" style="padding:5px 14px; cursor:pointer; background:#fff; color:#888; display:flex; align-items:center; gap:5px; transition:background 0.15s;">
                                            <input type="radio" name="modo-formulario" id="modo-formulario-avanzado" value="avanzado" style="display:none;">
                                            🔧 Avanzado
                                        </label>
                                    </div>
                                </div>

                                <!-- Modo de producto + Tipo + Complejidad -->
                                <div id="grid-modo-tipo-complejidad" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Modo de Producto</label>
                                        <select id="modo-producto" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);"
                                            onchange="document.getElementById('seccion-3d').style.display=this.value!=='plano'?'block':'none'">
                                            <option value="plano">Plano</option>
                                            <option value="multicapa">Multicapa</option>
                                            <option value="tridimensional">Tridimensional</option>
                                        </select>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Tipo de Producto</label>
                                        <select id="tipo-producto" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                            <option value="llavero">Llavero</option>
                                            <option value="garita">Garita</option>
                                            <option value="shadow_box">Shadow Box</option>
                                            <option value="ornamento">Ornamento</option>
                                            <option value="portada_libreta">Portada de Libreta</option>
                                            <option value="lapicero">Lapicero</option>
                                            <option value="barco">Barco / Miniatura</option>
                                            <option value="base_soporte">Base / Soporte</option>
                                            <option value="canva">Canvas</option>
                                            <option value="macrame">Macramé</option>
                                            <option value="madera">Madera</option>
                                            <option value="personalizado">Personalizado</option>
                                            <option value="otro">Otro</option>
                                        </select>
                                    </div>
                                    <div id="campo-avanzado-complejidad" style="display:none; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;" title="Multiplica el costo de labor: Simple ×1.0 · Media ×1.3 · Compleja ×1.6">Complejidad <span style="color:#aaa;font-size:11px;">(afecta labor)</span></label>
                                        <select id="complejidad-producto" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                            <option value="simple">Simple (×1.0)</option>
                                            <option value="media">Media (×1.3)</option>
                                            <option value="compleja">Compleja (×1.6)</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Sección 3D / Multicapa (oculta por defecto) -->
                                <div id="seccion-3d" style="display:none; border:1px solid #b8d4a8; border-radius:10px; padding:14px; background:#f4faf0;">
                                    <div style="font-weight:600; font-size:13px; color:#3d7a30; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                                        <i data-lucide="layers" style="width:15px;height:15px;"></i> Configuración Multicapa / 3D
                                    </div>
                                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:10px;">
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Nº de Piezas / Capas</label>
                                            <input type="number" id="num-piezas" value="1" step="1" min="1" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #b8d4a8;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Tiempo Pegado (min) <span style="color:#c0392b;font-size:10px;">cobra labor</span></label>
                                            <input type="number" id="tiempo-pegado" value="0" step="0.5" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #b8d4a8;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Tiempo Secado (min) <span style="color:#aaa;font-size:10px;">referencia</span></label>
                                            <input type="number" id="tiempo-secado-ref" value="0" step="5" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #b8d4a8;font-family:var(--font-primary);">
                                        </div>
                                    </div>
                                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px;">
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Costo Pegamento ($)</label>
                                            <input type="number" id="costo-pegamento" value="0" step="0.01" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #b8d4a8;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Herrajes Extras ($)</label>
                                            <input type="number" id="costo-herrajes-extras" value="0" step="0.01" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #b8d4a8;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Costo Empaque ($)</label>
                                            <input type="number" id="costo-empaque" value="0" step="0.01" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #b8d4a8;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">% Merma adicional</label>
                                            <input type="number" id="porcentaje-merma" value="0" step="1" min="0" max="50" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #b8d4a8;font-family:var(--font-primary);">
                                        </div>
                                    </div>
                                    <div style="margin-top:8px;font-size:11px;color:#7a9a70;">
                                        ⏱ El tiempo de secado es solo referencial — no se cobra como labor. La merma adicional se aplica sobre el material base (ya incluye 15% base).
                                    </div>
                                </div>

                                <!-- SECCIÓN LÁSER (oculta cuando tipo-produccion=sublimacion) -->
                                <div id="seccion-laser-campos">

                                <!-- Material base -->
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <label style="font-weight: 500; font-size: 13px;">Madera o Acrílico Base (Plancha)</label>
                                    <select id="costo-material-select" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                        ${materialBaseOptions}
                                    </select>
                                </div>

                                <!-- Dimensiones -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top:14px;">
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Ancho de la Pieza (in)</label>
                                        <input type="number" id="prod-ancho" value="2.0" step="0.1" min="0.1" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <label style="font-weight: 500; font-size: 13px;">Alto de la Pieza (in)</label>
                                        <input type="number" id="prod-alto" value="2.0" step="0.1" min="0.1" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                    </div>
                                </div>

                                <!-- Tiempo láser unificado -->
                                <div style="display: flex; flex-direction: column; gap: 4px; margin-top:14px;">
                                    <label style="font-weight: 500; font-size: 13px;">Tiempo de Láser (min) <span style="color:#aaa;font-size:11px;">corte + grabado total</span></label>
                                    <input type="number" id="laser-tiempo" value="2.5" step="0.1" min="0" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                </div>

                                </div><!-- fin seccion-laser-campos -->

                                <!-- SECCIÓN SUBLIMACIÓN (visible cuando tipo-produccion=sublimacion) -->
                                <div id="seccion-sublimacion-campos" style="display:none; border:1px solid #f4a0a0; border-radius:10px; padding:14px; background:#fff5f5;">
                                    <div style="font-weight:600; font-size:13px; color:#c0392b; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                                        🔴 Campos de Sublimación
                                    </div>
                                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Costo del Blank ($)</label>
                                            <input type="number" id="subli-costo-blank" value="0" step="0.01" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #f4a0a0;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Hojas A4 de Impresión</label>
                                            <input type="number" id="subli-hojas" value="1" step="0.5" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #f4a0a0;font-family:var(--font-primary);">
                                        </div>
                                        <div style="display:flex;flex-direction:column;gap:4px;">
                                            <label style="font-weight:500;font-size:12px;">Tiempo Plancha (min)</label>
                                            <input type="number" id="subli-tiempo-plancha" value="5" step="0.5" min="0" style="padding:9px;border-radius:var(--radius-sm);border:1px solid #f4a0a0;font-family:var(--font-primary);">
                                        </div>
                                    </div>
                                    <div style="margin-top:8px;font-size:11px;color:#c0392b;">
                                        Tarifas de impresión y plancha se configuran en el panel de Tarifas →
                                    </div>
                                </div>

                                <!-- Tiempos de labor (ocultos en modo Simple) -->
                                <div id="campos-avanzados-labor" style="display: none; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
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

                                <!-- Resina (oculta en modo Simple) -->
                                <div id="campo-avanzado-resina" style="display:none; border:1px solid #e8d5c4;border-radius:8px;padding:12px;background:#fffaf7;">
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

                    <!-- Panel Tarifas Globales (acordeón) -->
                    <div class="card" style="border: 1px solid #c8d9a0; background: #f8faf3; padding: 0; overflow: hidden;">
                        <button id="btn-toggle-tarifas" type="button" style="width:100%; background:none; border:none; cursor:pointer; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; font-family:var(--font-primary); font-size:13px; font-weight:600; color:var(--color-olive-brown);">
                            <span>⚙️ Ajustar Tarifas Globales</span>
                            <span id="icono-tarifas" style="font-size:11px; color:#999;">▼</span>
                        </button>
                        <div id="panel-tarifas-cuerpo" style="display:none; padding:0 16px 14px 16px; border-top:1px solid #c8d9a0;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top:12px; margin-bottom: 10px;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 500; font-size: 12px; color: #555;">Láser ($/hora)</label>
                                <input type="number" id="tarifa-laser" value="${this.tarifas.tarifa_hora_laser.toFixed(2)}" step="0.50" min="0.01" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #c8d9a0; font-family: var(--font-primary); font-size: 13px;">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 500; font-size: 12px; color: #555;">Labor / Mano de Obra ($/hora)</label>
                                <input type="number" id="tarifa-labor" value="${this.tarifas.tarifa_hora_labor.toFixed(2)}" step="0.50" min="0.01" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #c8d9a0; font-family: var(--font-primary); font-size: 13px;">
                            </div>
                        </div>
                        <div style="border-top:1px dashed #c8d9a0; padding-top:8px; margin-bottom:10px;">
                            <div style="font-size:11px;font-weight:600;color:#c0392b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">🔴 Tarifas Sublimación</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <label style="font-weight: 500; font-size: 11px; color: #555;">Impresión A4 ($)</label>
                                    <input type="number" id="tarifa-subli-impresion" value="${(this.tarifas.sublimacion_costo_impresion_a4 || 0.75).toFixed(2)}" step="0.05" min="0" style="padding: 7px; border-radius: var(--radius-sm); border: 1px solid #f4a0a0; font-family: var(--font-primary); font-size: 12px;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <label style="font-weight: 500; font-size: 11px; color: #555;">Plancha ($/min)</label>
                                    <input type="number" id="tarifa-subli-plancha" value="${(this.tarifas.sublimacion_costo_minuto_plancha || 0.10).toFixed(2)}" step="0.01" min="0" style="padding: 7px; border-radius: var(--radius-sm); border: 1px solid #f4a0a0; font-family: var(--font-primary); font-size: 12px;">
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <label style="font-weight: 500; font-size: 11px; color: #555;">Mano Obra ($/min)</label>
                                    <input type="number" id="tarifa-subli-mano-obra" value="${(this.tarifas.sublimacion_mano_obra_minuto || 0.25).toFixed(2)}" step="0.01" min="0" style="padding: 7px; border-radius: var(--radius-sm); border: 1px solid #f4a0a0; font-family: var(--font-primary); font-size: 12px;">
                                </div>
                            </div>
                        </div>
                        <button id="btn-guardar-tarifas" class="btn btn-secondary" style="width:100%; font-size: 12px; padding: 6px; color: var(--color-moss-green); border-color: var(--color-moss-green);">
                            <i data-lucide="save" style="width:13px;height:13px;"></i> Guardar Tarifas
                        </button>
                        </div><!-- fin panel-tarifas-cuerpo -->
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

                <!-- Panel Campos de Personalización (se inyecta cuando hay producto seleccionado) -->
                <div id="campos-panel-wrap" style="margin-top:24px; display:none;"></div>

                <!-- Panel Galería del Producto -->
                <div id="galeria-panel-wrap" style="margin-top:24px; display:none;"></div>

                <!-- Modales Dinámicos -->
                <div id="product-save-modal" class="modal-overlay" style="display: none;"></div>
                <div id="gemini-config-modal" class="modal-overlay" style="display: none;"></div>
            `;

            lucide.createIcons();
            this.setupListeners();

            // Si hay un producto en modo edición, aplicar sus valores a la calculadora
            if (this.editingProductoId) {
                const p = this.productos.find(prod => prod.id === this.editingProductoId);
                if (p) {
                    this._aplicarModoEdicion(p);
                    // Mostrar panel de campos si el producto es personalizable
                    if (p.personalizado) this.renderCamposPanel(p.id);
                    this.renderGaleriaPanel(p.id);
                }
            }

            // Mostrar/ocultar panel de campos cuando cambia tipo-producto
            const tipoSelect = document.getElementById('tipo-producto');
            if (tipoSelect) {
                tipoSelect.addEventListener('change', () => {
                    const wrap = document.getElementById('campos-panel-wrap');
                    if (!wrap) return;
                    if (tipoSelect.value === 'personalizado' && this.editingProductoId) {
                        this.renderCamposPanel(this.editingProductoId);
                    } else if (tipoSelect.value === 'personalizado' && !this.editingProductoId) {
                        wrap.style.display = 'block';
                        wrap.innerHTML = `<div class="card" style="padding:20px;border:2px solid #c5d9a8;">
                            <h3 style="margin:0 0 8px;font-size:15px;color:var(--color-moss-green);display:flex;align-items:center;gap:8px;">
                                <i data-lucide="sliders" style="width:16px;height:16px;"></i> Campos de Personalización para el Cliente
                            </h3>
                            <p style="font-size:13px;color:#8c8270;margin:0;">
                                Para configurar los campos de personalización, primero <strong>guarda el producto en el catálogo</strong> (botón azul de abajo).<br>
                                Luego regresa a editarlo — el panel de campos aparecerá aquí automáticamente.
                            </p>
                        </div>`;
                        lucide.createIcons();
                    } else {
                        wrap.style.display = 'none';
                    }
                });
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
        if (p.tiempo_corte !== undefined || p.tiempo_grabado !== undefined) {
            const tc = parseFloat(p.tiempo_corte)  || 0;
            const tg = parseFloat(p.tiempo_grabado) || 0;
            document.getElementById('laser-tiempo').value = (tc + tg).toFixed(1);
        }
        if (p.margen_ganancia !== undefined) document.getElementById('margen-ganancia').value = (p.margen_ganancia * 100).toFixed(0);
        // Nuevos campos motor de costeo
        if (p.tipo_producto) { const sel = document.getElementById('tipo-producto'); if (sel) sel.value = p.tipo_producto; }
        if (p.complejidad)   { const sel = document.getElementById('complejidad-producto'); if (sel) sel.value = p.complejidad; }
        if (p.capas          !== undefined && p.capas !== null) document.getElementById('capas-pintura').value   = p.capas;
        if (p.tiempo_pintura !== undefined && p.tiempo_pintura !== null) document.getElementById('tiempo-pintura').value  = p.tiempo_pintura;
        if (p.tiempo_ensamblaje !== undefined && p.tiempo_ensamblaje !== null) document.getElementById('tiempo-ensamblaje').value = p.tiempo_ensamblaje;
        // Modo 3D / Multicapa
        const modoEl = document.getElementById('modo-producto');
        if (modoEl && p.modo_producto) {
            modoEl.value = p.modo_producto;
            const seccion3d = document.getElementById('seccion-3d');
            if (seccion3d) seccion3d.style.display = p.modo_producto !== 'plano' ? 'block' : 'none';
        }
        const _set3d = (id, val) => { if (val !== undefined && val !== null) { const el = document.getElementById(id); if (el) el.value = val; } };
        _set3d('num-piezas',          p.num_piezas);
        _set3d('tiempo-pegado',        p.tiempo_pegado);
        _set3d('tiempo-secado-ref',    p.tiempo_secado_ref);
        _set3d('costo-pegamento',      p.costo_pegamento);
        _set3d('costo-herrajes-extras', p.costo_herrajes_extras);
        _set3d('costo-empaque',        p.costo_empaque);
        _set3d('porcentaje-merma',     p.porcentaje_merma);
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

        // Restaurar tipo de producción y campos de sublimación
        const tipoProd = p.tipo_produccion || 'laser';
        const radioLaser = document.getElementById('tipo-produccion-laser');
        const radioSubli  = document.getElementById('tipo-produccion-sublimacion');
        if (tipoProd === 'sublimacion' && radioSubli) {
            radioSubli.checked = true;
            document.getElementById('seccion-laser-campos').style.display = 'none';
            document.getElementById('seccion-sublimacion-campos').style.display = 'block';
            const lblLaser = document.getElementById('lbl-laser');
            const lblSub   = document.getElementById('lbl-sublimacion');
            if (lblLaser) { lblLaser.style.background = '#fff'; lblLaser.style.color = '#666'; }
            if (lblSub)   { lblSub.style.background = '#c0392b'; lblSub.style.color = '#fff'; }
            const _setSubli = (id, val) => { if (val !== undefined && val !== null) { const el = document.getElementById(id); if (el) el.value = val; } };
            _setSubli('subli-costo-blank',    p.sublimacion_costo_blank);
            _setSubli('subli-hojas',          p.sublimacion_hojas_impresion);
            _setSubli('subli-tiempo-plancha', p.sublimacion_tiempo_plancha);
        } else if (radioLaser) {
            radioLaser.checked = true;
        }

        // Activar botón y lanzar cálculo automáticamente
        const btnCalcular = document.getElementById('btn-calcular-costo');
        const btnSave = document.getElementById('btn-save-as-product');
        if (btnCalcular) btnCalcular.click();
        if (btnSave) btnSave.removeAttribute('disabled');
    },

    _aplicarModoFormulario(modo) {
        const esSimple = modo === 'simple';

        // Toggle visual del switch
        const lblSimple   = document.getElementById('lbl-modo-simple');
        const lblAvanzado = document.getElementById('lbl-modo-avanzado');
        if (lblSimple)   { lblSimple.style.background   = esSimple ? 'var(--color-moss-green)' : '#fff'; lblSimple.style.color   = esSimple ? '#fff' : '#888'; }
        if (lblAvanzado) { lblAvanzado.style.background = esSimple ? '#fff' : 'var(--color-moss-green)'; lblAvanzado.style.color = esSimple ? '#888' : '#fff'; }

        // Mostrar / ocultar campos avanzados
        const grid      = document.getElementById('grid-modo-tipo-complejidad');
        const complejEl = document.getElementById('campo-avanzado-complejidad');
        const laborEl   = document.getElementById('campos-avanzados-labor');
        const resinaEl  = document.getElementById('campo-avanzado-resina');

        if (grid)      grid.style.gridTemplateColumns = esSimple ? '1fr 1fr' : '1fr 1fr 1fr';
        if (complejEl) complejEl.style.display        = esSimple ? 'none' : 'flex';
        if (laborEl)   laborEl.style.display          = esSimple ? 'none' : 'grid';
        if (resinaEl)  resinaEl.style.display         = esSimple ? 'none' : 'block';

        // En modo Simple: forzar valores por defecto en campos ocultos
        if (esSimple) {
            const compSel = document.getElementById('complejidad-producto');
            if (compSel) compSel.value = 'simple';
            const tPintura = document.getElementById('tiempo-pintura');
            if (tPintura) tPintura.value = '0';
            const capas = document.getElementById('capas-pintura');
            if (capas) capas.value = '1';
            const tEnsam = document.getElementById('tiempo-ensamblaje');
            if (tEnsam) tEnsam.value = '0';
            const resina = document.getElementById('usa-resina');
            if (resina && resina.checked) {
                resina.checked = false;
                const resinaFields = document.getElementById('resina-fields');
                if (resinaFields) resinaFields.style.display = 'none';
            }
        }
    },

    setupListeners() {
        const checkboxes = document.querySelectorAll('.extra-checkbox');
        const btnCalcular = document.getElementById('btn-calcular-costo');
        const btnSaveProduct = document.getElementById('btn-save-as-product');

        // Toggle Simple / Avanzado
        document.querySelectorAll('input[name="modo-formulario"]').forEach(radio => {
            radio.addEventListener('change', (e) => this._aplicarModoFormulario(e.target.value));
        });
        // Iniciar en Simple
        this._aplicarModoFormulario('simple');
        // IA desactivada temporalmente — los elementos ya no se renderizan en el HTML

        if (btnSaveProduct) {
            btnSaveProduct.addEventListener('click', () => this.openSaveProductModal());
        }

        // Acordeón Tarifas Globales
        const btnToggleTarifas = document.getElementById('btn-toggle-tarifas');
        if (btnToggleTarifas) {
            btnToggleTarifas.addEventListener('click', () => {
                const cuerpo = document.getElementById('panel-tarifas-cuerpo');
                const icono  = document.getElementById('icono-tarifas');
                const abierto = cuerpo.style.display !== 'none';
                cuerpo.style.display = abierto ? 'none' : 'block';
                if (icono) icono.textContent = abierto ? '▼' : '▲';
            });
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
                const subliImpresion = parseFloat(document.getElementById('tarifa-subli-impresion').value) || 0.75;
                const subliPlancha   = parseFloat(document.getElementById('tarifa-subli-plancha').value)   || 0.10;
                const subliManoObra  = parseFloat(document.getElementById('tarifa-subli-mano-obra').value) || 0.25;
                btnGuardarTarifas.disabled = true;
                btnGuardarTarifas.textContent = 'Guardando...';
                try {
                    await EvergreenAPI.updateConfiguracion({
                        tarifa_hora_laser: laser,
                        tarifa_hora_labor: labor,
                        sublimacion_costo_impresion_a4: subliImpresion,
                        sublimacion_costo_minuto_plancha: subliPlancha,
                        sublimacion_mano_obra_minuto: subliManoObra,
                    });
                    CostosComponent.tarifas = {
                        tarifa_hora_laser: laser,
                        tarifa_hora_labor: labor,
                        sublimacion_costo_impresion_a4: subliImpresion,
                        sublimacion_costo_minuto_plancha: subliPlancha,
                        sublimacion_mano_obra_minuto: subliManoObra,
                    };
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

        // Toggle Láser / Sublimación
        document.querySelectorAll('input[name="tipo-produccion"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const esSub = radio.value === 'sublimacion';
                document.getElementById('seccion-laser-campos').style.display   = esSub ? 'none'  : 'block';
                document.getElementById('seccion-sublimacion-campos').style.display = esSub ? 'block' : 'none';
                const lblLaser = document.getElementById('lbl-laser');
                const lblSub   = document.getElementById('lbl-sublimacion');
                if (lblLaser) { lblLaser.style.background = esSub ? '#fff' : 'var(--color-moss-green)'; lblLaser.style.color = esSub ? '#666' : '#fff'; }
                if (lblSub)   { lblSub.style.background   = esSub ? '#c0392b' : '#fff'; lblSub.style.color = esSub ? '#fff' : '#666'; }
            });
        });

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

        // Ejecutar cálculo normal
        if (btnCalcular) {
            btnCalcular.addEventListener('click', () => {
                // Branch: sublimación vs láser
                const radioSubli = document.getElementById('tipo-produccion-sublimacion');
                if (radioSubli && radioSubli.checked) {
                    this._calcularSublimacion(btnSaveProduct);
                    return;
                }

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
                const tiempoCorte = parseFloat(document.getElementById('laser-tiempo').value) || 0;
                const tiempoGrabado = 0;
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
                // Modo 3D / Multicapa
                const modoProducto = document.getElementById('modo-producto')?.value || 'plano';
                const numPiezas = parseInt(document.getElementById('num-piezas')?.value) || 1;
                const tiempoPegado = parseFloat(document.getElementById('tiempo-pegado')?.value) || 0;
                const tiempoSecadoRef = parseFloat(document.getElementById('tiempo-secado-ref')?.value) || 0;
                const costoPegamento = parseFloat(document.getElementById('costo-pegamento')?.value) || 0;
                const costoHerrajesExtras = parseFloat(document.getElementById('costo-herrajes-extras')?.value) || 0;
                const costoEmpaque = parseFloat(document.getElementById('costo-empaque')?.value) || 0;
                const pctMerma = parseFloat(document.getElementById('porcentaje-merma')?.value) || 0;

                // Tarifas desde estado del componente (ya cargadas desde API)
                const tarifaLaser = CostosComponent.tarifas.tarifa_hora_laser;
                const tarifaLabor = CostosComponent.tarifas.tarifa_hora_labor;
                const factorComplejidad = complejidad === 'compleja' ? 1.6 : complejidad === 'media' ? 1.3 : 1.0;

                const areaHoja = anchoHoja * altoHoja;
                const areaProd = anchoProd * altoProd;
                // Merma: 15% base + % adicional configurable
                const factorMerma = 1.15 + (pctMerma / 100);
                const areaConDesperdicio = areaProd * factorMerma;
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

                // Bloque unificado de extras (accesorios + 3D) — siempre visible si hay algo
                const costoExtras3DTemp = costoPegamento + costoHerrajesExtras + costoEmpaque;
                const totalExtrasVisible = costoAccesoriosTotal + costoExtras3DTemp;
                if (totalExtrasVisible > 0 || accesoriosHTML) {
                    const itemsExtrasHTML = [];
                    if (costoPegamento > 0)      itemsExtrasHTML.push(`<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;"><span>Pegamento</span><span>$${costoPegamento.toFixed(2)}</span></div>`);
                    if (costoHerrajesExtras > 0) itemsExtrasHTML.push(`<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;"><span>Herrajes / imanes extras</span><span>$${costoHerrajesExtras.toFixed(2)}</span></div>`);
                    if (costoEmpaque > 0)        itemsExtrasHTML.push(`<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;"><span>Empaque</span><span>$${costoEmpaque.toFixed(2)}</span></div>`);
                    desgloseHTML += `
                        <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                            <strong style="color: var(--color-moss-green); font-size: 13.5px;">Componentes / Extras:</strong>
                            ${accesoriosHTML}
                            ${itemsExtrasHTML.join('')}
                            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;border-top:1px dashed #ddd;padding-top:6px;margin-top:6px;">
                                <span>Total Extras</span><span>$${totalExtrasVisible.toFixed(2)}</span>
                            </div>
                        </div>
                    `;
                }

                // === Motor de Costeo Inteligente ===
                const costoLaser = (tiempoCorte + tiempoGrabado) / 60 * tarifaLaser;
                const tiempoPinturaTotal = tiempoPinturaCapa * capas;
                const costoPintura = tiempoPinturaTotal / 60 * tarifaLabor * factorComplejidad;
                const costoEnsamblaje = tiempoEnsamblaje / 60 * tarifaLabor;
                // Pegado (se cobra como labor, secado NO)
                const costoPegado = tiempoPegado / 60 * tarifaLabor;
                // Resina
                const costoResinaMaterial = usaResina ? resinaMl * resinaCostoPorMl : 0;
                const costoResinaLabor = usaResina ? resinaActivo / 60 * tarifaLabor : 0;
                const costoResinaTotal = costoResinaMaterial + costoResinaLabor;
                // Extras 3D directos
                const costoExtras3D = costoPegamento + costoHerrajesExtras + costoEmpaque;
                const costoManoObra = costoPintura + costoEnsamblaje + costoPegado + ajusteManual;

                // Desglose — Láser
                desgloseHTML += `
                    <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">Láser ($${tarifaLaser.toFixed(2)}/hr):</strong>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                            <span>Tiempo Láser: ${tiempoCorte} min</span>
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

                // Desglose — Pegado (solo en modo 3D/multicapa)
                if (costoPegado > 0) {
                    desgloseHTML += `
                    <div style="background-color: var(--color-white); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); margin-bottom: 8px;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">Pegado ($${tarifaLabor.toFixed(2)}/hr):</strong>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
                            <span>${tiempoPegado} min</span>
                            <span>$${costoPegado.toFixed(2)}</span>
                        </div>
                        ${tiempoSecadoRef > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#aaa;margin-top:3px;"><span>⏱ Secado estimado: ${tiempoSecadoRef} min (sin costo)</span><span>—</span></div>` : ''}
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

                const costoTotal = costoPlanchaProporcional + costoAccesoriosTotal + costoLaser + costoManoObra + costoResinaTotal + costoExtras3D;
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
                    // Modo 3D / Multicapa
                    modo_producto: modoProducto,
                    num_piezas: numPiezas,
                    tiempo_pegado: tiempoPegado,
                    tiempo_secado_ref: tiempoSecadoRef,
                    costo_pegamento: costoPegamento,
                    costo_herrajes_extras: costoHerrajesExtras,
                    costo_empaque: costoEmpaque,
                    porcentaje_merma: pctMerma,
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

    _calcularSublimacion(btnSaveProduct) {
        const costBlank    = parseFloat(document.getElementById('subli-costo-blank')?.value) || 0;
        const hojas        = parseFloat(document.getElementById('subli-hojas')?.value) || 1;
        const minPlancha   = parseFloat(document.getElementById('subli-tiempo-plancha')?.value) || 0;
        const margen       = parseFloat(document.getElementById('margen-ganancia').value) || 0;
        const margenWhole  = parseFloat(document.getElementById('margen-wholesale')?.value) || 0;
        const tipoProducto = document.getElementById('tipo-producto')?.value || 'otro';
        const complejidad  = document.getElementById('complejidad-producto')?.value || 'simple';
        const modoProducto = document.getElementById('modo-producto')?.value || 'plano';

        // Extras manuales (campos compartidos con el modo láser)
        const costoHerrajesExtras = parseFloat(document.getElementById('costo-herrajes-extras')?.value) || 0;
        const costoEmpaque        = parseFloat(document.getElementById('costo-empaque')?.value) || 0;

        const tarifaImpresion = parseFloat(CostosComponent.tarifas.sublimacion_costo_impresion_a4)  || 0.75;
        const tarifaPlancha   = parseFloat(CostosComponent.tarifas.sublimacion_costo_minuto_plancha) || 0.10;
        const tarifaManoObra  = parseFloat(CostosComponent.tarifas.sublimacion_mano_obra_minuto)     || 0.25;

        const costoImpresion = hojas * tarifaImpresion;
        const costoPlancha   = minPlancha * tarifaPlancha;
        const costoManoObra  = minPlancha * tarifaManoObra;

        // Leer checkboxes de componentes extras (igual que el modo láser)
        this.componentesSeleccionados = [];
        const checkboxes = document.querySelectorAll('.extra-checkbox');
        let costoAccesoriosTotal = 0;
        let accesoriosHTML = '';

        checkboxes.forEach(cb => {
            if (!cb.checked) return;
            try {
                const extId        = parseInt(cb.getAttribute('data-id'))    || 0;
                const extNombre    = cb.getAttribute('data-nombre')          || 'Extra';
                const extCostoUnit = parseFloat(cb.getAttribute('data-costo') || '0') || 0;
                const qtyInput     = cb.closest('div')?.parentElement?.querySelector('.extra-qty-input');
                const qty          = parseInt(qtyInput?.value) || 1;
                const costoCalculado = extCostoUnit * qty;

                costoAccesoriosTotal += costoCalculado;
                this.componentesSeleccionados.push({
                    materialId: extId,
                    cantidad: qty,
                    nombre: extNombre,
                    costoCalculado
                });
                accesoriosHTML += `
                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;">
                        <span>${extNombre} (x${qty})</span><span>$${costoCalculado.toFixed(2)}</span>
                    </div>`;
            } catch (_) { /* ignorar extras con DOM inesperado */ }
        });

        const costoExtrasTotal = costoAccesoriosTotal + costoHerrajesExtras + costoEmpaque;
        const costoTotal = costBlank + costoImpresion + costoPlancha + costoManoObra + costoExtrasTotal;

        const factorRetail   = 1 - (margen / 100);
        const precioSugerido = factorRetail > 0 ? costoTotal / factorRetail : costoTotal;
        const gananciaRetail = precioSugerido - costoTotal;
        const factorWhole    = 1 - (margenWhole / 100);
        const precioWhole    = factorWhole > 0 ? costoTotal / factorWhole : costoTotal;

        // Sección de accesorios en el desglose (solo si hay algo)
        const extrasSection = (costoExtrasTotal > 0) ? `
            <div style="background:var(--color-white);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--color-gray-border);margin-top:8px;margin-bottom:8px;">
                <strong style="color:var(--color-olive-brown);font-size:13.5px;">Componentes / Extras</strong>
                ${accesoriosHTML}
                ${costoHerrajesExtras > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;"><span>Herrajes / imanes extras</span><span>$${costoHerrajesExtras.toFixed(2)}</span></div>` : ''}
                ${costoEmpaque > 0        ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;"><span>Empaque</span><span>$${costoEmpaque.toFixed(2)}</span></div>` : ''}
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px;font-weight:600;border-top:1px dashed #ddd;padding-top:6px;">
                    <span>Subtotal extras</span><span>$${costoExtrasTotal.toFixed(2)}</span>
                </div>
            </div>` : '';

        const desgloseHTML = `
            <div style="background:var(--color-white);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--color-gray-border);margin-bottom:8px;">
                <strong style="color:#c0392b;font-size:13.5px;">🔴 Sublimación</strong>
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px;">
                    <span>Blank (costo base)</span><span>$${costBlank.toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;">
                    <span>Impresión: ${hojas} hoja${hojas !== 1 ? 's' : ''} × $${tarifaImpresion.toFixed(2)}</span><span>$${costoImpresion.toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;">
                    <span>Plancha: ${minPlancha} min × $${tarifaPlancha.toFixed(2)}/min</span><span>$${costoPlancha.toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;">
                    <span>Mano de obra: ${minPlancha} min × $${tarifaManoObra.toFixed(2)}/min</span><span>$${costoManoObra.toFixed(2)}</span>
                </div>
            </div>
            ${extrasSection}
            <div style="display:flex;justify-content:space-between;border-top:2px solid #c0392b;padding-top:12px;margin-top:14px;font-weight:700;color:#c0392b;font-size:15px;">
                <span>COSTO TOTAL SUBLIMACIÓN:</span><span>$${costoTotal.toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600;color:var(--color-terracotta);margin-top:6px;">
                <span>Retail (${margen}% margen):</span><span>$${precioSugerido.toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:500;color:var(--color-success);margin-top:2px;">
                <span>Ganancia Retail:</span><span>$${gananciaRetail.toFixed(2)}</span>
            </div>
            ${margenWhole > 0 ? `
            <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600;color:#1976d2;margin-top:8px;border-top:1px dashed #cde;padding-top:8px;">
                <span>Wholesale (${margenWhole}% margen):</span><span>$${precioWhole.toFixed(2)}</span>
            </div>` : ''}
        `;

        this.ultimoCalculo = {
            tipo_produccion: 'sublimacion',
            tipo_producto: tipoProducto,
            complejidad,
            modo_producto: modoProducto,
            // Campos de sublimación
            sublimacion_costo_blank: costBlank,
            sublimacion_hojas_impresion: hojas,
            sublimacion_tiempo_plancha: minPlancha,
            // Costos calculados
            costo_maquina: costoPlancha,
            costo_mano_obra: costoManoObra,
            costo_herrajes_extras: costoHerrajesExtras,
            costo_empaque: costoEmpaque,
            costo_total: costoTotal,
            margen_ganancia: margen / 100,
            precio_sugerido: precioSugerido,
            margen_wholesale: margenWhole,
            precio_wholesale: margenWhole > 0 ? precioWhole : null,
            // Campos láser en 0 para no romper el schema del backend
            tiempo_corte: 0, tiempo_grabado: 0, tiempo_pintura: 0, capas: 1,
            tiempo_ensamblaje: 0, usa_resina: 0, cantidad_resina_ml: 0,
            costo_resina_por_ml: 0, tiempo_resina_activo_min: 0, tiempo_resina_curado_min: 0,
            num_piezas: 1, tiempo_pegado: 0, tiempo_secado_ref: 0, costo_pegamento: 0,
            porcentaje_merma: 0,
        };

        document.getElementById('costo-desglose-lista').innerHTML = desgloseHTML;
        if (btnSaveProduct) btnSaveProduct.removeAttribute('disabled');
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
        const defPrecio = (sugerido !== undefined && sugerido !== null) ? sugerido.toFixed(2) : (editingProd ? editingProd.precio_final.toFixed(2) : '0.00');
        const tipoProductoCalc = document.getElementById('tipo-producto')?.value || '';
        const defPersonal = editingProd
            ? editingProd.personalizado
            : (tipoProductoCalc === 'personalizado' ? 1 : 0);
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
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <h4 style="font-size:13px; font-weight:600; color:#8a6a3c; margin:0; display:flex; align-items:center; gap:6px;">
                                <i data-lucide="file-image" style="width:14px;height:14px;"></i> Fotos Técnicas
                            </h4>
                            <span style="font-size:10px; color:#c0634c; font-weight:600; background:#fff5f5; border:1px solid #f5c6cb; border-radius:4px; padding:2px 7px;">Solo uso interno</span>
                        </div>
                        <p style="font-size:11px; color:#8c8270; margin:0 0 10px;">Fotos de proceso y referencia interna. <strong>No se muestran en el catálogo público.</strong> La galería comercial se gestiona abajo en "Galería del Producto".</p>
                        <div id="foto-galeria-grid" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; min-height:40px;">
                            <div style="font-size:12px; color:#aaa; font-style:italic; padding:8px 0;">Cargando fotos...</div>
                        </div>
                        <div style="border-top:1px solid #e8e0d5; padding-top:12px;">
                            <div style="font-size:12px; font-weight:600; color:#555; margin-bottom:8px;">+ Agregar foto técnica</div>
                            <div style="display:grid; grid-template-columns:1fr 1.5fr auto; gap:8px; align-items:end;">
                                <div style="display:flex; flex-direction:column; gap:3px;">
                                    <label style="font-size:11px; font-weight:500; color:#666;">Tipo</label>
                                    <select id="nueva-foto-tipo" style="padding:6px 8px; border-radius:6px; border:1px solid #ddd; font-size:12px; font-family:var(--font-primary); background:white;">
                                        <option value="referencia" selected>Referencia</option>
                                        <option value="material">Material</option>
                                        <option value="antes">Antes</option>
                                        <option value="final">Final</option>
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

                    <!-- Campos de Personalización -->
                    <div id="seccion-campos-personalizacion" style="background-color: #f0f5eb; padding: 12px; border-radius: var(--radius-md); border: 1px solid #c5d9a8; margin-top: 2px; display: ${defPersonal === 1 ? 'block' : 'none'};">
                        <h4 style="font-size: 13px; font-weight: 600; color: var(--color-moss-green); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                            <span style="display:flex;align-items:center;gap:6px;"><i data-lucide="sliders" style="width: 14px; height: 14px;"></i> Campos de Personalización</span>
                            <button type="button" id="btn-agregar-campo" style="font-size:11px;padding:3px 10px;background:var(--color-moss-green);color:#fff;border:none;border-radius:4px;cursor:pointer;">+ Agregar campo</button>
                        </h4>
                        <div id="lista-campos-personalizacion" style="display:flex;flex-direction:column;gap:8px;min-height:24px;">
                            <p id="campos-vacio-msg" style="font-size:12px;color:#8c8270;margin:0;">Sin campos configurados. Presiona <strong>+ Agregar campo</strong> para añadir.</p>
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

                    <div id="modal-campos-error" style="display:none;color:#c0392b;font-size:12.5px;background:#fff5f5;border-radius:8px;padding:10px 14px;border:1px solid #ffd0cc;"></div>

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

        // ─── CAMPOS DE PERSONALIZACIÓN ────────────────────────────────────────────
        const productoIdActual = isEditing ? this.editingProductoId : null;
        this._camposTemp = [];
        this._camposActivos = false; // se pone true cuando el admin toca la sección

        const seccionCampos   = document.getElementById('seccion-campos-personalizacion');
        const listaCampos     = document.getElementById('lista-campos-personalizacion');
        const vacioMsg        = document.getElementById('campos-vacio-msg');
        const selectPersonal  = document.getElementById('prod-personalizado');

        // Mostrar/ocultar sección según tipo de venta
        selectPersonal.addEventListener('change', () => {
            seccionCampos.style.display = selectPersonal.value === '1' ? 'block' : 'none';
            if (selectPersonal.value === '1') this._camposActivos = true;
        });

        // Renderiza la lista de campos temporales en el modal
        const renderCamposTemp = () => {
            if (this._camposTemp.length === 0) {
                listaCampos.innerHTML = '<p id="campos-vacio-msg" style="font-size:12px;color:#8c8270;margin:0;">Sin campos configurados. Presiona <strong>+ Agregar campo</strong> para añadir.</p>';
                return;
            }
            listaCampos.innerHTML = this._camposTemp.map((c, i) => `
                <div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;background:#fff;border:1px solid #d4e6b5;border-radius:6px;padding:6px 10px;font-size:12px;">
                    <span><strong>${c.etiqueta}</strong> <span style="color:#8c8270;">[${c.tipo}${c.requerido ? ' · requerido' : ''}${c.costo_adicional > 0 ? ` · +$${c.costo_adicional}` : ''}]</span></span>
                    <button type="button" data-idx="${i}" class="btn-edit-campo" style="padding:2px 8px;font-size:11px;background:#f0f5eb;border:1px solid #c5d9a8;border-radius:3px;cursor:pointer;">Editar</button>
                    <button type="button" data-idx="${i}" class="btn-del-campo" style="padding:2px 8px;font-size:11px;background:#fce4ec;border:1px solid #e57373;border-radius:3px;cursor:pointer;color:#c0392b;">✕</button>
                </div>`).join('');

            listaCampos.querySelectorAll('.btn-del-campo').forEach(btn => {
                btn.addEventListener('click', () => {
                    this._camposTemp.splice(parseInt(btn.dataset.idx), 1);
                    this._camposActivos = true;
                    renderCamposTemp();
                });
            });
            listaCampos.querySelectorAll('.btn-edit-campo').forEach(btn => {
                btn.addEventListener('click', () => abrirFormCampo(parseInt(btn.dataset.idx)));
            });
        };

        // Abre un mini-formulario flotante para añadir/editar un campo
        const abrirFormCampo = (editIdx = null) => {
            const c = editIdx !== null ? { ...this._camposTemp[editIdx] } : { etiqueta: '', tipo: 'texto', requerido: 0, opciones: '', costo_adicional: 0, orden: this._camposTemp.length };
            const formId = 'modal-campo-form';
            let existing = document.getElementById(formId);
            if (existing) existing.remove();

            const div = document.createElement('div');
            div.id = formId;
            div.style.cssText = 'background:#f0f5eb;border:1px solid #c5d9a8;border-radius:8px;padding:12px;margin-top:8px;display:flex;flex-direction:column;gap:8px;';
            div.innerHTML = `
                <div style="font-size:12px;font-weight:600;color:var(--color-moss-green);">${editIdx !== null ? 'Editar' : 'Nuevo'} campo</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div><label style="font-size:11px;font-weight:500;">Etiqueta</label><br>
                    <input id="cf-etiqueta" value="${c.etiqueta}" style="width:100%;padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>
                    <div><label style="font-size:11px;font-weight:500;">Tipo</label><br>
                    <select id="cf-tipo" style="width:100%;padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;">
                        ${['texto','textarea','fecha','select','multiselect','checkbox','archivo'].map(t => `<option value="${t}" ${c.tipo===t?'selected':''}>${t}</option>`).join('')}
                    </select></div>
                </div>
                <div id="cf-opciones-wrap" style="display:${['select','multiselect'].includes(c.tipo)?'block':'none'}">
                    <label id="cf-opciones-label" style="font-size:11px;font-weight:500;">${c.tipo==='multiselect'?'Opciones con costo (una por línea: Nombre | costo)':'Opciones (separadas por coma)'}</label><br>
                    <textarea id="cf-opciones" rows="3" placeholder="${c.tipo==='multiselect'?'Baltic | 0\nBasswood | 1.50\nWalnut | 3.00':'Rojo, Azul, Verde'}" style="width:100%;padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;resize:vertical;">${c.tipo==='multiselect'?(c.opciones||'').split(',').map(o=>o.trim()).join('\n'):(c.opciones||'')}</textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:center;">
                    <label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
                        <input type="checkbox" id="cf-requerido" ${c.requerido?'checked':''} style="width:14px;height:14px;"> Requerido
                    </label>
                    <div><label style="font-size:11px;font-weight:500;">Costo adicional ($)</label><br>
                    <input type="number" id="cf-costo" value="${c.costo_adicional||0}" step="0.01" min="0" style="width:100%;padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button type="button" id="cf-cancel" style="padding:4px 12px;font-size:12px;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:#fff;">Cancelar</button>
                    <button type="button" id="cf-save" style="padding:4px 12px;font-size:12px;background:var(--color-moss-green);color:#fff;border:none;border-radius:4px;cursor:pointer;">Guardar campo</button>
                </div>`;
            listaCampos.parentElement.appendChild(div);

            document.getElementById('cf-tipo').addEventListener('change', function() {
                const isOpts = ['select','multiselect'].includes(this.value);
                document.getElementById('cf-opciones-wrap').style.display = isOpts ? 'block' : 'none';
                if (isOpts) {
                    const isMulti = this.value === 'multiselect';
                    document.getElementById('cf-opciones-label').textContent = isMulti ? 'Opciones con costo (una por línea: Nombre | costo)' : 'Opciones (separadas por coma)';
                    document.getElementById('cf-opciones').placeholder = isMulti ? 'Baltic | 0\nBasswood | 1.50\nWalnut | 3.00' : 'Rojo, Azul, Verde';
                }
            });
            document.getElementById('cf-cancel').addEventListener('click', () => div.remove());
            document.getElementById('cf-save').addEventListener('click', () => {
                const etiqueta = document.getElementById('cf-etiqueta').value.trim();
                if (!etiqueta) { alert('La etiqueta es obligatoria.'); return; }
                const _tipoSave = document.getElementById('cf-tipo').value;
                let _opcionesSave = document.getElementById('cf-opciones').value.trim() || null;
                if (_tipoSave === 'multiselect' && _opcionesSave) {
                    _opcionesSave = _opcionesSave.split('\n').map(l => l.trim()).filter(Boolean).join(',');
                }
                const nuevo = {
                    etiqueta,
                    tipo: _tipoSave,
                    requerido: document.getElementById('cf-requerido').checked ? 1 : 0,
                    opciones: _opcionesSave,
                    costo_adicional: parseFloat(document.getElementById('cf-costo').value) || 0,
                    orden: editIdx !== null ? c.orden : this._camposTemp.length,
                    id: editIdx !== null ? c.id : null,
                };
                if (editIdx !== null) this._camposTemp[editIdx] = nuevo;
                else this._camposTemp.push(nuevo);
                this._camposActivos = true;
                div.remove();
                renderCamposTemp();
            });
        };

        document.getElementById('btn-agregar-campo').addEventListener('click', () => abrirFormCampo());

        // Cargar campos existentes si estamos editando
        if (isEditing && productoIdActual) {
            EvergreenAPI.getCamposPersonalizacion(productoIdActual).then(res => {
                if (res.status === 'success') {
                    this._camposTemp = res.data || [];
                    this._camposActivos = true; // carga exitosa → el admin puede editar
                    renderCamposTemp();
                }
            }).catch(() => {});
        }
        // ──────────────────────────────────────────────────────────────────────────

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
                        modo_producto: this.ultimoCalculo.modo_producto,
                        num_piezas: this.ultimoCalculo.num_piezas,
                        tiempo_pegado: this.ultimoCalculo.tiempo_pegado,
                        tiempo_secado_ref: this.ultimoCalculo.tiempo_secado_ref,
                        costo_pegamento: this.ultimoCalculo.costo_pegamento,
                        costo_herrajes_extras: this.ultimoCalculo.costo_herrajes_extras,
                        costo_empaque: this.ultimoCalculo.costo_empaque,
                        porcentaje_merma: this.ultimoCalculo.porcentaje_merma,
                        tipo_produccion: this.ultimoCalculo.tipo_produccion || 'laser',
                        sublimacion_costo_blank: this.ultimoCalculo.sublimacion_costo_blank || 0,
                        sublimacion_hojas_impresion: this.ultimoCalculo.sublimacion_hojas_impresion || 0,
                        sublimacion_tiempo_plancha: this.ultimoCalculo.sublimacion_tiempo_plancha || 0,
                    });

                    // Reemplazar foto si se seleccionó una nueva
                    const fotoFileInput = document.getElementById('prod-foto');
                    if (fotoFileInput && fotoFileInput.files && fotoFileInput.files.length > 0) {
                        await EvergreenAPI.subirFoto(fotoFileInput.files[0], null, this.editingProductoId, 'referencia');
                    }

                    // Guardar campos de personalización
                    await this._guardarCamposPersonalizacion(this.editingProductoId);

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
                    modo_producto: this.ultimoCalculo.modo_producto,
                    num_piezas: this.ultimoCalculo.num_piezas,
                    tiempo_pegado: this.ultimoCalculo.tiempo_pegado,
                    tiempo_secado_ref: this.ultimoCalculo.tiempo_secado_ref,
                    costo_pegamento: this.ultimoCalculo.costo_pegamento,
                    costo_herrajes_extras: this.ultimoCalculo.costo_herrajes_extras,
                    costo_empaque: this.ultimoCalculo.costo_empaque,
                    porcentaje_merma: this.ultimoCalculo.porcentaje_merma,
                    tipo_produccion: this.ultimoCalculo.tipo_produccion || 'laser',
                    sublimacion_costo_blank: this.ultimoCalculo.sublimacion_costo_blank || 0,
                    sublimacion_hojas_impresion: this.ultimoCalculo.sublimacion_hojas_impresion || 0,
                    sublimacion_tiempo_plancha: this.ultimoCalculo.sublimacion_tiempo_plancha || 0,
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

                    // Guardar campos de personalización del nuevo producto
                    await this._guardarCamposPersonalizacion(nuevoProductoId);

                    modal.style.display = 'none';
                    this.render('costos-container');
                } catch (err) {
                    alert("Error al registrar el producto: " + err.message);
                }
            }
        });
    },

    async _guardarCamposPersonalizacion(productoId) {
        // Solo proceder si el admin interactuó con la sección de campos en el modal
        if (!this._camposActivos) return;
        const modalErrorEl = document.getElementById('modal-campos-error');
        const showModalErr = (msg) => {
            if (modalErrorEl) { modalErrorEl.textContent = msg; modalErrorEl.style.display = 'block'; }
            else alert(msg);
        };
        try {
            // Obtener campos actuales — si falla la API, no borramos nada
            const existentes = await EvergreenAPI.getCamposPersonalizacion(productoId)
                .then(r => r.data || [])
                .catch(() => null);

            if (existentes === null) {
                // API no disponible — solo intentar crear campos nuevos
                for (let i = 0; i < (this._camposTemp || []).length; i++) {
                    const c = { ...this._camposTemp[i], orden: i };
                    if (!c.id) await EvergreenAPI.createCampoPersonalizacion(productoId, c).catch(() => {});
                }
                return;
            }

            const existentesIds = new Set(existentes.map(c => c.id));
            const tempIds = new Set((this._camposTemp || []).filter(c => c.id).map(c => c.id));

            // Eliminar los que ya no están en la lista temporal
            for (const ex of existentes) {
                if (!tempIds.has(ex.id)) {
                    await EvergreenAPI.deleteCampoPersonalizacion(productoId, ex.id).catch(() => {});
                }
            }

            // Crear o actualizar
            for (let i = 0; i < (this._camposTemp || []).length; i++) {
                const c = { ...this._camposTemp[i], orden: i };
                if (c.id && existentesIds.has(c.id)) {
                    await EvergreenAPI.updateCampoPersonalizacion(productoId, c.id, c).catch(() => {});
                } else {
                    await EvergreenAPI.createCampoPersonalizacion(productoId, c).catch(() => {});
                }
            }
        } catch (err) {
            showModalErr('⚠️ Error al guardar campos de personalización: ' + err.message);
        }
        this._camposTemp = [];
        this._camposActivos = false;
    },

    /**
     * Renderiza el panel de campos de personalización en la vista principal de Costos.
     * Se muestra cuando se edita un producto personalizable.
     */
    async renderCamposPanel(productoId) {
        const wrap = document.getElementById('campos-panel-wrap');
        if (!wrap) return;

        // Estado local del panel (independiente del modal)
        let camposList = [];
        let panelActivo = false;

        const statusId = 'campos-panel-status';

        const showStatus = (msg, isError = false) => {
            const el = document.getElementById(statusId);
            if (!el) return;
            el.textContent = msg;
            el.style.color = isError ? '#c0392b' : '#5f7830';
            el.style.display = 'block';
            if (!isError) setTimeout(() => { if (el) el.style.display = 'none'; }, 3000);
        };

        const renderLista = () => {
            const lista = document.getElementById('campos-panel-lista');
            if (!lista) return;
            if (camposList.length === 0) {
                lista.innerHTML = `<p style="font-size:13px;color:#8c8270;margin:0;font-style:italic;">Sin campos configurados. Usa <strong>+ Añadir Campo</strong> para comenzar.</p>`;
                return;
            }
            lista.innerHTML = camposList.map((c, i) => `
                <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;background:#fff;border:1px solid #d4e6b5;border-radius:8px;padding:10px 14px;">
                    <div>
                        <strong style="font-size:13px;">${c.etiqueta}</strong>
                        <span style="font-size:11.5px;color:#8c8270;margin-left:8px;">[${c.tipo}${c.requerido ? ' · requerido' : ''}${c.opciones ? ` · ${c.opciones}` : ''}${c.costo_adicional > 0 ? ` · +$${Number(c.costo_adicional).toFixed(2)}` : ''}]</span>
                    </div>
                    <button type="button" data-idx="${i}" class="cpanel-edit" style="padding:4px 12px;font-size:12px;background:#f0f5eb;border:1px solid #c5d9a8;border-radius:6px;cursor:pointer;font-weight:600;">Editar</button>
                    <button type="button" data-idx="${i}" class="cpanel-del" style="padding:4px 12px;font-size:12px;background:#fce4ec;border:1px solid #e57373;border-radius:6px;cursor:pointer;color:#c0392b;font-weight:600;">✕</button>
                </div>`).join('');

            lista.querySelectorAll('.cpanel-del').forEach(btn => {
                btn.addEventListener('click', () => {
                    camposList.splice(parseInt(btn.dataset.idx), 1);
                    panelActivo = true;
                    renderLista();
                });
            });
            lista.querySelectorAll('.cpanel-edit').forEach(btn => {
                btn.addEventListener('click', () => abrirFormCampo(parseInt(btn.dataset.idx)));
            });
        };

        const abrirFormCampo = (editIdx = null) => {
            const existing = document.getElementById('cpanel-campo-form');
            if (existing) existing.remove();
            const c = editIdx !== null ? { ...camposList[editIdx] } : { etiqueta: '', tipo: 'texto', requerido: 0, opciones: '', costo_adicional: 0 };

            const div = document.createElement('div');
            div.id = 'cpanel-campo-form';
            div.style.cssText = 'background:#eef6e8;border:1.5px solid #b8d9a0;border-radius:10px;padding:16px;margin-top:12px;display:flex;flex-direction:column;gap:10px;';
            div.innerHTML = `
                <div style="font-size:13px;font-weight:700;color:var(--color-moss-green);">${editIdx !== null ? '✏️ Editar' : '➕ Nuevo'} Campo</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div style="display:flex;flex-direction:column;gap:4px;">
                        <label style="font-size:12px;font-weight:600;">Etiqueta <span style="color:#c0634c;">*</span></label>
                        <input id="cpf-etiqueta" value="${c.etiqueta}" placeholder="Ej. Tamaño, Color, Texto a grabar…"
                            style="padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px;font-family:var(--font-primary);">
                    </div>
                    <div style="display:flex;flex-direction:column;gap:4px;">
                        <label style="font-size:12px;font-weight:600;">Tipo</label>
                        <select id="cpf-tipo" style="padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px;font-family:var(--font-primary);">
                            ${['texto','textarea','fecha','select','multiselect','checkbox','archivo'].map(t => `<option value="${t}" ${c.tipo===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div id="cpf-opciones-wrap" style="display:${['select','multiselect'].includes(c.tipo)?'flex':'none'};flex-direction:column;gap:4px;">
                    <label id="cpf-opciones-label" style="font-size:12px;font-weight:600;">${c.tipo==='multiselect'?'Opciones con costo (una por línea: Nombre | costo)':'Opciones (separadas por coma)'} <span style="color:#c0634c;">*</span></label>
                    <textarea id="cpf-opciones" rows="4" placeholder="${c.tipo==='multiselect'?'Baltic | 0\nBasswood | 1.50\nWalnut | 3.00':'Ej. 4\", 6\", 8\"  ó  Natural, Nogal, Caoba'}"
                        style="padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px;font-family:var(--font-primary);resize:vertical;">${c.tipo==='multiselect'?(c.opciones||'').split(',').map(o=>o.trim()).join('\n'):(c.opciones||'')}</textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center;">
                    <label style="font-size:13px;display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="checkbox" id="cpf-requerido" ${c.requerido?'checked':''} style="width:15px;height:15px;"> Requerido
                    </label>
                    <div style="display:flex;flex-direction:column;gap:4px;">
                        <label style="font-size:12px;font-weight:600;">Costo adicional ($)</label>
                        <input type="number" id="cpf-costo" value="${c.costo_adicional||0}" step="0.01" min="0"
                            style="padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px;font-family:var(--font-primary);">
                    </div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button type="button" id="cpf-cancel" style="padding:6px 16px;font-size:13px;border:1px solid #ccc;border-radius:6px;cursor:pointer;background:#fff;">Cancelar</button>
                    <button type="button" id="cpf-save" style="padding:6px 16px;font-size:13px;background:var(--color-moss-green);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;">✓ Guardar campo</button>
                </div>`;

            document.getElementById('campos-panel-lista').insertAdjacentElement('afterend', div);

            document.getElementById('cpf-tipo').addEventListener('change', function() {
                const isOpts = ['select','multiselect'].includes(this.value);
                document.getElementById('cpf-opciones-wrap').style.display = isOpts ? 'flex' : 'none';
                if (isOpts) {
                    const isMulti = this.value === 'multiselect';
                    document.getElementById('cpf-opciones-label').textContent = (isMulti ? 'Opciones con costo (una por línea: Nombre | costo)' : 'Opciones (separadas por coma)') + ' *';
                    document.getElementById('cpf-opciones').placeholder = isMulti ? 'Baltic | 0\nBasswood | 1.50\nWalnut | 3.00' : 'Ej. 4", 6", 8"  ó  Natural, Nogal, Caoba';
                }
            });
            document.getElementById('cpf-cancel').addEventListener('click', () => div.remove());
            document.getElementById('cpf-save').addEventListener('click', () => {
                const etiqueta = document.getElementById('cpf-etiqueta').value.trim();
                if (!etiqueta) { alert('La etiqueta es obligatoria.'); return; }
                const tipo = document.getElementById('cpf-tipo').value;
                let opciones = document.getElementById('cpf-opciones').value.trim();
                if (['select','multiselect'].includes(tipo) && !opciones) { alert('Debes agregar opciones para este tipo de campo.'); return; }
                if (tipo === 'multiselect' && opciones) {
                    opciones = opciones.split('\n').map(l => l.trim()).filter(Boolean).join(',');
                }
                const nuevo = {
                    etiqueta,
                    tipo,
                    requerido: document.getElementById('cpf-requerido').checked ? 1 : 0,
                    opciones: opciones || null,
                    costo_adicional: parseFloat(document.getElementById('cpf-costo').value) || 0,
                    orden: editIdx !== null ? (c.orden ?? editIdx) : camposList.length,
                    id: editIdx !== null ? c.id : null,
                };
                if (editIdx !== null) camposList[editIdx] = nuevo;
                else camposList.push(nuevo);
                panelActivo = true;
                div.remove();
                renderLista();
            });
        };

        // ── Render inicial del panel ──────────────────────────────────────────
        wrap.style.display = 'block';
        wrap.innerHTML = `
        <div class="card" style="padding:24px;border:2px solid #c5d9a8;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
                <h3 style="margin:0;font-size:16px;color:var(--color-moss-green);display:flex;align-items:center;gap:8px;">
                    <i data-lucide="sliders" style="width:18px;height:18px;"></i> Campos de Personalización para el Cliente
                </h3>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span id="${statusId}" style="font-size:12px;display:none;"></span>
                    <button id="cpanel-add" type="button" style="padding:7px 16px;background:var(--color-moss-green);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
                        <i data-lucide="plus" style="width:14px;height:14px;"></i> Añadir Campo
                    </button>
                    <button id="cpanel-save" type="button" style="padding:7px 16px;background:#1976d2;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
                        Guardar Todo
                    </button>
                </div>
            </div>
            <p style="font-size:12.5px;color:#8c8270;margin:0 0 14px;">
                Estos campos aparecerán como formulario para el cliente al pedir o cotizar este producto (catálogo público y B2B).
            </p>
            <div id="campos-panel-lista" style="display:flex;flex-direction:column;gap:8px;min-height:30px;">
                <p style="font-size:13px;color:#aaa;font-style:italic;margin:0;">Cargando campos…</p>
            </div>
        </div>`;

        lucide.createIcons();

        // Cargar campos existentes
        try {
            const res = await EvergreenAPI.getCamposPersonalizacion(productoId);
            camposList = res.data || [];
            panelActivo = false;
            renderLista();
        } catch (err) {
            document.getElementById('campos-panel-lista').innerHTML =
                `<p style="color:#c0392b;font-size:13px;margin:0;">⚠️ Error al cargar campos: ${err.message}</p>`;
        }

        document.getElementById('cpanel-add').addEventListener('click', () => abrirFormCampo());

        document.getElementById('cpanel-save').addEventListener('click', async () => {
            const btn = document.getElementById('cpanel-save');
            btn.disabled = true;
            btn.textContent = 'Guardando…';
            try {
                // Obtener campos actuales del servidor para diff
                const existentes = await EvergreenAPI.getCamposPersonalizacion(productoId)
                    .then(r => r.data || [])
                    .catch(() => null);

                if (existentes !== null) {
                    const tempIds = new Set(camposList.filter(c => c.id).map(c => c.id));
                    // Eliminar los removidos
                    for (const ex of existentes) {
                        if (!tempIds.has(ex.id)) {
                            await EvergreenAPI.deleteCampoPersonalizacion(productoId, ex.id);
                        }
                    }
                }

                const existentesIds = new Set((existentes || []).map(c => c.id));
                for (let i = 0; i < camposList.length; i++) {
                    const c = { ...camposList[i], orden: i };
                    if (c.id && existentesIds.has(c.id)) {
                        await EvergreenAPI.updateCampoPersonalizacion(productoId, c.id, c);
                    } else {
                        const created = await EvergreenAPI.createCampoPersonalizacion(productoId, c);
                        // Actualizar id local para que ediciones futuras funcionen
                        if (created?.data?.id) camposList[i].id = created.data.id;
                        else if (created?.id) camposList[i].id = created.id;
                    }
                }

                panelActivo = false;
                showStatus('✓ Campos guardados correctamente');
                // Recargar para obtener ids actualizados
                const reloaded = await EvergreenAPI.getCamposPersonalizacion(productoId);
                camposList = reloaded.data || [];
                renderLista();
            } catch (err) {
                showStatus('⚠️ Error al guardar: ' + err.message, true);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Guardar Todo';
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
    },

    // ──────────────────────────────────────────────────────────────────────────
    // PANEL GALERÍA DEL PRODUCTO (admin)
    // ──────────────────────────────────────────────────────────────────────────
    async renderGaleriaPanel(productoId) {
        const wrap = document.getElementById('galeria-panel-wrap');
        if (!wrap) return;

        const TIPOS = ['producto', 'ejemplo_cliente', 'material', 'detalle', 'uso_real'];

        const showStatus = (msg, isError = false) => {
            const el = document.getElementById('galeria-panel-status');
            if (!el) return;
            el.textContent = msg;
            el.style.color = isError ? '#c0392b' : '#5f7830';
            el.style.display = 'block';
            if (!isError) setTimeout(() => { if (el) el.style.display = 'none'; }, 3500);
        };

        const render = async () => {
            let imagenes = [];
            try {
                const res = await EvergreenAPI.getGaleriaProducto(productoId);
                imagenes = res.data || [];
            } catch (e) {
                console.error('renderGaleriaPanel load error:', e);
            }

            wrap.style.display = 'block';
            wrap.innerHTML = `
                <div class="card" style="padding:20px;border:2px solid #b8d0f0;margin-top:0;">
                    <h3 style="margin:0 0 4px;font-size:15px;color:#1565c0;display:flex;align-items:center;gap:8px;">
                        🖼️ Galería del Producto
                    </h3>
                    <p style="font-size:12px;color:#8c8270;margin:0 0 14px;">
                        Hasta 10 imágenes. La imagen principal aparece primero en el catálogo.
                    </p>
                    <div id="galeria-panel-status" style="display:none;font-size:12.5px;margin-bottom:10px;"></div>

                    <!-- Miniaturas existentes -->
                    <div id="galeria-panel-grid" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;min-height:30px;">
                        ${imagenes.length === 0
                            ? `<p style="font-size:13px;color:#aaa;font-style:italic;margin:0;">Sin imágenes aún. Sube la primera imagen del producto.</p>`
                            : imagenes.map(img => `
                                <div data-img-id="${img.id}" style="position:relative;width:90px;flex-shrink:0;">
                                    <div style="position:relative;width:90px;height:90px;border-radius:10px;overflow:hidden;
                                        border:2px solid ${img.es_principal ? '#1565c0' : '#e0d9ce'};background:#f5f0e8;">
                                        <img src="${getFullImageUrl(img.ruta_imagen)}"
                                            style="width:100%;height:100%;object-fit:cover;"
                                            onerror="this.style.display='none'">
                                        ${img.es_principal
                                            ? `<span style="position:absolute;bottom:3px;left:0;right:0;text-align:center;font-size:9px;background:rgba(21,101,192,0.85);color:#fff;padding:1px 0;">⭐ Principal</span>`
                                            : ''}
                                    </div>
                                    <div style="margin-top:4px;display:flex;flex-direction:column;gap:3px;">
                                        <select class="galeria-tipo-sel" data-img-id="${img.id}"
                                            style="font-size:10px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;width:100%;">
                                            ${TIPOS.map(t => `<option value="${t}" ${img.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                                        </select>
                                        <div style="display:flex;gap:3px;">
                                            ${!img.es_principal
                                                ? `<button class="galeria-btn-principal" data-img-id="${img.id}"
                                                    style="flex:1;font-size:9px;padding:2px;background:#e3f2fd;border:1px solid #90caf9;border-radius:4px;cursor:pointer;font-weight:700;" title="Marcar como principal">⭐</button>`
                                                : ''}
                                            <button class="galeria-btn-del" data-img-id="${img.id}"
                                                style="flex:1;font-size:9px;padding:2px;background:#fce4ec;border:1px solid #ef9a9a;border-radius:4px;cursor:pointer;color:#c62828;font-weight:700;" title="Eliminar">✕</button>
                                        </div>
                                    </div>
                                </div>`).join('')
                        }
                    </div>

                    <!-- Subir nueva imagen -->
                    ${imagenes.length < 10 ? `
                    <div style="border-top:1px solid #e8e0d5;padding-top:12px;">
                        <label style="font-size:12px;font-weight:700;color:#333;display:block;margin-bottom:6px;">Agregar imagen</label>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                            <input type="file" id="galeria-file-input" accept=".jpg,.jpeg,.png,.webp"
                                style="font-size:12px;flex:1;min-width:160px;">
                            <select id="galeria-tipo-nuevo" style="font-size:12px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;">
                                ${TIPOS.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                            <label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;">
                                <input type="checkbox" id="galeria-es-principal" style="width:13px;height:13px;">
                                Principal
                            </label>
                            <button id="galeria-btn-subir"
                                style="padding:7px 16px;background:#1565c0;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
                                Subir
                            </button>
                        </div>
                    </div>` : `<p style="font-size:12px;color:#e67e22;margin:0;">Límite de 10 imágenes alcanzado.</p>`}
                </div>`;

            // ── Evento: subir imagen ──
            const btnSubir = document.getElementById('galeria-btn-subir');
            if (btnSubir) {
                btnSubir.addEventListener('click', async () => {
                    const fileInput = document.getElementById('galeria-file-input');
                    const tipo = document.getElementById('galeria-tipo-nuevo')?.value || 'producto';
                    const esPrincipal = document.getElementById('galeria-es-principal')?.checked || false;
                    if (!fileInput?.files?.length) { showStatus('Selecciona una imagen.', true); return; }
                    const file = fileInput.files[0];
                    btnSubir.disabled = true;
                    btnSubir.textContent = 'Subiendo…';
                    try {
                        await EvergreenAPI.subirImagenGaleria(productoId, file, esPrincipal, '', tipo);
                        showStatus('✅ Imagen subida.');
                        await render();
                    } catch (e) {
                        console.error('galeria upload error:', e);
                        showStatus('Error: ' + e.message, true);
                        btnSubir.disabled = false;
                        btnSubir.textContent = 'Subir';
                    }
                });
            }

            // ── Evento: marcar principal ──
            wrap.querySelectorAll('.galeria-btn-principal').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const imgId = parseInt(btn.dataset.imgId);
                    try {
                        await EvergreenAPI.updateImagenGaleria(productoId, imgId, { es_principal: 1 });
                        showStatus('✅ Imagen principal actualizada.');
                        await render();
                    } catch (e) {
                        console.error('galeria principal error:', e);
                        showStatus('Error: ' + e.message, true);
                    }
                });
            });

            // ── Evento: eliminar ──
            wrap.querySelectorAll('.galeria-btn-del').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const imgId = parseInt(btn.dataset.imgId);
                    if (!confirm('¿Eliminar esta imagen de la galería?')) return;
                    try {
                        await EvergreenAPI.deleteImagenGaleria(productoId, imgId);
                        showStatus('Imagen eliminada.');
                        await render();
                    } catch (e) {
                        console.error('galeria delete error:', e);
                        showStatus('Error: ' + e.message, true);
                    }
                });
            });

            // ── Evento: cambiar tipo ──
            wrap.querySelectorAll('.galeria-tipo-sel').forEach(sel => {
                sel.addEventListener('change', async () => {
                    const imgId = parseInt(sel.dataset.imgId);
                    try {
                        await EvergreenAPI.updateImagenGaleria(productoId, imgId, { tipo: sel.value });
                        showStatus('Tipo actualizado.');
                    } catch (e) {
                        console.error('galeria tipo error:', e);
                        showStatus('Error: ' + e.message, true);
                    }
                });
            });
        };

        await render();
    }
};
