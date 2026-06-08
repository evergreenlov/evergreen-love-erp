/**
 * Componente Biblioteca de Diseños y Ajustes Láser (Real)
 */
const DisenosComponent = {
    disenos: [],
    selectedDiseno: null, // Para ver o añadir ajustes láser en un modal

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando biblioteca de diseños y configuraciones láser...</p>
            </div>
        `;

        try {
            const res = await EvergreenAPI.getDisenos();
            this.disenos = res.data || [];

            let disenoCards = '';
            if (this.disenos.length === 0) {
                disenoCards = `
                    <div class="card" style="grid-column: 1 / -1; text-align: center; color: #8c8270; padding: 40px;">
                        <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 12px;"></i>
                        <p>No hay diseños registrados en la biblioteca de Evergreen Love.</p>
                        <p style="font-size: 13px; margin-top: 6px;">¡Haz clic en "Registrar Diseño" para cargar tu primera plantilla SVG/PDF!</p>
                    </div>
                `;
            } else {
                this.disenos.forEach(dis => {
                    const hasFile = !!dis.archivo_diseno;
                    const fileButton = hasFile
                        ? `<a href="/adjuntos/${dis.archivo_diseno}" target="_blank" class="btn btn-secondary" style="padding: 6px 10px; font-size: 12px;" title="Ver archivo SVG/PDF">
                                <i data-lucide="download" style="width: 14px; height: 14px;"></i> Descargar SVG
                           </a>`
                        : `<span style="font-size: 12px; color: #8c8270; font-style: italic;">Sin archivo adjunto</span>`;

                    disenoCards += `
                        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; gap: 12px; position: relative;">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <span class="badge" style="background-color: var(--color-moss-green-light); color: var(--color-moss-green); font-size: 10px; text-transform: uppercase;">
                                        ${dis.categoria}
                                    </span>
                                    <button class="btn-delete-diseno" data-id="${dis.id}" style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 0;" title="Eliminar diseño">
                                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                                    </button>
                                </div>
                                <h4 style="font-family: var(--font-serif); font-size: 20px; font-weight: 600; margin-top: 8px; color: var(--color-soft-black);">
                                    ${dis.nombre}
                                </h4>
                                <span style="font-size: 11px; color: #8c8270;">Creado: ${dis.fecha_creacion.split(" ")[0]}</span>
                            </div>
                            
                            <div style="border-top: 1px solid var(--color-gray-border); padding-top: 12px; margin-top: 6px; display: flex; flex-direction: column; gap: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    ${fileButton}
                                    <button class="btn btn-primary btn-view-settings" style="padding: 6px 12px; font-size: 12px; background-color: var(--color-olive-brown); border-color: var(--color-olive-brown);" data-id="${dis.id}">
                                        <i data-lucide="sliders"></i> Settings Láser
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            container.innerHTML = `
                <div class="card" style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <h3 class="card-title" style="margin: 0;">Biblioteca de Diseños y Settings Láser</h3>
                            <p style="color: #6c757d; font-size: 14px; margin-top: 4px;">Almacena tus plantillas de corte e indexa los parámetros recomendados de velocidad y potencia de máquina por tipo de material.</p>
                        </div>
                        <button class="btn btn-primary" id="btn-new-diseno">
                            <i data-lucide="plus"></i> Registrar Diseño
                        </button>
                    </div>
                </div>

                <!-- Rejilla de Tarjetas de Diseños -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;" id="disenos-grid">
                    ${disenoCards}
                </div>

                <!-- Modales Dinámicos -->
                <div id="diseno-modal" class="modal-overlay" style="display: none;"></div>
                <div id="settings-modal" class="modal-overlay" style="display: none;"></div>
            `;

            lucide.createIcons();
            this.setupListeners();

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

    setupListeners() {
        // Registrar Nuevo Diseño (Abrir Modal)
        const btnNew = document.getElementById('btn-new-diseno');
        if (btnNew) {
            btnNew.addEventListener('click', () => this.openDisenoModal());
        }

        // Borrar Diseño
        document.querySelectorAll('.btn-delete-diseno').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const disId = parseInt(btn.getAttribute('data-id'));
                if (confirm("¿Estás seguro de que deseas eliminar este diseño de la biblioteca? Se borrarán también sus configuraciones láser y archivos asociados.")) {
                    try {
                        await EvergreenAPI.deleteDiseno(disId);
                        this.render('disenos-container');
                    } catch (err) {
                        alert("Error al eliminar diseño: " + err.message);
                    }
                }
            });
        });

        // Ver Ajustes Láser (Abrir Modal)
        document.querySelectorAll('.btn-view-settings').forEach(btn => {
            btn.addEventListener('click', () => {
                const disId = parseInt(btn.getAttribute('data-id'));
                const dis = this.disenos.find(d => d.id === disId);
                if (dis) this.openSettingsModal(dis);
            });
        });
    },

    openDisenoModal() {
        const modal = document.getElementById('diseno-modal');

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 450px; width: 90%; margin: 100px auto; position: relative;">
                <h3 class="card-title">Registrar Diseño</h3>
                
                <form id="diseno-form" style="display: flex; flex-direction: column; gap: 14px;" enctype="multipart/form-data">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13.5px;">Nombre del Diseño</label>
                        <input type="text" id="dis-nombre" required placeholder="Ej. Garita de San Juan" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13.5px;">Categoría</label>
                        <select id="dis-categoria" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                            <option value="garitas">Garitas</option>
                            <option value="casitas Viejo San Juan">Casitas Viejo San Juan</option>
                            <option value="llaveros NFC">Llaveros NFC</option>
                            <option value="ornamentos">Ornamentos</option>
                            <option value="shadow box">Shadow Box</option>
                            <option value="portadas de libreta">Portadas de libreta</option>
                            <option value="productos personalizados">Productos personalizados</option>
                        </select>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13.5px;">Archivo de Corte (SVG, PDF, DXF, PNG)</label>
                        <input type="file" id="dis-file" accept=".svg,.pdf,.png,.jpg,.jpeg,.dxf" style="font-family: var(--font-primary); font-size: 13px;">
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" id="btn-close-dis-modal" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Registrar Diseño</button>
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

        document.getElementById('btn-close-dis-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('diseno-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData();
            formData.append("nombre", document.getElementById('dis-nombre').value.trim());
            formData.append("categoria", document.getElementById('dis-categoria').value);
            
            const fileInput = document.getElementById('dis-file');
            if (fileInput.files[0]) {
                formData.append("file", fileInput.files[0]);
            }

            try {
                await EvergreenAPI.createDiseno(formData);
                modal.style.display = 'none';
                this.render('disenos-container');
            } catch (err) {
                alert("Error al registrar diseño: " + err.message);
            }
        });
    },

    async openSettingsModal(diseno) {
        const modal = document.getElementById('settings-modal');
        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 650px; width: 90%; margin: 60px auto; position: relative; max-height: 85vh; overflow-y: auto;">
                <h3 class="card-title" style="color: var(--color-moss-green); font-family: var(--font-serif);">${diseno.nombre} - Ajustes del Láser</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px;">
                    <!-- Ajustes Existentes -->
                    <div style="border-right: 1px solid var(--color-gray-border); padding-right: 16px;">
                        <h4 style="font-size: 14.5px; font-weight: 600; margin-bottom: 12px; color: var(--color-soft-black);">Parámetros Guardados</h4>
                        <div id="settings-list-container" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="font-size: 13px; color: #8c8270; font-style: italic;">Cargando ajustes...</p>
                        </div>
                    </div>

                    <!-- Formulario para Añadir Ajuste -->
                    <div>
                        <h4 style="font-size: 14.5px; font-weight: 600; margin-bottom: 12px; color: var(--color-soft-black);">Añadir Parámetro Láser</h4>
                        <form id="setting-form" style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px;">
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <label style="font-size: 11.5px; font-weight: 500;">Material</label>
                                    <select id="set-material-tipo" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 12.5px;">
                                        <option value="madera">Madera (Basswood/Walnut)</option>
                                        <option value="acrilico">Acrílico</option>
                                        <option value="corcho">Corcho</option>
                                        <option value="resina">Resina</option>
                                    </select>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 3px;">
                                    <label style="font-size: 11.5px; font-weight: 500;">Espesor (in)</label>
                                    <input type="number" id="set-espesor" step="0.001" value="0.125" required style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 12.5px;">
                                </div>
                            </div>

                            <div style="background-color: var(--color-gray-light); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                                <strong style="font-size: 11.5px; color: var(--color-moss-green); display: block; margin-bottom: 6px;">Corte Láser</strong>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                                    <input type="number" id="set-vel-corte" placeholder="Vel (mm/s)" style="padding: 6px; font-size: 12px; border: 1px solid var(--color-gray-border); border-radius: var(--radius-sm);">
                                    <input type="number" id="set-pot-corte" placeholder="Pot %" style="padding: 6px; font-size: 12px; border: 1px solid var(--color-gray-border); border-radius: var(--radius-sm);">
                                    <input type="number" id="set-pas-corte" placeholder="Pasadas" value="1" style="padding: 6px; font-size: 12px; border: 1px solid var(--color-gray-border); border-radius: var(--radius-sm);">
                                </div>
                            </div>

                            <div style="background-color: var(--color-gray-light); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border);">
                                <strong style="font-size: 11.5px; color: var(--color-moss-green); display: block; margin-bottom: 6px;">Grabado Láser</strong>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                                    <input type="number" id="set-vel-grab" placeholder="Vel (mm/s)" style="padding: 6px; font-size: 12px; border: 1px solid var(--color-gray-border); border-radius: var(--radius-sm);">
                                    <input type="number" id="set-pot-grab" placeholder="Pot %" style="padding: 6px; font-size: 12px; border: 1px solid var(--color-gray-border); border-radius: var(--radius-sm);">
                                    <input type="number" id="set-pas-grab" placeholder="Pasadas" value="1" style="padding: 6px; font-size: 12px; border: 1px solid var(--color-gray-border); border-radius: var(--radius-sm);">
                                </div>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <label style="font-size: 11.5px; font-weight: 500;">Notas / Foco</label>
                                <textarea id="set-notas" placeholder="Foco láser a 4mm, lijar después..." style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 12px; min-height: 50px; resize: vertical;"></textarea>
                            </div>

                            <button type="submit" class="btn btn-primary" style="width: 100%; font-size: 13px; padding: 8px 12px;">Guardar Parámetro</button>
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 24px; border-top: 1px solid var(--color-gray-border); padding-top: 16px;">
                    <button class="btn btn-secondary" id="btn-close-settings-modal">Cerrar Ajustes</button>
                </div>
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

        // Escuchas del modal de ajustes
        document.getElementById('btn-close-settings-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Cargar la lista inicial de ajustes del láser
        await this.loadLaserSettingsList(diseno.id);

        // Envío del formulario de ajustes
        document.getElementById('setting-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const sData = {
                material_tipo: document.getElementById('set-material-tipo').value,
                espesor: parseFloat(document.getElementById('set-espesor').value),
                velocidad_corte: parseFloat(document.getElementById('set-vel-corte').value) || null,
                potencia_corte: parseFloat(document.getElementById('set-pot-corte').value) || null,
                pasadas_corte: parseInt(document.getElementById('set-pas-corte').value) || 1,
                velocidad_grabado: parseFloat(document.getElementById('set-vel-grab').value) || null,
                potencia_grabado: parseFloat(document.getElementById('set-pot-grab').value) || null,
                pasadas_grabado: parseInt(document.getElementById('set-pas-grab').value) || 1,
                tipo_trabajo: "ambos",
                notas: document.getElementById('set-notas').value.trim() || null
            };

            try {
                await EvergreenAPI.createLaserSetting(diseno.id, sData);
                // Limpiar form
                document.getElementById('setting-form').reset();
                // Recargar lista
                await this.loadLaserSettingsList(diseno.id);
            } catch (err) {
                alert("Error al registrar ajuste: " + err.message);
            }
        });
    },

    async loadLaserSettingsList(disenoId) {
        const listContainer = document.getElementById('settings-list-container');
        listContainer.innerHTML = `<p style="font-size: 13px; color: #8c8270; font-style: italic;">Actualizando...</p>`;

        try {
            const res = await EvergreenAPI.getLaserSettings(disenoId);
            const settings = res.data || [];

            if (settings.length === 0) {
                listContainer.innerHTML = `<p style="font-size: 13px; color: #8c8270; font-style: italic;">No hay ajustes guardados para este diseño.</p>`;
                return;
            }

            let html = '';
            settings.forEach(s => {
                html += `
                    <div style="background-color: var(--color-gray-light); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 13px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <div>
                            <strong style="text-transform: capitalize; color: var(--color-moss-green);">${s.material_tipo} (${s.espesor} in)</strong>
                            <div style="margin-top: 4px; font-size: 12px; display: flex; flex-direction: column; gap: 2px;">
                                ${s.velocidad_corte ? `<span><strong>Corte:</strong> Vel ${s.velocidad_corte} | Pot ${s.potencia_corte} | Pas ${s.pasadas_corte}</span>` : ''}
                                ${s.velocidad_grabado ? `<span><strong>Grabado:</strong> Vel ${s.velocidad_grabado} | Pot ${s.potencia_grabado} | Pas ${s.pasadas_grabado}</span>` : ''}
                                ${s.notas ? `<span style="color: #8c8270; font-style: italic; margin-top: 2px;">Nota: ${s.notas}</span>` : ''}
                            </div>
                        </div>
                        <button class="btn-delete-setting" data-id="${s.id}" style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 0;" title="Borrar parámetro">
                            <i data-lucide="x" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>
                `;
            });

            listContainer.innerHTML = html;
            lucide.createIcons();

            // Asignar escuchas de borrado a cada ajuste
            document.querySelectorAll('.btn-delete-setting').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const setId = parseInt(btn.getAttribute('data-id'));
                    try {
                        await EvergreenAPI.deleteLaserSetting(setId);
                        await this.loadLaserSettingsList(disenoId);
                    } catch (err) {
                        alert("Error al borrar ajuste: " + err.message);
                    }
                });
            });

        } catch (err) {
            listContainer.innerHTML = `<p style="font-size: 13px; color: var(--color-danger);">Error: ${err.message}</p>`;
        }
    }
};
