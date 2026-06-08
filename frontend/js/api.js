/**
 * Cliente de API para conectar el Frontend con el Backend de FastAPI
 */

const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') || window.location.protocol === 'file:'
    ? 'http://127.0.0.1:8000/api'
    : '/api';

function getFullImageUrl(path) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
    const base = API_BASE_URL.replace('/api', '');
    if (base === '') {
        return path;
    }
    return base + (path.startsWith('/') ? path : '/' + path);
}

// ==========================================
// SISTEMA OFFLINE EMULADO CON LOCALSTORAGE
// ==========================================
(function() {
    let offlineMode = false;
    let initialized = false;

    const SEED_DATA = {
        materiales: [
            {id: 1, nombre: "Basswood (Tilo) 1/8\"", tipo: "madera", espesor: 0.125, tamano_ancho: 12.0, tamano_alto: 20.0, cantidad: 15, cantidad_minima_alerta: 2, costo_hoja_unidad: 7.50, proveedor: "WoodCraft Co.", fecha_compra: "2026-05-15", lote: "LOTE-BASS-1220", enlace_compra: "", foto_url: ""},
            {id: 2, nombre: "Walnut Finished (Nogal) 1/8\"", tipo: "madera", espesor: 0.125, tamano_ancho: 12.0, tamano_alto: 20.0, cantidad: 10, cantidad_minima_alerta: 2, costo_hoja_unidad: 11.00, proveedor: "WoodCraft Co.", fecha_compra: "2026-05-20", lote: "LOTE-WAL-FIN", enlace_compra: "", foto_url: ""},
            {id: 3, nombre: "Acrílico Transparente 1/8\"", tipo: "acrilico", espesor: 0.125, tamano_ancho: 12.0, tamano_alto: 12.0, cantidad: 8, cantidad_minima_alerta: 2, costo_hoja_unidad: 12.50, proveedor: "Plásticos PR", fecha_compra: "2026-05-22", lote: "LOTE-ACR-1212", enlace_compra: "", foto_url: ""}
        ],
        retazos: [
            {id: 1, material_id: 1, tamano_ancho: 4.0, tamano_alto: 10.0, cantidad: 2, ubicacion: "Estante A"},
            {id: 2, material_id: 2, tamano_ancho: 6.0, tamano_alto: 8.0, cantidad: 1, ubicacion: "Estante B"}
        ],
        disenos: [
            {id: 1, nombre: "Garita del Viejo San Juan", categoria: "garitas", archivo_diseno: "garita_clasica.svg", fecha_creacion: "2026-06-01"},
            {id: 2, nombre: "Casitas Típicas San Juan", categoria: "casitas Viejo San Juan", archivo_diseno: "casitas_viejo_sanjuan.svg", fecha_creacion: "2026-06-01"},
            {id: 3, nombre: "Llavero NFC Redondo", categoria: "llaveros NFC", archivo_diseno: "llavero_nfc_redondo.svg", fecha_creacion: "2026-06-01"}
        ],
        laser_settings: [
            {id: 1, diseno_id: 1, material_tipo: "madera", espesor: 0.125, velocidad_corte: 18.0, potencia_corte: 90.0, pasadas_corte: 1, velocidad_grabado: 80.0, potencia_grabado: 35.0, pasadas_grabado: 1, tipo_trabajo: "ambos", notas: "Walnut/Basswood 1/8\""},
            {id: 2, diseno_id: 3, material_tipo: "madera", espesor: 0.125, velocidad_corte: 20.0, potencia_corte: 90.0, pasadas_corte: 1, velocidad_grabado: 90.0, potencia_grabado: 40.0, pasadas_grabado: 1, tipo_trabajo: "ambos", notas: "Espacio NFC"}
        ],
        productos: [
            {id: 1, sku: "SKU-GAR-LLAV-01", nombre: "Llavero de Garita Walnut", diseno_id: 1, ancho: 1.5, alto: 2.0, tiempo_corte: 1.5, tiempo_grabado: 1.0, costo_maquina: 0.50, costo_mano_obra: 1.50, costo_total: 2.45, margen_ganancia: 0.60, precio_sugerido: 6.13, precio_final: 6.50, personalizado: 0, shopify_titulo: "Llavero de Madera de Nogal", shopify_descripcion: "Hermoso llavero de Nogal Acabado.", shopify_tags: "llavero, madera, nogal, garita, artesanal", shopify_alt_text: "Llavero nogal", foto_ruta: ""},
            {id: 2, sku: "SKU-NFC-LLAV-03", nombre: "Llavero NFC Basswood Inteligente", diseno_id: 3, ancho: 2.0, alto: 2.0, tiempo_corte: 1.2, tiempo_grabado: 0.8, costo_maquina: 0.40, costo_mano_obra: 2.00, costo_total: 3.90, margen_ganancia: 0.65, precio_sugerido: 11.14, precio_final: 12.00, personalizado: 1, shopify_titulo: "Llavero NFC de Madera", shopify_descripcion: "Llavero inteligente NFC.", shopify_tags: "nfc, llavero inteligente, tilo, tecnologia, personalizado", shopify_alt_text: "Llavero NFC", foto_ruta: ""}
        ],
        componentes_producto: [
            {id: 1, producto_id: 1, material_id: 2, cantidad_usada: 3.0, costo_calculado: 0.15},
            {id: 2, producto_id: 1, material_id: 5, cantidad_usada: 1.0, costo_calculado: 0.12},
            {id: 3, producto_id: 1, material_id: 6, cantidad_usada: 1.0, costo_calculado: 0.15},
            {id: 4, producto_id: 2, material_id: 1, cantidad_usada: 4.0, costo_calculado: 0.13}
        ],
        ordenes: [
            {id: 1, codigo_orden: "EVL-1001", cliente: "Sofía Méndez", producto_id: 1, cantidad: 5, estado: "Pendiente", material_descontado: 0, completado: 0, fecha_creacion: "2026-06-01 10:30:00", fecha_entrega: "2026-06-05"},
            {id: 2, codigo_orden: "EVL-1002", cliente: "Restaurante El Morro", producto_id: 2, cantidad: 20, estado: "Cortando", material_descontado: 1, completado: 0, fecha_creacion: "2026-06-01 11:15:00", fecha_entrega: "2026-06-08"}
        ],
        clientes: [
            {id: 1, nombre: "Restaurante El Morro", contacto: "Carlos Rivera (Gerente)", email: "carlos@elmorro.com", telefono: "787-555-1234", notas: "Cliente B2B recurrente para llaveros NFC de mesa.", fecha_registro: "2026-06-01"},
            {id: 2, nombre: "Hotel Convento", contacto: "María Delgado (Eventos)", email: "maria@convento.com", telefono: "787-555-5678", notas: "Interesados en grabado de posavasos y llaveros premium.", fecha_registro: "2026-06-02"},
            {id: 3, nombre: "Cliente Público", contacto: "Público General", email: "", telefono: "", notas: "Cliente genérico", fecha_registro: "2026-06-02"}
        ],
        catalogo_cliente: [
            {id: 1, cliente_id: 1, producto_id: 2, precio_especial: 10.00, notas: "Precio pactado"}
        ],
        facturas: [
            {id: 1, numero_factura: "EV-2026-0001", cliente_id: 1, fecha_emision: "2026-06-01", fecha_vencimiento: "2026-06-15", fecha_pago: "2026-06-01", metodo_pago: "ATH Movil", subtotal: 200.00, ivu_estatal: 21.00, ivu_municipal: 2.00, total: 223.00, notas: "Primer lote de 20 llaveros NFC", estado: "Pagada", monto_pagado: 223.00, notificado: 1},
            {id: 2, numero_factura: "EV-2026-0002", cliente_id: 2, fecha_emision: "2026-06-02", fecha_vencimiento: "2026-06-16", fecha_pago: null, metodo_pago: null, subtotal: 130.00, ivu_estatal: 13.65, ivu_municipal: 1.30, total: 144.95, notas: "Posavasos y llaveros de muestra", estado: "Pendiente", monto_pagado: 0, notificado: 0}
        ],
        items_factura: [
            {id: 1, factura_id: 1, producto_id: 2, nombre_producto: "Llavero NFC Basswood Inteligente", cantidad: 20, precio_unitario: 10.00, total: 200.00},
            {id: 2, factura_id: 2, producto_id: 1, nombre_producto: "Llavero de Garita Walnut", cantidad: 20, precio_unitario: 6.50, total: 130.00}
        ],
        carrito: []
    };

    function initDB() {
        if (initialized) return;
        for (const [key, val] of Object.entries(SEED_DATA)) {
            const lsKey = `ev_db_${key}`;
            if (!localStorage.getItem(lsKey)) {
                localStorage.setItem(lsKey, JSON.stringify(val));
            }
        }
        initialized = true;
    }

    function getTable(name) {
        initDB();
        return JSON.parse(localStorage.getItem(`ev_db_${name}`) || '[]');
    }

    function saveTable(name, data) {
        localStorage.setItem(`ev_db_${name}`, JSON.stringify(data));
    }

    function mockResponse(data, status = 200) {
        return Promise.resolve({
            ok: status >= 200 && status < 300,
            status: status,
            json: () => Promise.resolve(data),
            text: () => Promise.resolve(JSON.stringify(data))
        });
    }

    // Interceptar llamadas HTTP locales
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        const urlStr = typeof url === 'string' ? url : url.url;
        
        // Solo interceptar peticiones destinadas al backend de Evergreen
        if (!urlStr.includes('/api/')) {
            return originalFetch.apply(this, arguments);
        }

        // Si el estado de conexión no ha sido determinado, probarlo
        if (offlineMode === false) {
            try {
                // Hacer una llamada rápida con timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1000);
                const check = await originalFetch(`${API_BASE_URL}/health`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!check.ok) throw new Error();
            } catch (e) {
                console.warn("⚠️ Backend no disponible. Activando modo emulación offline en localStorage.");
                offlineMode = true;
                initDB();
            }
        }

        if (!offlineMode) {
            // Conexión activa, proceder normalmente
            return originalFetch.apply(this, arguments);
        }

        // RUTEADOR DE API OFFLINE (MOCK DB EN LOCALSTORAGE)
        const parsedUrl = new URL(urlStr, window.location.origin);
        const path = parsedUrl.pathname.replace(API_BASE_URL.replace(window.location.origin, ''), '').replace(/^\/api/, '');
        const method = (options.method || 'GET').toUpperCase();
        
        console.log(`[Offline API] Interceptado: ${method} ${path}`);

        try {
            // 1. Diagnóstico
            if (path === '/health') {
                return mockResponse({ status: "healthy", service: "Evergreen Love API (Offline)", database: "connected (localStorage)" });
            }
            if (path === '/db_status') {
                const counts = {};
                for (const key of Object.keys(SEED_DATA)) {
                    counts[key] = getTable(key).length;
                }
                return mockResponse({ status: "success", counts });
            }

            // 2. Materiales
            if (path === '/materiales' && method === 'GET') {
                return mockResponse(getTable('materiales'));
            }
            if (path === '/materiales' && method === 'POST') {
                const data = JSON.parse(options.body);
                const table = getTable('materiales');
                const nextId = table.reduce((max, m) => m.id > max ? m.id : max, 0) + 1;
                const newMaterial = { id: nextId, ...data };
                table.push(newMaterial);
                saveTable('materiales', table);
                return mockResponse(newMaterial);
            }
            if (path.startsWith('/materiales/') && !path.endsWith('/foto')) {
                const id = parseInt(path.split('/')[2]);
                const table = getTable('materiales');
                const idx = table.findIndex(m => m.id === id);

                if (method === 'PUT') {
                    if (idx === -1) return mockResponse({ detail: "Material no encontrado" }, 404);
                    const data = JSON.parse(options.body);
                    table[idx] = { ...table[idx], ...data };
                    saveTable('materiales', table);
                    return mockResponse(table[idx]);
                }
                if (method === 'DELETE') {
                    if (idx === -1) return mockResponse({ detail: "Material no encontrado" }, 404);
                    table.splice(idx, 1);
                    saveTable('materiales', table);
                    return mockResponse({ status: "success", message: "Material eliminado" });
                }
            }
            if (path.startsWith('/materiales/') && path.endsWith('/foto')) {
                return mockResponse({ status: "success", foto_url: "" });
            }

            // 3. Retazos
            if (path === '/retazos' && method === 'GET') {
                return mockResponse(getTable('retazos'));
            }
            if (path === '/retazos' && method === 'POST') {
                const data = JSON.parse(options.body);
                const table = getTable('retazos');
                const nextId = table.reduce((max, r) => r.id > max ? r.id : max, 0) + 1;
                const newRetazo = { id: nextId, ...data };
                table.push(newRetazo);
                saveTable('retazos', table);
                return mockResponse(newRetazo);
            }
            if (path.startsWith('/retazos/') && method === 'DELETE') {
                const id = parseInt(path.split('/')[2]);
                const table = getTable('retazos');
                const idx = table.findIndex(r => r.id === id);
                if (idx === -1) return mockResponse({ detail: "Retazo no encontrado" }, 404);
                table.splice(idx, 1);
                saveTable('retazos', table);
                return mockResponse({ status: "success", message: "Retazo eliminado" });
            }

            // 4. Productos
            if (path === '/productos' && method === 'GET') {
                return mockResponse(getTable('productos'));
            }
            if (path === '/productos' && method === 'POST') {
                const data = JSON.parse(options.body);
                const table = getTable('productos');
                const nextId = table.reduce((max, p) => p.id > max ? p.id : max, 0) + 1;
                const newProduct = { id: nextId, ...data };
                table.push(newProduct);
                saveTable('productos', table);
                return mockResponse(newProduct);
            }
            if (path.startsWith('/productos/')) {
                const parts = path.split('/');
                const id = parseInt(parts[2]);
                const table = getTable('productos');
                const idx = table.findIndex(p => p.id === id);

                if (parts[3] === 'descripcion' && method === 'PUT') {
                    if (idx === -1) return mockResponse({ detail: "Producto no encontrado" }, 404);
                    const data = JSON.parse(options.body);
                    table[idx].shopify_descripcion = data.descripcion;
                    saveTable('productos', table);
                    return mockResponse(table[idx]);
                }
                if (method === 'PUT') {
                    if (idx === -1) return mockResponse({ detail: "Producto no encontrado" }, 404);
                    const data = JSON.parse(options.body);
                    table[idx] = { ...table[idx], ...data };
                    saveTable('productos', table);
                    return mockResponse(table[idx]);
                }
                if (method === 'DELETE') {
                    if (idx === -1) return mockResponse({ detail: "Producto no encontrado" }, 404);
                    table.splice(idx, 1);
                    saveTable('productos', table);
                    return mockResponse({ status: "success", message: "Producto eliminado" });
                }
            }

            // 5. Órdenes
            if (path === '/ordenes' && method === 'GET') {
                return mockResponse(getTable('ordenes'));
            }
            if (path === '/ordenes' && method === 'POST') {
                const data = JSON.parse(options.body);
                const table = getTable('ordenes');
                const nextId = table.reduce((max, o) => o.id > max ? o.id : max, 0) + 1;
                const newOrder = { id: nextId, completado: 0, material_descontado: 0, fecha_creacion: new Date().toISOString(), ...data };
                table.push(newOrder);
                saveTable('ordenes', table);
                return mockResponse(newOrder);
            }
            if (path.startsWith('/ordenes/')) {
                const parts = path.split('/');
                const id = parseInt(parts[2]);
                const table = getTable('ordenes');
                const idx = table.findIndex(o => o.id === id);
                if (idx === -1) return mockResponse({ detail: "Orden no encontrada" }, 404);

                if (parts[3] === 'completado' && method === 'PUT') {
                    const completed = parsedUrl.searchParams.get('completado') === '1' || parsedUrl.searchParams.get('completado') === 'true';
                    table[idx].completado = completed ? 1 : 0;
                    saveTable('ordenes', table);
                    return mockResponse(table[idx]);
                }
                if (method === 'PUT') {
                    const estado = parsedUrl.searchParams.get('estado');
                    if (estado) {
                        table[idx].estado = estado;
                    }
                    saveTable('ordenes', table);
                    return mockResponse(table[idx]);
                }
                if (method === 'DELETE') {
                    table.splice(idx, 1);
                    saveTable('ordenes', table);
                    return mockResponse({ status: "success", message: "Orden eliminada" });
                }
            }

            // 6. Diseños
            if (path === '/disenos' && method === 'GET') {
                return mockResponse(getTable('disenos'));
            }
            if (path === '/disenos' && method === 'POST') {
                const table = getTable('disenos');
                const nextId = table.reduce((max, d) => d.id > max ? d.id : max, 0) + 1;
                const newDesign = { id: nextId, nombre: "Nuevo Diseño Subido", categoria: "productos personalizados", archivo_diseno: "archivo.svg", fecha_creacion: new Date().toISOString() };
                table.push(newDesign);
                saveTable('disenos', table);
                return mockResponse(newDesign);
            }
            if (path.startsWith('/disenos/')) {
                const parts = path.split('/');
                const id = parseInt(parts[2]);
                
                if (parts[3] === 'settings') {
                    const settings = getTable('laser_settings');
                    if (method === 'GET') {
                        return mockResponse(settings.filter(s => s.diseno_id === id));
                    }
                    if (method === 'POST') {
                        const data = JSON.parse(options.body);
                        const nextId = settings.reduce((max, s) => s.id > max ? s.id : max, 0) + 1;
                        const newSetting = { id: nextId, diseno_id: id, ...data };
                        settings.push(newSetting);
                        saveTable('laser_settings', settings);
                        return mockResponse(newSetting);
                    }
                }
                if (method === 'DELETE') {
                    const table = getTable('disenos');
                    const idx = table.findIndex(d => d.id === id);
                    if (idx === -1) return mockResponse({ detail: "Diseño no encontrado" }, 404);
                    table.splice(idx, 1);
                    saveTable('disenos', table);
                    return mockResponse({ status: "success", message: "Diseño eliminado" });
                }
            }

            // 7. Clientes B2B
            if (path === '/clientes' && method === 'GET') {
                return mockResponse(getTable('clientes'));
            }
            if (path === '/clientes' && method === 'POST') {
                const data = JSON.parse(options.body);
                const table = getTable('clientes');
                const nextId = table.reduce((max, c) => c.id > max ? c.id : max, 0) + 1;
                const newClient = { id: nextId, fecha_registro: new Date().toISOString(), ...data };
                table.push(newClient);
                saveTable('clientes', table);
                return mockResponse(newClient);
            }
            if (path.startsWith('/clientes/')) {
                const parts = path.split('/');
                const id = parseInt(parts[2]);
                if (parts[3] === 'catalogo') {
                    const catalog = getTable('catalogo_cliente');
                    return mockResponse(catalog.filter(c => c.cliente_id === id));
                }
                if (method === 'DELETE') {
                    const table = getTable('clientes');
                    const idx = table.findIndex(c => c.id === id);
                    if (idx === -1) return mockResponse({ detail: "Cliente no encontrado" }, 404);
                    table.splice(idx, 1);
                    saveTable('clientes', table);
                    return mockResponse({ status: "success", message: "Cliente eliminado" });
                }
            }
            if (path === '/clientes/catalogo' && method === 'POST') {
                const data = JSON.parse(options.body);
                const catalog = getTable('catalogo_cliente');
                const nextId = catalog.reduce((max, c) => c.id > max ? c.id : max, 0) + 1;
                const newItem = { id: nextId, ...data };
                catalog.push(newItem);
                saveTable('catalogo_cliente', catalog);
                return mockResponse(newItem);
            }
            if (path.startsWith('/clientes/catalogo/') && method === 'DELETE') {
                const id = parseInt(path.split('/')[3]);
                const catalog = getTable('catalogo_cliente');
                const idx = catalog.findIndex(c => c.id === id);
                if (idx === -1) return mockResponse({ detail: "Relación no encontrada" }, 404);
                catalog.splice(idx, 1);
                saveTable('catalogo_cliente', catalog);
                return mockResponse({ status: "success", message: "Retirado del catálogo" });
            }

            // 8. Facturas
            if (path === '/facturas' && method === 'GET') {
                return mockResponse(getTable('facturas'));
            }
            if (path === '/facturas/nuevas' && method === 'GET') {
                const invoices = getTable('facturas');
                return mockResponse(invoices.filter(f => f.notificado === 0));
            }
            if (path === '/facturas/marcar-leidas' && method === 'POST') {
                const { ids } = JSON.parse(options.body);
                const invoices = getTable('facturas');
                invoices.forEach(f => {
                    if (ids.includes(f.id)) f.notificado = 1;
                });
                saveTable('facturas', invoices);
                return mockResponse({ status: "success" });
            }
            if (path.startsWith('/facturas/')) {
                const parts = path.split('/');
                const id = parseInt(parts[2]);
                const invoices = getTable('facturas');
                const idx = invoices.findIndex(f => f.id === id);

                if (parts[3] === 'estado' && method === 'PUT') {
                    if (idx === -1) return mockResponse({ detail: "Factura no encontrada" }, 404);
                    const data = JSON.parse(options.body);
                    invoices[idx].estado = data.estado;
                    if (data.estado === 'Pagada') {
                        invoices[idx].fecha_pago = new Date().toISOString().split('T')[0];
                        invoices[idx].metodo_pago = data.metodo_pago || 'Otro';
                        invoices[idx].monto_pagado = invoices[idx].total;
                    } else {
                        invoices[idx].fecha_pago = null;
                        invoices[idx].monto_pagado = 0;
                    }
                    saveTable('facturas', invoices);
                    return mockResponse(invoices[idx]);
                }
                if (method === 'GET') {
                    if (idx === -1) return mockResponse({ detail: "Factura no encontrada" }, 404);
                    const items = getTable('items_factura').filter(it => it.factura_id === id);
                    return mockResponse({ ...invoices[idx], items });
                }
                if (method === 'DELETE') {
                    if (idx === -1) return mockResponse({ detail: "Factura no encontrada" }, 404);
                    invoices.splice(idx, 1);
                    saveTable('facturas', invoices);
                    return mockResponse({ status: "success", message: "Factura eliminada" });
                }
            }

            // 9. Reporte de Contabilidad
            if (path === '/contabilidad/reporte' && method === 'GET') {
                const invoices = getTable('facturas');
                const pagadas = invoices.filter(f => f.estado === 'Pagada');
                
                const desgloseMensual = {};
                pagadas.forEach(f => {
                    const mes = f.fecha_emision.substring(0, 7); // YYYY-MM
                    if (!desgloseMensual[mes]) {
                        desgloseMensual[mes] = { subtotal: 0, ivu_estatal: 0, ivu_municipal: 0, total: 0, count: 0 };
                    }
                    desgloseMensual[mes].subtotal += f.subtotal;
                    desgloseMensual[mes].ivu_estatal += f.ivu_estatal;
                    desgloseMensual[mes].ivu_municipal += f.ivu_municipal;
                    desgloseMensual[mes].total += f.total;
                    desgloseMensual[mes].count++;
                });

                const total_recaudado = pagadas.reduce((s, f) => s + f.total, 0);
                const subtotal_facturado = pagadas.reduce((s, f) => s + f.subtotal, 0);
                const ivu_estatal_total = pagadas.reduce((s, f) => s + f.ivu_estatal, 0);
                const ivu_municipal_total = pagadas.reduce((s, f) => s + f.ivu_municipal, 0);

                return mockResponse({
                    status: "success",
                    resumen: {
                        total_recaudado: round(total_recaudado),
                        subtotal_facturado: round(subtotal_facturado),
                        ivu_estatal_total: round(ivu_estatal_total),
                        ivu_municipal_total: round(ivu_municipal_total),
                        facturas_pagadas_count: pagadas.length
                    },
                    desglose_mensual: desgloseMensual
                });
            }

            // Helper para redondear centavos
            function round(num) {
                return Math.round(num * 100) / 100;
            }

            // 10. Carrito y Checkout
            if (path === '/carrito/add' && method === 'POST') {
                const { session_id, producto_id, cantidad } = JSON.parse(options.body);
                const cart = getTable('carrito');
                const idx = cart.findIndex(c => c.session_id === session_id && c.producto_id === producto_id);
                if (idx !== -1) {
                    cart[idx].cantidad += cantidad;
                } else {
                    cart.push({ id: Date.now(), session_id, producto_id, cantidad });
                }
                saveTable('carrito', cart);
                return mockResponse({ status: "success", message: "Producto añadido al carrito" });
            }
            if (path.startsWith('/carrito') && method === 'GET') {
                const sId = parsedUrl.searchParams.get('session_id');
                const cart = getTable('carrito').filter(c => c.session_id === sId);
                const products = getTable('productos');
                
                const data = cart.map(item => {
                    const prod = products.find(p => p.id === item.producto_id) || { nombre: "Producto Desconocido", precio_final: 0.0 };
                    return {
                        cart_id: item.id,
                        session_id: item.session_id,
                        cantidad: item.cantidad,
                        producto_id: item.producto_id,
                        nombre: prod.nombre,
                        precio_final: prod.precio_final,
                        foto_ruta: ""
                    };
                });
                return mockResponse({ status: "success", data });
            }
            if (path === '/carrito/clear' && method === 'DELETE') {
                const sId = parsedUrl.searchParams.get('session_id');
                const cart = getTable('carrito').filter(c => c.session_id !== sId);
                saveTable('carrito', cart);
                return mockResponse({ status: "success", message: "Carrito vaciado" });
            }
            if (path === '/carrito/remove' && method === 'DELETE') {
                const sId = parsedUrl.searchParams.get('session_id');
                const pId = parseInt(parsedUrl.searchParams.get('producto_id'));
                const cart = getTable('carrito').filter(c => !(c.session_id === sId && c.producto_id === pId));
                saveTable('carrito', cart);
                return mockResponse({ status: "success", message: "Producto eliminado del carrito" });
            }
            if (path === '/carrito/pedido' && method === 'POST') {
                const pedido = JSON.parse(options.body);
                
                // Buscar cliente público
                const clients = getTable('clientes');
                let publicClient = clients.find(c => c.nombre === 'Cliente Público');
                if (!publicClient) {
                    publicClient = { id: 3, nombre: 'Cliente Público', contacto: 'Público General', email: '', telefono: '', notas: 'Cliente genérico' };
                    clients.push(publicClient);
                    saveTable('clientes', clients);
                }

                // Generar Factura
                const invoices = getTable('facturas');
                const anioActual = new Date().getFullYear();
                const nextSeq = invoices.filter(f => f.numero_factura.startsWith(`EV-${anioActual}-`)).length + 1;
                const numFactura = `EV-${anioActual}-${String(nextSeq).padStart(4, '0')}`;
                const invoiceId = invoices.reduce((max, f) => f.id > max ? f.id : max, 0) + 1;

                const subtotal = pedido.items.reduce((s, it) => s + (it.cantidad * it.precio_unitario), 0);
                const ivuEstatal = subtotal * 0.105;
                const ivuMunicipal = subtotal * 0.01;
                const total = subtotal + ivuEstatal + ivuMunicipal;

                const newInvoice = {
                    id: invoiceId,
                    numero_factura: numFactura,
                    cliente_id: publicClient.id,
                    fecha_emision: new Date().toISOString().split('T')[0],
                    fecha_vencimiento: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
                    fecha_pago: null,
                    metodo_pago: pedido.metodo_pago || 'ATH Movil',
                    subtotal: round(subtotal),
                    ivu_estatal: round(ivuEstatal),
                    ivu_municipal: round(ivuMunicipal),
                    total: round(total),
                    notas: `Pedido Público de ${pedido.nombre_contacto}. Tel: ${pedido.telefono_contacto} | Email: ${pedido.email_contacto || 'N/A'}. Notas: ${pedido.notas || 'Ninguna'}. Pago: ${pedido.metodo_pago || 'ATH Movil'}`,
                    estado: 'Pendiente',
                    monto_pagado: 0,
                    notificado: 0
                };
                invoices.push(newInvoice);
                saveTable('facturas', invoices);

                // Insertar partidas de la factura
                const invoiceItems = getTable('items_factura');
                pedido.items.forEach(it => {
                    const nextItemId = invoiceItems.reduce((max, item) => item.id > max ? item.id : max, 0) + 1;
                    invoiceItems.push({
                        id: nextItemId,
                        factura_id: invoiceId,
                        producto_id: it.producto_id,
                        nombre_producto: it.nombre_producto,
                        cantidad: it.cantidad,
                        precio_unitario: it.precio_unitario,
                        total: round(it.cantidad * it.precio_unitario)
                    });
                });
                saveTable('items_factura', invoiceItems);

                // Registrar Ordenes de Producción
                const orders = getTable('ordenes');
                pedido.items.forEach((it, idx) => {
                    const nextOrderId = orders.reduce((max, o) => o.id > max ? o.id : max, 0) + 1;
                    const code = `EVL-PUB-${String(Math.floor(Date.now() % 10000000))}-${idx}-${it.producto_id}`;
                    orders.push({
                        id: nextOrderId,
                        codigo_orden: code,
                        cliente: `[PEDIDO PÚBLICO] Contacto: ${pedido.nombre_contacto} | Tel: ${pedido.telefono_contacto} | Pago: ${pedido.metodo_pago || 'ATH Movil'}`,
                        producto_id: it.producto_id,
                        cantidad: it.cantidad,
                        estado: 'Pendiente',
                        material_descontado: 0,
                        completado: 0,
                        fecha_creacion: new Date().toISOString()
                    });
                });
                saveTable('ordenes', orders);

                // Vaciar carrito
                const cart = getTable('carrito').filter(c => c.session_id !== pedido.session_id);
                saveTable('carrito', cart);

                return mockResponse({
                    status: "success",
                    message: `Pedido registrado offline correctamente y factura ${numFactura} generada.`,
                    total: total,
                    numero_factura: numFactura,
                    factura_id: invoiceId
                }, 201);
            }

            return mockResponse({ detail: "Endpoint offline no implementado" }, 404);

        } catch (e) {
            console.error("Error en router offline de API:", e);
            return mockResponse({ detail: e.message }, 500);
        }
    };
})();

const EvergreenAPI = {
    // 1. Diagnóstico y Estado
    async getHealth() {
        try {
            const response = await fetch(`${API_BASE_URL}/health`);
            if (!response.ok) throw new Error("Error al consultar el estado de la API");
            return await response.json();
        } catch (error) {
            console.error("Health check error:", error);
            throw error;
        }
    },

    async getDbStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/db_status`);
            if (!response.ok) throw new Error("Error al consultar el estado de la base de datos");
            return await response.json();
        } catch (error) {
            console.error("DB Status error:", error);
            throw error;
        }
    },

    // 2. Materiales (CRUD e Importación)
    async getMateriales() {
        try {
            const response = await fetch(`${API_BASE_URL}/materiales`);
            if (!response.ok) throw new Error("Error al obtener materiales");
            return await response.json();
        } catch (error) {
            console.error("getMateriales error:", error);
            throw error;
        }
    },

    async createMaterial(materialData) {
        try {
            const response = await fetch(`${API_BASE_URL}/materiales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(materialData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al crear material");
            }
            return await response.json();
        } catch (error) {
            console.error("createMaterial error:", error);
            throw error;
        }
    },

    async updateMaterial(id, materialData) {
        try {
            const response = await fetch(`${API_BASE_URL}/materiales/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(materialData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al actualizar material");
            }
            return await response.json();
        } catch (error) {
            console.error("updateMaterial error:", error);
            throw error;
        }
    },

    async deleteMaterial(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/materiales/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Error al eliminar material");
            return await response.json();
        } catch (error) {
            console.error("deleteMaterial error:", error);
            throw error;
        }
    },

    async uploadMaterialPhoto(id, file) {
        try {
            const formData = new FormData();
            formData.append("file", file);
            
            const response = await fetch(`${API_BASE_URL}/materiales/${id}/foto`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al subir la foto del material");
            }
            return await response.json();
        } catch (error) {
            console.error("uploadMaterialPhoto error:", error);
            throw error;
        }
    },

    async importarMateriales(file) {
        try {
            const formData = new FormData();
            formData.append("file", file);
            
            const response = await fetch(`${API_BASE_URL}/materiales/importar`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al importar el archivo CSV");
            }
            return await response.json();
        } catch (error) {
            console.error("importarMateriales error:", error);
            throw error;
        }
    },

    // 3. Retazos
    async getRetazos() {
        try {
            const response = await fetch(`${API_BASE_URL}/retazos`);
            if (!response.ok) throw new Error("Error al obtener retazos");
            return await response.json();
        } catch (error) {
            console.error("getRetazos error:", error);
            throw error;
        }
    },

    async createRetazo(retazoData) {
        try {
            const response = await fetch(`${API_BASE_URL}/retazos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(retazoData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al crear retazo");
            }
            return await response.json();
        } catch (error) {
            console.error("createRetazo error:", error);
            throw error;
        }
    },

    async deleteRetazo(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/retazos/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Error al eliminar retazo");
            return await response.json();
        } catch (error) {
            console.error("deleteRetazo error:", error);
            throw error;
        }
    },

    // 4. Productos (Costos y Catálogo)
    async getProductos() {
        try {
            const response = await fetch(`${API_BASE_URL}/productos`);
            if (!response.ok) throw new Error("Error al obtener productos");
            return await response.json();
        } catch (error) {
            console.error("getProductos error:", error);
            throw error;
        }
    },

    async createProducto(productoData) {
        try {
            const response = await fetch(`${API_BASE_URL}/productos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productoData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al registrar el producto");
            }
            return await response.json();
        } catch (error) {
            console.error("createProducto error:", error);
            throw error;
        }
    },

    async deleteProducto(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/productos/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Error al eliminar el producto");
            return await response.json();
        } catch (error) {
            console.error("deleteProducto error:", error);
            throw error;
        }
    },

    async updateProductoDescripcion(id, descripcion) {
        try {
            const response = await fetch(`${API_BASE_URL}/productos/${id}/descripcion`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descripcion })
            });
            if (!response.ok) throw new Error("Error al actualizar la descripción del producto");
            return await response.json();
        } catch (error) {
            console.error("updateProductoDescripcion error:", error);
            throw error;
        }
    },

    async updateProducto(id, productData) {
        try {
            const response = await fetch(`${API_BASE_URL}/productos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al actualizar el producto");
            }
            return await response.json();
        } catch (error) {
            console.error("updateProducto error:", error);
            throw error;
        }
    },

    // 5. Órdenes de Producción
    async getOrdenes() {
        try {
            const response = await fetch(`${API_BASE_URL}/ordenes`);
            if (!response.ok) throw new Error("Error al obtener órdenes");
            return await response.json();
        } catch (error) {
            console.error("getOrdenes error:", error);
            throw error;
        }
    },

    async createOrden(ordenData) {
        try {
            const response = await fetch(`${API_BASE_URL}/ordenes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ordenData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al crear la orden");
            }
            return await response.json();
        } catch (error) {
            console.error("createOrden error:", error);
            throw error;
        }
    },

    async updateOrdenEstado(id, estado) {
        try {
            const response = await fetch(`${API_BASE_URL}/ordenes/${id}?estado=${encodeURIComponent(estado)}`, {
                method: 'PUT'
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al actualizar estado de la orden");
            }
            return await response.json();
        } catch (error) {
            console.error("updateOrdenEstado error:", error);
            throw error;
        }
    },

    async deleteOrden(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/ordenes/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Error al eliminar la orden");
            return await response.json();
        } catch (error) {
            console.error("deleteOrden error:", error);
            throw error;
        }
    },

    async updateOrdenCompletado(id, completado) {
        try {
            const response = await fetch(`${API_BASE_URL}/ordenes/${id}/completado?completado=${completado}`, {
                method: 'PUT'
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al actualizar el estado completado del artículo");
            }
            return await response.json();
        } catch (error) {
            console.error("updateOrdenCompletado error:", error);
            throw error;
        }
    },

    // 6. Diseños y Settings Láser
    async getDisenos() {
        try {
            const response = await fetch(`${API_BASE_URL}/disenos`);
            if (!response.ok) throw new Error("Error al obtener diseños");
            return await response.json();
        } catch (error) {
            console.error("getDisenos error:", error);
            throw error;
        }
    },

    async createDiseno(formData) {
        try {
            const response = await fetch(`${API_BASE_URL}/disenos`, {
                method: 'POST',
                body: formData // Contiene archivo y metadatos
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al registrar el diseño");
            }
            return await response.json();
        } catch (error) {
            console.error("createDiseno error:", error);
            throw error;
        }
    },

    async deleteDiseno(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/disenos/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Error al eliminar el diseño");
            return await response.json();
        } catch (error) {
            console.error("deleteDiseno error:", error);
            throw error;
        }
    },

    async getLaserSettings(disenoId) {
        try {
            const response = await fetch(`${API_BASE_URL}/disenos/${disenoId}/settings`);
            if (!response.ok) throw new Error("Error al obtener los settings del láser");
            return await response.json();
        } catch (error) {
            console.error("getLaserSettings error:", error);
            throw error;
        }
    },

    async createLaserSetting(disenoId, settingData) {
        try {
            const response = await fetch(`${API_BASE_URL}/disenos/${disenoId}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al crear la configuración láser");
            }
            return await response.json();
        } catch (error) {
            console.error("createLaserSetting error:", error);
            throw error;
        }
    },

    async deleteLaserSetting(settingId) {
        try {
            const response = await fetch(`${API_BASE_URL}/settings/${settingId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Error al eliminar el ajuste láser");
            return await response.json();
        } catch (error) {
            console.error("deleteLaserSetting error:", error);
            throw error;
        }
    },

    // 7. Estimación de IA con Gemini
    async estimarCostoPorIA(file, geminiKey) {
        try {
            const formData = new FormData();
            formData.append("file", file);
            
            const response = await fetch(`${API_BASE_URL}/ia/estimar`, {
                method: 'POST',
                headers: {
                    'X-Gemini-Key': geminiKey
                },
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al analizar la imagen con IA");
            }
            return await response.json();
        } catch (error) {
            console.error("estimarCostoPorIA error:", error);
            throw error;
        }
    },

    // 8. Evaluaciones Visuales (Calidad)
    async getEvaluaciones() {
        try {
            const response = await fetch(`${API_BASE_URL}/evaluaciones`);
            if (!response.ok) throw new Error("Error al obtener evaluaciones");
            return await response.json();
        } catch (error) {
            console.error("getEvaluaciones error:", error);
            throw error;
        }
    },

    async getEvaluacionOrden(ordenId) {
        try {
            const response = await fetch(`${API_BASE_URL}/evaluaciones/orden/${ordenId}`);
            if (!response.ok) throw new Error("Error al obtener la evaluación de la orden");
            return await response.json();
        } catch (error) {
            console.error("getEvaluacionOrden error:", error);
            throw error;
        }
    },

    async saveEvaluacion(evaluacionData) {
        try {
            const response = await fetch(`${API_BASE_URL}/evaluaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(evaluacionData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al guardar la evaluación");
            }
            return await response.json();
        } catch (error) {
            console.error("saveEvaluacion error:", error);
            throw error;
        }
    },

    async escanearFotos() {
        try {
            const response = await fetch(`${API_BASE_URL}/fotos/escanear`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error("Error al escanear fotos");
            return await response.json();
        } catch (error) {
            console.error("escanearFotos error:", error);
            throw error;
        }
    },

    async getFotosOrden(ordenId) {
        try {
            const response = await fetch(`${API_BASE_URL}/fotos/ordenes/${ordenId}`);
            if (!response.ok) throw new Error("Error al obtener fotos de la orden");
            return await response.json();
        } catch (error) {
            console.error("getFotosOrden error:", error);
            throw error;
        }
    },

    async subirFoto(file, ordenId, productoId, tipoFoto) {
        try {
            const formData = new FormData();
            formData.append("file", file);
            
            let url = `${API_BASE_URL}/fotos/subir?tipo_foto=${tipoFoto}`;
            if (ordenId) url += `&orden_id=${ordenId}`;
            if (productoId) url += `&producto_id=${productoId}`;
            
            const headers = {};
            const cfAccountId = localStorage.getItem('evergreen_cloudflare_account_id');
            const cfApiToken = localStorage.getItem('evergreen_cloudflare_api_token');
            const cfBucket = localStorage.getItem('evergreen_cloudflare_bucket');
            const cfDeliveryUrl = localStorage.getItem('evergreen_cloudflare_delivery_url');

            if (cfAccountId) headers['X-Cloudflare-Account-Id'] = cfAccountId;
            if (cfApiToken) headers['X-Cloudflare-Api-Token'] = cfApiToken;
            if (cfBucket) headers['X-Cloudflare-Bucket'] = cfBucket;
            if (cfDeliveryUrl) headers['X-Cloudflare-Delivery-Url'] = cfDeliveryUrl;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al subir foto");
            }
            return await response.json();
        } catch (error) {
            console.error("subirFoto error:", error);
            throw error;
        }
    },

    // 9. Clientes B2B y Catálogos Personalizados
    async getClientes() {
        try {
            const response = await fetch(`${API_BASE_URL}/clientes`);
            if (!response.ok) throw new Error("Error al obtener clientes B2B");
            return await response.json();
        } catch (error) {
            console.error("getClientes error:", error);
            throw error;
        }
    },

    async createCliente(clienteData) {
        try {
            const response = await fetch(`${API_BASE_URL}/clientes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clienteData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al registrar cliente B2B");
            }
            return await response.json();
        } catch (error) {
            console.error("createCliente error:", error);
            throw error;
        }
    },

    async deleteCliente(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/clientes/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Error al eliminar cliente B2B");
            return await response.json();
        } catch (error) {
            console.error("deleteCliente error:", error);
            throw error;
        }
    },

    async getCatalogoCliente(clienteId) {
        try {
            const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}/catalogo`);
            if (!response.ok) throw new Error("Error al obtener catálogo del cliente B2B");
            return await response.json();
        } catch (error) {
            console.error("getCatalogoCliente error:", error);
            throw error;
        }
    },

    async addProductoCatalogoCliente(itemData) {
        try {
            const response = await fetch(`${API_BASE_URL}/clientes/catalogo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al asociar producto al catálogo");
            }
            return await response.json();
        } catch (error) {
            console.error("addProductoCatalogoCliente error:", error);
            throw error;
        }
    },

    async deleteProductoCatalogoCliente(itemId) {
        try {
            const response = await fetch(`${API_BASE_URL}/clientes/catalogo/${itemId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Error al retirar producto del catálogo");
            return await response.json();
        } catch (error) {
            console.error("deleteProductoCatalogoCliente error:", error);
            throw error;
        }
    },

    async publicarCatalogoWeb() {
        try {
            const response = await fetch(`${API_BASE_URL}/shopify/publicar_web`, {
                method: 'POST'
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al publicar catálogo");
            }
            return await response.json();
        } catch (error) {
            console.error("publicarCatalogoWeb error:", error);
            throw error;
        }
    },

    // 10. Facturas y Contabilidad (IVU ERP)
    async getFacturas() {
        try {
            const response = await fetch(`${API_BASE_URL}/facturas`);
            if (!response.ok) throw new Error("Error al obtener facturas");
            return await response.json();
        } catch (error) {
            console.error("getFacturas error:", error);
            throw error;
        }
    },

    async getFactura(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/facturas/${id}`);
            if (!response.ok) throw new Error("Error al obtener detalles de la factura");
            return await response.json();
        } catch (error) {
            console.error("getFactura error:", error);
            throw error;
        }
    },

    async createFactura(facturaData) {
        try {
            const response = await fetch(`${API_BASE_URL}/facturas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(facturaData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al crear la factura");
            }
            return await response.json();
        } catch (error) {
            console.error("createFactura error:", error);
            throw error;
        }
    },

    async updateFacturaEstado(id, estadoData) {
        try {
            const response = await fetch(`${API_BASE_URL}/facturas/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(estadoData)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Error al actualizar estado de la factura");
            }
            return await response.json();
        } catch (error) {
            console.error("updateFacturaEstado error:", error);
            throw error;
        }
    },

    async deleteFactura(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/facturas/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Error al eliminar la factura");
            return await response.json();
        } catch (error) {
            console.error("deleteFactura error:", error);
            throw error;
        }
    },

    async getReporteContabilidad() {
        try {
            const response = await fetch(`${API_BASE_URL}/contabilidad/reporte`);
            if (!response.ok) throw new Error("Error al obtener reporte contable");
            return await response.json();
        } catch (error) {
            console.error("getReporteContabilidad error:", error);
            throw error;
        }
    },
    async getNuevasFacturas() {
        try {
            const response = await fetch(`${API_BASE_URL}/facturas/nuevas`);
            if (!response.ok) throw new Error("Error al obtener facturas nuevas");
            return await response.json();
        } catch (error) {
            console.error("getNuevasFacturas error:", error);
            throw error;
        }
    },
    async marcarFacturasLeidas(ids) {
        try {
            const response = await fetch(`${API_BASE_URL}/facturas/marcar-leidas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            if (!response.ok) throw new Error("Error al marcar facturas como leídas");
            return await response.json();
        } catch (error) {
            console.error("marcarFacturasLeidas error:", error);
            throw error;
        }
    },
    // Carrito de compras
    async addToCart(sessionId, productoId, cantidad = 1) {
        try {
            const response = await fetch(`${API_BASE_URL}/carrito/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, producto_id: productoId, cantidad })
            });
            if (!response.ok) throw new Error('Error al agregar al carrito');
            return await response.json();
        } catch (error) {
            console.error('addToCart error:', error);
            throw error;
        }
    },
    async getCart(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/carrito?session_id=${encodeURIComponent(sessionId)}`);
            if (!response.ok) throw new Error('Error al obtener el carrito');
            return await response.json();
        } catch (error) {
            console.error('getCart error:', error);
            throw error;
        }
    },
    async clearCart(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/carrito/clear?session_id=${encodeURIComponent(sessionId)}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Error al limpiar el carrito');
            return await response.json();
        } catch (error) {
            console.error('clearCart error:', error);
            throw error;
        }
    },
    async removeFromCart(sessionId, productoId) {
        try {
            const response = await fetch(`${API_BASE_URL}/carrito/remove?session_id=${encodeURIComponent(sessionId)}&producto_id=${productoId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Error al eliminar del carrito');
            return await response.json();
        } catch (error) {
            console.error('removeFromCart error:', error);
            throw error;
        }
    },
};

