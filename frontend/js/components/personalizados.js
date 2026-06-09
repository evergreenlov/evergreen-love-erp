/**
 * Componente de Productos Personalizables - Evergreen Love
 */
const PersonalizadosComponent = {
    productos: [],
    materiales: [],
    selectedProducto: null,

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando productos personalizables y materiales del taller...</p>
            </div>
        `;

        try {
            // Cargar datos paralelos
            const [resProd, resMat] = await Promise.all([
                EvergreenAPI.getProductos(),
                EvergreenAPI.getMateriales()
            ]);

            // Filtrar productos personalizables (personalizado === 1)
            this.productos = (resProd.data || []).filter(p => Number(p.personalizado) === 1);
            this.materiales = (resMat.data || []).filter(m => m.tipo === 'madera' || m.tipo === 'acrilico' || m.tipo === 'corcho');

            let cardsHtml = '';
            if (this.productos.length === 0) {
                cardsHtml = `
                    <div class="card" style="grid-column: 1 / -1; text-align: center; color: #8c8270; padding: 40px; background: white; border-radius: var(--radius-lg);">
                        <i data-lucide="sparkles" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 12px; color: var(--color-moss-green);"></i>
                        <p style="font-weight:600; font-size:16px;">No hay productos personalizables configurados.</p>
                        <p style="font-size: 13.5px; margin-top: 6px; color:#8c8270;">Puedes marcar productos como "Personalizados" en la pestaña de <strong>Calculadora de Costos</strong>.</p>
                    </div>
                `;
            } else {
                this.productos.forEach(p => {
                    const fotoImg = p.foto_ruta 
                        ? `<div style="width: 100%; height: 180px; background: linear-gradient(135deg, #fdfbf7 0%, #f5f0e6 100%); border-bottom: 1px solid rgba(237, 230, 216, 0.5); overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center;">
                            <img src="${getFullImageUrl(p.foto_ruta)}" alt="${p.nombre}" style="width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);">
                           </div>` 
                        : `<div style="width: 100%; height: 180px; background: linear-gradient(135deg, #fbfbfb 0%, #f0f0f0 100%); display: flex; align-items: center; justify-content: center; color: #ac9f8a; font-size: 12.5px; font-style: italic; border-bottom: 1px solid rgba(237, 230, 216, 0.5); gap: 6px;"><i data-lucide="image" style="width:18px; height:18px; opacity:0.6;"></i>Sin imagen de muestra</div>`;

                    cardsHtml += `
                        <div class="card custom-prod-card" style="display: flex; flex-direction: column; padding: 0; background: white; border-radius: var(--radius-lg); overflow: hidden; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: var(--shadow-sm); border: 1px solid rgba(237, 230, 216, 0.6); position: relative; height: 395px;">
                            <div style="position: absolute; top: 12px; left: 12px; z-index: 2;">
                                <span class="badge" style="background: linear-gradient(135deg, var(--color-terracotta), #e27c4c); color: white; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px; box-shadow: 0 4px 10px rgba(198, 95, 47, 0.25);">
                                    <i data-lucide="sparkles" style="width:10px;height:10px;"></i> Personalizable
                                </span>
                            </div>
                            ${fotoImg}
                            <div style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between; flex: 1; box-sizing: border-box;">
                                <div style="margin-bottom: 8px;">
                                    <h4 style="font-family: var(--font-primary); font-size: 15px; font-weight: 600; color: var(--color-moss-green); margin: 0 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.nombre}">${p.nombre}</h4>
                                    <span style="font-size: 11px; color: #8c8270; display: block; margin-bottom: 6px;">SKU: ${p.sku}</span>
                                    <p style="font-size: 12.5px; color: #736b5c; margin: 0; line-height: 1.4; font-style: italic; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; height: 35px;">
                                        ${p.shopify_descripcion || 'Permite grabado de nombres, fechas y logotipos en materiales seleccionados.'}
                                    </p>
                                </div>
                                <div style="margin-top: auto;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                                        <span style="font-size: 11px; color:#8c8270; font-weight:500;">Precio Base Cotización:</span>
                                        <span style="font-weight: 700; color: var(--color-moss-green); font-size: 15px;">$${(p.precio_final || p.precio_sugerido || 0.0).toFixed(2)}</span>
                                    </div>
                                    <button class="btn btn-primary btn-config-custom" data-id="${p.id}" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background-color: var(--color-moss-green); border-color: var(--color-moss-green); font-weight: 600; font-size: 13px; padding: 10px; border-radius: 8px;">
                                        <i data-lucide="sliders"></i> Diseñar & Cotizar
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            container.innerHTML = `
                <div class="card" style="margin-bottom: 24px;">
                    <h3 class="card-title">Estudio de Productos Personalizables</h3>
                    <p style="color: #6c757d; font-size: 14.5px; margin: 0;">
                        Simula grabados personalizados, dimensiona y cotiza productos en tiempo real basándote en los costos de los materiales actuales en el taller. Genera órdenes de diseño instantáneas o cotizaciones directamente para enviar por WhatsApp.
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(285px, 1fr)); gap: 20px;">
                    ${cardsHtml}
                </div>

                <!-- Modal de Simulación y Cotización -->
                <div id="simulador-modal" class="modal-overlay" style="display: none;"></div>
            `;

            lucide.createIcons();
            this.setupListeners();

        } catch (err) {
            console.error("Error al cargar personalizables:", err);
            container.innerHTML = `
                <div class="alert-card">
                    <i data-lucide="alert-octagon"></i>
                    <div>
                        <div class="alert-title">Error al cargar la pestaña</div>
                        <div class="alert-desc">${err.message}</div>
                    </div>
                </div>
            `;
            lucide.createIcons();
        }
    },

    setupListeners() {
        // Escuchar botones de Diseñar & Cotizar
        document.querySelectorAll('.btn-config-custom').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-id'));
                const prod = this.productos.find(p => p.id === id);
                if (prod) this.openSimuladorModal(prod);
            });
        });

        // Hover animations para custom-prod-card
        document.querySelectorAll('.custom-prod-card').forEach(card => {
            const img = card.querySelector('img');
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-6px)';
                card.style.boxShadow = '0 12px 30px rgba(95, 120, 48, 0.12)';
                card.style.borderColor = 'var(--color-moss-green)';
                if (img) img.style.transform = 'scale(1.08)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = 'var(--shadow-sm)';
                card.style.borderColor = 'rgba(237, 230, 216, 0.6)';
                if (img) img.style.transform = 'scale(1)';
            });
        });
    },

    openSimuladorModal(p) {
        this.selectedProducto = p;
        const modal = document.getElementById('simulador-modal');

        // Materiales disponibles para el selector
        let matOptions = '';
        this.materiales.forEach(m => {
            matOptions += `<option value="${m.id}" data-costo="${m.costo_hoja_unidad}" data-w="${m.ancho_hoja}" data-h="${m.alto_hoja}">${m.nombre} ($${m.costo_hoja_unidad.toFixed(2)} / ud)</option>`;
        });

        // Si no hay materiales cargados, proveer defaults
        if (!matOptions) {
            matOptions = `
                <option value="999" data-costo="12.00" data-w="12" data-h="20">Madera Maple 1/8" (Falso/Default)</option>
                <option value="998" data-costo="15.00" data-w="12" data-h="20">Acrílico Clear 1/8" (Falso/Default)</option>
            `;
        }

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 850px; width: 95%; margin: 40px auto; display: grid; grid-template-columns: 1.1fr 1fr; gap: 24px; position: relative; max-height: 90vh; overflow-y: auto; text-align: left; padding: 24px; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); background: white;">
                
                <!-- Columna Izquierda: Previsualización de Grabado Interactiva -->
                <div style="display: flex; flex-direction: column; gap: 14px; background-color: var(--color-gray-light); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--color-gray-border); justify-content: center; align-items: center; min-height: 320px;">
                    <h4 style="font-family: var(--font-serif); color: var(--color-moss-green); margin: 0; font-size: 15px; font-weight:600; width:100%; text-align:center;">Canvas de Previsualización</h4>
                    
                    <!-- Simulación Visual de la Tarjeta del Producto y Grabado -->
                    <div id="canvas-preview-box" style="width: 100%; max-width: 320px; height: 260px; border-radius: var(--radius-md); background-color: #d7ccc8; border: 2px dashed var(--color-olive-brown); position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: inset 0 0 20px rgba(0,0,0,0.1); transition: all 0.3s ease;">
                        ${p.foto_ruta ? `<img src="${getFullImageUrl(p.foto_ruta)}" style="width: 100%; height: 100%; object-fit: contain; opacity: 0.7; position: absolute; z-index: 1;">` : ''}
                        
                        <!-- Texto Grabado Superpuesto -->
                        <div id="engraved-text-layer" style="position: absolute; z-index: 2; font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: #4e342e; text-shadow: 1px 1px 1px rgba(255,255,255,0.4); text-align: center; max-width: 80%; word-wrap: break-word; pointer-events: none; transition: all 0.2s;">
                            [Tu Grabado Aquí]
                        </div>
                    </div>

                    <div style="font-size: 11px; color: #8c8270; text-align: center;">
                        *Simulación estética aproximada en el material seleccionado.
                    </div>
                </div>

                <!-- Columna Derecha: Configuración y Precios -->
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h3 class="card-title" style="margin: 0; color: var(--color-moss-green); font-family: var(--font-serif);">${p.nombre}</h3>
                            <span style="font-size: 12px; color: #8c8270;">Cotización Inteligente de Taller</span>
                        </div>
                        <button type="button" class="btn-close-sim" style="background:none; border:none; color:var(--color-danger); cursor:pointer; font-size:20px; font-weight:bold; padding:0; width:28px; height:28px; line-height:28px; text-align:center;">&times;</button>
                    </div>

                    <form id="sim-form" style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 12.5px; font-weight: 600; color: var(--color-soft-black);">Texto Personalizado a Grabar</label>
                            <input type="text" id="sim-texto" placeholder="Escribe el nombre, fecha o frase..." style="padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;" value="">
                        </div>

                        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-size: 12.5px; font-weight: 600;">Estilo de Letra (Font)</label>
                                <select id="sim-font" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 13px;">
                                    <option value="'Playfair Display', serif">Clásica / Caligráfica</option>
                                    <option value="'Outfit', sans-serif">Moderna / Geométrica</option>
                                    <option value="'Georgia', serif">Elegante / Editorial</option>
                                    <option value="'Courier New', monospace">Retro / Mecanografiado</option>
                                </select>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-size: 12.5px; font-weight: 600;">Material Base</label>
                                <select id="sim-material" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 13px;">
                                    ${matOptions}
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-size: 12.5px; font-weight: 600;">Ancho (in)</label>
                                <input type="number" id="sim-ancho" step="0.1" value="${p.ancho || 3.0}" min="1" max="24" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 13px;">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-size: 12.5px; font-weight: 600;">Alto (in)</label>
                                <input type="number" id="sim-alto" step="0.1" value="${p.alto || 3.0}" min="1" max="24" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 13px;">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-size: 12.5px; font-weight: 600;">Cantidad</label>
                                <input type="number" id="sim-cantidad" value="1" min="1" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-size: 13px;">
                            </div>
                        </div>

                        <!-- Tarjeta de Resultados e Instant Price Estimate -->
                        <div style="background-color: var(--color-moss-green-light); padding: 14px; border-radius: var(--radius-md); border: 1px solid rgba(95, 120, 48, 0.2); margin-top: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-weight: 600; font-size: 13px; color: var(--color-moss-green);">Estimado Unitario Sugerido:</span>
                                <strong id="sim-precio-estimado" style="font-size: 20px; color: var(--color-moss-green);">$0.00</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size:12px; color:#5f7830; opacity:0.9;">
                                <span>Costo producción estimado:</span>
                                <span id="sim-costo-produccion">$0.00</span>
                            </div>
                            <div id="sim-desglose-resumen" style="font-size: 10px; color: #8c8270; margin-top: 6px; border-top: 1px solid rgba(95, 120, 48, 0.15); padding-top: 6px; line-height: 1.4;">
                                Calculando desglose de costos...
                            </div>
                        </div>

                        <!-- Botones de Acción -->
                        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
                            <button type="button" id="btn-sim-whatsapp" class="btn btn-secondary" style="border-color: #25d366; color: #25d366; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; background: white; padding: 10px;">
                                <i data-lucide="message-square"></i> Solicitar por WhatsApp
                            </button>
                            <button type="submit" id="btn-sim-guardar-orden" class="btn btn-primary" style="background-color: var(--color-moss-green); border-color: var(--color-moss-green); display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px;">
                                <i data-lucide="cpu"></i> Registrar en Producción
                            </button>
                        </div>
                    </form>
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

        lucide.createIcons();

        // Elementos interactivos
        const inputTexto = document.getElementById('sim-texto');
        const selectFont = document.getElementById('sim-font');
        const selectMat = document.getElementById('sim-material');
        const inputAncho = document.getElementById('sim-ancho');
        const inputAlto = document.getElementById('sim-alto');
        const inputCant = document.getElementById('sim-cantidad');
        
        const textLayer = document.getElementById('engraved-text-layer');
        const previewBox = document.getElementById('canvas-preview-box');

        const updateSimulation = () => {
            const texto = inputTexto.value.trim();
            const font = selectFont.value;
            const matOpt = selectMat.options[selectMat.selectedIndex];
            
            // 1. Simulación visual
            if (texto) {
                textLayer.innerText = texto;
            } else {
                textLayer.innerText = '[Tu Grabado Aquí]';
            }
            textLayer.style.fontFamily = font;

            // Cambiar color de fondo del canvas según tipo de material
            const matNombre = matOpt.text.toLowerCase();
            if (matNombre.includes('acrilico') || matNombre.includes('clear')) {
                previewBox.style.backgroundColor = 'rgba(230, 242, 255, 0.65)';
                previewBox.style.borderColor = '#90caf9';
                textLayer.style.color = '#37474f';
            } else if (matNombre.includes('corcho')) {
                previewBox.style.backgroundColor = '#bcaaa4';
                previewBox.style.borderColor = '#8d6e63';
                textLayer.style.color = '#3e2723';
            } else { // Madera
                previewBox.style.backgroundColor = '#d7ccc8';
                previewBox.style.borderColor = '#8d6e63';
                textLayer.style.color = '#4e342e';
            }

            // 2. Cálculo dinámico del precio
            const costoMatHoja = parseFloat(matOpt.getAttribute('data-costo')) || 12.00;
            const wHoja = parseFloat(matOpt.getAttribute('data-w')) || 12;
            const hHoja = parseFloat(matOpt.getAttribute('data-h')) || 20;

            const wProd = parseFloat(inputAncho.value) || 2.0;
            const hProd = parseFloat(inputAlto.value) || 2.0;
            const cantidad = parseInt(inputCant.value) || 1;

            const areaHoja = wHoja * hHoja;
            const areaProd = wProd * hProd;
            const areaConDesperdicio = areaProd * 1.15; // 15% desperdicio
            const costoMaterialEstimado = (areaConDesperdicio / areaHoja) * costoMatHoja;

            // Estimación de Tiempos de Láser
            // Perímetro aproximado de corte (velocidad promedio 15mm/s -> 1.5 in/s)
            const perimetroPulgadas = (wProd * 2 + hProd * 2);
            const tiempoCorteMin = perimetroPulgadas / 1.5 / 60; // en minutos

            // Grabado: proporcional al número de letras a grabar
            const cantLetras = texto.length || 10;
            const tiempoGrabadoMin = cantLetras * 0.25; // 15s por letra

            const totalLaserMin = (tiempoCorteMin + tiempoGrabadoMin);
            const costoLaserEstimado = totalLaserMin * 0.25; // tarifa de $0.25/min de láser

            const manoObraBase = 5.00; // tarifa de taller por preparación
            const costoTotalProduccion = (costoMaterialEstimado + costoLaserEstimado + manoObraBase);

            // Reutilizar el margen del producto original o 60% por defecto
            const margen = p.margen_ganancia || 0.60;
            const factorMargen = 1 - margen;
            const precioSugeridoUnitario = factorMargen > 0 ? (costoTotalProduccion / factorMargen) : costoTotalProduccion;
            
            const totalSugerido = precioSugeridoUnitario * cantidad;

            // Actualizar interfaz
            document.getElementById('sim-precio-estimado').innerText = `$${precioSugeridoUnitario.toFixed(2)}`;
            document.getElementById('sim-costo-produccion').innerText = `$${(costoTotalProduccion * cantidad).toFixed(2)}`;
            
            document.getElementById('sim-desglose-resumen').innerHTML = `
                Material: $${costoMaterialEstimado.toFixed(2)} | 
                Láser estimado: ${totalLaserMin.toFixed(1)} min ($${costoLaserEstimado.toFixed(2)}) | 
                Mano de Obra: $${manoObraBase.toFixed(2)} | 
                Margen Ganancia: ${(margen * 100).toFixed(0)}%
            `;

            return {
                precioUnitario: precioSugeridoUnitario,
                costoProduccion: costoTotalProduccion,
                texto,
                font,
                materialNombre: matOpt.text.split(" (")[0],
                materialId: parseInt(matOpt.value),
                ancho: wProd,
                alto: hProd,
                cantidad
            };
        };

        // Event listeners
        inputTexto.addEventListener('input', updateSimulation);
        selectFont.addEventListener('change', updateSimulation);
        selectMat.addEventListener('change', updateSimulation);
        inputAncho.addEventListener('input', updateSimulation);
        inputAlto.addEventListener('input', updateSimulation);
        inputCant.addEventListener('input', updateSimulation);

        // Inicializar
        const currentData = updateSimulation();

        // Botón WhatsApp
        document.getElementById('btn-sim-whatsapp').addEventListener('click', () => {
            const data = updateSimulation();
            const textToEncode = `Hola Evergreen Love, me interesa cotizar este producto personalizado: *${p.nombre}* (SKU: ${p.sku}).

*Especificaciones:*
- Material: ${data.materialNombre}
- Medidas: ${data.ancho} x ${data.alto} in
- Texto a grabar: "${data.texto || 'Ninguno'}"
- Tipografía: ${selectFont.options[selectFont.selectedIndex].text}
- Cantidad requerida: ${data.cantidad} ud(s)

*Precio unitario simulado:* $${data.precioUnitario.toFixed(2)}
*Total estimado:* $${(data.precioUnitario * data.cantidad).toFixed(2)}

¿Podrían confirmarme si es posible realizarlo en el taller y los métodos de pago?`;
            
            const link = `https://wa.me/17879601431?text=${encodeURIComponent(textToEncode)}`;
            window.open(link, '_blank');
        });

        // Cerrar modal
        const closeModalFunc = () => {
            modal.style.display = 'none';
            this.selectedProducto = null;
        };
        modal.querySelector('.btn-close-sim').addEventListener('click', closeModalFunc);

        // Guardar Orden
        document.getElementById('sim-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = updateSimulation();

            const randomCode = Math.floor(1000 + Math.random() * 9000);
            const orderCode = `EVG-PERS-${p.sku}-${randomCode}`;
            
            const orderData = {
                codigo_orden: orderCode,
                cliente: `[COTIZACIÓN PERSONALIZADA] Cliente: Público General. Teléfono / Datos: WhatsApp. Especificaciones: Texto Grabado: "${data.texto}", Font: ${data.font}, Material: ${data.materialNombre}, Medidas: ${data.ancho}x${data.alto} in.`,
                producto_id: p.id,
                cantidad: data.cantidad,
                estado: "En diseño",
                fecha_entrega: null
            };

            try {
                await EvergreenAPI.createOrden(orderData);
                alert(`¡Cotización registrada con éxito! Se ha creado una orden en producción con estado "En diseño" bajo el código: ${orderCode}`);
                closeModalFunc();
            } catch (err) {
                alert("Error al registrar la orden personalizada: " + err.message);
            }
        });
    }
};
