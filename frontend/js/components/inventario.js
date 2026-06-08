/**
 * Componente de Inventario de Materiales, Retazos e Importación Masiva
 */
const InventarioComponent = {
    activeSubTab: 'materiales', // 'materiales' o 'retazos'
    materialesList: [],

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando inventario de Evergreen Love...</p>
            </div>
        `;

        try {
            // Consultar datos en paralelo
            const [materialesRes, retazosRes] = await Promise.all([
                EvergreenAPI.getMateriales(),
                EvergreenAPI.getRetazos()
            ]);

            this.materialesList = materialesRes.data || [];
            const retazos = retazosRes.data || [];

            // Pintar estructura principal con sub-pestañas
            container.innerHTML = `
                <!-- Sub-pestañas internas -->
                <div style="display: flex; gap: 16px; border-bottom: 2px solid var(--color-gray-border); margin-bottom: 24px; padding-bottom: 8px;">
                    <button class="sub-tab-btn ${this.activeSubTab === 'materiales' ? 'active' : ''}" id="tab-btn-materiales" style="background: none; border: none; font-family: var(--font-primary); font-size: 16px; font-weight: 600; cursor: pointer; color: ${this.activeSubTab === 'materiales' ? 'var(--color-moss-green)' : '#8c8270'}; border-bottom: 3px solid ${this.activeSubTab === 'materiales' ? 'var(--color-moss-green)' : 'transparent'}; padding: 6px 12px; margin-bottom: -11px; transition: all 0.2s;">
                        Materia Prima (${this.materialesList.length})
                    </button>
                    <button class="sub-tab-btn ${this.activeSubTab === 'retazos' ? 'active' : ''}" id="tab-btn-retazos" style="background: none; border: none; font-family: var(--font-primary); font-size: 16px; font-weight: 600; cursor: pointer; color: ${this.activeSubTab === 'retazos' ? 'var(--color-moss-green)' : '#8c8270'}; border-bottom: 3px solid ${this.activeSubTab === 'retazos' ? 'var(--color-moss-green)' : 'transparent'}; padding: 6px 12px; margin-bottom: -11px; transition: all 0.2s;">
                        Retazos Disponibles (${retazos.length})
                    </button>
                </div>

                <!-- Secciones de Contenido -->
                <div id="sub-tab-content-materiales" style="display: ${this.activeSubTab === 'materiales' ? 'block' : 'none'};">
                    ${this.renderMaterialesSection()}
                </div>
                <div id="sub-tab-content-retazos" style="display: ${this.activeSubTab === 'retazos' ? 'block' : 'none'};">
                    ${this.renderRetazosSection(retazos)}
                </div>

                <!-- Modal de Formulario (Insertado dinámicamente) -->
                <div id="material-modal" class="modal-overlay" style="display: none;"></div>
                <div id="retazo-modal" class="modal-overlay" style="display: none;"></div>
            `;

            lucide.createIcons();
            this.setupListeners(retazos);

        } catch (error) {
            container.innerHTML = `
                <div class="alert-card">
                    <i data-lucide="alert-octagon"></i>
                    <div>
                        <div class="alert-title">Error al cargar datos</div>
                        <div class="alert-desc">${error.message}</div>
                    </div>
                </div>
            `;
            lucide.createIcons();
        }
    },

    // --- SECCIÓN: MATERIALES PRINCIPALES ---
    renderMaterialesSection() {
        let rows = '';
        if (this.materialesList.length === 0) {
            rows = `<tr><td colspan="8" style="text-align: center; color: #8c8270; padding: 30px;">No hay materiales registrados. Usa el importador o añade uno nuevo.</td></tr>`;
        } else {
            this.materialesList.forEach(mat => {
                const isLow = mat.cantidad <= mat.cantidad_minima_alerta;
                const stockBadge = isLow
                    ? `<span class="badge badge-danger" style="background-color: var(--color-terracotta-light); color: var(--color-terracotta);">Bajo Stock (${mat.cantidad})</span>`
                    : `<span class="badge badge-success" style="background-color: rgba(77, 124, 15, 0.1); color: var(--color-success);">Suficiente (${mat.cantidad})</span>`;

                const isBaseMaterial = ['madera', 'acrilico', 'corcho', 'resina'].includes(mat.tipo);
                let costoDetalle = '';
                if (isBaseMaterial) {
                    const area = mat.tamano_ancho * mat.tamano_alto;
                    const costoIn = area > 0 ? (mat.costo_hoja_unidad / area) : 0;
                    costoDetalle = `
                        <div style="font-weight: 600; font-size: 13.5px;">$${mat.costo_hoja_unidad.toFixed(2)} <span style="font-size: 11px; font-weight: normal; color: #8c8270;">/plancha</span></div>
                        <div style="font-size: 11.5px; color: var(--color-olive-brown); margin-top: 2.5px; font-weight: 500;">$${costoIn.toFixed(4)} / in²</div>
                    `;
                } else {
                    costoDetalle = `
                        <div style="font-weight: 600; font-size: 13.5px;">$${mat.costo_hoja_unidad.toFixed(4)} <span style="font-size: 11px; font-weight: normal; color: #8c8270;">/unidad</span></div>
                    `;
                }

                const totalCostoLote = mat.cantidad * mat.costo_hoja_unidad;

                rows += `
                    <tr data-id="${mat.id}">
                        <td>
                            ${mat.foto_url ? `<img src="${mat.foto_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; margin-right: 8px;">` : ''}
                            <strong>${mat.nombre}</strong>
                        </td>
                        <td><span class="badge badge-pending" style="background-color: var(--color-moss-green-light); color: var(--color-moss-green); text-transform: capitalize;">${mat.tipo}</span></td>
                        <td>${mat.espesor ? mat.espesor + ' in' : 'N/A'}</td>
                        <td>${mat.tamano_ancho} x ${mat.tamano_alto} in</td>
                        <td>${costoDetalle}</td>
                        <td>${stockBadge}</td>
                        <td><strong>$${totalCostoLote.toFixed(2)}</strong></td>
                        <td>${mat.proveedor || 'N/A'}</td>
                        <td>${mat.enlace_compra ? `<a href="${mat.enlace_compra}" target="_blank" class="btn-link">Ver enlace</a>` : 'N/A'}</td>
                        <td style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                            <label class="btn btn-secondary" style="padding: 6px 10px; font-size: 12px; cursor:pointer; margin:0;" title="Subir Foto">
                                <i data-lucide="image" style="width: 14px; height: 14px;"></i>
                                <input type="file" style="display:none;" accept="image/*" onchange="InventarioComponent.uploadPhoto(${mat.id}, this)">
                            </label>
                            <button class="btn btn-secondary btn-edit-mat" style="padding: 6px 10px; font-size: 12px;" data-id="${mat.id}">
                                <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
                            </button>
                            <button class="btn btn-secondary btn-delete-mat" style="padding: 6px 10px; font-size: 12px; color: var(--color-danger); border-color: rgba(153, 27, 27, 0.2);" data-id="${mat.id}">
                                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        return `
            <div class="card" style="margin-bottom: 24px;">
                <h3 class="card-title">Carga e Importación Masiva</h3>
                <p style="color: #6c757d; font-size: 14px; margin-bottom: 16px;">
                    Sube un archivo CSV con tus materiales para poblar el almacén de forma masiva.
                </p>
                
                <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background-color: var(--color-gray-light); padding: 16px; border-radius: var(--radius-md); border: 1px dashed var(--color-gray-border);">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <input type="file" id="csv-file-input" accept=".csv" style="font-family: var(--font-primary); font-size: 13.5px;">
                        <span style="font-size: 11.5px; color: #8c8270;">Formato: nombre, tipo, espesor, tamano_ancho, tamano_alto, cantidad, cantidad_minima_alerta, costo_hoja_unidad, proveedor, lote</span>
                    </div>
                    <button class="btn btn-primary" id="btn-submit-import">
                        <i data-lucide="upload-cloud"></i> Importar CSV
                    </button>
                </div>
            </div>

            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                    <h3 class="card-title" style="margin: 0;">Materia Prima</h3>
                    <button class="btn btn-primary" id="btn-new-material">
                        <i data-lucide="plus"></i> Registrar Material
                    </button>
                </div>

                <div class="table-container">
                    <table class="custom-table materia-prima-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Espesor</th>
                                <th>Formato / Dimensiones</th>
                                <th>Costo (Plancha/Ud)</th>
                                <th>Stock Disponible</th>
                                <th>Costo Total Lote</th>
                                <th>Proveedor</th>
                                <th>Compra</th>
                                <th style="text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // --- SECCIÓN: RETAZOS ---
    renderRetazosSection(retazos) {
        let rows = '';
        if (retazos.length === 0) {
            rows = `<tr><td colspan="6" style="text-align: center; color: #8c8270; padding: 30px;">No hay retazos guardados. Los retazos te ayudan a aprovechar material sobrante.</td></tr>`;
        } else {
            retazos.forEach(ret => {
                rows += `
                    <tr>
                        <td><strong>${ret.material_nombre || 'Material Desconocido'}</strong></td>
                        <td><span class="badge badge-pending" style="background-color: var(--color-moss-green-light); color: var(--color-moss-green); text-transform: capitalize;">${ret.material_tipo || 'N/A'}</span></td>
                        <td>${ret.tamano_ancho} x ${ret.tamano_alto} in</td>
                        <td>${ret.cantidad} u</td>
                        <td>${ret.ubicacion || 'Sin Ubicación'}</td>
                        <td style="text-align: right;">
                            <button class="btn btn-secondary btn-delete-ret" style="padding: 6px 10px; font-size: 12px; color: var(--color-danger); border-color: rgba(153, 27, 27, 0.2);" data-id="${ret.id}">
                                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h3 class="card-title" style="margin: 0;">Retazos en Taller</h3>
                        <p style="color: #6c757d; font-size: 13.5px; margin-top: 4px;">Utiliza piezas sobrantes de cortes previos para ahorrar costos y reducir residuos.</p>
                    </div>
                    <button class="btn btn-primary" id="btn-new-retazo">
                        <i data-lucide="plus"></i> Registrar Retazo
                    </button>
                </div>

                <div class="table-container">
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th>Material Base</th>
                                <th>Tipo</th>
                                <th>Tamaño Retazo</th>
                                <th>Cantidad</th>
                                <th>Ubicación Física</th>
                                <th style="text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // --- MANEJO DE EVENTOS ---
    setupListeners(retazos) {
        // Alternancia de Pestañas
        const btnMat = document.getElementById('tab-btn-materiales');
        const btnRet = document.getElementById('tab-btn-retazos');
        const secMat = document.getElementById('sub-tab-content-materiales');
        const secRet = document.getElementById('sub-tab-content-retazos');

        if (btnMat && btnRet) {
            btnMat.addEventListener('click', () => {
                this.activeSubTab = 'materiales';
                btnMat.style.color = 'var(--color-moss-green)';
                btnMat.style.borderBottom = '3px solid var(--color-moss-green)';
                btnRet.style.color = '#8c8270';
                btnRet.style.borderBottom = '3px solid transparent';
                secMat.style.display = 'block';
                secRet.style.display = 'none';
            });

            btnRet.addEventListener('click', () => {
                this.activeSubTab = 'retazos';
                btnRet.style.color = 'var(--color-moss-green)';
                btnRet.style.borderBottom = '3px solid var(--color-moss-green)';
                btnMat.style.color = '#8c8270';
                btnMat.style.borderBottom = '3px solid transparent';
                secRet.style.display = 'block';
                secMat.style.display = 'none';
            });
        }

        // Importación de CSV
        const btnImport = document.getElementById('btn-submit-import');
        const fileInput = document.getElementById('csv-file-input');
        if (btnImport && fileInput) {
            btnImport.addEventListener('click', async () => {
                const file = fileInput.files[0];
                if (!file) {
                    alert("Por favor, selecciona un archivo CSV primero.");
                    return;
                }
                btnImport.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; margin-right: 6px; border-width: 2px;"></span> Procesando...`;
                btnImport.disabled = true;

                try {
                    const res = await EvergreenAPI.importarMateriales(file);
                    alert(res.message);
                    this.render('inventario-container');
                } catch (err) {
                    alert("Error en la importación: " + err.message);
                    btnImport.innerHTML = `<i data-lucide="upload-cloud"></i> Importar CSV`;
                    btnImport.disabled = false;
                    lucide.createIcons();
                }
            });
        }

        // Crear nuevo material (Abrir Modal)
        const btnNewMat = document.getElementById('btn-new-material');
        if (btnNewMat) {
            btnNewMat.addEventListener('click', () => this.openMaterialModal());
        }

        // Editar material (Abrir Modal)
        document.querySelectorAll('.btn-edit-mat').forEach(btn => {
            btn.addEventListener('click', () => {
                const matId = parseInt(btn.getAttribute('data-id'));
                const mat = this.materialesList.find(m => m.id === matId);
                if (mat) this.openMaterialModal(mat);
            });
        });

        // Borrar material
        document.querySelectorAll('.btn-delete-mat').forEach(btn => {
            btn.addEventListener('click', async () => {
                const matId = parseInt(btn.getAttribute('data-id'));
                if (confirm("¿Estás seguro de que deseas eliminar este material? Esto podría afectar a productos y retazos asociados.")) {
                    try {
                        await EvergreenAPI.deleteMaterial(matId);
                        this.render('inventario-container');
                    } catch (err) {
                        alert("Error al eliminar material: " + err.message);
                    }
                }
            });
        });

        // Crear nuevo retazo (Abrir Modal)
        const btnNewRet = document.getElementById('btn-new-retazo');
        if (btnNewRet) {
            btnNewRet.addEventListener('click', () => this.openRetazoModal());
        }

        // Borrar retazo
        document.querySelectorAll('.btn-delete-ret').forEach(btn => {
            btn.addEventListener('click', async () => {
                const retId = parseInt(btn.getAttribute('data-id'));
                if (confirm("¿Deseas retirar este retazo del stock?")) {
                    try {
                        await EvergreenAPI.deleteRetazo(retId);
                        this.render('inventario-container');
                    } catch (err) {
                        alert("Error al eliminar retazo: " + err.message);
                    }
                }
            });
        });
    },

    // --- MODALES (HTML Dinámico y Lógica) ---
    openMaterialModal(material = null) {
        const modal = document.getElementById('material-modal');
        const isEdit = !!material;

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 500px; width: 90%; margin: 40px auto; position: relative;">
                <h3 class="card-title">${isEdit ? 'Editar Material' : 'Añadir Material'}</h3>
                
                <form id="material-form" style="display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Nombre del Material</label>
                        <input type="text" id="mat-nombre" required value="${isEdit ? material.nombre : ''}" placeholder="Ej. Madera Contrachapada Abedul" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Tipo de Material</label>
                            <select id="mat-tipo" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                                <option value="madera" ${isEdit && material.tipo === 'madera' ? 'selected' : ''}>Madera</option>
                                <option value="acrilico" ${isEdit && material.tipo === 'acrilico' ? 'selected' : ''}>Acrílico</option>
                                <option value="corcho" ${isEdit && material.tipo === 'corcho' ? 'selected' : ''}>Corcho</option>
                                <option value="resina" ${isEdit && material.tipo === 'resina' ? 'selected' : ''}>Resina</option>
                                <option value="herrajes" ${isEdit && material.tipo === 'herrajes' ? 'selected' : ''}>Herrajes</option>
                                <option value="empaques" ${isEdit && material.tipo === 'empaques' ? 'selected' : ''}>Empaques</option>
                                <option value="imanes" ${isEdit && material.tipo === 'imanes' ? 'selected' : ''}>Imanes</option>
                                <option value="pegamentos" ${isEdit && material.tipo === 'pegamentos' ? 'selected' : ''}>Pegamentos</option>
                                <option value="pinturas" ${isEdit && material.tipo === 'pinturas' ? 'selected' : ''}>Pinturas</option>
                                <option value="otros" ${isEdit && material.tipo === 'otros' ? 'selected' : ''}>Otros</option>
                            </select>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label id="label-mat-espesor" style="font-weight: 500; font-size: 13px;">Espesor (pulgadas)</label>
                            <input type="number" id="mat-espesor" step="any" required value="${isEdit ? material.espesor : 0.125}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label id="label-mat-ancho" style="font-weight: 500; font-size: 13px;">Ancho (pulgadas)</label>
                            <input type="number" id="mat-ancho" step="any" required value="${isEdit ? material.tamano_ancho : 12}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label id="label-mat-alto" style="font-weight: 500; font-size: 13px;">Alto (pulgadas)</label>
                            <input type="number" id="mat-alto" step="any" required value="${isEdit ? material.tamano_alto : 20}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label id="label-mat-cantidad" style="font-weight: 500; font-size: 13px;">Cantidad</label>
                            <input type="number" id="mat-cantidad" step="1" required value="${isEdit ? material.cantidad : 5}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Alerta Mínima</label>
                            <input type="number" id="mat-alerta" step="1" required value="${isEdit ? material.cantidad_minima_alerta : 2}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background-color: var(--color-moss-green-light); border: 1px solid var(--color-moss-green); border-radius: var(--radius-sm); padding: 12px; margin-top: 4px; box-shadow: var(--shadow-sm);">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 600; font-size: 12.5px; color: var(--color-moss-green);">Costo Total Compra ($)</label>
                            <input type="number" id="mat-costo-total" step="any" value="${isEdit ? (material.cantidad * material.costo_hoja_unidad).toFixed(2) : '42.50'}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label id="label-mat-costo" style="font-weight: 600; font-size: 12.5px; color: var(--color-moss-green);">Costo Unitario ($)</label>
                            <input type="number" id="mat-costo" step="any" required value="${isEdit ? material.costo_hoja_unidad : 8.50}" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Proveedor</label>
                            <input type="text" id="mat-proveedor" value="${isEdit && material.proveedor ? material.proveedor : ''}" placeholder="Ej. Madera Local" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Lote</label>
                            <input type="text" id="mat-lote" value="${isEdit && material.lote ? material.lote : ''}" placeholder="Ej. LOTE-01" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Foto URL</label>
                        <input type="url" id="mat-foto" value="${isEdit && material.foto_url ? material.foto_url : ''}" placeholder="https://..." style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Enlace de Compra</label>
                        <input type="url" id="mat-enlace" value="${isEdit && material.enlace_compra ? material.enlace_compra : ''}" placeholder="https://..." style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" id="btn-close-mat-modal" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1;">${isEdit ? 'Guardar Cambios' : 'Añadir Material'}</button>
                    </div>
                </form>
            </div>
        `;
        
        // Estilos CSS para el overlay del modal
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(62, 62, 62, 0.4)';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.zIndex = '1000';
        modal.style.display = 'block';

        // Escuchas
        document.getElementById('btn-close-mat-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Dynamic Form Labels Helper
        const updateFormLabels = (tipo) => {
            const isBaseMaterial = ['madera', 'acrilico', 'corcho', 'resina'].includes(tipo);
            
            const labelEspesor = document.getElementById('label-mat-espesor');
            const labelAncho = document.getElementById('label-mat-ancho');
            const labelAlto = document.getElementById('label-mat-alto');
            const labelCantidad = document.getElementById('label-mat-cantidad');
            const labelCosto = document.getElementById('label-mat-costo');
            
            if (isBaseMaterial) {
                if (labelEspesor) labelEspesor.innerText = "Espesor Plancha (in)";
                if (labelAncho) labelAncho.innerText = "Ancho Plancha (in)";
                if (labelAlto) labelAlto.innerText = "Alto Plancha (in)";
                if (labelCantidad) labelCantidad.innerText = "Cantidad (Planchas)";
                if (labelCosto) labelCosto.innerText = "Costo por Plancha ($)";
            } else {
                if (labelEspesor) labelEspesor.innerText = "Espesor (in, opcional)";
                if (labelAncho) labelAncho.innerText = "Ancho (in, opcional)";
                if (labelAlto) labelAlto.innerText = "Alto (in, opcional)";
                if (labelCantidad) labelCantidad.innerText = "Cantidad (Unidades)";
                if (labelCosto) labelCosto.innerText = "Costo Unitario ($)";
            }
        };

        const selectTipo = document.getElementById('mat-tipo');
        if (selectTipo) {
            selectTipo.addEventListener('change', (e) => {
                updateFormLabels(e.target.value);
            });
            updateFormLabels(selectTipo.value);
        }

        // Bidirectional Auto-Calculator Logic
        const cantInput = document.getElementById('mat-cantidad');
        const costoTotalInput = document.getElementById('mat-costo-total');
        const costoUnitInput = document.getElementById('mat-costo');

        if (cantInput && costoTotalInput && costoUnitInput) {
            const calculateFromTotal = () => {
                const cant = parseFloat(cantInput.value) || 0;
                const total = parseFloat(costoTotalInput.value) || 0;
                if (cant > 0 && total >= 0) {
                    costoUnitInput.value = (total / cant).toFixed(4);
                }
            };

            const calculateFromUnit = () => {
                const cant = parseFloat(cantInput.value) || 0;
                const unit = parseFloat(costoUnitInput.value) || 0;
                if (cant > 0 && unit >= 0) {
                    costoTotalInput.value = (unit * cant).toFixed(2);
                }
            };

            costoTotalInput.addEventListener('input', calculateFromTotal);
            cantInput.addEventListener('input', calculateFromUnit); // Al cambiar la cantidad, recalculamos el total de compra usando el precio unitario
            costoUnitInput.addEventListener('input', calculateFromUnit);
        }

        document.getElementById('material-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const matData = {
                nombre: document.getElementById('mat-nombre').value,
                tipo: document.getElementById('mat-tipo').value,
                espesor: parseFloat(document.getElementById('mat-espesor').value),
                tamano_ancho: parseFloat(document.getElementById('mat-ancho').value),
                tamano_alto: parseFloat(document.getElementById('mat-alto').value),
                cantidad: parseInt(document.getElementById('mat-cantidad').value, 10),
                cantidad_minima_alerta: parseInt(document.getElementById('mat-alerta').value, 10),
                costo_hoja_unidad: parseFloat(document.getElementById('mat-costo').value),
                proveedor: document.getElementById('mat-proveedor').value || null,
                fecha_compra: isEdit ? material.fecha_compra : new Date().toISOString().split('T')[0],
                lote: document.getElementById('mat-lote').value || null,
                foto_url: document.getElementById('mat-foto').value || null,
                enlace_compra: document.getElementById('mat-enlace').value || null
            };

            try {
                if (isEdit) {
                    await EvergreenAPI.updateMaterial(material.id, matData);
                } else {
                    await EvergreenAPI.createMaterial(matData);
                }
                modal.style.display = 'none';
                this.render('inventario-container');
            } catch (err) {
                alert("Error al procesar el material: " + err.message);
            }
        });
    },

    openRetazoModal() {
        const modal = document.getElementById('retazo-modal');

        if (this.materialesList.length === 0) {
            alert("Debes registrar al menos un material principal para poder añadir retazos.");
            return;
        }

        let materialOptions = '';
        this.materialesList.forEach(m => {
            materialOptions += `<option value="${m.id}">${m.nombre} (${m.espesor} in)</option>`;
        });

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 450px; width: 90%; margin: 100px auto; position: relative;">
                <h3 class="card-title">Registrar Retazo</h3>
                
                <form id="retazo-form" style="display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Material de Origen</label>
                        <select id="ret-material-id" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                            ${materialOptions}
                        </select>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Ancho (pulgadas)</label>
                            <input type="number" id="ret-ancho" required value="4" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Alto (pulgadas)</label>
                            <input type="number" id="ret-alto" required value="6" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Cantidad</label>
                            <input type="number" id="ret-cantidad" required value="1" min="1" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Ubicación Física</label>
                            <input type="text" id="ret-ubicacion" required placeholder="Ej. Caja Retazos Madera 1" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" id="btn-close-ret-modal" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Registrar Retazo</button>
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

        document.getElementById('btn-close-ret-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('retazo-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const retData = {
                material_id: parseInt(document.getElementById('ret-material-id').value),
                tamano_ancho: parseFloat(document.getElementById('ret-ancho').value),
                tamano_alto: parseFloat(document.getElementById('ret-alto').value),
                cantidad: parseInt(document.getElementById('ret-cantidad').value),
                ubicacion: document.getElementById('ret-ubicacion').value
            };

            try {
                await EvergreenAPI.createRetazo(retData);
                modal.style.display = 'none';
                this.render('inventario-container');
            } catch (err) {
                alert("Error al registrar retazo: " + err.message);
            }
        });
    },

    async uploadPhoto(materialId, inputElement) {
        if (!inputElement.files || inputElement.files.length === 0) return;
        const file = inputElement.files[0];
        try {
            await EvergreenAPI.uploadMaterialPhoto(materialId, file);
            alert('Foto del material subida con éxito.');
            this.render('inventario-container');
        } catch (error) {
            console.error('Error al subir la foto del material:', error);
            alert('Hubo un error al subir la foto del material.');
        }
    }
};
