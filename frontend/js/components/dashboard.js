/**
 * Componente Dashboard - Evergreen Love
 */
const DashboardComponent = {
    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando información del taller...</p>
            </div>
        `;

        try {
            // Consultar contadores reales de la base de datos y materiales
            const [statusData, materialesData] = await Promise.all([
                EvergreenAPI.getDbStatus(),
                EvergreenAPI.getMateriales()
            ]);
            
            const counts = statusData.counts || {};
            const materiales = materialesData.data || [];

            // Identificar materiales con stock bajo
            const materialesAlerta = materiales.filter(m => m.cantidad <= m.cantidad_minima_alerta);

            let alertHtml = '';
            if (materialesAlerta.length > 0) {
                alertHtml = materialesAlerta.map(m => `
                    <div class="alert-card" style="margin-bottom: 12px;">
                        <i data-lucide="alert-triangle"></i>
                        <div>
                            <div class="alert-title">Stock Bajo: ${m.nombre}</div>
                            <div class="alert-desc">
                                Quedan solo <strong>${m.cantidad.toFixed(2)}</strong> unidades/planchas (Alerta fijada en: ${m.cantidad_minima_alerta} unidades). 
                                ${m.proveedor ? `Proveedor sugerido: ${m.proveedor}.` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                alertHtml = `
                    <div class="card" style="display: flex; align-items: center; gap: 12px; border-left: 4px solid var(--color-success); background-color: #F0FDF4; padding: 16px; margin-bottom: 24px; box-shadow: var(--shadow-sm);">
                        <i data-lucide="check-circle" style="color: var(--color-success); flex-shrink:0;"></i>
                        <div>
                            <span style="font-weight: 600; font-size: 14px; color: #15803D;">Inventario en Orden</span>
                            <p style="font-size: 13px; color: #166534; margin-top: 2px;">Todos los materiales se encuentran por encima de sus límites de alerta.</p>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <!-- Banner de Bienvenida con Logo de Marca -->
                <div class="card animate-fade-in" style="display: flex; align-items: center; gap: 24px; margin-bottom: 24px; background: linear-gradient(135deg, var(--color-moss-green-light), transparent); border: 1px solid var(--color-gray-border); padding: 20px;">
                    <div style="width: 90px; height: 90px; border-radius: 50%; overflow: hidden; border: 2px solid var(--color-terracotta); flex-shrink: 0; background: var(--color-white); box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: center;">
                        <img src="img/logo.jpg" alt="Evergreen Love" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div>
                        <h2 style="font-family: var(--font-serif); font-size: 26px; color: var(--color-moss-green); margin-bottom: 6px;">Evergreen Love</h2>
                        <p style="color: var(--color-soft-black); opacity: 0.85; font-size: 14.5px; line-height: 1.5; max-width: 800px;">Este es tu taller digital. Gestiona fácilmente tus planchas de madera y acrílico, optimiza tus costos usando el rendimiento por hoja y exporta directamente a Shopify con descripciones listas para vender.</p>
                    </div>
                </div>

                <!-- Panel de KPIs -->
                <div class="kpi-grid">
                    <div class="card kpi-card">
                        <div class="kpi-icon moss">
                            <i data-lucide="package"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Materiales</span>
                            <span class="kpi-value">${counts.materiales || 0}</span>
                        </div>
                    </div>
                    <div class="card kpi-card">
                        <div class="kpi-icon terracotta">
                            <i data-lucide="hammer"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Órdenes de Producción</span>
                            <span class="kpi-value">${counts.ordenes_produccion || 0}</span>
                        </div>
                    </div>
                    <div class="card kpi-card">
                        <div class="kpi-icon blue">
                            <i data-lucide="sparkles"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Diseños Activos</span>
                            <span class="kpi-value">${counts.disenos || 0}</span>
                        </div>
                    </div>
                    <div class="card kpi-card">
                        <div class="kpi-icon moss">
                            <i data-lucide="recycle"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Retazos</span>
                            <span class="kpi-value">${counts.retazos || 0}</span>
                        </div>
                    </div>
                </div>

                <!-- Alertas de Inventario Dinámicas -->
                <div id="dashboard-alerts-section" style="margin-bottom: 24px;">
                    ${alertHtml}
                </div>

                <!-- Secciones de Grid -->
                <div class="dashboard-grid">
                    <!-- Resumen del Taller -->
                    <div class="card">
                        <h3 class="card-title">Resumen de Actividades</h3>
                        <p style="color: #6c757d; margin-bottom: 20px; font-size: 14.5px;">Panel central de gestión de láser para la marca Evergreen Love. Todo listo para iniciar el turno.</p>
                        
                        <div class="table-container">
                            <table class="custom-table">
                                <thead>
                                    <tr>
                                        <th>Módulo</th>
                                        <th>Estado</th>
                                        <th>Registros</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Inventario de Materiales</td>
                                        <td><span class="badge badge-success">Activo</span></td>
                                        <td>${counts.materiales || 0} materiales en base de datos</td>
                                    </tr>
                                    <tr>
                                        <td>Órdenes Láser</td>
                                        <td><span class="badge badge-progress">En Corte</span></td>
                                        <td>${counts.ordenes_produccion || 0} órdenes registradas</td>
                                    </tr>
                                    <tr>
                                        <td>Biblioteca Diseños</td>
                                        <td><span class="badge badge-success">Sincronizado</span></td>
                                        <td>${counts.disenos || 0} archivos SVG cargados</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Panel de Información Rápida -->
                    <div class="card">
                        <h3 class="card-title">Guía de Uso Rápido</h3>
                        <ul style="display: flex; flex-direction: column; gap: 12px; font-size: 14px; line-height: 1.5;">
                            <li><strong style="color: var(--color-moss-green);">1. Inventario:</strong> Registra tus planchas de madera y acrílico.</li>
                            <li><strong style="color: var(--color-moss-green);">2. Diseños:</strong> Sube tus plantillas y guarda los settings del láser.</li>
                            <li><strong style="color: var(--color-moss-green);">3. Costos:</strong> Calcula el precio óptimo según el rendimiento de la hoja.</li>
                            <li><strong style="color: var(--color-moss-green);">4. Producción:</strong> Crea y cambia los estados de tus cortes y grabados.</li>
                        </ul>
                    </div>
                </div>
            `;
            
            // Re-inicializar iconos Lucide cargados dinámicamente
            lucide.createIcons();
            
        } catch (error) {
            console.error("Error al cargar dashboard:", error);
            container.innerHTML = `
                <div class="alert-card">
                    <i data-lucide="alert-octagon"></i>
                    <div>
                        <div class="alert-title">Error de Conexión</div>
                        <div class="alert-desc">No se pudo cargar la información del servidor. Verifique si el servicio backend está corriendo.</div>
                    </div>
                </div>
            `;
            lucide.createIcons();
        }
    }
};
