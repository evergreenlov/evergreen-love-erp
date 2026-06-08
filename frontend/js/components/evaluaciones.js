/**
 * Componente de Evaluación Visual (Calidad) - Evergreen Love
 */
const EvaluacionesComponent = {
    selectedOrderId: null,
    ordenes: [],
    fotosAsociadas: [],
    evaluacionActual: null,
    historialEvaluaciones: [],

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <style>
                .quality-grid {
                    display: grid;
                    grid-template-columns: 1.2fr 1fr;
                    gap: 24px;
                    margin-bottom: 32px;
                }
                @media (max-width: 1024px) {
                    .quality-grid {
                        grid-template-columns: 1fr;
                    }
                }
                
                /* Comparador de Antes vs Después */
                .slider-container {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .comparison-slider {
                    position: relative;
                    width: 100%;
                    height: 400px;
                    background-color: #EAE3D5;
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    border: 1px solid var(--color-gray-border);
                    user-select: none;
                }
                .comparison-slider .img {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-size: contain;
                    background-position: center;
                    background-repeat: no-repeat;
                }
                .comparison-slider .img-before {
                    z-index: 1;
                }
                .comparison-slider .img-after {
                    width: 50%;
                    z-index: 2;
                    border-right: 3px solid var(--color-terracotta);
                    box-shadow: 2px 0 10px rgba(0,0,0,0.15);
                }
                .comparison-slider input[type="range"] {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    cursor: ew-resize;
                    z-index: 10;
                    margin: 0;
                }
                .comparison-slider .slider-line-handle {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: 50%;
                    width: 3px;
                    background: var(--color-terracotta);
                    transform: translateX(-50%);
                    pointer-events: none;
                    z-index: 6;
                }
                .comparison-slider .slider-button-handle {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 36px;
                    height: 36px;
                    background: var(--color-terracotta);
                    color: var(--color-white);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                    z-index: 7;
                    box-shadow: var(--shadow-md);
                }
                
                /* Subida de Fotos Manual */
                .upload-placeholder {
                    border: 2px dashed var(--color-gray-border);
                    border-radius: var(--radius-md);
                    padding: 30px 20px;
                    text-align: center;
                    background-color: var(--color-gray-light);
                    cursor: pointer;
                    transition: border-color 0.2s, background-color 0.2s;
                }
                .upload-placeholder:hover {
                    border-color: var(--color-terracotta);
                    background-color: rgba(208, 151, 134, 0.05);
                }
                .upload-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-top: 10px;
                }
                @media (max-width: 500px) {
                    .upload-grid {
                        grid-template-columns: 1fr;
                    }
                }
                
                .toast-alert {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    padding: 16px 24px;
                    border-radius: var(--radius-md);
                    color: white;
                    z-index: 9999;
                    box-shadow: var(--shadow-lg);
                    display: none;
                    animation: slideUp 0.3s ease;
                }
                @keyframes slideUp {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                .photo-badge {
                    position: absolute;
                    top: 12px;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    z-index: 5;
                    color: var(--color-white);
                }
                .badge-before {
                    left: 12px;
                    background-color: rgba(62, 62, 62, 0.75);
                }
                .badge-after {
                    right: 12px;
                    background-color: rgba(95, 90, 48, 0.85);
                }
                
                /* Lista de auditorías */
                .audits-table {
                    margin-top: 24px;
                }
            </style>

            <div class="quality-grid">
                <!-- PANEL IZQUIERDO: Comparador Visual y Fotos -->
                <div class="card slider-container">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <h3 class="card-title" style="margin-bottom: 4px;">Comparador Visual Antes vs Después</h3>
                            <p style="color: #6c757d; font-size: 13px;">Arrastra la barra central para comparar el estado en bruto con el acabado final.</p>
                        </div>
                        <button id="btn-scan-photos" class="btn btn-secondary" style="font-size: 12.5px; padding: 6px 12px;">
                            <i data-lucide="scan"></i> Escanear Carpeta
                        </button>
                    </div>

                    <!-- Contenedor del Comparador Visual Dinámico -->
                    <div id="comparison-view-box">
                        <!-- Se poblará dinámicamente con JS -->
                        <div class="loading-state">
                            <div class="spinner"></div>
                            <p>Seleccione una orden para ver las imágenes...</p>
                        </div>
                    </div>

                    <!-- Subida de Fotos Manual (Formulario Oculto/Backup) -->
                    <div id="manual-upload-section" style="display: none; border-top: 1px solid var(--color-gray-border); padding-top: 16px;">
                        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--color-soft-black);">Cargar Fotos para esta Orden</h4>
                        <div class="upload-grid">
                            <div class="upload-placeholder" onclick="document.getElementById('input-foto-antes').click()">
                                <i data-lucide="image-up" style="margin: 0 auto 8px; color: var(--color-terracotta); width: 24px; height: 24px;"></i>
                                <span style="font-size: 12.5px; font-weight: 500; display: block;">Foto ANTES (En Bruto)</span>
                                <span style="font-size: 10px; color: #8c8c8c; display: block; margin-top: 4px;">Corte láser inicial</span>
                                <input type="file" id="input-foto-antes" accept="image/*" style="display: none;">
                            </div>
                            <div class="upload-placeholder" onclick="document.getElementById('input-foto-final').click()">
                                <i data-lucide="image-play" style="margin: 0 auto 8px; color: var(--color-moss-green); width: 24px; height: 24px;"></i>
                                <span style="font-size: 12.5px; font-weight: 500; display: block;">Foto DESPUÉS (Terminado)</span>
                                <span style="font-size: 10px; color: #8c8c8c; display: block; margin-top: 4px;">Lijado, limpio y armado</span>
                                <input type="file" id="input-foto-final" accept="image/*" style="display: none;">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PANEL DERECHO: Formulario de Auditoría y Aprobación -->
                <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
                    <h3 class="card-title" style="margin-bottom: 4px;">Auditoría de Control de Calidad</h3>
                    <p style="color: #6c757d; font-size: 13.5px;">Evalúa el acabado final y registra cualquier desviación en el proceso.</p>

                    <!-- Selector de Orden -->
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-weight: 600; font-size: 13.5px; color: var(--color-soft-black);">Orden a Evaluar</label>
                        <select id="select-orden-evaluar" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); background-color: var(--color-white); cursor: pointer;">
                            <option value="">Seleccione una orden...</option>
                        </select>
                    </div>

                    <!-- Detalles del Producto de la Orden Seleccionada -->
                    <div id="orden-detalles-box" style="display: none; padding: 12px; background-color: var(--color-gray-light); border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 13.5px;">
                        <!-- Se poblará con JS -->
                    </div>

                    <!-- Checklist de Problemas Detectados -->
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                        <span style="font-weight: 600; font-size: 13.5px; color: var(--color-soft-black);">Incidencias Detectadas:</span>
                        <div id="incidencias-checklist" style="display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; padding-left: 4px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" name="incidencia" value="Quemado excesivo / hollín"> Quemado excesivo / hollín
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" name="incidencia" value="Corte incompleto (requiere repaso)"> Corte incompleto (requiere repaso)
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" name="incidencia" value="Mala alineación o descentrado"> Mala alineación o descentrado
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" name="incidencia" value="Material doblado o con curvas"> Material doblado o con curvas
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" name="incidencia" value="Grabado débil o poco profundo"> Grabado débil o poco profundo
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" name="incidencia" value="Fallas de ensamblaje (herrajes/borlas)"> Fallas de ensamblaje (herrajes/borlas)
                            </label>
                        </div>
                    </div>

                    <!-- Comentarios y Corrección Aplicada -->
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                        <label style="font-weight: 600; font-size: 13.5px; color: var(--color-soft-black);">Medidas Correctoras / Notas</label>
                        <textarea id="audit-correcciones" placeholder="Ej. Se requirió lijar un poco más el hollín. Ajustar potencia láser +5% en la configuración del Basswood para el siguiente lote." style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); min-height: 80px; resize: vertical;"></textarea>
                    </div>

                    <!-- Botones de Acción -->
                    <div style="display: flex; gap: 12px; margin-top: 8px;">
                        <button id="btn-aprobar-calidad" class="btn btn-primary" style="flex: 1; background-color: var(--color-success); border-color: var(--color-success);" disabled>
                            <i data-lucide="check-circle-2"></i> Aprobar Pieza
                        </button>
                        <button id="btn-rechazar-calidad" class="btn btn-secondary" style="flex: 1; color: var(--color-danger); border-color: var(--color-danger); background-color: #FEF2F2;" disabled>
                            <i data-lucide="x-circle"></i> Rechazar
                        </button>
                    </div>
                </div>
            </div>

            <!-- HISTORIAL DE AUDITORÍAS -->
            <div class="card audits-table">
                <h3 class="card-title">Historial de Evaluaciones y Auditoría Visual</h3>
                <p style="color: #6c757d; font-size: 13.5px; margin-bottom: 16px;">Registro continuo de piezas auditadas en el taller.</p>
                <div class="table-container">
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th>Orden</th>
                                <th>Producto</th>
                                <th>Cliente</th>
                                <th>Problemas Detectados</th>
                                <th>Medida Correctora</th>
                                <th>Evaluación</th>
                                <th>Fecha</th>
                            </tr>
                        </thead>
                        <tbody id="historial-evaluaciones-body">
                            <tr>
                                <td colspan="7" style="text-align: center; color: #8c8c8c; padding: 30px;">Cargando historial de auditorías...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Toast Container -->
            <div id="toast-message" class="toast-alert"></div>
        `;

        lucide.createIcons();
        
        // Inicializar listeners y datos
        await this.loadData();
        this.setupEventListeners();
    },

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast-message');
        toast.innerText = message;
        toast.style.display = 'block';
        if (type === 'success') {
            toast.style.backgroundColor = 'var(--color-success)';
        } else if (type === 'error') {
            toast.style.backgroundColor = 'var(--color-danger)';
        } else {
            toast.style.backgroundColor = 'var(--color-moss-green)';
        }
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 4000);
    },

    async loadData() {
        try {
            // Cargar Órdenes
            const resOrdenes = await EvergreenAPI.getOrdenes();
            if (resOrdenes.status === 'success') {
                this.ordenes = resOrdenes.data;
                this.populateOrdenSelect();
            }

            // Cargar Historial
            await this.loadHistorialEvaluaciones();
        } catch (error) {
            console.error("Error al inicializar evaluaciones:", error);
            this.showToast("No se pudo conectar con el servidor", "error");
        }
    },

    async loadHistorialEvaluaciones() {
        try {
            const resHistorial = await EvergreenAPI.getEvaluaciones();
            if (resHistorial.status === 'success') {
                this.historialEvaluaciones = resHistorial.data;
                this.renderHistorial();
            }
        } catch (error) {
            console.error("Error al cargar historial:", error);
        }
    },

    populateOrdenSelect() {
        const select = document.getElementById('select-orden-evaluar');
        select.innerHTML = '<option value="">Seleccione una orden...</option>';
        
        // Filtrar o mostrar todas las órdenes
        this.ordenes.forEach(o => {
            const option = document.createElement('option');
            option.value = o.id;
            option.textContent = `${o.codigo_orden} - ${o.producto_nombre || 'Producto Personalizado'} (${o.cliente})`;
            select.appendChild(option);
        });
    },

    setupEventListeners() {
        const select = document.getElementById('select-orden-evaluar');
        const btnScan = document.getElementById('btn-scan-photos');
        const btnAprobar = document.getElementById('btn-aprobar-calidad');
        const btnRechazar = document.getElementById('btn-rechazar-calidad');
        
        // Al seleccionar una orden
        select.addEventListener('change', async (e) => {
            const id = e.target.value;
            if (id) {
                this.selectedOrderId = parseInt(id);
                btnAprobar.disabled = false;
                btnRechazar.disabled = false;
                await this.loadOrdenDetails();
            } else {
                this.selectedOrderId = null;
                btnAprobar.disabled = true;
                btnRechazar.disabled = true;
                document.getElementById('orden-detalles-box').style.display = 'none';
                document.getElementById('manual-upload-section').style.display = 'none';
                document.getElementById('comparison-view-box').innerHTML = `
                    <div class="loading-state">
                        <p>Seleccione una orden para ver las imágenes...</p>
                    </div>
                `;
                this.resetForm();
            }
        });

        // Escanear Fotos
        btnScan.addEventListener('click', async () => {
            btnScan.disabled = true;
            btnScan.innerHTML = '<span class="spinner" style="width:14px; height:14px; margin-bottom:0; display:inline-block; vertical-align:middle; border-width:2px;"></span> Escaneando...';
            try {
                const res = await EvergreenAPI.escanearFotos();
                if (res.status === 'success') {
                    this.showToast(`Escaneo completo: ${res.scanned_files_count} archivos escaneados, ${res.new_indexed_count} nuevas asociaciones.`);
                    if (this.selectedOrderId) {
                        await this.loadOrdenDetails();
                    }
                    await this.loadHistorialEvaluaciones();
                }
            } catch (error) {
                console.error("Error al escanear:", error);
                this.showToast("Error al escanear la carpeta", "error");
            } finally {
                btnScan.disabled = false;
                btnScan.innerHTML = '<i data-lucide="scan"></i> Escanear Carpeta';
                lucide.createIcons();
            }
        });

        // Subir Fotos Manualmente (Antes y Después)
        const inputAntes = document.getElementById('input-foto-antes');
        const inputFinal = document.getElementById('input-foto-final');

        inputAntes.addEventListener('change', async (e) => {
            if (e.target.files.length > 0 && this.selectedOrderId) {
                await this.uploadFotoManual(e.target.files[0], 'antes');
            }
        });

        inputFinal.addEventListener('change', async (e) => {
            if (e.target.files.length > 0 && this.selectedOrderId) {
                await this.uploadFotoManual(e.target.files[0], 'final');
            }
        });

        // Aprobar Calidad
        btnAprobar.addEventListener('click', () => this.submitAudit('Aprobado'));
        
        // Rechazar Calidad
        btnRechazar.addEventListener('click', () => this.submitAudit('Rechazado'));
    },

    async uploadFotoManual(file, tipoFoto) {
        this.showToast(`Subiendo foto ${tipoFoto.toUpperCase()}...`, 'info');
        try {
            const res = await EvergreenAPI.subirFoto(file, this.selectedOrderId, null, tipoFoto);
            if (res.status === 'success') {
                this.showToast(`Foto ${tipoFoto} subida correctamente`);
                await this.loadOrdenDetails();
            }
        } catch (error) {
            console.error("Error en subida:", error);
            this.showToast("Error al subir el archivo", 'error');
        }
    },

    async loadOrdenDetails() {
        const order = this.ordenes.find(o => o.id === this.selectedOrderId);
        if (!order) return;

        // Mostrar detalles textualmente
        const detailsBox = document.getElementById('orden-detalles-box');
        detailsBox.style.display = 'block';
        detailsBox.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div><strong>Código de Orden:</strong> ${order.codigo_orden}</div>
                <div><strong>Cliente:</strong> ${order.cliente}</div>
                <div><strong>Producto:</strong> ${order.producto_nombre || 'N/A'} (SKU: ${order.producto_sku || 'N/A'})</div>
                <div><strong>Cantidad:</strong> ${order.cantidad} piezas</div>
                <div><strong>Estado de Producción:</strong> <span class="badge ${this.getBadgeClass(order.estado)}">${order.estado}</span></div>
                <div><strong>Fecha de Entrega:</strong> ${order.fecha_entrega || 'No definida'}</div>
            </div>
        `;

        // Mostrar sección de subida manual
        document.getElementById('manual-upload-section').style.display = 'block';

        // Cargar fotos asociadas
        try {
            const resFotos = await EvergreenAPI.getFotosOrden(this.selectedOrderId);
            if (resFotos.status === 'success') {
                this.fotosAsociadas = resFotos.data;
                this.renderSlider();
            }
        } catch (error) {
            console.error("Error al cargar fotos:", error);
        }

        // Cargar evaluación previa si existe
        try {
            const resEval = await EvergreenAPI.getEvaluacionOrden(this.selectedOrderId);
            if (resEval.status === 'success' && resEval.data) {
                this.evaluacionActual = resEval.data;
                this.populateForm(resEval.data);
            } else {
                this.evaluacionActual = null;
                this.resetForm();
            }
        } catch (error) {
            console.error("Error al cargar evaluación previa:", error);
        }
    },

    renderSlider() {
        const container = document.getElementById('comparison-view-box');
        
        // Buscar foto de tipo 'antes' y 'final'
        const fotoAntes = this.fotosAsociadas.find(f => f.tipo_foto === 'antes');
        const fotoFinal = this.fotosAsociadas.find(f => f.tipo_foto === 'final');

        if (!fotoAntes && !fotoFinal) {
            container.innerHTML = `
                <div class="loading-state" style="padding: 60px 20px;">
                    <i data-lucide="image-off" style="width: 48px; height: 48px; opacity: 0.3; margin-bottom: 12px;"></i>
                    <p style="font-weight: 500; color: var(--color-soft-black);">Sin imágenes cargadas para esta orden</p>
                    <p style="font-size: 12px; max-width: 320px; margin-top: 6px; text-align: center;">Sube archivos usando los paneles de abajo o coloca imágenes llamadas <strong>${this.getCurrentOrderCode()}_antes.jpg</strong> y <strong>${this.getCurrentOrderCode()}_final.jpg</strong> en <code>data/fotos_import</code> y haz clic en Escanear.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        // Caso donde solo se tiene una de las dos fotos
        if (!fotoAntes || !fotoFinal) {
            const fotoExistente = fotoAntes || fotoFinal;
            const tipo = fotoAntes ? 'ANTES (En Bruto)' : 'DESPUÉS (Terminado)';
            const color = fotoAntes ? '#D6CDBB' : 'var(--color-moss-green)';
            
            container.innerHTML = `
                <div style="position: relative; width: 100%; height: 380px; background-color: #EAE3D5; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--color-gray-border); display: flex; align-items: center; justify-content: center;">
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: url('${getFullImageUrl('/fotos_import/' + fotoExistente.nombre_archivo)}'); background-size: contain; background-position: center; background-repeat: no-repeat;"></div>
                    <div style="position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background-color: rgba(62,62,62,0.85); color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                        Foto Única Detectada: ${tipo}
                    </div>
                </div>
                <p style="font-size: 12px; color: #8c8270; text-align: center; margin-top: 10px;">Para utilizar el deslizador interactivo, suba también la foto restante.</p>
            `;
            return;
        }
 
        // Render del comparador visual con el deslizador
        container.innerHTML = `
            <div class="comparison-slider">
                <!-- Imagen ANTES (Fondo / Base) -->
                <div class="img img-before" style="background-image: url('${getFullImageUrl('/fotos_import/' + fotoAntes.nombre_archivo)}');">
                    <span class="photo-badge badge-before">ANTES (Grabado Láser Rústico)</span>
                </div>
                
                <!-- Imagen DESPUÉS (Superpuesta / Recortada) -->
                <div class="img img-after" style="background-image: url('${getFullImageUrl('/fotos_import/' + fotoFinal.nombre_archivo)}');">
                    <span class="photo-badge badge-after">DESPUÉS (Lijado / Acabado)</span>
                </div>
                
                <!-- Barra y botón de control de deslizamiento -->
                <div class="slider-line-handle"></div>
                <div class="slider-button-handle">⇄</div>
                
                <!-- Rango interactivo para el control -->
                <input type="range" class="slider-bar" min="0" max="100" value="50">
            </div>
        `;

        // Lógica interactiva del slider
        const sliderInput = container.querySelector('.slider-bar');
        const imgAfter = container.querySelector('.img-after');
        const line = container.querySelector('.slider-line-handle');
        const btn = container.querySelector('.slider-button-handle');

        sliderInput.addEventListener('input', (e) => {
            const val = e.target.value;
            imgAfter.style.width = val + '%';
            line.style.left = val + '%';
            btn.style.left = val + '%';
        });
    },

    getCurrentOrderCode() {
        const order = this.ordenes.find(o => o.id === this.selectedOrderId);
        return order ? order.codigo_orden : "EVL-XXXX";
    },

    getBadgeClass(estado) {
        switch (estado) {
            case 'Pendiente': return 'badge-pending';
            case 'En diseño': return 'badge-pending';
            case 'Cortando': return 'badge-progress';
            case 'Grabando': return 'badge-progress';
            case 'Pintura/Acabado': return 'badge-progress';
            case 'Listo': return 'badge-success';
            case 'Entregado': return 'badge-success';
            default: return 'badge-pending';
        }
    },

    populateForm(data) {
        // Desmarcar todos los checkbox primero
        const checkboxes = document.querySelectorAll('input[name="incidencia"]');
        checkboxes.forEach(cb => cb.checked = false);

        // Marcar los correspondientes
        if (data.problemas) {
            try {
                const problemasList = JSON.parse(data.problemas);
                problemsList.forEach(p => {
                    const cb = document.querySelector(`input[name="incidencia"][value="${p}"]`);
                    if (cb) cb.checked = true;
                });
            } catch (e) {
                // Si está guardado como texto plano separado por comas
                const problemasList = data.problemas.split(',');
                problemsList.forEach(p => {
                    const val = p.trim();
                    const cb = document.querySelector(`input[name="incidencia"][value="${val}"]`);
                    if (cb) cb.checked = true;
                });
            }
        }

        // Rellenar correcciones
        document.getElementById('audit-correcciones').value = data.correcciones_aplicadas || '';
        
        // Estilizar botones según estado guardado
        const btnAprobar = document.getElementById('btn-aprobar-calidad');
        const btnRechazar = document.getElementById('btn-rechazar-calidad');
        
        if (data.estado_aprobacion === 'Aprobado') {
            btnAprobar.style.boxShadow = '0 0 12px rgba(77, 124, 15, 0.4)';
            btnRechazar.style.boxShadow = 'none';
        } else {
            btnRechazar.style.boxShadow = '0 0 12px rgba(153, 27, 27, 0.4)';
            btnAprobar.style.boxShadow = 'none';
        }
    },

    resetForm() {
        const checkboxes = document.querySelectorAll('input[name="incidencia"]');
        checkboxes.forEach(cb => cb.checked = false);
        document.getElementById('audit-correcciones').value = '';
        
        const btnAprobar = document.getElementById('btn-aprobar-calidad');
        const btnRechazar = document.getElementById('btn-rechazar-calidad');
        btnAprobar.style.boxShadow = 'none';
        btnRechazar.style.boxShadow = 'none';
    },

    async submitAudit(estado) {
        if (!this.selectedOrderId) return;

        // Recopilar incidencias seleccionadas
        const cbChecked = document.querySelectorAll('input[name="incidencia"]:checked');
        const problemas = Array.from(cbChecked).map(cb => cb.value);
        const correcciones = document.getElementById('audit-correcciones').value;

        // Buscar nombres de las fotos
        const fotoAntes = this.fotosAsociadas.find(f => f.tipo_foto === 'antes');
        const fotoFinal = this.fotosAsociadas.find(f => f.tipo_foto === 'final');

        const auditData = {
            orden_id: this.selectedOrderId,
            foto_antes: fotoAntes ? `/fotos_import/${fotoAntes.nombre_archivo}` : null,
            foto_despues: fotoFinal ? `/fotos_import/${fotoFinal.nombre_archivo}` : null,
            problemas: JSON.stringify(problemas),
            correcciones_aplicadas: correcciones,
            estado_aprobacion: estado
        };

        try {
            const res = await EvergreenAPI.saveEvaluacion(auditData);
            if (res.status === 'success') {
                this.showToast(res.message);
                
                // Si la pieza fue aprobada, podemos avanzar automáticamente la orden a 'Listo' en Kanban
                if (estado === 'Aprobado') {
                    // Solo actualizamos si la orden no está ya en 'Listo' o 'Entregado'
                    const currentOrder = this.ordenes.find(o => o.id === this.selectedOrderId);
                    if (currentOrder && currentOrder.estado !== 'Listo' && currentOrder.estado !== 'Entregado') {
                        await EvergreenAPI.updateOrdenEstado(this.selectedOrderId, 'Listo');
                        // Actualizar localmente el estado
                        currentOrder.estado = 'Listo';
                        this.populateOrdenSelect();
                        // Seleccionar de nuevo la orden para recargar detalles
                        document.getElementById('select-orden-evaluar').value = this.selectedOrderId;
                        await this.loadOrdenDetails();
                    }
                }
                
                await this.loadHistorialEvaluaciones();
            }
        } catch (error) {
            console.error("Error al guardar auditoría:", error);
            this.showToast("No se pudo guardar la evaluación de calidad", "error");
        }
    },

    renderHistorial() {
        const tbody = document.getElementById('historial-evaluaciones-body');
        if (this.historialEvaluaciones.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #8c8c8c; padding: 24px;">No hay auditorías registradas en este taller.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        this.historialEvaluaciones.forEach(ev => {
            // parsear problemas
            let probs = [];
            try {
                probs = JSON.parse(ev.problemas || '[]');
            } catch (e) {
                probs = ev.problemas ? ev.problemas.split(',') : [];
            }
            
            const probsHtml = probs.length > 0 
                ? probs.map(p => `<span class="badge badge-danger" style="margin: 2px 0; font-size:10px; text-transform:none;">${p}</span>`).join('<br>')
                : '<span style="color:var(--color-success); font-weight:500;">✓ Ninguna</span>';

            const badgeEstado = ev.estado_aprobacion === 'Aprobado' 
                ? '<span class="badge badge-success" style="background-color:#4D7C0F; color:white;">APROBADO</span>' 
                : '<span class="badge badge-danger" style="background-color:var(--color-danger); color:white;">RECHAZADO</span>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight: 600; color: var(--color-moss-green);">${ev.codigo_orden}</td>
                <td>${ev.producto_nombre || 'Producto Personalizado'}</td>
                <td>${ev.cliente}</td>
                <td>${probsHtml}</td>
                <td style="font-size: 13px; font-style: italic; max-width: 250px; white-space: normal;">${ev.correcciones_aplicadas || '<span style="color:#b2a895;">Ninguna</span>'}</td>
                <td>${badgeEstado}</td>
                <td style="font-size:13px; color:#6c757d;">${ev.fecha_evaluacion}</td>
            `;
            tbody.appendChild(row);
        });
    }
};
