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

    const OFFLINE_DB_VERSION = "2026-06-09-v2";
    const SEED_DATA = {
        "materiales": [
                {
                        "id": 1,
                        "nombre": "Basswood (Tilo)",
                        "tipo": "madera",
                        "espesor": 0.125,
                        "tamano_ancho": 12.0,
                        "tamano_alto": 12.0,
                        "cantidad": 60.0,
                        "cantidad_minima_alerta": 20.0,
                        "costo_hoja_unidad": 0.8414,
                        "proveedor": "Amazon",
                        "fecha_compra": "2026-05-15",
                        "lote": "LOTE-BASS-1220",
                        "enlace_compra": "https://www.amazon.com/dp/B078M7QRXD?ref=ppx_yo2ov_dt_b_fed_asin_title",
                        "foto_url": "/fotos_import/material_1.jpg"
                },
                {
                        "id": 2,
                        "nombre": "Walnut Finished (Nogal Acabado)",
                        "tipo": "madera",
                        "espesor": 0.125,
                        "tamano_ancho": 12.0,
                        "tamano_alto": 12.0,
                        "cantidad": 12.0,
                        "cantidad_minima_alerta": 5.0,
                        "costo_hoja_unidad": 2.3508,
                        "proveedor": "Amazon",
                        "fecha_compra": "2026-05-20",
                        "lote": "LOTE-WAL-FIN",
                        "enlace_compra": null,
                        "foto_url": null
                },
                {
                        "id": 3,
                        "nombre": "Walnut Unfinished (Nogal sin Acabar)",
                        "tipo": "madera",
                        "espesor": 0.125,
                        "tamano_ancho": 12.0,
                        "tamano_alto": 20.0,
                        "cantidad": 12.0,
                        "cantidad_minima_alerta": 2.0,
                        "costo_hoja_unidad": 9.0,
                        "proveedor": "WoodCraft Co.",
                        "fecha_compra": "2026-05-20",
                        "lote": "LOTE-WAL-UNF",
                        "enlace_compra": null,
                        "foto_url": null
                },
                {
                        "id": 4,
                        "nombre": "Baltic Birch (Abedul Báltico)",
                        "tipo": "madera",
                        "espesor": 0.125,
                        "tamano_ancho": 12.0,
                        "tamano_alto": 12.0,
                        "cantidad": 45.0,
                        "cantidad_minima_alerta": 10.0,
                        "costo_hoja_unidad": 1.2658,
                        "proveedor": "Amazon",
                        "fecha_compra": "2026-05-20",
                        "lote": "LOTE-BIRCH-1212",
                        "enlace_compra": "https://www.amazon.com/dp/B078M7QRXD?ref=ppx_yo2ov_dt_b_fed_asin_title",
                        "foto_url": null
                },
                {
                        "id": 5,
                        "nombre": "Acrílico Transparente",
                        "tipo": "acrilico",
                        "espesor": 0.125,
                        "tamano_ancho": 12.0,
                        "tamano_alto": 12.0,
                        "cantidad": 8.0,
                        "cantidad_minima_alerta": 2.0,
                        "costo_hoja_unidad": 12.5,
                        "proveedor": "Plásticos PR",
                        "fecha_compra": "2026-05-22",
                        "lote": "LOTE-ACR-1212",
                        "enlace_compra": null,
                        "foto_url": null
                },
                {
                        "id": 6,
                        "nombre": "Anilla de Llavero con Cadena",
                        "tipo": "herrajes",
                        "espesor": 0.0,
                        "tamano_ancho": 1.0,
                        "tamano_alto": 1.0,
                        "cantidad": 150.0,
                        "cantidad_minima_alerta": 20.0,
                        "costo_hoja_unidad": 0.12,
                        "proveedor": "Amazon Business",
                        "fecha_compra": "2026-05-01",
                        "lote": "LOTE-KEYRING",
                        "enlace_compra": null,
                        "foto_url": null
                },
                {
                        "id": 7,
                        "nombre": "Borla Decorativa de Cuero (Tassel)",
                        "tipo": "herrajes",
                        "espesor": 0.0,
                        "tamano_ancho": 1.5,
                        "tamano_alto": 0.5,
                        "cantidad": 120.0,
                        "cantidad_minima_alerta": 15.0,
                        "costo_hoja_unidad": 0.0833,
                        "proveedor": "Etsy Wholesale",
                        "fecha_compra": "2026-05-05",
                        "lote": "LOTE-TASSEL",
                        "enlace_compra": "https://www.amazon.com/gp/buyagain/ref=pd_rhf_ee_s_rp_c_d_sccl_2_42/136-5693323-0924666?pd_rd_w=iwR1u&content-id=amzn1.sym.e6de1cec-4959-4aef-bb2c-4bdde202c7a9&pf_rd_p=e6de1cec-4959-4aef-bb2c-4bdde202c7a9&pf_rd_r=THJJY9GP3D8ETEA55ABJ&pd_rd_wg=EnUyK&pd_rd_r=c70b74b8-a8b0-43f5-ba0c-fb7b8bdeb431&pd_rd_i=B07P8DDPLY&ats=eyJleHBsaWNpdENhbmRpZGF0ZXMiOiJCMDdQOEREUExZIiwiYXNpbkludGVyYWN0ZWQiOiJ0cnVlIiwiY3VzdG9tZXJJZCI6IkEyWkdYTlQzRTdKV1JEIn0=",
                        "foto_url": null
                },
                {
                        "id": 8,
                        "nombre": "Chip NFC Inteligente NTAG213",
                        "tipo": "herrajes",
                        "espesor": 0.0,
                        "tamano_ancho": 1.0,
                        "tamano_alto": 1.0,
                        "cantidad": 100.0,
                        "cantidad_minima_alerta": 15.0,
                        "costo_hoja_unidad": 0.45,
                        "proveedor": "NFC Tag Shop",
                        "fecha_compra": "2026-05-05",
                        "lote": "LOTE-NFC",
                        "enlace_compra": null,
                        "foto_url": null
                },
                {
                        "id": 9,
                        "nombre": "Caja de Regalo Kraft (Empaque)",
                        "tipo": "empaques",
                        "espesor": 0.0,
                        "tamano_ancho": 6.0,
                        "tamano_alto": 6.0,
                        "cantidad": 50.0,
                        "cantidad_minima_alerta": 10.0,
                        "costo_hoja_unidad": 0.35,
                        "proveedor": "Empaques Eco",
                        "fecha_compra": "2026-05-01",
                        "lote": "LOTE-BOX-KRAFT",
                        "enlace_compra": null,
                        "foto_url": null
                },
                {
                        "id": 10,
                        "nombre": "Imán de Neodimio Redondo 8mm",
                        "tipo": "imanes",
                        "espesor": 0.08,
                        "tamano_ancho": 0.31,
                        "tamano_alto": 0.31,
                        "cantidad": 140.0,
                        "cantidad_minima_alerta": 10.0,
                        "costo_hoja_unidad": 0.0606,
                        "proveedor": "Amazon",
                        "fecha_compra": "2026-05-25",
                        "lote": "LOTE-MAGNET-8MM",
                        "enlace_compra": "https://www.amazon.com/dp/B0B6FRTKF7?ref=ppx_yo2ov_dt_b_fed_asin_title",
                        "foto_url": null
                },
                {
                        "id": 11,
                        "nombre": "Pega de Madera Titebond III (Aplicación)",
                        "tipo": "pegamentos",
                        "espesor": 0.0,
                        "tamano_ancho": 1.0,
                        "tamano_alto": 1.0,
                        "cantidad": 50.0,
                        "cantidad_minima_alerta": 5.0,
                        "costo_hoja_unidad": 0.05,
                        "proveedor": "Home Depot",
                        "fecha_compra": "2026-05-25",
                        "lote": "LOTE-PEGA-TITEBOND",
                        "enlace_compra": null,
                        "foto_url": null
                },
                {
                        "id": 12,
                        "nombre": "Pintura Acrílica Americana Negra (Aplicación)",
                        "tipo": "pinturas",
                        "espesor": 0.0,
                        "tamano_ancho": 1.0,
                        "tamano_alto": 1.0,
                        "cantidad": 30.0,
                        "cantidad_minima_alerta": 3.0,
                        "costo_hoja_unidad": 0.1,
                        "proveedor": "Craft Store",
                        "fecha_compra": "2026-05-25",
                        "lote": "LOTE-PINTURA-NEGRO",
                        "enlace_compra": null,
                        "foto_url": null
                },
                {
                        "id": 15,
                        "nombre": "Anilla Llavero",
                        "tipo": "otros",
                        "espesor": 0.125,
                        "tamano_ancho": 1.0,
                        "tamano_alto": 1.0,
                        "cantidad": 300.0,
                        "cantidad_minima_alerta": 15.0,
                        "costo_hoja_unidad": 0.0333,
                        "proveedor": null,
                        "fecha_compra": "2026-06-04",
                        "lote": null,
                        "enlace_compra": "https://www.amazon.com/dp/B076Q9SSSQ/ref=sspa_dk_rhf_yoy_pt_sub_0/?_encoding=UTF8&ie=UTF8&psc=1&spc=MTo4NTU2MTU3NjExNzU3NzI6MTc4MDYxNTEzNjpzcF9yaGZfeW95OjIwMDAwNDU3ODU2NjQ2MTowOjA6Og%3D%3D&sp_csd=d2lkZ2V0TmFtZT1zcF9yaGZfeW95&pd_rd_w=vLDHw&content-id=amzn1.sym.69f8f66e-98eb-45f4-92c0-0c9f99faf570&pf_rd_p=69f8f66e-98eb-45f4-92c0-0c9f99faf570&pf_rd_r=G1XWMMVK8Y9PJA8AYWPP&pd_rd_wg=EIJN0&pd_rd_r=6f0e52bc-42b4-4985-a43d-f544ad31834c&ref_=sspa_dk_rhf_yoy_pt_sub",
                        "foto_url": null
                }
        ],
        "retazos": [
                {
                        "id": 1,
                        "material_id": 1,
                        "tamano_ancho": 4.0,
                        "tamano_alto": 10.0,
                        "cantidad": 2.0,
                        "ubicacion": "Estante Madera Retazos A"
                },
                {
                        "id": 2,
                        "material_id": 2,
                        "tamano_ancho": 6.0,
                        "tamano_alto": 8.0,
                        "cantidad": 1.0,
                        "ubicacion": "Estante Madera Retazos B"
                }
        ],
        "disenos": [
                {
                        "id": 2,
                        "nombre": "Casitas Típicas San Juan",
                        "categoria": "casitas Viejo San Juan",
                        "archivo_diseno": "casitas_viejo_sanjuan.svg",
                        "fecha_creacion": "2026-06-01 23:55:05"
                },
                {
                        "id": 3,
                        "nombre": "Llavero NFC Redondo",
                        "categoria": "llaveros NFC",
                        "archivo_diseno": "llavero_nfc_redondo.svg",
                        "fecha_creacion": "2026-06-01 23:55:05"
                },
                {
                        "id": 5,
                        "nombre": "Carreta",
                        "categoria": "productos personalizados",
                        "archivo_diseno": "carreta_Cart All Layers.svg",
                        "fecha_creacion": "2026-06-07 18:24:02"
                }
        ],
        "laser_settings": [
                {
                        "id": 1,
                        "diseno_id": 1,
                        "material_tipo": "madera",
                        "espesor": 0.125,
                        "velocidad_corte": 18.0,
                        "potencia_corte": 90.0,
                        "pasadas_corte": 1,
                        "velocidad_grabado": 80.0,
                        "potencia_grabado": 35.0,
                        "pasadas_grabado": 1,
                        "tipo_trabajo": "ambos",
                        "notas": "Walnut/Basswood 1/8\". Lijar antes para mejores acabados."
                },
                {
                        "id": 2,
                        "diseno_id": 3,
                        "material_tipo": "madera",
                        "espesor": 0.125,
                        "velocidad_corte": 20.0,
                        "potencia_corte": 90.0,
                        "pasadas_corte": 1,
                        "velocidad_grabado": 90.0,
                        "potencia_grabado": 40.0,
                        "pasadas_grabado": 1,
                        "tipo_trabajo": "ambos",
                        "notas": "Espacio tag NFC grabado a 0.05\" de profundidad."
                }
        ],
        "productos": [
                {
                        "id": 4,
                        "sku": "SKU-EVG-1560",
                        "nombre": "Llavero Guitarra y Cotorra",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.24936905,
                        "margen_ganancia": 0.5,
                        "precio_sugerido": 4.4987381,
                        "precio_final": 4.5,
                        "personalizado": 0,
                        "shopify_titulo": "Llavero Guitarra y Cotorra - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.72\"x3.6\"/BassWood",
                        "shopify_tags": "llavero, guitarra, cotorra",
                        "shopify_alt_text": "Fotografía de producto terminado de Llavero Guitarra y Cotorra",
                        "ancho": 2.0,
                        "alto": 2.0
                },
                {
                        "id": 5,
                        "sku": "SKU-EVG-8582",
                        "nombre": "Llavero flor de Maga",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.1998761406250003,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.4996903515625,
                        "precio_final": 5.5,
                        "personalizado": 0,
                        "shopify_titulo": "Llavero flor de Maga - Hecho en Puerto Rico",
                        "shopify_descripcion": "3.1\"x3.3/BassWood",
                        "shopify_tags": "llavero, flor, maga",
                        "shopify_alt_text": "Fotografía de producto terminado de Llavero flor de Maga",
                        "ancho": 2.0,
                        "alto": 2.0
                },
                {
                        "id": 6,
                        "sku": "SKU-EVG-6636",
                        "nombre": "Garita Flor Maga",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.162547859375,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.4063696484375,
                        "precio_final": 5.41,
                        "personalizado": 0,
                        "shopify_titulo": "Garita Flor Maga - Hecho en Puerto Rico",
                        "shopify_descripcion": "1.9\"x2.7\"/BassWood",
                        "shopify_tags": "garita, flor, maga",
                        "shopify_alt_text": "Fotografía de producto terminado de Garita Flor Maga",
                        "ancho": 2.0,
                        "alto": 2.0
                },
                {
                        "id": 7,
                        "sku": "SKU-EVG-1661",
                        "nombre": "Garita Morro con Flor de Maga",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.1853181109374997,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.463295277343749,
                        "precio_final": 5.46,
                        "personalizado": 0,
                        "shopify_titulo": "Garita Morro con Flor de Maga - Hecho en Puerto Rico",
                        "shopify_descripcion": "2.01\"x4.1/BassWood",
                        "shopify_tags": "garita, morro, flor, maga",
                        "shopify_alt_text": "Fotografía de producto terminado de Garita Morro con Flor de Maga",
                        "ancho": 2.0,
                        "alto": 2.0
                },
                {
                        "id": 8,
                        "sku": "SKU-EVG-8533",
                        "nombre": "Corazón con flor de Maga",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.1518780555555557,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.379695138888889,
                        "precio_final": 6.53,
                        "personalizado": 0,
                        "shopify_titulo": "Corazón con flor de Maga - Hecho en Puerto Rico",
                        "shopify_descripcion": "2.9\"x2.3\"/BassWood",
                        "shopify_tags": "corazón, flor, maga",
                        "shopify_alt_text": "Fotografía de producto terminado de Corazón con flor de Maga",
                        "ancho": 2.0,
                        "alto": 2.0
                },
                {
                        "id": 9,
                        "sku": "SKU-EVG-4102",
                        "nombre": "Corazón Flor Maga y Garita",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.252940854166667,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.632352135416667,
                        "precio_final": 5.63,
                        "personalizado": 0,
                        "shopify_titulo": "Corazón Flor Maga y Garita - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.6\"x3.8\"/BassWood",
                        "shopify_tags": "corazón, flor, maga, garita",
                        "shopify_alt_text": "Fotografía de producto terminado de Corazón Flor Maga y Garita",
                        "ancho": 2.0,
                        "alto": 2.0
                },
                {
                        "id": 10,
                        "sku": "SKU-EVG-3704",
                        "nombre": "Corazón Bandera Puerto Rico",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.20580475,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.514511874999999,
                        "precio_final": 5.51,
                        "personalizado": 0,
                        "shopify_titulo": "Corazón Bandera Puerto Rico - Hecho en Puerto Rico",
                        "shopify_descripcion": "3.68\"x3\"/BassWood",
                        "shopify_tags": "corazón, bandera, puerto, rico",
                        "shopify_alt_text": "Fotografía de producto terminado de Corazón Bandera Puerto Rico",
                        "ancho": 2.0,
                        "alto": 2.0
                },
                {
                        "id": 11,
                        "sku": "SKU-EVG-8515",
                        "nombre": "Llavero Tambor Garita",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.245521201111111,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.613803002777777,
                        "precio_final": 5.61,
                        "personalizado": 0,
                        "shopify_titulo": "Llavero Tambor Garita - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.72\"x3.8\"/BassWood",
                        "shopify_tags": "llavero, tambor, garita",
                        "shopify_alt_text": "Fotografía de producto terminado de Llavero Tambor Garita",
                        "ancho": 4.72,
                        "alto": 3.8
                },
                {
                        "id": 12,
                        "sku": "SKU-EVG-5425",
                        "nombre": "Cuadro Garita",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.2491766166666665,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.622941541666666,
                        "precio_final": 5.62,
                        "personalizado": 0,
                        "shopify_titulo": "Cuadro Garita - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.2\"x4.4\"/BassWood",
                        "shopify_tags": "cuadro, garita",
                        "shopify_alt_text": "Fotografía de producto terminado de Cuadro Garita",
                        "ancho": 4.2,
                        "alto": 4.4
                },
                {
                        "id": 13,
                        "sku": "SKU-EVG-4368",
                        "nombre": "Macrame Isla Puerto Rico",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.1794280625,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.44857015625,
                        "precio_final": 5.45,
                        "personalizado": 0,
                        "shopify_titulo": "Macrame Isla Puerto Rico - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.5\"x1.8\"/BassWood",
                        "shopify_tags": "macrame, isla, puerto, rico",
                        "shopify_alt_text": "Fotografía de producto terminado de Macrame Isla Puerto Rico",
                        "ancho": 4.5,
                        "alto": 1.8
                },
                {
                        "id": 14,
                        "sku": "SKU-EVG-5975",
                        "nombre": "Macrame Rectangular Puerto Rico",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.182580858416667,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.456452146041666,
                        "precio_final": 5.46,
                        "personalizado": 0,
                        "shopify_titulo": "Macrame Rectangular Puerto Rico - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.44\"x1.93\"/BassWood",
                        "shopify_tags": "macrame, rectangular, puerto, rico",
                        "shopify_alt_text": "Fotografía de producto terminado de Macrame Rectangular Puerto Rico",
                        "ancho": 4.44,
                        "alto": 1.93
                },
                {
                        "id": 15,
                        "sku": "SKU-EVG-9392",
                        "nombre": "Media Luna Flor Maga Puerto Rico(Pequeña)",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.1947015175694444,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.486753793923611,
                        "precio_final": 5.49,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Flor Maga Puerto Rico(Pequeña) - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.1\"x2.53/BassWood (Media Luna Pequeña)",
                        "shopify_tags": "media, luna, flor, maga, puerto, ricopequeña",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Flor Maga Puerto Rico(Pequeña)",
                        "ancho": 4.1,
                        "alto": 2.53
                },
                {
                        "id": 16,
                        "sku": "SKU-EVG-6738",
                        "nombre": "Media Luna Bandera Puerto Rico (Pequeña)",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.1947015175694444,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.486753793923611,
                        "precio_final": 5.49,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Bandera Puerto Rico (Pequeña) - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.1\"x2.53\"/BassWood (Media Luna Pequeña)",
                        "shopify_tags": "media, luna, bandera, puerto, rico, pequeña",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Bandera Puerto Rico (Pequeña)",
                        "ancho": 4.1,
                        "alto": 2.53
                },
                {
                        "id": 17,
                        "sku": "SKU-EVG-4827",
                        "nombre": "Media Luna Garita Bandera Puerto Rico",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.214369534722222,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.535923836805555,
                        "precio_final": 5.54,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Garita Bandera Puerto Rico  - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.75\"x2.8\"/BassWood (Media Luna Pequeña)",
                        "shopify_tags": "media, luna, garita, bandera, puerto, rico",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Garita Bandera Puerto Rico",
                        "ancho": 4.75,
                        "alto": 2.8
                },
                {
                        "id": 18,
                        "sku": "SKU-EVG-3464",
                        "nombre": "Media Luna Tambor y Garita",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.215646242361111,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.5391156059027775,
                        "precio_final": 5.54,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Tambor y Garita - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.75\"x2.84/BassWood (Media Luna Pequeña)",
                        "shopify_tags": "media, luna, tambor, garita",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Tambor y Garita",
                        "ancho": 4.75,
                        "alto": 2.84
                },
                {
                        "id": 19,
                        "sku": "SKU-EVG-1558",
                        "nombre": "Media Luna Guitarra Cotorra",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.214369534722222,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.535923836805555,
                        "precio_final": 5.54,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Guitarra Cotorra - Hecho en Puerto Rico",
                        "shopify_descripcion": "4.75\"x2.8\"",
                        "shopify_tags": "media, luna, guitarra, cotorra",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Guitarra Cotorra",
                        "ancho": 4.75,
                        "alto": 2.8
                },
                {
                        "id": 20,
                        "sku": "SKU-EVG-9429",
                        "nombre": "Media Luna Garita Coqui (Grande)",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.2791456486111112,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.697864121527778,
                        "precio_final": 5.7,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Garita Coqui (Grande) - Hecho en Puerto Rico",
                        "shopify_descripcion": "6.2\"x3.7\"/BassWood (Media Luna Grande)",
                        "shopify_tags": "media, luna, garita, coqui, grande",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Garita Coqui (Grande)",
                        "ancho": 6.2,
                        "alto": 3.7
                },
                {
                        "id": 21,
                        "sku": "SKU-EVG-9460",
                        "nombre": "Media Luna Tambor y Garita (Media Luna Grande)",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.2791456486111112,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.697864121527778,
                        "precio_final": 5.7,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Tambor y Garita (Media Luna Grande) - Hecho en Puerto Rico",
                        "shopify_descripcion": "6.2\"x3.7/BassWood (Media Luna Grande)",
                        "shopify_tags": "media, luna, tambor, garita, media, luna, grande",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Tambor y Garita (Media Luna Grande)",
                        "ancho": 6.2,
                        "alto": 3.7
                },
                {
                        "id": 22,
                        "sku": "SKU-EVG-7533",
                        "nombre": "Media Luna Guitarra Cotorra",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.2791456486111112,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.697864121527778,
                        "precio_final": 5.7,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Guitarra Cotorra - Hecho en Puerto Rico",
                        "shopify_descripcion": "6.2\"x3.7\"",
                        "shopify_tags": "media, luna, guitarra, cotorra",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Guitarra Cotorra",
                        "ancho": 6.2,
                        "alto": 3.7
                },
                {
                        "id": 23,
                        "sku": "SKU-EVG-8477",
                        "nombre": "Media Luna Casitas de San Juan",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.2791456486111112,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.697864121527778,
                        "precio_final": 5.7,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Casitas de San Juan - Hecho en Puerto Rico",
                        "shopify_descripcion": "6.2\"x3.7\"",
                        "shopify_tags": "media, luna, casitas, juan",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Casitas de San Juan",
                        "ancho": 6.2,
                        "alto": 3.7
                },
                {
                        "id": 24,
                        "sku": "SKU-EVG-7500",
                        "nombre": "Media Luna Garita Doble Bandera San Juan",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.2791456486111112,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.697864121527778,
                        "precio_final": 5.7,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Garita Doble Bandera San Juan - Hecho en Puerto Rico",
                        "shopify_descripcion": "6.2\"x3.7\"/BassWood (Media Luna Grande)",
                        "shopify_tags": "media, luna, garita, doble, bandera, juan",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Garita Doble Bandera San Juan",
                        "ancho": 6.2,
                        "alto": 3.7
                },
                {
                        "id": 25,
                        "sku": "SKU-EVG-6685",
                        "nombre": "Media Luna Flor Maga Puerto Rico (Media Luna Grande)",
                        "diseno_id": null,
                        "tiempo_corte": 1.5,
                        "tiempo_grabado": 1.0,
                        "costo_maquina": 0.625,
                        "costo_mano_obra": 1.5,
                        "costo_total": 2.2791456486111112,
                        "margen_ganancia": 0.6,
                        "precio_sugerido": 5.697864121527778,
                        "precio_final": 5.7,
                        "personalizado": 0,
                        "shopify_titulo": "Media Luna Flor Maga Puerto Rico (Media Luna Grande) - Hecho en Puerto Rico",
                        "shopify_descripcion": "6.2\"x3.7\"/BassWood (Media Luna Grande",
                        "shopify_tags": "media, luna, flor, maga, puerto, rico, media, luna, grande",
                        "shopify_alt_text": "Fotografía de producto terminado de Media Luna Flor Maga Puerto Rico (Media Luna Grande)",
                        "ancho": 6.2,
                        "alto": 3.7
                }
        ],
        "componentes_producto": [
                {
                        "id": 1,
                        "producto_id": 1,
                        "material_id": 2,
                        "cantidad_usada": 3.0,
                        "costo_calculado": 0.15
                },
                {
                        "id": 2,
                        "producto_id": 1,
                        "material_id": 5,
                        "cantidad_usada": 1.0,
                        "costo_calculado": 0.12
                },
                {
                        "id": 3,
                        "producto_id": 1,
                        "material_id": 6,
                        "cantidad_usada": 1.0,
                        "costo_calculado": 0.15
                },
                {
                        "id": 4,
                        "producto_id": 2,
                        "material_id": 1,
                        "cantidad_usada": 4.0,
                        "costo_calculado": 0.13
                },
                {
                        "id": 5,
                        "producto_id": 2,
                        "material_id": 5,
                        "cantidad_usada": 1.0,
                        "costo_calculado": 0.12
                },
                {
                        "id": 6,
                        "producto_id": 2,
                        "material_id": 6,
                        "cantidad_usada": 1.0,
                        "costo_calculado": 0.15
                },
                {
                        "id": 7,
                        "producto_id": 2,
                        "material_id": 7,
                        "cantidad_usada": 1.0,
                        "costo_calculado": 0.45
                },
                {
                        "id": 8,
                        "producto_id": 2,
                        "material_id": 8,
                        "cantidad_usada": 1.0,
                        "costo_calculado": 0.35
                },
                {
                        "id": 9,
                        "producto_id": 3,
                        "material_id": 1,
                        "cantidad_usada": 20.626399999999997,
                        "costo_calculado": 0.13127844166666663
                },
                {
                        "id": 10,
                        "producto_id": 4,
                        "material_id": 1,
                        "cantidad_usada": 19.5408,
                        "costo_calculado": 0.12436905000000001
                },
                {
                        "id": 11,
                        "producto_id": 5,
                        "material_id": 1,
                        "cantidad_usada": 11.7645,
                        "costo_calculado": 0.07487614062499999
                },
                {
                        "id": 12,
                        "producto_id": 6,
                        "material_id": 1,
                        "cantidad_usada": 5.8995,
                        "costo_calculado": 0.037547859375
                },
                {
                        "id": 13,
                        "producto_id": 7,
                        "material_id": 1,
                        "cantidad_usada": 9.477149999999996,
                        "costo_calculado": 0.060318110937499975
                },
                {
                        "id": 15,
                        "producto_id": 9,
                        "material_id": 1,
                        "cantidad_usada": 20.101999999999993,
                        "costo_calculado": 0.12794085416666662
                },
                {
                        "id": 16,
                        "producto_id": 10,
                        "material_id": 1,
                        "cantidad_usada": 12.696,
                        "costo_calculado": 0.08080475000000001
                },
                {
                        "id": 19,
                        "producto_id": 11,
                        "material_id": 1,
                        "cantidad_usada": 20.626399999999997,
                        "costo_calculado": 0.12052120111111109
                },
                {
                        "id": 20,
                        "producto_id": 8,
                        "material_id": 1,
                        "cantidad_usada": 4.6,
                        "costo_calculado": 0.026878055555555554
                },
                {
                        "id": 21,
                        "producto_id": 12,
                        "material_id": 1,
                        "cantidad_usada": 21.252000000000002,
                        "costo_calculado": 0.12417661666666668
                },
                {
                        "id": 23,
                        "producto_id": 13,
                        "material_id": 1,
                        "cantidad_usada": 9.315,
                        "costo_calculado": 0.0544280625
                },
                {
                        "id": 24,
                        "producto_id": 14,
                        "material_id": 1,
                        "cantidad_usada": 9.85458,
                        "costo_calculado": 0.05758085841666667
                },
                {
                        "id": 25,
                        "producto_id": 15,
                        "material_id": 1,
                        "cantidad_usada": 11.928949999999997,
                        "costo_calculado": 0.06970151756944443
                },
                {
                        "id": 26,
                        "producto_id": 16,
                        "material_id": 1,
                        "cantidad_usada": 11.928949999999997,
                        "costo_calculado": 0.06970151756944443
                },
                {
                        "id": 27,
                        "producto_id": 17,
                        "material_id": 1,
                        "cantidad_usada": 15.294999999999998,
                        "costo_calculado": 0.08936953472222221
                },
                {
                        "id": 28,
                        "producto_id": 18,
                        "material_id": 1,
                        "cantidad_usada": 15.513499999999997,
                        "costo_calculado": 0.0906462423611111
                },
                {
                        "id": 29,
                        "producto_id": 19,
                        "material_id": 1,
                        "cantidad_usada": 15.294999999999998,
                        "costo_calculado": 0.08936953472222221
                },
                {
                        "id": 30,
                        "producto_id": 20,
                        "material_id": 1,
                        "cantidad_usada": 26.381,
                        "costo_calculado": 0.15414564861111113
                },
                {
                        "id": 31,
                        "producto_id": 21,
                        "material_id": 1,
                        "cantidad_usada": 26.381,
                        "costo_calculado": 0.15414564861111113
                },
                {
                        "id": 32,
                        "producto_id": 22,
                        "material_id": 1,
                        "cantidad_usada": 26.381,
                        "costo_calculado": 0.15414564861111113
                },
                {
                        "id": 33,
                        "producto_id": 23,
                        "material_id": 1,
                        "cantidad_usada": 26.381,
                        "costo_calculado": 0.15414564861111113
                },
                {
                        "id": 34,
                        "producto_id": 24,
                        "material_id": 1,
                        "cantidad_usada": 26.381,
                        "costo_calculado": 0.15414564861111113
                },
                {
                        "id": 35,
                        "producto_id": 25,
                        "material_id": 1,
                        "cantidad_usada": 26.381,
                        "costo_calculado": 0.15414564861111113
                }
        ],
        "ordenes": [],
        "clientes": [
                {
                        "id": 3,
                        "nombre": "FBarros",
                        "contacto": "Lucia Barros (Dueña)",
                        "email": null,
                        "telefono": "(787)408-7310",
                        "notas": null,
                        "fecha_registro": "2026-06-02 12:17:29"
                }
        ],
        "catalogo_cliente": [
                {
                        "id": 1,
                        "cliente_id": 1,
                        "producto_id": 2,
                        "precio_especial": 10.0,
                        "notas": "Precio al por mayor pactado para lote de 50+ unidades."
                },
                {
                        "id": 2,
                        "cliente_id": 3,
                        "producto_id": 3,
                        "precio_especial": 1.45,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 3,
                        "cliente_id": 3,
                        "producto_id": 4,
                        "precio_especial": 1.45,
                        "notas": null
                },
                {
                        "id": 4,
                        "cliente_id": 3,
                        "producto_id": 5,
                        "precio_especial": 0.95,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 5,
                        "cliente_id": 3,
                        "producto_id": 6,
                        "precio_especial": 0.45,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 7,
                        "cliente_id": 3,
                        "producto_id": 7,
                        "precio_especial": 0.95,
                        "notas": "Asociado durante edición."
                },
                {
                        "id": 9,
                        "cliente_id": 3,
                        "producto_id": 9,
                        "precio_especial": 1.45,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 10,
                        "cliente_id": 3,
                        "producto_id": 10,
                        "precio_especial": 1.25,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 13,
                        "cliente_id": 3,
                        "producto_id": 11,
                        "precio_especial": 1.45,
                        "notas": "Asociado durante edición."
                },
                {
                        "id": 14,
                        "cliente_id": 3,
                        "producto_id": 8,
                        "precio_especial": 0.55,
                        "notas": "Asociado durante edición."
                },
                {
                        "id": 15,
                        "cliente_id": 3,
                        "producto_id": 12,
                        "precio_especial": 1.25,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 17,
                        "cliente_id": 3,
                        "producto_id": 13,
                        "precio_especial": 0.6,
                        "notas": "Asociado durante edición."
                },
                {
                        "id": 18,
                        "cliente_id": 3,
                        "producto_id": 14,
                        "precio_especial": 0.55,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 19,
                        "cliente_id": 3,
                        "producto_id": 15,
                        "precio_especial": 0.55,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 20,
                        "cliente_id": 3,
                        "producto_id": 16,
                        "precio_especial": 0.55,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 21,
                        "cliente_id": 3,
                        "producto_id": 17,
                        "precio_especial": 0.6,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 22,
                        "cliente_id": 3,
                        "producto_id": 18,
                        "precio_especial": 0.6,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 23,
                        "cliente_id": 3,
                        "producto_id": 19,
                        "precio_especial": 0.6,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 24,
                        "cliente_id": 3,
                        "producto_id": 20,
                        "precio_especial": 0.75,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 25,
                        "cliente_id": 3,
                        "producto_id": 21,
                        "precio_especial": 0.75,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 26,
                        "cliente_id": 3,
                        "producto_id": 22,
                        "precio_especial": 0.75,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 27,
                        "cliente_id": 3,
                        "producto_id": 23,
                        "precio_especial": 0.75,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 28,
                        "cliente_id": 3,
                        "producto_id": 24,
                        "precio_especial": 0.75,
                        "notas": "Asociado automáticamente durante el costeo."
                },
                {
                        "id": 29,
                        "cliente_id": 3,
                        "producto_id": 25,
                        "precio_especial": 0.75,
                        "notas": "Asociado automáticamente durante el costeo."
                }
        ],
        "facturas": [
                {
                        "id": 8,
                        "numero_factura": "EV-2026-0004",
                        "cliente_id": 1,
                        "fecha_emision": "2026-06-07",
                        "fecha_vencimiento": "2026-06-22",
                        "fecha_pago": "2026-06-07",
                        "metodo_pago": "ATH Movil",
                        "numero_cheque": null,
                        "subtotal": 20.0,
                        "ivu_estatal": 2.1,
                        "ivu_municipal": 0.2,
                        "total": 22.3,
                        "notas": "Pedido B2B de Carlos Rivera. Notas adicionales: [IVU DETALLES - Subtotal: $20.00 | IVU Estatal (10.5%): $2.10 | IVU Municipal (1.0%): $0.20 (COBRADO) | Total Final: $22.30]",
                        "estado": "Pagada",
                        "monto_pagado": 22.3,
                        "notificado": 0
                }
        ],
        "items_factura": [
                {
                        "id": 1,
                        "factura_id": 1,
                        "producto_id": 2,
                        "nombre_producto": "Llavero NFC Basswood Inteligente",
                        "cantidad": 20,
                        "precio_unitario": 10.0,
                        "total": 200.0
                },
                {
                        "id": 2,
                        "factura_id": 2,
                        "producto_id": 1,
                        "nombre_producto": "Llavero de Garita Walnut",
                        "cantidad": 20,
                        "precio_unitario": 6.5,
                        "total": 130.0
                },
                {
                        "id": 3,
                        "factura_id": 3,
                        "producto_id": 10,
                        "nombre_producto": "Corazón Bandera Puerto Rico",
                        "cantidad": 1,
                        "precio_unitario": 1.25,
                        "total": 1.25
                },
                {
                        "id": 4,
                        "factura_id": 3,
                        "producto_id": 8,
                        "nombre_producto": "Corazón con flor de Maga",
                        "cantidad": 1,
                        "precio_unitario": 0.55,
                        "total": 0.55
                },
                {
                        "id": 5,
                        "factura_id": 3,
                        "producto_id": 4,
                        "nombre_producto": "Llavero Guitarra y Cotorra",
                        "cantidad": 1,
                        "precio_unitario": 1.45,
                        "total": 1.45
                },
                {
                        "id": 6,
                        "factura_id": 4,
                        "producto_id": 1,
                        "nombre_producto": "Llavero de Garita Walnut",
                        "cantidad": 10,
                        "precio_unitario": 10.0,
                        "total": 100.0
                },
                {
                        "id": 7,
                        "factura_id": 5,
                        "producto_id": 1,
                        "nombre_producto": "Llavero de Garita Walnut",
                        "cantidad": 10,
                        "precio_unitario": 5.0,
                        "total": 50.0
                },
                {
                        "id": 8,
                        "factura_id": 6,
                        "producto_id": 1,
                        "nombre_producto": "Llavero de Garita Walnut",
                        "cantidad": 10,
                        "precio_unitario": 5.0,
                        "total": 50.0
                },
                {
                        "id": 9,
                        "factura_id": 7,
                        "producto_id": 10,
                        "nombre_producto": "Corazón Bandera Puerto Rico",
                        "cantidad": 1,
                        "precio_unitario": 1.25,
                        "total": 1.25
                },
                {
                        "id": 10,
                        "factura_id": 7,
                        "producto_id": 7,
                        "nombre_producto": "Garita Morro con Flor de Maga",
                        "cantidad": 1,
                        "precio_unitario": 0.95,
                        "total": 0.95
                },
                {
                        "id": 11,
                        "factura_id": 7,
                        "producto_id": 6,
                        "nombre_producto": "Garita Flor Maga",
                        "cantidad": 1,
                        "precio_unitario": 0.45,
                        "total": 0.45
                },
                {
                        "id": 12,
                        "factura_id": 8,
                        "producto_id": 2,
                        "nombre_producto": "Llavero NFC Basswood Inteligente",
                        "cantidad": 2,
                        "precio_unitario": 10.0,
                        "total": 20.0
                },
                {
                        "id": 13,
                        "factura_id": 9,
                        "producto_id": 10,
                        "nombre_producto": "Corazón Bandera Puerto Rico",
                        "cantidad": 1,
                        "precio_unitario": 5.51,
                        "total": 5.51
                },
                {
                        "id": 14,
                        "factura_id": 9,
                        "producto_id": 9,
                        "nombre_producto": "Corazón Flor Maga y Garita",
                        "cantidad": 1,
                        "precio_unitario": 5.63,
                        "total": 5.63
                },
                {
                        "id": 15,
                        "factura_id": 9,
                        "producto_id": 8,
                        "nombre_producto": "Corazón con flor de Maga",
                        "cantidad": 1,
                        "precio_unitario": 6.53,
                        "total": 6.53
                },
                {
                        "id": 16,
                        "factura_id": 9,
                        "producto_id": 7,
                        "nombre_producto": "Garita Morro con Flor de Maga",
                        "cantidad": 1,
                        "precio_unitario": 5.46,
                        "total": 5.46
                },
                {
                        "id": 17,
                        "factura_id": 9,
                        "producto_id": 1,
                        "nombre_producto": "Llavero de Garita Walnut",
                        "cantidad": 1,
                        "precio_unitario": 6.5,
                        "total": 6.5
                },
                {
                        "id": 18,
                        "factura_id": 9,
                        "producto_id": 4,
                        "nombre_producto": "Llavero Guitarra y Cotorra",
                        "cantidad": 1,
                        "precio_unitario": 4.5,
                        "total": 4.5
                },
                {
                        "id": 19,
                        "factura_id": 9,
                        "producto_id": 5,
                        "nombre_producto": "Llavero flor de Maga",
                        "cantidad": 1,
                        "precio_unitario": 5.5,
                        "total": 5.5
                },
                {
                        "id": 20,
                        "factura_id": 10,
                        "producto_id": 8,
                        "nombre_producto": "Corazón con flor de Maga",
                        "cantidad": 1,
                        "precio_unitario": 6.53,
                        "total": 6.53
                },
                {
                        "id": 21,
                        "factura_id": 10,
                        "producto_id": 9,
                        "nombre_producto": "Corazón Flor Maga y Garita",
                        "cantidad": 1,
                        "precio_unitario": 5.63,
                        "total": 5.63
                },
                {
                        "id": 22,
                        "factura_id": 10,
                        "producto_id": 10,
                        "nombre_producto": "Corazón Bandera Puerto Rico",
                        "cantidad": 1,
                        "precio_unitario": 5.51,
                        "total": 5.51
                },
                {
                        "id": 23,
                        "factura_id": 10,
                        "producto_id": 7,
                        "nombre_producto": "Garita Morro con Flor de Maga",
                        "cantidad": 1,
                        "precio_unitario": 5.46,
                        "total": 5.46
                },
                {
                        "id": 24,
                        "factura_id": 10,
                        "producto_id": 6,
                        "nombre_producto": "Garita Flor Maga",
                        "cantidad": 1,
                        "precio_unitario": 5.41,
                        "total": 5.41
                },
                {
                        "id": 25,
                        "factura_id": 10,
                        "producto_id": 5,
                        "nombre_producto": "Llavero flor de Maga",
                        "cantidad": 1,
                        "precio_unitario": 5.5,
                        "total": 5.5
                },
                {
                        "id": 26,
                        "factura_id": 10,
                        "producto_id": 1,
                        "nombre_producto": "Llavero de Garita Walnut",
                        "cantidad": 1,
                        "precio_unitario": 6.5,
                        "total": 6.5
                },
                {
                        "id": 27,
                        "factura_id": 10,
                        "producto_id": 4,
                        "nombre_producto": "Llavero Guitarra y Cotorra",
                        "cantidad": 1,
                        "precio_unitario": 4.5,
                        "total": 4.5
                }
        ],
        "carrito": [
                {
                        "id": 2,
                        "session_id": "sid-s418dfv8h",
                        "producto_id": 3,
                        "cantidad": 1
                },
                {
                        "id": 3,
                        "session_id": "sid-s418dfv8h",
                        "producto_id": 4,
                        "cantidad": 2
                },
                {
                        "id": 4,
                        "session_id": "sid-s418dfv8h",
                        "producto_id": 5,
                        "cantidad": 1
                },
                {
                        "id": 5,
                        "session_id": "sid-s418dfv8h",
                        "producto_id": 6,
                        "cantidad": 1
                },
                {
                        "id": 6,
                        "session_id": "sid-s418dfv8h",
                        "producto_id": 7,
                        "cantidad": 1
                }
        ]
};

    // Emulador robusto de almacenamiento (con fallback en memoria si localStorage está bloqueado o lleno)
    const StorageEmulation = {
        memory: {},
        isSupported: null,
        
        init() {
            if (this.isSupported !== null) return;
            try {
                localStorage.setItem('__test_ls__', '1');
                localStorage.removeItem('__test_ls__');
                this.isSupported = true;
            } catch (e) {
                console.warn("⚠️ LocalStorage no está disponible o tiene cuota excedida. Usando base de datos en memoria para esta sesión.");
                this.isSupported = false;
            }
        },
        
        getItem(key) {
            this.init();
            if (this.isSupported) {
                try {
                    return localStorage.getItem(key);
                } catch (e) {}
            }
            return this.memory[key] || null;
        },
        
        setItem(key, value) {
            this.init();
            if (this.isSupported) {
                try {
                    localStorage.setItem(key, value);
                    return;
                } catch (e) {
                    console.warn("⚠️ Error al escribir en LocalStorage. Migrando a memoria.", e);
                    this.isSupported = false;
                }
            }
            this.memory[key] = value;
        }
    };

    function processSeedData(key, val) {
        if (key === 'productos' && Array.isArray(val)) {
            return val.map(p => {
                if (p.sku && !p.foto_ruta) {
                    const ext = p.sku === 'SKU-GAR-LLAV-01' ? 'jpg' : 'jpeg';
                    p.foto_ruta = `/fotos_import/${p.sku}_referencia.${ext}`;
                }
                return p;
            });
        }
        return val;
    }

    function initDB() {
        if (initialized) return;
        
        // Control de versiones para la base de datos offline emulada
        const currentVersion = StorageEmulation.getItem('ev_db_version');
        const targetVersion = typeof OFFLINE_DB_VERSION !== 'undefined' ? OFFLINE_DB_VERSION : '1.0';
        
        if (currentVersion !== targetVersion) {
            console.log(`🔄 Actualizando base de datos offline a la versión: ${targetVersion}`);
            for (const [key, val] of Object.entries(SEED_DATA)) {
                const processed = processSeedData(key, val);
                StorageEmulation.setItem(`ev_db_${key}`, JSON.stringify(processed));
            }
            StorageEmulation.setItem('ev_db_version', targetVersion);
        } else {
            for (const [key, val] of Object.entries(SEED_DATA)) {
                const lsKey = `ev_db_${key}`;
                if (!StorageEmulation.getItem(lsKey)) {
                    const processed = processSeedData(key, val);
                    StorageEmulation.setItem(lsKey, JSON.stringify(processed));
                }
            }
        }
        initialized = true;
    }

    function getTable(name) {
        initDB();
        return JSON.parse(StorageEmulation.getItem(`ev_db_${name}`) || '[]');
    }

    function saveTable(name, data) {
        StorageEmulation.setItem(`ev_db_${name}`, JSON.stringify(data));
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
        async function handleImageUpload(file, folder, id, suffix) {
            const cfAccountId = StorageEmulation.getItem('evergreen_cloudflare_account_id') || localStorage.getItem('evergreen_cloudflare_account_id');
            const cfApiToken = StorageEmulation.getItem('evergreen_cloudflare_api_token') || localStorage.getItem('evergreen_cloudflare_api_token');
            const cfBucket = StorageEmulation.getItem('evergreen_cloudflare_bucket') || localStorage.getItem('evergreen_cloudflare_bucket');
            const cfDeliveryUrl = StorageEmulation.getItem('evergreen_cloudflare_delivery_url') || localStorage.getItem('evergreen_cloudflare_delivery_url');

            if (cfAccountId && cfApiToken && cfBucket && cfDeliveryUrl) {
                const extension = file.name ? file.name.split('.').pop() : 'jpg';
                const fileName = `${folder}/${id}_${suffix || 'foto'}_${Date.now()}.${extension}`;
                const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/r2/buckets/${cfBucket}/objects/${encodeURIComponent(fileName)}`;
                
                try {
                    const uploadResponse = await originalFetch(uploadUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${cfApiToken}`,
                            'Content-Type': file.type || 'image/jpeg'
                        },
                        body: file
                    });

                    if (!uploadResponse.ok) {
                        let errText = '';
                        try {
                            const errJson = await uploadResponse.json();
                            errText = errJson.errors && errJson.errors[0] ? errJson.errors[0].message : uploadResponse.statusText;
                        } catch(e) {
                            errText = uploadResponse.statusText;
                        }
                        throw new Error("Direct Cloudflare R2 Upload failed: " + errText);
                    }

                    const cleanDelivery = cfDeliveryUrl.endsWith('/') ? cfDeliveryUrl.slice(0, -1) : cfDeliveryUrl;
                    return `${cleanDelivery}/${fileName}`;
                } catch (r2Err) {
                    console.error("Error al subir a Cloudflare R2:", r2Err);
                    alert("Error al subir a Cloudflare R2. Se guardará de forma local temporalmente.");
                }
            }

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = e => reject(e);
                reader.readAsDataURL(file);
            });
        }

        let urlStr = '';
        if (typeof url === 'string') {
            urlStr = url;
        } else if (url instanceof URL) {
            urlStr = url.href;
        } else if (url && typeof url === 'object' && url.url) {
            urlStr = url.url;
        } else if (url && typeof url === 'object' && typeof url.toString === 'function') {
            urlStr = url.toString();
        }
        
        if (!urlStr || typeof urlStr !== 'string') {
            return originalFetch.apply(this, arguments);
        }
        
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
                
                // Validar que la respuesta sea JSON real y no HTML de redirección de hosting
                const health = await check.json();
                if (!health || health.status !== 'healthy') throw new Error();
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
                return mockResponse({ status: "success", data: getTable('materiales') });
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
                return mockResponse({ status: "success", data: getTable('retazos') });
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
                return mockResponse({ status: "success", data: getTable('productos') });
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
                return mockResponse({ status: "success", data: getTable('ordenes') });
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
                return mockResponse({ status: "success", data: getTable('disenos') });
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
                        return mockResponse({ status: "success", data: settings.filter(s => s.diseno_id === id) });
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
                return mockResponse({ status: "success", data: getTable('clientes') });
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
                    const prods = getTable('productos');
                    const clientCatalog = catalog.filter(c => c.cliente_id === id).map(item => {
                        const p = prods.find(prod => prod.id === item.producto_id) || {};
                        return {
                            ...item,
                            producto_nombre: p.nombre || "Producto Desconocido",
                            producto_sku: p.sku || "N/A",
                            costo_total: p.costo_total || 0,
                            precio_retail: p.precio_final || 0,
                            personalizado: p.personalizado || 0,
                            foto_ruta: p.foto_ruta || null
                        };
                    });
                    return mockResponse({ status: "success", data: clientCatalog });
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
                return mockResponse({ status: "success", data: getTable('facturas') });
            }
            if (path === '/facturas/nuevas' && method === 'GET') {
                const invoices = getTable('facturas');
                return mockResponse({ status: "success", data: invoices.filter(f => f.notificado === 0) });
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

            // 11. Carga de Fotos
            if (path === '/fotos/subir' && method === 'POST') {
                const tipoFoto = parsedUrl.searchParams.get('tipo_foto') || 'referencia';
                const productoId = parseInt(parsedUrl.searchParams.get('producto_id'));
                const ordenId = parseInt(parsedUrl.searchParams.get('orden_id'));
                const file = options.body.get('file');

                if (productoId) {
                    const url = await handleImageUpload(file, 'productos', productoId, tipoFoto);
                    const prods = getTable('productos');
                    const idx = prods.findIndex(p => p.id === productoId);
                    if (idx !== -1) {
                        prods[idx].foto_ruta = url;
                        saveTable('productos', prods);
                    }
                    return mockResponse({ status: "success", foto_url: url });
                }
                
                if (ordenId) {
                    const url = await handleImageUpload(file, 'ordenes', ordenId, tipoFoto);
                    const orders = getTable('ordenes');
                    const idx = orders.findIndex(o => o.id === ordenId);
                    if (idx !== -1) {
                        if (tipoFoto === 'antes') {
                            orders[idx].foto_antes = url;
                        } else {
                            orders[idx].foto_despues = url;
                        }
                        saveTable('ordenes', orders);
                    }
                    return mockResponse({ status: "success", foto_url: url });
                }

                const url = await handleImageUpload(file, 'general', Date.now(), tipoFoto);
                return mockResponse({ status: "success", foto_url: url });
            }

            if (path.startsWith('/materiales/') && path.endsWith('/foto') && method === 'POST') {
                const parts = path.split('/');
                const id = parseInt(parts[2]);
                const file = options.body.get('file');
                
                const url = await handleImageUpload(file, 'materiales', id, 'foto');
                const mats = getTable('materiales');
                const idx = mats.findIndex(m => m.id === id);
                if (idx !== -1) {
                    mats[idx].foto_url = url;
                    saveTable('materiales', mats);
                }
                return mockResponse({ status: "success", foto_url: url });
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

