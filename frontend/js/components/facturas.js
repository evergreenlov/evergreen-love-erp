/**
 * Componente de Facturación, Creador de PDFs e IVU ERP - Evergreen Love
 */

// Formatters
const MONEY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function getClienteDisplayData(clienteNombre, notas, defaultEmail = '', defaultPhone = '') {
    let name = clienteNombre;
    let phone = defaultPhone || '';
    let email = defaultEmail || '';
    let notasAdicionales = notas || '';

    if (clienteNombre === 'Cliente Público' && notas) {
        const matchNombre = notas.match(/Pedido Público de ([^.]+)/);
        const matchTel = notas.match(/Tel: ([^|.]+)/);
        const matchEmail = notas.match(/Email: ([^.]+)/);
        const matchNotas = notas.match(/Notas adicionales: (.*)/);

        if (matchNombre) name = `${matchNombre[1].trim()} (Público)`;
        if (matchTel) phone = matchTel[1].trim();
        if (matchEmail) {
            const parsedEmail = matchEmail[1].trim();
            if (parsedEmail !== 'N/A') email = parsedEmail;
        }
        if (matchNotas) {
            const parsedNotes = matchNotas[1].trim();
            if (parsedNotes !== 'Ninguna' && parsedNotes !== 'Ninguno') {
                notasAdicionales = parsedNotes;
            }
        }
    }
    return { name, phone, email, notas: notasAdicionales };
}

// Helper functions for PDF Generation
function cleanPdfText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, " ")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function wrapPdfText(value, maxLength = 72) {
    const words = String(value || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
        const next = line ? line + " " + word : word;
        if (next.length > maxLength && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
}

function dataUrlToBytes(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

function withPdfCacheBust(source) {
    const value = String(source || "");
    if (!value || value.startsWith("data:")) return value;
    try {
        const url = new URL(value, window.location.href);
        url.searchParams.set("pdf", String(Date.now()));
        return url.href;
    } catch {
        return value;
    }
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

async function sourceToDataUrl(source) {
    const value = String(source || "");
    if (!value) return "";
    if (value.startsWith("data:")) return value;
    try {
        const response = await fetch(withPdfCacheBust(getFullImageUrl(value)), {
            cache: "no-store",
            credentials: "omit",
            mode: "cors",
        });
        if (!response.ok) return "";
        return await blobToDataUrl(await response.blob());
    } catch {
        return "";
    }
}

async function loadLogoForPdf(source, maxSize = 96) {
    const dataUrl = await sourceToDataUrl(source);
    if (!dataUrl) return null;

    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            try {
                const scale = Math.min(maxSize / image.naturalWidth, maxSize / image.naturalHeight, 1);
                const width = Math.max(1, Math.round(image.naturalWidth * scale));
                const height = Math.max(1, Math.round(image.naturalHeight * scale));
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext("2d");
                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, width, height);
                context.drawImage(image, 0, 0, width, height);
                const pixels = context.getImageData(0, 0, width, height).data;
                const bytes = new Uint8Array(width * height * 3);
                for (let pixelIndex = 0, byteIndex = 0; pixelIndex < pixels.length; pixelIndex += 4) {
                    bytes[byteIndex] = pixels[pixelIndex];
                    bytes[byteIndex + 1] = pixels[pixelIndex + 1];
                    bytes[byteIndex + 2] = pixels[pixelIndex + 2];
                    byteIndex += 3;
                }
                resolve({ bytes, width, height });
            } catch {
                resolve(null);
            }
        };
        image.onerror = () => resolve(null);
        image.src = dataUrl;
    });
}

function encodePdfAscii(value) {
    return new TextEncoder().encode(value);
}

function cleanInvoiceNotes(notes) {
    if (!notes) return "";
    return notes
        .replace(/\[IVU DETALLES - [^\]]+\]/g, "")
        .replace(/Notas adicionales:\s*$/, "")
        .replace(/Notas:\s*$/, "")
        .trim();
}

async function buildSimpleInvoicePdf({ invoiceMeta, selectedCustomer, rows, subtotal, stateTax, municipalTax, ivu, total, montoPagado, stateTaxRate, municipalTaxRate, municipalTaxEnabled, logoSrc }) {
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const bottom = 58;
    const logo = await loadLogoForPdf(logoSrc, 96);
    
    // Load product images in parallel
    const loadedRows = await Promise.all(rows.map(async (item) => {
        let image = null;
        if (item.foto_ruta) {
            image = await loadLogoForPdf(item.foto_ruta, 48); // thumbnail max 48px
        }
        return { ...item, image };
    }));
    
    const pages = [];
    let commands = [];
    let y = pageHeight - margin;
    let pageNumber = 1;

    function textAt(x, yPos, size, value, bold = false) {
        const font = bold ? "/F2" : "/F1";
        commands.push("BT " + font + " " + size + " Tf " + x + " " + yPos + " Td (" + cleanPdfText(value) + ") Tj ET");
    }
    function imageAt(name, x, yPos, width, height) {
        commands.push("q " + width + " 0 0 " + height + " " + x + " " + yPos + " cm /" + name + " Do Q");
    }
    function logoAt(x, yPos, width, height) {
        if (!logo) return;
        imageAt("Logo1", x, yPos, width, height);
    }
    function textRight(xRight, yPos, size, value, bold = false) {
        const safe = cleanPdfText(value);
        const width = safe.length * size * 0.48;
        textAt(Math.max(margin, xRight - width), yPos, size, safe, bold);
    }
    function line(x1, y1, x2, y2) {
        commands.push("0.37 0.35 0.19 RG 1 w " + x1 + " " + y1 + " m " + x2 + " " + y2 + " l S"); // Moss Green
    }
    function finishPage() {
        line(margin, 36, pageWidth - margin, 36);
        textAt(margin, 22, 8, "Evergreen Love | evergreenlov@gmail.com | (787) 960-1431");
        textRight(pageWidth - margin, 22, 8, "Página " + pageNumber);
        pages.push(commands.join("\n"));
        commands = [];
        pageNumber += 1;
        y = pageHeight - margin;
    }
    function ensureSpace(height) {
        if (y - height < bottom) {
            finishPage();
            drawHeader(false);
            drawTableHeader();
        }
    }
    function drawHeader(includeCustomer = true) {
        const brandX = logo ? margin + 58 : margin;
        logoAt(margin, y - 44, 44, 44);
        textAt(brandX, y - 32, 30, "Factura", true);
        textRight(pageWidth - margin, y - 6, 13, invoiceMeta.number || "Factura", true);
        textRight(pageWidth - margin, y - 26, 9, "Fecha: " + (invoiceMeta.date || "N/A"));
        textRight(pageWidth - margin, y - 40, 9, "Vence: " + (invoiceMeta.due || "Al recibir"));
        y -= 58;
        line(margin, y, pageWidth - margin, y);
        y -= 24;
        textAt(margin, y, 10, "Myriam Nieves | Evergreen Love", true);
        y -= 14;
        textAt(margin, y, 9, "San Juan, Puerto Rico | (787) 960-1431 | evergreenlov@gmail.com");
        y -= 24;
        if (includeCustomer) {
            textAt(margin, y, 10, "Cliente", true);
            y -= 15;
            textAt(margin, y, 12, selectedCustomer?.name || "Sin cliente", true);
            y -= 14;
            
            const contactInfo = [selectedCustomer?.email, selectedCustomer?.phone].filter(Boolean).join(" | ");
            wrapPdfText(contactInfo, 84).forEach((lineText) => {
                textAt(margin, y, 9, lineText);
                y -= 12;
            });
            y -= 10;
        }
    }
    function drawTableHeader() {
        line(margin, y, pageWidth - margin, y);
        y -= 14;
        textAt(margin, y, 8, "Producto", true);
        textAt(354, y, 8, "Cant.", true);
        textAt(420, y, 8, "Precio", true);
        textRight(pageWidth - margin, y, 8, "Total", true);
        y -= 9;
        line(margin, y, pageWidth - margin, y);
        y -= 18;
    }

    drawHeader(true);
    drawTableHeader();

    loadedRows.forEach((item, index) => {
        const name = (index + 1) + ". " + (item.nombre_producto || item.producto_nombre || "Producto");
        const rowHeight = 36; // Larger row height to fit the image
        ensureSpace(rowHeight + 8);
        
        let textXOffset = margin;
        if (item.image) {
            const imgSize = 24;
            const imgY = y - 18; // Center the image vertically in the 36-point row height
            imageAt(`ProdImage${index}`, margin, imgY, imgSize, imgSize);
            textXOffset += 32;
        }
        
        textAt(textXOffset, y - 4, 9, name, true); // Align text with image center
        textAt(365, y - 4, 9, String(item.cantidad));
        textRight(470, y - 4, 9, MONEY.format(item.precio_unitario || 0));
        textRight(pageWidth - margin, y - 4, 9, MONEY.format(item.total || 0), true);
        y -= rowHeight;
    });

    ensureSpace(150);
    line(340, y, pageWidth - margin, y);
    y -= 18;
    const totals = [
        ["Subtotal", subtotal],
        ["IVU estatal " + stateTaxRate + "%", stateTax],
        ["IVU municipal " + (municipalTaxEnabled ? municipalTaxRate + "%" : "exento"), municipalTax],
        ["IVU total", ivu],
        ["Total a Pagar", total],
    ];
    totals.forEach(([label, amount], index) => {
        const isLast = index === totals.length - 1;
        const bold = isLast;
        textAt(350, y, bold ? 11 : 9, label, bold);
        textRight(pageWidth - margin, y, bold ? 11 : 9, MONEY.format(amount), bold);
        y -= bold ? 20 : 15;
    });

    // Payment balance block
    const hasMontoPagado = montoPagado !== null && montoPagado !== undefined && montoPagado >= 0;
    const balanceDue = hasMontoPagado ? Math.max(0, total - montoPagado) : null;
    if (hasMontoPagado) {
        y -= 4;
        // Draw a light background rect for the payment block
        commands.push("q 0.93 0.97 0.93 rg " + 340 + " " + (y - 12) + " " + (pageWidth - margin - 340) + " 48 re f Q"); // light green fill
        commands.push("q 0.45 0.60 0.36 RG 0.5 w " + 340 + " " + (y - 12) + " " + (pageWidth - margin - 340) + " 48 re S Q"); // green border
        y -= 2;
        textAt(350, y, 9, "Cantidad Pagada", false);
        textRight(pageWidth - margin, y, 9, MONEY.format(montoPagado), false);
        y -= 16;
        if (balanceDue > 0) {
            // Red highlight for remaining balance
            commands.push("q 1.0 0.95 0.95 rg " + 340 + " " + (y - 8) + " " + (pageWidth - margin - 340) + " 20 re f Q");
            textAt(350, y, 10, "Balance Restante", true);
            textRight(pageWidth - margin, y, 10, MONEY.format(balanceDue), true);
        } else {
            textAt(350, y, 10, "Balance Restante", true);
            textRight(pageWidth - margin, y, 10, MONEY.format(0), true);
        }
        y -= 22;
    }
    y -= 10;
    textAt(margin, y, 10, "Método de pago", true);
    y -= 14;
    textAt(margin, y, 9, [invoiceMeta.paymentMethod || "Pendiente", invoiceMeta.checkNumber && "Cheque #" + invoiceMeta.checkNumber].filter(Boolean).join(" | "));
    y -= 22;
    textAt(margin, y, 10, "Términos y Condiciones", true);
    y -= 14;
    wrapPdfText("Haga todos los cheques pagaderos a Myriam Nieves. El pago vence según lo acordado. Si tiene alguna pregunta sobre esta factura, comuníquese con Myriam Nieves al (787) 960-1431 o evergreenlov@gmail.com.", 96).forEach((lineText) => {
        textAt(margin, y, 8, lineText);
        y -= 10;
    });
    if (invoiceMeta.notes) {
        const cleanedNotes = cleanInvoiceNotes(invoiceMeta.notes);
        if (cleanedNotes) {
            y -= 6;
            wrapPdfText("Notas: " + cleanedNotes, 96).forEach((lineText) => {
                textAt(margin, y, 8, lineText);
                y -= 10;
            });
        }
    }
    finishPage();

    const objects = [];
    const fontRegularId = 3;
    const fontBoldId = 4;
    const imageResources = [];
    if (logo) imageResources.push({ name: "Logo1", image: logo });
    
    // Add product images to resources
    loadedRows.forEach((item, index) => {
        if (item.image) {
            imageResources.push({ name: `ProdImage${index}`, image: item.image });
        }
    });
    
    const imageStartId = 5;
    const firstPageId = imageStartId + imageResources.length;
    const pageObjectIds = pages.map((_, index) => firstPageId + index * 2);
    const contentObjectIds = pages.map((_, index) => firstPageId + index * 2 + 1);
    objects[1] = ["<< /Type /Catalog /Pages 2 0 R >>"];
    objects[2] = ["<< /Type /Pages /Kids [" + pageObjectIds.map((id) => id + " 0 R").join(" ") + "] /Count " + pages.length + " >>"];
    objects[fontRegularId] = ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
    objects[fontBoldId] = ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
    imageResources.forEach((resource, index) => {
        const objectId = imageStartId + index;
        objects[objectId] = [
            "<< /Type /XObject /Subtype /Image /Width " + resource.image.width + " /Height " + resource.image.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length " + resource.image.bytes.length + " >>\nstream\n",
            resource.image.bytes,
            "\nendstream"
        ];
    });
    pages.forEach((content, index) => {
        const pageId = pageObjectIds[index];
        const contentId = contentObjectIds[index];
        const xObjectEntries = imageResources.map((resource, imageIndex) => "/" + resource.name + " " + (imageStartId + imageIndex) + " 0 R").join(" ");
        const xObject = imageResources.length ? " /XObject << " + xObjectEntries + " >>" : "";
        objects[pageId] = ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidth + " " + pageHeight + "] /Resources << /Font << /F1 " + fontRegularId + " 0 R /F2 " + fontBoldId + " 0 R >>" + xObject + " >> /Contents " + contentId + " 0 R >>"];
        objects[contentId] = ["<< /Length " + encodePdfAscii(content).length + " >>\nstream\n" + content + "\nendstream"];
    });

    const chunks = [];
    const offsets = [0];
    let byteLength = 0;
    function append(chunk) {
        const bytes = typeof chunk === "string" ? encodePdfAscii(chunk) : chunk;
        chunks.push(bytes);
        byteLength += bytes.length;
    }
    append("%PDF-1.4\n");
    for (let id = 1; id < objects.length; id += 1) {
        if (!objects[id]) continue;
        offsets[id] = byteLength;
        append(id + " 0 obj\n");
        objects[id].forEach(append);
        append("\nendobj\n");
    }
    const xrefStart = byteLength;
    append("xref\n0 " + objects.length + "\n0000000000 65535 f \n");
    for (let id = 1; id < objects.length; id += 1) {
        append(String(offsets[id] || 0).padStart(10, "0") + " 00000 n \n");
    }
    append("trailer\n<< /Size " + objects.length + " /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF");
    return new Blob(chunks, { type: "application/pdf" });
}

// MAIN COMPONENT DEFINITION
const FacturasComponent = {
    facturas: [],
    clientes: [],
    productos: [],
    activeTab: "list", // 'list', 'create', 'reports'
    selectedClienteId: null,
    currentClientCatalog: [],
    cart: [],
    reporte: { totales: {}, reporte_mensual: [] },
    
    // Invoice creator state
    selectedProductId: "",
    selectedProductPrice: 0.0,
    selectedProductIsPactado: false,
    selectedQty: 1,
    invoiceDate: "",
    invoiceDueDate: "",
    municipalTaxEnabled: true,
    invoiceNotes: "Gracias por apoyar las artesanías de Evergreen Love.",
    invoiceNumber: "",

    // Payment register state
    paymentModalFactura: null,

    suggestNextInvoiceNumber() {
        const year = new Date().getFullYear();
        const prefix = `EV-${year}-`;
        let maxSeq = 0;
        this.facturas.forEach(f => {
            if (f.numero_factura && f.numero_factura.startsWith(prefix)) {
                const parts = f.numero_factura.split('-');
                if (parts.length >= 3) {
                    const seqStr = parts[parts.length - 1];
                    const seq = parseInt(seqStr, 10);
                    if (!isNaN(seq) && seq > maxSeq) {
                        maxSeq = seq;
                    }
                }
            }
        });
        const nextSeq = maxSeq + 1;
        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    },

    updateAutoInvoiceNumber() {
        const input = document.getElementById('inv-numero-manual');
        if (input) {
            input.value = this.suggestNextInvoiceNumber();
        }
    },

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <style>
                .facturas-nav-tabs {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 24px;
                    border-bottom: 1px solid var(--color-gray-border);
                    padding-bottom: 10px;
                }
                .facturas-nav-tab {
                    padding: 8px 16px;
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    font-weight: 600;
                    color: var(--color-olive-brown);
                    transition: all 0.2s;
                }
                .facturas-nav-tab:hover {
                    background-color: rgba(95, 90, 48, 0.05);
                }
                .facturas-nav-tab.active {
                    background-color: var(--color-moss-green);
                    color: var(--color-white);
                }
                .creator-grid {
                    display: grid;
                    grid-template-columns: 1fr 1.5fr;
                    gap: 24px;
                }
                @media (max-width: 900px) {
                    .creator-grid {
                        grid-template-columns: 1fr;
                    }
                }
                .cart-table th, .cart-table td {
                    padding: 10px 14px;
                    font-size: 13.5px;
                }
                .invoice-row {
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .invoice-row:hover {
                    background-color: rgba(95, 90, 48, 0.02);
                }
                .invoice-detail-row {
                    background-color: var(--color-gray-light);
                }
                .invoice-detail-container {
                    padding: 16px 24px;
                    border-left: 4px solid var(--color-moss-green);
                    font-size: 13px;
                    color: var(--color-soft-black);
                }
                .invoice-detail-title {
                    font-weight: 600;
                    margin-bottom: 12px;
                    color: var(--color-moss-green);
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .invoice-detail-table {
                    width: 100%;
                    max-width: 700px;
                    border-collapse: collapse;
                    margin-top: 8px;
                    background: white;
                    border-radius: var(--radius-sm);
                    box-shadow: var(--shadow-sm);
                    overflow: hidden;
                    border: 1px solid var(--color-gray-border);
                }
                .invoice-detail-table th {
                    text-align: left;
                    padding: 10px 12px;
                    font-weight: 600;
                    font-size: 12px;
                    color: var(--color-olive-brown);
                    background-color: var(--color-gray-light);
                    border-bottom: 1px solid var(--color-gray-border);
                }
                .invoice-detail-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid var(--color-gray-border);
                    vertical-align: middle;
                }
                .invoice-detail-table tr:last-child td {
                    border-bottom: none;
                }
            </style>

            <div class="facturas-nav-tabs">
                <div class="facturas-nav-tab active" id="tab-list" data-tab="list">
                    <i data-lucide="file-text" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Facturas Emitidas
                </div>
                <div class="facturas-nav-tab" id="tab-create" data-tab="create">
                    <i data-lucide="plus-circle" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Crear Factura
                </div>
                <div class="facturas-nav-tab" id="tab-reports" data-tab="reports">
                    <i data-lucide="bar-chart-3" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Contabilidad y Planillas
                </div>
                <div class="facturas-nav-tab" id="tab-expenses" data-tab="expenses">
                    <i data-lucide="receipt" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Registro de Gastos
                </div>
            </div>

            <!-- VISTA 1: LISTADO DE FACTURAS -->
            <div id="view-section-list" class="factura-section animate-fade-in">
                <div class="card">
                    <h3 class="card-title">Registro de Facturas</h3>
                    <p style="color: #6c757d; font-size: 14px; margin-bottom: 20px; margin-top:-8px;">
                        Gestiona los cobros de clientes comerciales, descarga los comprobantes de facturas en formato PDF nativo y anula transacciones de ser necesario.
                    </p>
                    <div class="table-container">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th style="width: 40px;"></th>
                                    <th>Número</th>
                                    <th>Cliente</th>
                                    <th>Emisión</th>
                                    <th>Vence</th>
                                    <th>Total</th>
                                    <th>Estado</th>
                                    <th style="text-align:right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="facturas-list-body">
                                <tr>
                                    <td colspan="7" style="text-align: center; color: #8c8c8c; padding: 30px;">Cargando registro de facturas...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- VISTA 2: CREACIÓN DE FACTURA -->
            <div id="view-section-create" class="factura-section animate-fade-in" style="display:none;">
                <div class="creator-grid">
                    <!-- PANEL IZQUIERDO: Encabezado y Cliente -->
                    <div class="card" style="display:flex; flex-direction:column; gap:16px;">
                        <h3 class="card-title" style="margin-bottom:0;">Datos de Facturación</h3>
                        
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Cliente Comercial B2B *</label>
                            <select id="inv-cliente-id" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); cursor:pointer;">
                                <option value="">Seleccione un cliente comercial...</option>
                            </select>
                            <div id="inv-cliente-detail" style="font-size:12.5px; color:var(--color-olive-brown); padding:8px; background-color:var(--color-gray-light); border-radius:var(--radius-sm); border:1px solid var(--color-gray-border); display:none; line-height:1.4;">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 500; font-size: 13px;">Fecha Emisión</label>
                                <input type="date" id="inv-fecha-emision" style="padding: 9px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 500; font-size: 13px;">Fecha Vencimiento</label>
                                <input type="date" id="inv-fecha-vence" style="padding: 9px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Número de Factura</label>
                            <input type="text" id="inv-numero-manual" placeholder="EV-YYYY-XXXX" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                            <span style="font-size:11px; color:#8c8270;">Generado automáticamente. Puede editarlo manualmente si es necesario.</span>
                        </div>

                        <div style="display: flex; align-items: center; gap: 8px; margin-top:4px; padding:4px 0;">
                            <input type="checkbox" id="inv-ivu-municipal-enabled" checked style="width:16px; height:16px; cursor:pointer;">
                            <label for="inv-ivu-municipal-enabled" style="font-weight: 500; font-size: 13px; cursor:pointer;">Cobrar IVU Municipal (1.0%)</label>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Notas en la Factura</label>
                            <textarea id="inv-notas" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); min-height:80px; resize:vertical;"></textarea>
                        </div>
                    </div>

                    <!-- PANEL DERECHO: Partidas e Inventario -->
                    <div class="card" style="display:flex; flex-direction:column; gap:16px;">
                        <h3 class="card-title" style="margin-bottom:0;">Agregar Productos y Partidas</h3>
                        
                        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:12px; align-items:flex-end;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 500; font-size: 13px;">Producto del Catálogo</label>
                                <select id="inv-add-producto-id" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); cursor:pointer;">
                                    <option value="">Seleccione un producto...</option>
                                </select>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 500; font-size: 13px;">Precio Unitario ($)</label>
                                <input type="number" step="0.01" id="inv-add-precio" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-weight: 500; font-size: 13px;">Cantidad</label>
                                <input type="number" min="1" id="inv-add-qty" value="1" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                            </div>
                        </div>
                        <div id="inv-price-badge-container" style="margin-top:-8px; font-size:12px; min-height:16px;"></div>

                        <div style="display:flex; justify-content:flex-end;">
                            <button class="btn btn-secondary" id="btn-add-item-cart" style="padding: 6px 14px; font-size:13px; display:inline-flex; align-items:center; gap:6px; border-color:var(--color-moss-green); color:var(--color-moss-green);">
                                <i data-lucide="plus"></i> Añadir Partida
                            </button>
                        </div>

                        <!-- Carrito de Partidas -->
                        <div class="table-container" style="margin-top:8px;">
                            <table class="custom-table cart-table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Cant.</th>
                                        <th>Precio</th>
                                        <th>Total</th>
                                        <th style="text-align:right;">Quitar</th>
                                    </tr>
                                </thead>
                                <tbody id="inv-cart-body">
                                    <tr>
                                        <td colspan="5" style="text-align: center; color: #8c8c8c; padding: 20px; font-style:italic;">No hay partidas añadidas aún.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Resumen Financiero -->
                        <div style="align-self:flex-end; width:100%; max-width:300px; display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--color-gray-border); padding-top:12px; font-size:13.5px;">
                            <div style="display:flex; justify-content:space-between;">
                                <span>Subtotal:</span>
                                <strong id="inv-summary-subtotal">$0.00</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>IVU Estatal (10.5%):</span>
                                <strong id="inv-summary-estatal">$0.00</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>IVU Municipal (1.0%):</span>
                                <strong id="inv-summary-municipal">$0.00</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:15px; border-top:1px dashed var(--color-gray-border); padding-top:8px; margin-top:4px; color:var(--color-moss-green);">
                                <span>Total Factura:</span>
                                <strong id="inv-summary-total">$0.00</strong>
                            </div>
                        </div>

                        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px; border-top:1px solid var(--color-gray-border); padding-top:16px;">
                            <button class="btn btn-secondary" id="btn-cancel-invoice" style="flex:1; max-width:120px;">Cancelar</button>
                            <button class="btn btn-primary" id="btn-save-invoice" style="flex:1; max-width:200px;">
                                <i data-lucide="check"></i> Guardar Factura
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- VISTA 3: CONTABILIDAD Y REPORTES -->
            <div id="view-section-reports" class="factura-section animate-fade-in" style="display:none;">
                <!-- KPI GRID -->
                <div class="kpi-grid">
                    <div class="card kpi-card">
                        <div class="kpi-icon moss">
                            <i data-lucide="trending-up"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Ingresos Totales (Facturado)</span>
                            <span class="kpi-value" id="rep-kpi-facturado">$0.00</span>
                        </div>
                    </div>
                    <div class="card kpi-card">
                        <div class="kpi-icon terracotta">
                            <div class="status-indicator online" style="position:absolute; margin-top:-24px; margin-left:36px;"></div>
                            <i data-lucide="wallet"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Total Recaudado (Cobrado)</span>
                            <span class="kpi-value" id="rep-kpi-recaudado">$0.00</span>
                        </div>
                    </div>
                    <div class="card kpi-card">
                        <div class="kpi-icon blue">
                            <i data-lucide="clock"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Cuentas por Cobrar (Pendiente)</span>
                            <span class="kpi-value" id="rep-kpi-pendiente">$0.00</span>
                        </div>
                    </div>
                    <div class="card kpi-card">
                        <div class="kpi-icon olive">
                            <i data-lucide="percent"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">10% de Ventas (Facturado)</span>
                            <span class="kpi-value" id="rep-kpi-diez-porciento">$0.00</span>
                        </div>
                    </div>
                    <div class="card kpi-card">
                        <div class="kpi-icon terracotta">
                            <i data-lucide="minus-circle"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Gastos Totales (Deducibles)</span>
                            <span class="kpi-value" id="rep-kpi-gastos">$0.00</span>
                        </div>
                    </div>
                    <div class="card kpi-card">
                        <div class="kpi-icon moss">
                            <i data-lucide="dollar-sign"></i>
                        </div>
                        <div class="kpi-info">
                            <span class="kpi-label">Ganancia Neta (Sujeto a Planilla)</span>
                            <span class="kpi-value" id="rep-kpi-ganancia">$0.00</span>
                        </div>
                    </div>
                </div>

                <!-- TARJETAS DE ESTADO DE FACTURAS -->
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:14px; margin-bottom:24px;">
                    <div class="card" style="padding:18px 20px; border-left:4px solid var(--color-moss-green); display:flex; flex-direction:column; gap:6px;">
                        <div style="font-size:11px; font-weight:700; color:var(--color-moss-green); text-transform:uppercase; letter-spacing:0.6px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="check-circle-2" style="width:14px; height:14px;"></i> Pagadas
                        </div>
                        <div id="status-card-pagadas-count" style="font-size:26px; font-weight:800; color:var(--color-soft-black);">0</div>
                        <div id="status-card-pagadas-total" style="font-size:13px; color:#6c757d; font-weight:600;">$0.00</div>
                    </div>
                    <div class="card" style="padding:18px 20px; border-left:4px solid #e8a44a; display:flex; flex-direction:column; gap:6px;">
                        <div style="font-size:11px; font-weight:700; color:#c88620; text-transform:uppercase; letter-spacing:0.6px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="clock" style="width:14px; height:14px;"></i> Pendientes
                        </div>
                        <div id="status-card-pendientes-count" style="font-size:26px; font-weight:800; color:var(--color-soft-black);">0</div>
                        <div id="status-card-pendientes-total" style="font-size:13px; color:#6c757d; font-weight:600;">$0.00</div>
                    </div>
                    <div class="card" style="padding:18px 20px; border-left:4px solid var(--color-terracotta); display:flex; flex-direction:column; gap:6px;">
                        <div style="font-size:11px; font-weight:700; color:var(--color-terracotta); text-transform:uppercase; letter-spacing:0.6px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="alert-triangle" style="width:14px; height:14px;"></i> Vencidas
                        </div>
                        <div id="status-card-vencidas-count" style="font-size:26px; font-weight:800; color:var(--color-soft-black);">0</div>
                        <div id="status-card-vencidas-total" style="font-size:13px; color:#6c757d; font-weight:600;">$0.00</div>
                    </div>
                    <div class="card" style="padding:18px 20px; border-left:4px solid #adb5bd; display:flex; flex-direction:column; gap:6px;">
                        <div style="font-size:11px; font-weight:700; color:#6c757d; text-transform:uppercase; letter-spacing:0.6px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="x-circle" style="width:14px; height:14px;"></i> Anuladas
                        </div>
                        <div id="status-card-anuladas-count" style="font-size:26px; font-weight:800; color:var(--color-soft-black);">0</div>
                        <div id="status-card-anuladas-total" style="font-size:13px; color:#6c757d; font-weight:600;">$0.00</div>
                    </div>
                    <div class="card" id="status-card-sin-recibo" style="padding:18px 20px; border-left:4px solid #6c8ebf; display:flex; flex-direction:column; gap:6px; cursor:pointer;" title="Ver gastos sin recibo">
                        <div style="font-size:11px; font-weight:700; color:#4a6fa5; text-transform:uppercase; letter-spacing:0.6px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="file-x" style="width:14px; height:14px;"></i> Sin Recibo
                        </div>
                        <div id="status-card-sinrecibo-count" style="font-size:26px; font-weight:800; color:var(--color-soft-black);">0</div>
                        <div id="status-card-sinrecibo-total" style="font-size:13px; color:#6c757d; font-weight:600;">$0.00</div>
                        <div style="font-size:10.5px; color:#4a6fa5; margin-top:2px;">Clic para ver →</div>
                    </div>
                </div>

                <!-- GRÁFICAS -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
                    <div class="card" style="padding:20px;">
                        <h3 class="card-title" style="margin-bottom:4px; font-size:14px;">Ventas vs Gastos por Mes</h3>
                        <p style="font-size:12px; color:#8c8270; margin:0 0 14px;">Comparación mensual de ingresos y gastos deducibles.</p>
                        <div id="chart-ventas-gastos" style="width:100%; overflow-x:auto;"></div>
                    </div>
                    <div class="card" style="padding:20px;">
                        <h3 class="card-title" style="margin-bottom:4px; font-size:14px;">IVU Devengado por Mes</h3>
                        <p style="font-size:12px; color:#8c8270; margin:0 0 14px;">Estatal (10.5%) y Municipal (1%) acumulados por mes.</p>
                        <div id="chart-ivu" style="width:100%; overflow-x:auto;"></div>
                    </div>
                </div>

                <!-- DESGLOSE IVU POR PERIODO PERSONALIZADO -->
                <div class="card" style="margin-bottom:24px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                        <div>
                            <h3 class="card-title" style="margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                                <i data-lucide="calendar-range" style="color:var(--color-moss-green); width:18px; height:18px;"></i>
                                Desglose IVU por Periodo
                            </h3>
                            <p style="color:#6c757d; font-size:13.5px; margin:0;">
                                Calcula el IVU devengado para cualquier rango de fechas. Ideal para declaraciones en SURI.
                            </p>
                        </div>
                        <button id="btn-periodo-ivu-actual" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; font-size:12.5px; white-space:nowrap;">
                            <i data-lucide="zap" style="width:14px; height:14px;"></i>
                            Periodo IVU Actual
                        </button>
                    </div>

                    <div style="display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; margin-bottom:20px;">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <label style="font-size:11px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.5px;">Desde</label>
                            <input type="date" id="ivu-periodo-inicio" style="padding:8px 12px; border:1px solid var(--color-gray-border); border-radius:var(--radius-sm); font-family:var(--font-primary); font-size:13px; background:#fff; outline:none; color:var(--color-soft-black);">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <label style="font-size:11px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.5px;">Hasta</label>
                            <input type="date" id="ivu-periodo-fin" style="padding:8px 12px; border:1px solid var(--color-gray-border); border-radius:var(--radius-sm); font-family:var(--font-primary); font-size:13px; background:#fff; outline:none; color:var(--color-soft-black);">
                        </div>
                        <button id="btn-calcular-ivu-periodo" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:6px; padding:9px 18px; font-size:13px;">
                            <i data-lucide="calculator" style="width:15px; height:15px;"></i>
                            Calcular
                        </button>
                        <button id="btn-exportar-ivu-excel" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:6px; padding:9px 18px; font-size:13px;">
                            <i data-lucide="file-spreadsheet" style="width:15px; height:15px;"></i>
                            Exportar Excel
                        </button>
                    </div>

                    <div id="ivu-periodo-resultado" style="display:none;">
                        <div id="ivu-periodo-label" style="font-size:12px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.6px; margin-bottom:12px; padding:6px 12px; background:rgba(95,122,69,0.08); border-radius:6px; display:inline-block;"></div>
                        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px; margin-top:8px;">
                            <div style="background:#fdfaf5; border:1px solid #ede6d8; border-radius:10px; padding:16px;">
                                <div style="font-size:11px; font-weight:600; color:#8c8270; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Ventas Sujetas a IVU</div>
                                <div id="ivu-p-ventas" style="font-size:20px; font-weight:700; color:var(--color-soft-black);">$0.00</div>
                                <div style="font-size:11px; color:#aaa; margin-top:2px;">Subtotal facturas activas</div>
                            </div>
                            <div style="background:#fdfaf5; border:1px solid #ede6d8; border-radius:10px; padding:16px;">
                                <div style="font-size:11px; font-weight:600; color:#8c8270; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">IVU Estatal (10.5%)</div>
                                <div id="ivu-p-estatal" style="font-size:20px; font-weight:700; color:var(--color-moss-green);">$0.00</div>
                                <div style="font-size:11px; color:#aaa; margin-top:2px;">SC 2915 — SURI</div>
                            </div>
                            <div style="background:#fdfaf5; border:1px solid #ede6d8; border-radius:10px; padding:16px;">
                                <div style="font-size:11px; font-weight:600; color:#8c8270; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">IVU Municipal (1.0%)</div>
                                <div id="ivu-p-municipal" style="font-size:20px; font-weight:700; color:var(--color-moss-green);">$0.00</div>
                                <div style="font-size:11px; color:#aaa; margin-top:2px;">Municipio correspondiente</div>
                            </div>
                            <div style="background:#5f7a45; border-radius:10px; padding:16px;">
                                <div style="font-size:11px; font-weight:600; color:rgba(255,255,255,0.75); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">IVU Total Devengado</div>
                                <div id="ivu-p-total" style="font-size:20px; font-weight:700; color:#fff;">$0.00</div>
                                <div style="font-size:11px; color:rgba(255,255,255,0.6); margin-top:2px;">Estatal + Municipal</div>
                            </div>
                            <div style="background:#fdfaf5; border:1px solid #ede6d8; border-radius:10px; padding:16px;">
                                <div style="font-size:11px; font-weight:600; color:#8c8270; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Total Facturado</div>
                                <div id="ivu-p-facturado" style="font-size:20px; font-weight:700; color:var(--color-soft-black);">$0.00</div>
                                <div style="font-size:11px; color:#aaa; margin-top:2px;"><span id="ivu-p-n-facturas">0</span> facturas en el periodo</div>
                            </div>
                            <div style="background:#fdfaf5; border:1px solid #ede6d8; border-radius:10px; padding:16px;">
                                <div style="font-size:11px; font-weight:600; color:#8c8270; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Pendiente de Cobro</div>
                                <div id="ivu-p-pendiente" style="font-size:20px; font-weight:700; color:var(--color-terracotta);">$0.00</div>
                                <div style="font-size:11px; color:#aaa; margin-top:2px;">Facturas no cobradas</div>
                            </div>
                        </div>
                    </div>
                    <div id="ivu-periodo-loading" style="display:none; text-align:center; padding:24px; color:#8c8270; font-size:13.5px;">
                        <i data-lucide="loader-2" style="width:18px; height:18px; animation:spin 1s linear infinite; vertical-align:middle; margin-right:6px;"></i>
                        Calculando...
                    </div>
                    <div id="ivu-periodo-error" style="display:none; background:#fdf0ec; border:1px solid #f5c6b8; border-radius:8px; padding:10px 14px; font-size:13px; color:#c0694a; margin-top:8px;"></div>
                </div>

                <div class="card" style="margin-bottom:24px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h3 class="card-title" style="margin-bottom:0;">Desglose del IVU Devengado por Mes</h3>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-secondary" id="btn-add-manual-month" style="padding: 6px 12px; font-size:12.5px; display:inline-flex; align-items:center; gap:4px;">
                                <i data-lucide="plus"></i> Añadir Período Manual
                            </button>
                            <button class="btn btn-secondary" id="btn-copy-ivu-report" style="padding: 6px 12px; font-size:12.5px; display:inline-flex; align-items:center; gap:4px;">
                                <i data-lucide="copy"></i> Copiar Tabla al Portapapeles
                            </button>
                        </div>
                    </div>
                    <p style="color: #6c757d; font-size: 14px; margin-top:-8px; margin-bottom:16px;">
                        Esta tabla agrupa las facturas activas por mes, calculando de forma automatizada las cantidades que debes declarar en el portal SURI (tasa estatal del 10.5% y municipal del 1.0%).
                    </p>

                    <div class="table-container">
                        <table class="custom-table" id="ivu-report-table">
                            <thead>
                                <tr>
                                    <th>Mes</th>
                                    <th>Facturas</th>
                                    <th>Subtotal</th>
                                    <th>IVU Estatal (10.5%)</th>
                                    <th>IVU Municipal (1.0%)</th>
                                    <th>Total Facturado</th>
                                    <th>10% Ventas</th>
                                    <th>Total Cobrado</th>
                                    <th>Total Pendiente</th>
                                </tr>
                            </thead>
                            <tbody id="ivu-report-body">
                                <tr>
                                    <td colspan="9" style="text-align: center; color: #8c8c8c; padding: 24px;">Cargando informe contable de IVU...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- NUEVA SECCIÓN: PLANTILLAS SURI -->
                <div class="card" style="margin-bottom:24px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h3 class="card-title" style="margin-bottom:0; display:flex; align-items:center; gap:8px;">
                            <i data-lucide="calculator" style="color:var(--color-moss-green);"></i>
                            Plantillas de Declaración Mensual (SURI)
                        </h3>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label for="suri-month-select" style="font-size:13px; font-weight:600; color:var(--color-olive-brown);">Período:</label>
                            <select id="suri-month-select" style="padding:6px 12px; border-radius:var(--radius-sm); border:1px solid var(--color-gray-border); font-family:var(--font-primary); font-size:13px; cursor:pointer; background:white; outline:none;">
                                <option value="">Seleccione un mes...</option>
                            </select>
                        </div>
                    </div>
                    <p style="color: #6c757d; font-size: 14px; margin-top:-8px; margin-bottom:20px;">
                        Selecciona un mes para generar el borrador consolidado listo para copiar y pegar directamente en los formularios del portal de SURI o enviar a tu contador.
                    </p>
                    
                    <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:24px; align-items:stretch;">
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            <textarea id="suri-template-output" readonly placeholder="Seleccione un período arriba para ver la plantilla de declaración..." style="flex:1; width:100%; min-height:240px; padding:16px; font-family:monospace; font-size:12px; color:var(--color-soft-black); background:#faf8f5; border:1px solid #ede6d8; border-radius:10px; resize:none; line-height:1.5; outline:none; box-sizing:border-box;"></textarea>
                            <button class="btn btn-primary" id="btn-copy-suri-template" style="align-self:flex-start; display:inline-flex; align-items:center; gap:8px; padding:10px 20px; font-size:13px; border-radius:8px;">
                                <i data-lucide="copy"></i> Copiar Plantilla para SURI
                            </button>
                        </div>
                        <div style="background:#fdfdfa; border:1px solid rgba(237, 230, 216, 0.8); border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between; font-size:13px; line-height:1.5; color:#5c5549;">
                            <div>
                                <h4 style="margin:0 0 12px 0; color:var(--color-moss-green); font-size:14px; font-weight:700; display:flex; align-items:center; gap:6px;">
                                    <i data-lucide="help-circle" style="width:16px; height:16px;"></i> Guía de Presentación
                                </h4>
                                <ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:10px;">
                                    <li><strong>Estatal (10.5%):</strong> Ingresa el Subtotal en la sección de "Ventas de Servicios / Productos" en el SC 2915 en SURI.</li>
                                    <li><strong>Municipal (1.0%):</strong> Declara la porción municipal correspondiente según las tasas aplicables de tu municipio.</li>
                                    <li><strong>Ventas Exentas:</strong> Utiliza el monto exento si procesaste ventas marcadas como exentas de IVU.</li>
                                </ul>
                            </div>
                            <div style="margin-top:16px; font-size:11.5px; color:#8c8270; border-top:1px dashed var(--color-gray-border); padding-top:12px; display:flex; align-items:center; gap:6px;">
                                <i data-lucide="shield-check" style="width:15px; height:15px; color:var(--color-moss-green);"></i> Datos calculados en tiempo real.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- VISTA 4: REGISTRO DE GASTOS -->
            <div id="view-section-expenses" class="factura-section animate-fade-in" style="display:none;">
                <div style="display:grid; grid-template-columns: 1fr 2fr; gap:24px; align-items:start;">
                    <!-- FORMULARIO DE GASTOS -->
                    <div class="card">
                        <h3 class="card-title">Registrar Gasto</h3>
                        <p style="color: #6c757d; font-size: 13.5px; margin-bottom: 20px; margin-top:-8px;">
                            Ingresa los gastos operativos del taller para las deducciones en planilla.
                        </p>
                        <form id="expense-form" style="display:flex; flex-direction:column; gap:12px;">
                            <div class="form-group">
                                <label for="exp-descripcion" style="font-weight:600; font-size:13px; color:var(--color-olive-brown);">Descripción / Concepto *</label>
                                <input type="text" id="exp-descripcion" required placeholder="Ej. Madera, Luma, Renta..." style="padding:10px; border-radius:var(--radius-sm); border:1px solid var(--color-gray-border); width:100%; box-sizing:border-box;">
                            </div>
                            <div class="form-group">
                                <label for="exp-categoria" style="font-weight:600; font-size:13px; color:var(--color-olive-brown);">Categoría *</label>
                                <select id="exp-categoria" required style="padding:10px; border-radius:var(--radius-sm); border:1px solid var(--color-gray-border); width:100%; background:white;">
                                    <option value="Materiales">Materiales y Suministros</option>
                                    <option value="Renta">Renta del Local</option>
                                    <option value="Utilidades">Utilidades (Luz, Agua, Internet)</option>
                                    <option value="Equipos">Equipos y Herramientas</option>
                                    <option value="Marketing">Marketing y Publicidad</option>
                                    <option value="Servicios Profesionales">Servicios Profesionales</option>
                                    <option value="Otros">Otros Gastos Ordinarios</option>
                                </select>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                                <div class="form-group">
                                    <label for="exp-monto" style="font-weight:600; font-size:13px; color:var(--color-olive-brown);">Monto ($) *</label>
                                    <input type="number" step="0.01" min="0.01" id="exp-monto" required placeholder="0.00" style="padding:10px; border-radius:var(--radius-sm); border:1px solid var(--color-gray-border); width:100%; box-sizing:border-box;">
                                </div>
                                <div class="form-group">
                                    <label for="exp-fecha" style="font-weight:600; font-size:13px; color:var(--color-olive-brown);">Fecha *</label>
                                    <input type="date" id="exp-fecha" required style="padding:10px; border-radius:var(--radius-sm); border:1px solid var(--color-gray-border); width:100%; box-sizing:border-box;">
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="exp-metodo" style="font-weight:600; font-size:13px; color:var(--color-olive-brown);">Método de Pago *</label>
                                <select id="exp-metodo" required style="padding:10px; border-radius:var(--radius-sm); border:1px solid var(--color-gray-border); width:100%; background:white;">
                                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                                    <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                    <option value="ATH Móvil">ATH Móvil</option>
                                    <option value="Efectivo">Efectivo</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="exp-notas" style="font-weight:600; font-size:13px; color:var(--color-olive-brown);">Notas Adicionales</label>
                                <textarea id="exp-notas" placeholder="Detalles de factura, número de cheque..." style="padding:10px; border-radius:var(--radius-sm); border:1px solid var(--color-gray-border); width:100%; min-height:80px; box-sizing:border-box; resize:none;"></textarea>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <label for="exp-recibo" style="font-weight:600; font-size:13px; color:var(--color-olive-brown);">Recibo (opcional)</label>
                                <input type="file" id="exp-recibo" accept=".jpg,.jpeg,.png,.pdf" style="padding:8px; border-radius:var(--radius-sm); border:1px solid var(--color-gray-border); width:100%; box-sizing:border-box; font-size:13px; background:#fafaf8;">
                                <p style="font-size:11.5px; color:#8c8270; margin:0;">Formatos aceptados: JPG, PNG, PDF</p>
                            </div>
                            <button type="submit" class="btn btn-primary" style="width:100%; display:flex; justify-content:center; align-items:center; gap:8px; padding:12px; margin-top:8px;">
                                <i data-lucide="check-circle"></i> Guardar Gasto
                            </button>
                        </form>
                    </div>

                    <!-- TABLA DE GASTOS -->
                    <div class="card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                            <h3 class="card-title" style="margin-bottom:0;">Historial de Gastos</h3>
                            <span id="expenses-total-summary" style="font-size:14px; font-weight:700; color:var(--color-terracotta);">Total: $0.00</span>
                        </div>

                        <!-- FILTROS -->
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; padding:14px; background:#faf8f5; border-radius:10px; border:1px solid #ede6d8;">
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <label style="font-size:11px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.4px;">Desde</label>
                                <input type="date" id="filter-gasto-desde" style="padding:7px 10px; border:1px solid var(--color-gray-border); border-radius:7px; font-size:12.5px; font-family:var(--font-primary);">
                            </div>
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <label style="font-size:11px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.4px;">Hasta</label>
                                <input type="date" id="filter-gasto-hasta" style="padding:7px 10px; border:1px solid var(--color-gray-border); border-radius:7px; font-size:12.5px; font-family:var(--font-primary);">
                            </div>
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <label style="font-size:11px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.4px;">Categoría</label>
                                <select id="filter-gasto-categoria" style="padding:7px 10px; border:1px solid var(--color-gray-border); border-radius:7px; font-size:12.5px; font-family:var(--font-primary); background:#fff;">
                                    <option value="">Todas</option>
                                    <option value="Materiales">Materiales y Suministros</option>
                                    <option value="Renta">Renta del Local</option>
                                    <option value="Utilidades">Utilidades (Luz, Agua, Internet)</option>
                                    <option value="Equipos">Equipos y Herramientas</option>
                                    <option value="Marketing">Marketing y Publicidad</option>
                                    <option value="Servicios Profesionales">Servicios Profesionales</option>
                                    <option value="Otros">Otros Gastos Ordinarios</option>
                                </select>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <label style="font-size:11px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.4px;">Método de pago</label>
                                <select id="filter-gasto-metodo" style="padding:7px 10px; border:1px solid var(--color-gray-border); border-radius:7px; font-size:12.5px; font-family:var(--font-primary); background:#fff;">
                                    <option value="">Todos</option>
                                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                                    <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                    <option value="ATH Móvil">ATH Móvil</option>
                                    <option value="Efectivo">Efectivo</option>
                                </select>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <label style="font-size:11px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.4px;">Recibo</label>
                                <select id="filter-gasto-recibo" style="padding:7px 10px; border:1px solid var(--color-gray-border); border-radius:7px; font-size:12.5px; font-family:var(--font-primary); background:#fff;">
                                    <option value="">Todos</option>
                                    <option value="con">Con recibo</option>
                                    <option value="sin">Sin recibo</option>
                                </select>
                            </div>
                            <div style="display:flex; align-items:flex-end;">
                                <button id="btn-limpiar-filtros-gastos" class="btn btn-secondary" style="width:100%; padding:7px 12px; font-size:12.5px; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
                                    <i data-lucide="x-circle" style="width:13px;height:13px;"></i> Limpiar filtros
                                </button>
                            </div>
                            <div style="display:flex; align-items:flex-end;">
                                <button id="btn-exportar-gastos-excel" class="btn btn-secondary" style="width:100%; padding:7px 12px; font-size:12.5px; display:inline-flex; align-items:center; justify-content:center; gap:6px; border-color:#5f7a45; color:#5f7a45;">
                                    <i data-lucide="file-spreadsheet" style="width:13px;height:13px;"></i> Exportar Excel
                                </button>
                            </div>
                        </div>
                        <div style="font-size:12px; color:#8c8270; margin-bottom:10px;" id="expenses-filter-summary"></div>

                        <div class="table-container">
                            <table class="custom-table" id="expenses-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Concepto</th>
                                        <th>Categoría</th>
                                        <th>Método</th>
                                        <th style="text-align:right;">Monto</th>
                                        <th style="text-align:center;">Recibo</th>
                                        <th style="width:40px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="expenses-table-body">
                                    <tr>
                                        <td colspan="6" style="text-align:center; padding:24px; color:#8c8c8c;">Cargando gastos...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL PARA REGISTRAR PAGO (COBRAR) -->
            <div id="payment-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(62,62,62,0.4); backdrop-filter: blur(4px); z-index: 2000; justify-content: center; align-items: center;">
                <div class="card" style="width: 90%; max-width: 420px; padding: 24px; display: flex; flex-direction: column; gap: 16px; margin-top: 100px;">
                    <h3 class="card-title" style="margin-bottom:4px;" id="payment-modal-title">Registrar Cobro de Factura</h3>
                    <div id="payment-modal-total-info" style="background: rgba(95,120,48,0.08); border:1px solid rgba(95,120,48,0.2); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 13px;"></div>
                    <form id="form-registrar-pago" style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Método de Pago</label>
                            <select id="pay-metodo" required style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); cursor:pointer;">
                                <option value="ATH Movil">ATH Móvil</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                                <option value="Transferencia">Transferencia Bancaria</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;" id="pay-cheque-container" style="display:none;">
                            <label style="font-weight: 500; font-size: 13px;">Número de Cheque</label>
                            <input type="text" id="pay-cheque" placeholder="Ej. 1024" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Monto Pagado ($)</label>
                            <input type="number" step="0.01" min="0" id="pay-monto" placeholder="Ingrese el monto recibido" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                            <span id="pay-balance-preview" style="font-size:12px; color: var(--color-moss-green); min-height:16px;"></span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Fecha de Pago</label>
                            <input type="date" id="pay-fecha" required style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 10px;">
                            <button type="button" class="btn btn-secondary" id="btn-close-payment-modal" style="flex: 1;">Cancelar</button>
                            <button type="submit" class="btn btn-primary" style="flex: 1;">Confirmar Pago</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        lucide.createIcons();
        this.initDates();
        await this.loadData();
        this.setupListeners();
    },

    initDates() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        this.invoiceDate = `${yyyy}-${mm}-${dd}`;
        
        // Due date: +15 days
        const due = new Date();
        due.setDate(today.getDate() + 15);
        const dueYyyy = due.getFullYear();
        const dueMm = String(due.getMonth() + 1).padStart(2, '0');
        const dueDd = String(due.getDate()).padStart(2, '0');
        this.invoiceDueDate = `${dueYyyy}-${dueMm}-${dueDd}`;

        document.getElementById('inv-fecha-emision').value = this.invoiceDate;
        document.getElementById('inv-fecha-vence').value = this.invoiceDueDate;
        document.getElementById('inv-notas').value = this.invoiceNotes;

        const expFecha = document.getElementById('exp-fecha');
        if (expFecha) {
            expFecha.value = this.invoiceDate;
        }
    },

    async loadData() {
        if (this._loadingData) return;
        this._loadingData = true;
        try {
            // Load clients, products and expenses
            const [resFacturas, resClientes, resProductos, resReporte, resGastos] = await Promise.all([
                EvergreenAPI.getFacturas(),
                EvergreenAPI.getClientes(),
                EvergreenAPI.getProductos(),
                EvergreenAPI.getReporteContabilidad(),
                EvergreenAPI.getGastos()
            ]);

            this.facturas = resFacturas.data || [];
            this.clientes = resClientes.data || [];
            this.productos = resProductos.data || [];
            this.reporte = resReporte;
            // Deduplicate by id to guard against any duplicate rows from the server
            const rawGastos = resGastos.data || [];
            const seenIds = new Set();
            this.gastos = rawGastos.filter(g => {
                if (seenIds.has(g.id)) return false;
                seenIds.add(g.id);
                return true;
            });

            this.renderFacturasList();
            this.populateClientesSelect();
            this.populateProductosSelect();
            this.renderReports();
            this.renderExpenses();
            this.updateAutoInvoiceNumber();
        } catch (error) {
            console.error("Error al cargar datos en FacturasComponent:", error);
        } finally {
            this._loadingData = false;
        }
    },

    _filtrarGastos() {
        const desde    = document.getElementById('filter-gasto-desde')?.value || '';
        const hasta    = document.getElementById('filter-gasto-hasta')?.value || '';
        const catFilt  = document.getElementById('filter-gasto-categoria')?.value || '';
        const metFilt  = document.getElementById('filter-gasto-metodo')?.value || '';
        const recFilt  = document.getElementById('filter-gasto-recibo')?.value || '';

        return (this.gastos || []).filter(g => {
            if (desde && g.fecha < desde) return false;
            if (hasta && g.fecha > hasta) return false;
            if (catFilt && g.categoria !== catFilt) return false;
            if (metFilt && (g.metodo_pago || '') !== metFilt) return false;
            if (recFilt === 'con' && !g.recibo_ruta) return false;
            if (recFilt === 'sin' && g.recibo_ruta) return false;
            return true;
        });
    },

    renderExpenses() {
        const tbody = document.getElementById('expenses-table-body');
        if (!tbody) return;

        const totalSummary = document.getElementById('expenses-total-summary');
        const filterSummary = document.getElementById('expenses-filter-summary');
        let totalSum = 0;

        if (!this.gastos || this.gastos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #8c8c8c; padding: 24px;">
                        No hay gastos registrados en la base de datos local.
                    </td>
                </tr>
            `;
            if (totalSummary) totalSummary.textContent = "Total: $0.00";
            if (filterSummary) filterSummary.textContent = '';
            return;
        }

        const filtrados = this._filtrarGastos();
        // Sort descending by date
        const sortedGastos = [...filtrados].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (filterSummary) {
            const total = this.gastos.length;
            const shown = sortedGastos.length;
            filterSummary.textContent = shown < total
                ? `Mostrando ${shown} de ${total} gastos`
                : `${total} gastos en total`;
        }
        
        if (sortedGastos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#8c8c8c; padding:24px; font-style:italic;">No hay gastos que coincidan con los filtros aplicados.</td></tr>`;
            if (totalSummary) totalSummary.textContent = "Total: $0.00";
            return;
        }

        tbody.innerHTML = '';
        sortedGastos.forEach(g => {
            totalSum += g.monto;
            const tr = document.createElement('tr');
            tr.className = 'animate-fade-in';
            const tieneRecibo = !!g.recibo_ruta;
            tr.innerHTML = `
                <td>${g.fecha}</td>
                <td><strong>${g.concepto || g.descripcion || ''}</strong>${g.notas ? `<br><small style="color:#8c8270;">${g.notas}</small>` : ''}</td>
                <td><span class="badge" style="background:#ede6d8; color:var(--color-olive-brown); padding:3px 8px; border-radius:12px; font-size:11px;">${g.categoria}</span></td>
                <td>${g.metodo_pago || '—'}</td>
                <td style="text-align:right; font-weight:600; color:var(--color-terracotta);">${MONEY.format(g.monto)}</td>
                <td style="text-align:center; white-space:nowrap;">
                    ${tieneRecibo
                        ? `<button class="btn btn-secondary btn-ver-recibo" data-id="${g.id}" title="Ver recibo" style="padding:3px 8px; font-size:11px; display:inline-flex; align-items:center; gap:4px; margin-right:4px;">
                               <i data-lucide="file-text" style="width:12px;height:12px;"></i> Ver
                           </button>
                           <button class="btn btn-secondary btn-analizar-recibo" data-id="${g.id}" data-concepto="${(g.concepto||'').replace(/"/g,'&quot;')}" data-fecha="${g.fecha||''}" data-monto="${g.monto||0}" data-metodo="${(g.metodo_pago||'').replace(/"/g,'&quot;')}" data-categoria="${(g.categoria||'').replace(/"/g,'&quot;')}" data-notas="${(g.notas||'').replace(/"/g,'&quot;')}" data-proveedor="${(g.proveedor||'').replace(/"/g,'&quot;')}" title="Revisar y editar gasto" style="padding:3px 8px; font-size:11px; display:inline-flex; align-items:center; gap:4px; margin-right:4px; background:rgba(95,122,69,0.08); border-color:var(--color-moss-green); color:var(--color-moss-green);">
                               <i data-lucide="scan-text" style="width:12px;height:12px;"></i> Editar
                           </button>
                           <button class="btn btn-secondary btn-del-recibo" data-id="${g.id}" title="Eliminar recibo" style="padding:3px 6px; font-size:11px; color:var(--color-terracotta); border-color:var(--color-terracotta); display:inline-flex; align-items:center;">
                               <i data-lucide="x" style="width:12px;height:12px;"></i>
                           </button>`
                        : `<label class="btn btn-secondary btn-upload-recibo" data-id="${g.id}" title="Subir recibo" style="padding:3px 8px; font-size:11px; display:inline-flex; align-items:center; gap:4px; cursor:pointer; margin:0;">
                               <i data-lucide="upload" style="width:12px;height:12px;"></i> Subir
                               <input type="file" accept=".jpg,.jpeg,.png,.pdf" style="display:none;" class="input-recibo-inline" data-id="${g.id}">
                           </label>`
                    }
                </td>
                <td style="text-align:right;">
                    <button class="btn btn-secondary btn-delete-expense" data-id="${g.id}" style="color:var(--color-terracotta); border-color:var(--color-terracotta); padding: 4px 6px; font-size:11px; display:inline-flex; align-items:center; justify-content:center;">
                        <i data-lucide="trash-2" style="width:13px; height:13px;"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (totalSummary) {
            totalSummary.textContent = `Total: ${MONEY.format(totalSum)}`;
        }

        tbody.querySelectorAll('.btn-delete-expense').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.getAttribute('data-id'));
                if (confirm("¿Está seguro de que desea eliminar este gasto de forma permanente?")) {
                    try {
                        await EvergreenAPI.deleteGasto(id);
                        await this.loadData();
                    } catch (err) {
                        alert("Error al eliminar gasto: " + err.message);
                    }
                }
            });
        });

        tbody.querySelectorAll('.btn-ver-recibo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.getAttribute('data-id'));
                try {
                    await EvergreenAPI.verReciboGasto(id);
                } catch (err) {
                    alert("Error al abrir recibo: " + err.message);
                }
            });
        });

        tbody.querySelectorAll('.btn-del-recibo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.getAttribute('data-id'));
                if (confirm("¿Eliminar el recibo asociado a este gasto?")) {
                    try {
                        await EvergreenAPI.eliminarReciboGasto(id);
                        await this.loadData();
                    } catch (err) {
                        alert("Error al eliminar recibo: " + err.message);
                    }
                }
            });
        });

        tbody.querySelectorAll('.btn-analizar-recibo').forEach(btn => {
            btn.addEventListener('click', () => {
                const g = {
                    id:          parseInt(btn.getAttribute('data-id')),
                    concepto:    btn.getAttribute('data-concepto'),
                    fecha:       btn.getAttribute('data-fecha'),
                    monto:       parseFloat(btn.getAttribute('data-monto')) || 0,
                    metodo_pago: btn.getAttribute('data-metodo'),
                    categoria:   btn.getAttribute('data-categoria'),
                    notas:       btn.getAttribute('data-notas'),
                    proveedor:   btn.getAttribute('data-proveedor'),
                };
                this._abrirModalEditarGasto(g);
            });
        });

        tbody.querySelectorAll('.input-recibo-inline').forEach(input => {
            input.addEventListener('change', async () => {
                const id = parseInt(input.getAttribute('data-id'));
                const archivo = input.files[0];
                if (!archivo) return;
                try {
                    await EvergreenAPI.subirReciboGasto(id, archivo);
                    await this.loadData();
                } catch (err) {
                    alert("Error al subir recibo: " + err.message);
                }
            });
        });

        lucide.createIcons();
    },

    renderFacturasList() {
        const tbody = document.getElementById('facturas-list-body');
        if (this.facturas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #8c8c8c; padding: 24px;">
                        No hay facturas registradas en la base de datos local.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        this.facturas.forEach(f => {
            const tr = document.createElement('tr');
            tr.className = 'animate-fade-in';

            let badgeClass = "badge-pending";
            if (f.estado === "Pagada") badgeClass = "badge-success";
            if (f.estado === "Anulada") badgeClass = "badge-danger";

            let actionButtons = "";
            if (f.estado === "Pendiente") {
                actionButtons += `
                    <button class="btn btn-secondary btn-pay-factura" style="padding: 4px 8px; font-size:11.5px; border-color:var(--color-success); color:var(--color-success);" data-id="${f.id}">
                        Cobrar
                    </button>
                    <button class="btn btn-secondary btn-anular-factura" style="padding: 4px 8px; font-size:11.5px; border-color:var(--color-warning); color:var(--color-warning);" data-id="${f.id}">
                        Anular
                    </button>
                `;
            } else if (f.estado === "Pagada") {
                actionButtons += `
                    <span style="font-size:11.5px; color:#8c8270; font-style:italic; margin-right:8px;">${f.metodo_pago}</span>
                `;
            }

            actionButtons += `
                <button class="btn btn-secondary btn-email-factura" style="padding:4px; border:none; background:none; box-shadow:none; color:#1565c0;" data-id="${f.id}" data-email="${(f.cliente_email || '').replace(/"/g,'&quot;')}" title="Enviar por Email">
                    <i data-lucide="mail" style="width:16px; height:16px;"></i>
                </button>
                <button class="btn btn-secondary btn-download-pdf" style="padding:4px; border:none; background:none; box-shadow:none; color:var(--color-moss-green);" data-id="${f.id}" title="Descargar Factura PDF">
                    <i data-lucide="download" style="width:16px; height:16px;"></i>
                </button>
                <button class="btn btn-secondary btn-delete-factura" style="padding:4px; border:none; background:none; box-shadow:none; color:var(--color-danger);" data-id="${f.id}" title="Eliminar del Registro">
                    <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                </button>
            `;

            const parsedCliente = getClienteDisplayData(f.cliente_nombre, f.notas);

            tr.className = 'invoice-row animate-fade-in';
            tr.setAttribute('data-id', f.id);
            tr.innerHTML = `
                <td style="text-align:center; cursor:pointer;" class="toggle-detail-btn">
                    <i data-lucide="chevron-right" class="chevron-icon" style="width:16px; height:16px; transition: transform 0.2s;"></i>
                </td>
                <td>
                    <strong>${f.numero_factura}</strong>
                    ${f.codigo_orden ? `<br><span style="font-size:10.5px;color:#6b7280;font-weight:500;">Orden: <code style="font-size:10px;">${f.codigo_orden}</code></span>` : ''}
                    ${f.cotizacion_id ? `<br><span style="font-size:10.5px;background:#e8eaf6;color:#1565c0;padding:1px 7px;border-radius:10px;font-weight:700;">📋 Cotización #${f.cotizacion_id}</span>` : ''}
                </td>
                <td>${parsedCliente.name}</td>
                <td>${f.fecha_emision}</td>
                <td>${f.fecha_vencimiento || 'Al recibir'}</td>
                <td style="font-weight:600; color:var(--color-moss-green);">${MONEY.format(f.total)}</td>
                <td><span class="badge ${badgeClass}">${f.estado}</span></td>
                <td style="text-align:right; display:flex; justify-content:flex-end; align-items:center; gap:8px;">
                    ${actionButtons}
                </td>
            `;
            
            const detailTr = document.createElement('tr');
            detailTr.className = 'invoice-detail-row';
            detailTr.id = `detail-row-${f.id}`;
            detailTr.style.display = 'none';
            detailTr.innerHTML = `
                <td colspan="8">
                    <div class="invoice-detail-container">
                        <div class="invoice-detail-title">
                            <i data-lucide="shopping-bag" style="width:16px; height:16px;"></i> Productos Adquiridos
                        </div>
                        <div class="invoice-detail-content" id="detail-content-${f.id}">
                            <div class="loading-state" style="padding:10px 0; display:flex; align-items:center; gap:8px; font-size:12px; color:#8c8270;">
                                <span class="spinner" style="width:12px; height:12px; margin-bottom:0; border-width:2px;"></span> Cargando detalle...
                            </div>
                        </div>
                    </div>
                </td>
            `;
            
            tbody.appendChild(tr);
            tbody.appendChild(detailTr);
        });

        // Toggle collapsible rows
        tbody.querySelectorAll('.invoice-row').forEach(row => {
            const id = parseInt(row.getAttribute('data-id'));
            const toggleBtn = row.querySelector('.toggle-detail-btn');
            const detailRow = document.getElementById(`detail-row-${id}`);
            const chevron = row.querySelector('.chevron-icon');
            
            const toggleHandler = async (e) => {
                if (e.target.closest('button') || e.target.closest('a') || e.target.closest('select') || e.target.closest('input')) {
                    return;
                }
                
                const isCollapsed = detailRow.style.display === 'none';
                if (isCollapsed) {
                    detailRow.style.display = 'table-row';
                    chevron.style.transform = 'rotate(90deg)';
                    
                    const contentDiv = document.getElementById(`detail-content-${id}`);
                    const factura = this.facturas.find(f => f.id === id);
                    
                    if (factura && !factura.items_loaded) {
                        try {
                            const res = await EvergreenAPI.getFactura(id);
                            if (res.status === 'success') {
                                factura.items = res.data.items || [];
                                factura.items_loaded = true;
                                this.renderDetailContent(id, factura.items);
                            } else {
                                contentDiv.innerHTML = `<span style="color:var(--color-danger);">Error al cargar ítems.</span>`;
                            }
                        } catch (err) {
                            contentDiv.innerHTML = `<span style="color:var(--color-danger);">Error: ${err.message}</span>`;
                        }
                    } else if (factura) {
                        this.renderDetailContent(id, factura.items);
                    }
                } else {
                    detailRow.style.display = 'none';
                    chevron.style.transform = 'rotate(0deg)';
                }
            };
            
            row.addEventListener('click', toggleHandler);
        });

        // Add Listeners
        tbody.querySelectorAll('.btn-pay-factura').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-id'));
                const factura = this.facturas.find(f => f.id === id);
                if (factura) this.openPaymentModal(factura);
            });
        });

        tbody.querySelectorAll('.btn-anular-factura').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.getAttribute('data-id'));
                const factura = this.facturas.find(f => f.id === id);
                if (confirm(`¿Estás seguro de que deseas ANULAR la factura ${factura.numero_factura}? Esto cancelará contablemente los ingresos.`)) {
                    try {
                        await EvergreenAPI.updateFacturaEstado(id, { estado: "Anulada" });
                        alert("Factura anulada correctamente.");
                        await this.loadData();
                    } catch (err) {
                        alert("Error al anular: " + err.message);
                    }
                }
            });
        });

        tbody.querySelectorAll('.btn-delete-factura').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.getAttribute('data-id'));
                const factura = this.facturas.find(f => f.id === id);
                if (confirm(`¿Estás seguro de que deseas ELIMINAR permanentemente la factura ${factura.numero_factura} del registro SQLite? Esta acción no se puede deshacer.`)) {
                    try {
                        await EvergreenAPI.deleteFactura(id);
                        alert("Factura eliminada del sistema.");
                        await this.loadData();
                    } catch (err) {
                        alert("Error al eliminar: " + err.message);
                    }
                }
            });
        });

        tbody.querySelectorAll('.btn-download-pdf').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.getAttribute('data-id'));
                btn.disabled = true;
                try {
                    const res = await EvergreenAPI.getFactura(id);
                    if (res.status === 'success') {
                        const facturaDetalle = res.data;
                        
                        // Parse structure for PDF generator
                        const invoiceMeta = {
                            number: facturaDetalle.numero_factura,
                            date: facturaDetalle.fecha_emision,
                            due: facturaDetalle.fecha_vencimiento,
                            paymentMethod: facturaDetalle.metodo_pago,
                            checkNumber: facturaDetalle.numero_cheque,
                            notes: facturaDetalle.notas
                        };
                        const parsedCliente = getClienteDisplayData(
                            facturaDetalle.cliente_nombre,
                            facturaDetalle.notas,
                            facturaDetalle.cliente_email,
                            facturaDetalle.cliente_telefono
                        );
                        const selectedCustomer = {
                            name: parsedCliente.name,
                            email: parsedCliente.email,
                            phone: parsedCliente.phone,
                            notas: parsedCliente.notas
                        };
                        
                        const rows = (facturaDetalle.items || []).map(item => ({
                            nombre_producto: item.nombre_producto || item.producto_nombre || "Producto",
                            cantidad: item.cantidad,
                            precio_unitario: item.precio_unitario,
                            total: item.total,
                            foto_ruta: item.foto_ruta
                        }));
                        
                        const subtotal = facturaDetalle.subtotal;
                        const stateTax = facturaDetalle.ivu_estatal;
                        const municipalTax = facturaDetalle.ivu_municipal;
                        const ivu = stateTax + municipalTax;
                        const total = facturaDetalle.total;
                        
                        const municipalTaxEnabled = municipalTax > 0;
                        
                        const pdfBlob = await buildSimpleInvoicePdf({
                            invoiceMeta,
                            selectedCustomer,
                            rows,
                            subtotal,
                            stateTax,
                            municipalTax,
                            ivu,
                            total,
                            montoPagado: facturaDetalle.monto_pagado !== undefined ? facturaDetalle.monto_pagado : null,
                            stateTaxRate: 10.5,
                            municipalTaxRate: 1.0,
                            municipalTaxEnabled,
                            logoSrc: "./img/logo.jpg"
                        });
                        
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(pdfBlob);
                        link.download = `Factura_${facturaDetalle.numero_factura}.pdf`;
                        link.click();
                    }
                } catch (err) {
                    console.error("Error al descargar PDF:", err);
                    alert("Error al descargar PDF: " + err.message);
                } finally {
                    btn.disabled = false;
                }
            });
        });

        // ── Enviar por Email ─────────────────────────────────────────────
        tbody.querySelectorAll('.btn-email-factura').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                const emailBD = (btn.getAttribute('data-email') || '').trim();

                // Modal sencillo: el admin puede confirmar o cambiar el email
                const emailIngresado = prompt(
                    `Enviar factura por email.\n\nEmail del cliente${emailBD ? ' (registrado en BD)' : ''}:`,
                    emailBD
                );
                if (emailIngresado === null) return; // canceló
                const emailFinal = emailIngresado.trim();
                if (!emailFinal || !emailFinal.includes('@')) {
                    alert('Email inválido o vacío. No se envió la factura.');
                    return;
                }
                if (!confirm(`¿Enviar la factura al email:\n${emailFinal}?`)) return;

                const originalHTML = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px;margin:0;display:inline-block;vertical-align:middle;"></span>';
                try {
                    const res = await EvergreenAPI.enviarEmailFactura(id, emailFinal);
                    alert(`✓ Factura enviada correctamente a:\n${res.email_enviado_a}`);
                } catch (err) {
                    alert(`Error al enviar:\n${err.message}`);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                    lucide.createIcons();
                }
            });
        });

        lucide.createIcons();
    },

    populateClientesSelect() {
        const select = document.getElementById('inv-cliente-id');
        if (!select) return;
        select.innerHTML = '<option value="">Seleccione un cliente comercial...</option>';
        this.clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            select.appendChild(opt);
        });
    },

    populateProductosSelect() {
        const select = document.getElementById('inv-add-producto-id');
        if (!select) return;
        select.innerHTML = '<option value="">Seleccione un producto...</option>';
        this.productos.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.nombre} (${p.sku})`;
            select.appendChild(opt);
        });
    },

    renderStatusCards() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        let pagadas = 0, pagadasTotal = 0;
        let pendientes = 0, pendientesTotal = 0;
        let vencidas = 0, vencidasTotal = 0;
        let anuladas = 0, anuladasTotal = 0;

        (this.facturas || []).forEach(f => {
            const total = parseFloat(f.total) || 0;
            if (f.estado === 'Anulada') {
                anuladas++; anuladasTotal += total;
            } else if (f.estado === 'Pagada') {
                pagadas++; pagadasTotal += total;
            } else if (f.estado === 'Pendiente') {
                const vence = f.fecha_vencimiento ? new Date(f.fecha_vencimiento + 'T00:00:00') : null;
                if (vence && vence < hoy) {
                    vencidas++; vencidasTotal += total;
                } else {
                    pendientes++; pendientesTotal += total;
                }
            }
        });

        const fmt = (n) => `$${n.toFixed(2)}`;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('status-card-pagadas-count',    pagadas);
        set('status-card-pagadas-total',    fmt(pagadasTotal));
        set('status-card-pendientes-count', pendientes);
        set('status-card-pendientes-total', fmt(pendientesTotal));
        set('status-card-vencidas-count',   vencidas);
        set('status-card-vencidas-total',   fmt(vencidasTotal));
        set('status-card-anuladas-count',   anuladas);
        set('status-card-anuladas-total',   fmt(anuladasTotal));

        const sinRecibo = (this.gastos || []).filter(g => !g.recibo_ruta);
        set('status-card-sinrecibo-count', sinRecibo.length);
        set('status-card-sinrecibo-total', fmt(sinRecibo.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0)));

        const cardSinRecibo = document.getElementById('status-card-sin-recibo');
        if (cardSinRecibo) {
            cardSinRecibo.onclick = () => {
                document.querySelectorAll('.facturas-nav-tab').forEach(t => t.classList.remove('active'));
                const tabExp = document.querySelector('[data-tab="expenses"]');
                if (tabExp) tabExp.classList.add('active');
                document.querySelectorAll('.factura-section').forEach(s => s.style.display = 'none');
                const secExp = document.getElementById('view-section-expenses');
                if (secExp) secExp.style.display = 'block';
                this.activeTab = 'expenses';
                const filtroRecibo = document.getElementById('filter-gasto-recibo');
                if (filtroRecibo) { filtroRecibo.value = 'sin'; this.renderExpenses(); }
            };
        }
    },

    renderCharts(allMonths) {
        this._renderBarChart({
            containerId: 'chart-ventas-gastos',
            months: allMonths,
            series: [
                {
                    label: 'Ventas',
                    color: '#5f7a45',
                    values: allMonths.map(m => this.getMonthlyData(m)?.total_facturado || 0)
                },
                {
                    label: 'Gastos',
                    color: '#c0694a',
                    values: allMonths.map(m => {
                        if (!this.gastos) return 0;
                        const [y, mo] = m.split('-');
                        return this.gastos
                            .filter(g => g.fecha && g.fecha.startsWith(`${y}-${mo}`))
                            .reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
                    })
                }
            ]
        });

        this._renderBarChart({
            containerId: 'chart-ivu',
            months: allMonths,
            series: [
                {
                    label: 'IVU Estatal',
                    color: '#5f7a45',
                    values: allMonths.map(m => this.getMonthlyData(m)?.ivu_estatal || 0)
                },
                {
                    label: 'IVU Municipal',
                    color: '#8fa86b',
                    values: allMonths.map(m => this.getMonthlyData(m)?.ivu_municipal || 0)
                }
            ]
        });
    },

    _renderBarChart({ containerId, months, series }) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!months || months.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:#aaa; font-size:13px; padding:24px 0;">Sin datos para mostrar.</p>`;
            return;
        }

        const BAR_W = 16;
        const BAR_GAP = 4;
        const GROUP_GAP = 18;
        const nSeries = series.length;
        const groupW = nSeries * BAR_W + (nSeries - 1) * BAR_GAP;
        const totalW = months.length * (groupW + GROUP_GAP);
        const H = 160;
        const BOTTOM = 40;
        const TOP_PAD = 12;
        const chartH = H - BOTTOM - TOP_PAD;

        const allValues = series.flatMap(s => s.values);
        const maxVal = Math.max(...allValues, 1);

        const MESES_CORTOS = ['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
        const fmtLabel = (m) => {
            const parts = m.split('-');
            return parts.length === 2 ? `${MESES_CORTOS[parseInt(parts[1])] || parts[1]}/${parts[0].slice(2)}` : m;
        };

        let bars = '';
        months.forEach((m, gi) => {
            const x0 = gi * (groupW + GROUP_GAP);
            series.forEach((s, si) => {
                const val = s.values[gi] || 0;
                const barH = Math.max(2, (val / maxVal) * chartH);
                const bx = x0 + si * (BAR_W + BAR_GAP);
                const by = TOP_PAD + chartH - barH;
                const fmtVal = val >= 1000 ? `$${(val/1000).toFixed(1)}k` : `$${val.toFixed(0)}`;
                bars += `<rect x="${bx}" y="${by}" width="${BAR_W}" height="${barH}" rx="3" fill="${s.color}" opacity="0.88">
                    <title>${s.label} ${m}: $${val.toFixed(2)}</title>
                </rect>`;
                if (val > 0) {
                    bars += `<text x="${bx + BAR_W/2}" y="${by - 3}" text-anchor="middle" font-size="8" fill="#555" font-family="inherit">${fmtVal}</text>`;
                }
            });
            // Month label
            const labelX = x0 + groupW / 2;
            bars += `<text x="${labelX}" y="${H - 6}" text-anchor="middle" font-size="9.5" fill="#8c8270" font-family="inherit">${fmtLabel(m)}</text>`;
        });

        // Legend
        const legendItems = series.map((s, i) =>
            `<g transform="translate(${i * 90}, 0)">
                <rect width="10" height="10" rx="2" fill="${s.color}" y="-9"/>
                <text x="14" y="0" font-size="10" fill="#555" font-family="inherit">${s.label}</text>
            </g>`
        ).join('');

        const svgW = Math.max(totalW, 260);
        container.innerHTML = `
            <svg viewBox="0 0 ${svgW} ${H + 20}" width="100%" style="display:block; min-width:${Math.min(svgW,280)}px;">
                <g transform="translate(6, 0)">${bars}</g>
                <g transform="translate(6, ${H + 14})">${legendItems}</g>
            </svg>`;
    },

    _abrirModalEditarGasto(g) {
        const existing = document.getElementById('modal-editar-gasto');
        if (existing) existing.remove();

        const CATEGORIAS = [
            'Materiales', 'Renta', 'Utilidades', 'Equipos',
            'Marketing', 'Servicios Profesionales', 'Otros'
        ];
        const catOptions = CATEGORIAS.map(c =>
            `<option value="${c}" ${g.categoria === c ? 'selected' : ''}>${c === 'Materiales' ? 'Materiales y Suministros' : c === 'Renta' ? 'Renta del Local' : c === 'Utilidades' ? 'Utilidades (Luz, Agua, Internet)' : c === 'Equipos' ? 'Equipos y Herramientas' : c === 'Marketing' ? 'Marketing y Publicidad' : c === 'Servicios Profesionales' ? 'Servicios Profesionales' : 'Otros Gastos Ordinarios'}</option>`
        ).join('');

        const overlay = document.createElement('div');
        overlay.id = 'modal-editar-gasto';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:14px;padding:28px 30px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 36px rgba(0,0,0,0.18);font-family:var(--font-primary);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--color-soft-black);display:flex;align-items:center;gap:8px;">
                        <i data-lucide="edit-3" style="width:17px;height:17px;color:var(--color-moss-green);"></i>
                        Revisar y Editar Gasto
                    </h3>
                    <button id="modal-gasto-close" style="background:none;border:none;cursor:pointer;color:#8c8270;font-size:20px;line-height:1;padding:2px 6px;">&times;</button>
                </div>
                <p style="font-size:12.5px;color:#8c8270;margin:0 0 20px;">
                    Revisa los datos del gasto y edita lo que necesites antes de guardar.
                    <!-- FASE 2B: aquí se pre-rellenarán los datos extraídos por IA del recibo -->
                </p>

                <div style="display:flex;flex-direction:column;gap:13px;">
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:var(--color-olive-brown);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Proveedor</label>
                        <input type="text" id="meg-proveedor" value="${g.proveedor || ''}" placeholder="Nombre del proveedor o tienda"
                            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--color-gray-border);border-radius:8px;font-size:13px;font-family:inherit;color:var(--color-soft-black);">
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:var(--color-olive-brown);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Concepto *</label>
                        <input type="text" id="meg-concepto" value="${g.concepto || ''}" required
                            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--color-gray-border);border-radius:8px;font-size:13px;font-family:inherit;color:var(--color-soft-black);">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:var(--color-olive-brown);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Fecha *</label>
                            <input type="date" id="meg-fecha" value="${g.fecha || ''}" required
                                style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--color-gray-border);border-radius:8px;font-size:13px;font-family:inherit;">
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:var(--color-olive-brown);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Total / Monto *</label>
                            <input type="number" step="0.01" min="0.01" id="meg-monto" value="${g.monto || ''}" required
                                style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--color-gray-border);border-radius:8px;font-size:13px;font-family:inherit;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:var(--color-olive-brown);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Subtotal</label>
                            <input type="number" step="0.01" min="0" id="meg-subtotal" placeholder="0.00"
                                style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--color-gray-border);border-radius:8px;font-size:13px;font-family:inherit;">
                            <p style="font-size:10.5px;color:#aaa;margin:3px 0 0;">Se rellenará con IA</p>
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:var(--color-olive-brown);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">IVU</label>
                            <input type="number" step="0.01" min="0" id="meg-ivu" placeholder="0.00"
                                style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--color-gray-border);border-radius:8px;font-size:13px;font-family:inherit;">
                            <p style="font-size:10.5px;color:#aaa;margin:3px 0 0;">Se rellenará con IA</p>
                        </div>
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:var(--color-olive-brown);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Categoría</label>
                        <select id="meg-categoria" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--color-gray-border);border-radius:8px;font-size:13px;font-family:inherit;background:#fff;">
                            ${catOptions}
                        </select>
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;font-weight:600;color:var(--color-olive-brown);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Notas</label>
                        <textarea id="meg-notas" rows="2" placeholder="Observaciones adicionales..."
                            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--color-gray-border);border-radius:8px;font-size:13px;font-family:inherit;resize:none;">${g.notas || ''}</textarea>
                    </div>
                </div>

                <div id="modal-gasto-error" style="display:none;font-size:13px;color:#c0694a;background:#fdf0ec;border:1px solid #f5c6b8;border-radius:7px;padding:8px 12px;margin-top:14px;"></div>

                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
                    <button id="modal-gasto-cancel" class="btn btn-secondary" style="padding:9px 20px;font-size:13px;">Cancelar</button>
                    <button id="modal-gasto-confirm" class="btn btn-primary" style="padding:9px 20px;font-size:13px;display:inline-flex;align-items:center;gap:6px;">
                        <i data-lucide="save" style="width:14px;height:14px;"></i> Guardar cambios
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        const cerrar = () => overlay.remove();
        document.getElementById('modal-gasto-close').addEventListener('click', cerrar);
        document.getElementById('modal-gasto-cancel').addEventListener('click', cerrar);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

        document.getElementById('modal-gasto-confirm').addEventListener('click', async () => {
            const concepto = document.getElementById('meg-concepto').value.trim();
            const fecha    = document.getElementById('meg-fecha').value;
            const monto    = parseFloat(document.getElementById('meg-monto').value);
            const errorDiv = document.getElementById('modal-gasto-error');
            const btnSave  = document.getElementById('modal-gasto-confirm');

            if (!concepto || !fecha || isNaN(monto) || monto <= 0) {
                errorDiv.textContent = 'Concepto, Fecha y Monto son obligatorios.';
                errorDiv.style.display = 'block';
                return;
            }

            const payload = {
                concepto,
                fecha,
                monto,
                categoria:   document.getElementById('meg-categoria').value,
                metodo_pago: g.metodo_pago || null,
                notas:       document.getElementById('meg-notas').value.trim() || null,
                proveedor:   document.getElementById('meg-proveedor').value.trim() || null,
            };

            errorDiv.style.display = 'none';
            btnSave.disabled = true;
            btnSave.innerHTML = '<i data-lucide="loader-2" style="width:14px;height:14px;"></i> Guardando...';
            if (typeof lucide !== 'undefined') lucide.createIcons();

            try {
                await EvergreenAPI.actualizarGasto(g.id, payload);
                overlay.remove();
                await this.loadData();
            } catch (err) {
                errorDiv.textContent = `Error al guardar: ${err.message}`;
                errorDiv.style.display = 'block';
                btnSave.disabled = false;
                btnSave.innerHTML = '<i data-lucide="save" style="width:14px;height:14px;"></i> Guardar cambios';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    },

    _openAddManualMonthModal() {
        // Remove existing modal if any
        const existing = document.getElementById('modal-add-manual-month');
        if (existing) existing.remove();

        const hoy = new Date();
        const pad = (n) => String(n).padStart(2, '0');

        const overlay = document.createElement('div');
        overlay.id = 'modal-add-manual-month';
        overlay.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:9999;
            display:flex; align-items:center; justify-content:center;
        `;
        overlay.innerHTML = `
            <div style="background:#fff; border-radius:14px; padding:28px 32px; width:100%; max-width:420px; box-shadow:0 8px 32px rgba(0,0,0,0.18); font-family:var(--font-primary);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--color-soft-black);">Añadir Período Manual</h3>
                    <button id="modal-manual-close" style="background:none; border:none; cursor:pointer; color:#8c8270; font-size:20px; line-height:1; padding:2px 6px;">&times;</button>
                </div>

                <p style="margin:0 0 16px; font-size:13px; color:#6c757d; line-height:1.5;">
                    Define el rango del período. El mes se tomará de la fecha <strong>Desde</strong>.
                </p>

                <button id="modal-manual-btn-actual" style="
                    display:inline-flex; align-items:center; gap:6px; margin-bottom:18px;
                    background:rgba(95,122,69,0.1); border:1px solid rgba(95,122,69,0.3);
                    border-radius:8px; padding:7px 14px; font-size:12.5px; font-weight:600;
                    color:var(--color-moss-green); cursor:pointer;
                ">
                    <span>⚡</span> Período IVU Actual
                </button>

                <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:22px;">
                    <div>
                        <label style="display:block; font-size:11px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px;">Desde</label>
                        <input type="date" id="modal-manual-desde" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1.5px solid var(--color-gray-border); border-radius:8px; font-size:13.5px; font-family:var(--font-primary); color:var(--color-soft-black); outline:none;">
                    </div>
                    <div>
                        <label style="display:block; font-size:11px; font-weight:600; color:var(--color-olive-brown); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px;">Hasta</label>
                        <input type="date" id="modal-manual-hasta" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1.5px solid var(--color-gray-border); border-radius:8px; font-size:13.5px; font-family:var(--font-primary); color:var(--color-soft-black); outline:none;">
                    </div>
                    <div id="modal-manual-preview" style="font-size:12.5px; color:var(--color-moss-green); font-weight:600; min-height:18px;"></div>
                </div>

                <div id="modal-manual-error" style="display:none; font-size:13px; color:#c0694a; background:#fdf0ec; border:1px solid #f5c6b8; border-radius:7px; padding:8px 12px; margin-bottom:14px;"></div>

                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button id="modal-manual-cancel" class="btn btn-secondary" style="padding:9px 20px; font-size:13px;">Cancelar</button>
                    <button id="modal-manual-confirm" class="btn btn-primary" style="padding:9px 20px; font-size:13px;">Añadir Período</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
        const fmtDisplay = (yyyy, mm, dd) => `${pad(dd)}/${MESES[parseInt(mm)-1]}/${yyyy}`;

        const updatePreview = () => {
            const d = document.getElementById('modal-manual-desde').value;
            const h = document.getElementById('modal-manual-hasta').value;
            const prev = document.getElementById('modal-manual-preview');
            if (d && h) {
                const [dy, dm, dd2] = d.split('-');
                const [hy, hm, hd] = h.split('-');
                prev.textContent = `Período: ${fmtDisplay(dy, dm, dd2)} al ${fmtDisplay(hy, hm, hd)}`;
            } else {
                prev.textContent = '';
            }
        };

        document.getElementById('modal-manual-desde').addEventListener('change', updatePreview);
        document.getElementById('modal-manual-hasta').addEventListener('change', updatePreview);

        document.getElementById('modal-manual-btn-actual').addEventListener('click', () => {
            const mes = hoy.getMonth() + 1;
            const anio = hoy.getFullYear();
            const mesAnt = mes === 1 ? 12 : mes - 1;
            const anioAnt = mes === 1 ? anio - 1 : anio;
            document.getElementById('modal-manual-desde').value = `${anioAnt}-${pad(mesAnt)}-20`;
            document.getElementById('modal-manual-hasta').value = `${anio}-${pad(mes)}-19`;
            updatePreview();
        });

        const cerrar = () => overlay.remove();
        document.getElementById('modal-manual-close').addEventListener('click', cerrar);
        document.getElementById('modal-manual-cancel').addEventListener('click', cerrar);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

        document.getElementById('modal-manual-confirm').addEventListener('click', () => {
            this._confirmAddManualMonth(overlay);
        });
    },

    _confirmAddManualMonth(overlay) {
        const desde = document.getElementById('modal-manual-desde').value;
        const errorDiv = document.getElementById('modal-manual-error');

        const showError = (msg) => {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        };

        if (!desde) {
            showError('Selecciona al menos la fecha de inicio (Desde).');
            return;
        }

        // Derive YYYY-MM from the "desde" date
        const cleanMonth = desde.substring(0, 7); // "YYYY-MM"

        const allMonths = this.getAllMonths();
        if (allMonths.includes(cleanMonth)) {
            showError(`El período ${cleanMonth} ya existe en los reportes.`);
            return;
        }

        let manualMonths = [];
        try { manualMonths = JSON.parse(localStorage.getItem('manual_months') || '[]'); } catch (e) {}
        manualMonths.push(cleanMonth);
        localStorage.setItem('manual_months', JSON.stringify(manualMonths));

        let overrides = {};
        try { overrides = JSON.parse(localStorage.getItem('ivu_overrides') || '{}'); } catch (e) {}
        overrides[cleanMonth] = { ingresos_subtotal: 0.0, ivu_estatal: 0.0, ivu_municipal: 0.0, total_recaudado: 0.0 };
        localStorage.setItem('ivu_overrides', JSON.stringify(overrides));

        overlay.remove();
        this.renderReports();
    },

    async exportarIvuExcel() {
        const inicio = document.getElementById('ivu-periodo-inicio')?.value;
        const fin    = document.getElementById('ivu-periodo-fin')?.value;
        const errorDiv = document.getElementById('ivu-periodo-error');
        const btn = document.getElementById('btn-exportar-ivu-excel');

        if (!inicio || !fin) {
            if (errorDiv) { errorDiv.textContent = 'Selecciona el período (Desde y Hasta) antes de exportar.'; errorDiv.style.display = 'block'; }
            return;
        }
        if (errorDiv) errorDiv.style.display = 'none';

        const originalHTML = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" style="width:15px;height:15px;"></i> Generando...'; }

        try {
            const blob = await EvergreenAPI.exportIvuExcel(inicio, fin);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ivu_evergreen_${inicio}_${fin}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            if (errorDiv) { errorDiv.textContent = `Error al exportar: ${e.message}`; errorDiv.style.display = 'block'; }
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; if (typeof lucide !== 'undefined') lucide.createIcons(); }
        }
    },

    async exportarGastosExcel() {
        const desde    = document.getElementById('filter-gasto-desde')?.value || '';
        const hasta    = document.getElementById('filter-gasto-hasta')?.value || '';
        const categoria = document.getElementById('filter-gasto-categoria')?.value || '';
        const metodo   = document.getElementById('filter-gasto-metodo')?.value || '';
        const recibo   = document.getElementById('filter-gasto-recibo')?.value || '';

        const btn = document.getElementById('btn-exportar-gastos-excel');
        const originalHTML = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" style="width:13px;height:13px;"></i> Generando...'; }

        try {
            const blob = await EvergreenAPI.exportGastosExcel({ desde, hasta, categoria, metodo, recibo });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const desdeStr = desde ? desde.replace(/-/g, '') : 'inicio';
            const hastaStr = hasta ? hasta.replace(/-/g, '') : 'hoy';
            a.download = `gastos_evergreen_${desdeStr}_${hastaStr}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert(`Error al exportar gastos: ${e.message}`);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; if (typeof lucide !== 'undefined') lucide.createIcons(); }
        }
    },

    async calcularIvuPeriodo() {
        const inicio = document.getElementById('ivu-periodo-inicio')?.value;
        const fin    = document.getElementById('ivu-periodo-fin')?.value;
        const resultado = document.getElementById('ivu-periodo-resultado');
        const loading   = document.getElementById('ivu-periodo-loading');
        const errorDiv  = document.getElementById('ivu-periodo-error');

        if (!inicio || !fin) {
            if (errorDiv) { errorDiv.textContent = 'Selecciona fecha de inicio y fecha de fin.'; errorDiv.style.display = 'block'; }
            return;
        }
        if (inicio > fin) {
            if (errorDiv) { errorDiv.textContent = 'La fecha de inicio no puede ser mayor que la fecha de fin.'; errorDiv.style.display = 'block'; }
            return;
        }

        if (errorDiv)  errorDiv.style.display  = 'none';
        if (resultado) resultado.style.display  = 'none';
        if (loading)   loading.style.display    = 'block';

        try {
            const data = await EvergreenAPI.getIvuPeriodo(inicio, fin);
            this.renderIvuPeriodoResult(data);
        } catch (e) {
            if (errorDiv) { errorDiv.textContent = 'Error al calcular IVU. Verifica tu sesión e intenta de nuevo.'; errorDiv.style.display = 'block'; }
        } finally {
            if (loading) loading.style.display = 'none';
        }
    },

    renderIvuPeriodoResult(data) {
        const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;
        const label   = document.getElementById('ivu-periodo-label');
        const res     = document.getElementById('ivu-periodo-resultado');

        if (label) label.textContent = `Periodo: ${data.periodo?.desde} → ${data.periodo?.hasta}`;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('ivu-p-ventas',    fmt(data.ventas_sujetas_ivu));
        set('ivu-p-estatal',   fmt(data.ivu_estatal));
        set('ivu-p-municipal', fmt(data.ivu_municipal));
        set('ivu-p-total',     fmt(data.ivu_total));
        set('ivu-p-facturado', fmt(data.total_facturado));
        set('ivu-p-pendiente', fmt(data.total_pendiente));
        set('ivu-p-n-facturas', data.total_facturas ?? 0);

        if (res) res.style.display = 'block';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    getAllMonths() {
        const rMensual = this.reporte.reporte_mensual || [];
        const dbMonths = rMensual.map(m => m.mes);
        
        let manualMonths = [];
        try {
            manualMonths = JSON.parse(localStorage.getItem('manual_months') || '[]');
        } catch (e) {
            console.error("Error al leer manual_months de localStorage:", e);
        }

        // Merge and unique
        const allMonthsSet = new Set([...dbMonths, ...manualMonths]);
        const allMonths = Array.from(allMonthsSet);

        // Sort descending (e.g., "2026-06", "2026-05")
        allMonths.sort((a, b) => b.localeCompare(a));
        return allMonths;
    },

    getMonthlyData(monthStr) {
        const rMensual = this.reporte.reporte_mensual || [];
        const baseData = rMensual.find(row => row.mes === monthStr) || {
            mes: monthStr,
            total_facturas: 0,
            ingresos_subtotal: 0.0,
            ivu_estatal: 0.0,
            ivu_municipal: 0.0,
            total_facturado: 0.0,
            total_recaudado: 0.0,
            total_pendiente: 0.0
        };

        // Cargar overrides
        let overrides = {};
        try {
            overrides = JSON.parse(localStorage.getItem('ivu_overrides') || '{}');
        } catch (e) {
            console.error("Error al leer overrides de localStorage:", e);
        }

        const monthOverrides = overrides[monthStr] || {};
        
        const ingresos_subtotal = monthOverrides.ingresos_subtotal !== undefined ? monthOverrides.ingresos_subtotal : (baseData.ingresos_subtotal || 0.0);
        const ivu_estatal = monthOverrides.ivu_estatal !== undefined ? monthOverrides.ivu_estatal : (baseData.ivu_estatal || 0.0);
        const ivu_municipal = monthOverrides.ivu_municipal !== undefined ? monthOverrides.ivu_municipal : (baseData.ivu_municipal || 0.0);
        const total_recaudado = monthOverrides.total_recaudado !== undefined ? monthOverrides.total_recaudado : (baseData.total_recaudado || 0.0);
        
        const total_facturado = ingresos_subtotal + ivu_estatal + ivu_municipal;
        const total_pendiente = Math.max(0.0, total_facturado - total_recaudado);
        
        return {
            mes: monthStr,
            total_facturas: baseData.total_facturas,
            ingresos_subtotal,
            ivu_estatal,
            ivu_municipal,
            total_facturado,
            total_recaudado,
            total_pendiente,
            isEdited: Object.keys(monthOverrides).length > 0,
            isManual: !rMensual.some(row => row.mes === monthStr)
        };
    },

    renderReports() {
        const allMonths = this.getAllMonths();

        // Calcular KPIs en base a los meses de la tabla con sus modificaciones aplicadas
        let sumFacturado = 0.0;
        let sumRecaudado = 0.0;
        let sumPendiente = 0.0;

        allMonths.forEach(m => {
            const data = this.getMonthlyData(m);
            if (data) {
                sumFacturado += data.total_facturado;
                sumRecaudado += data.total_recaudado;
                sumPendiente += data.total_pendiente;
            }
        });

        const sumGastos = this.gastos ? this.gastos.reduce((s, g) => s + g.monto, 0) : 0;
        const gananciaNeta = sumFacturado - sumGastos;

        document.getElementById('rep-kpi-facturado').innerText = MONEY.format(sumFacturado);
        document.getElementById('rep-kpi-recaudado').innerText = MONEY.format(sumRecaudado);
        document.getElementById('rep-kpi-pendiente').innerText = MONEY.format(sumPendiente);
        document.getElementById('rep-kpi-diez-porciento').innerText = MONEY.format(sumFacturado * 0.10);
        
        const repKpiGastos = document.getElementById('rep-kpi-gastos');
        if (repKpiGastos) repKpiGastos.innerText = MONEY.format(sumGastos);
        const repKpiGanancia = document.getElementById('rep-kpi-ganancia');
        if (repKpiGanancia) repKpiGanancia.innerText = MONEY.format(gananciaNeta);

        this.renderStatusCards();
        this.renderCharts(allMonths);

        const tbody = document.getElementById('ivu-report-body');

        // Poblar selector de meses de SURI
        const monthSelect = document.getElementById('suri-month-select');
        if (monthSelect) {
            const currentSelectedMonth = monthSelect.value;
            monthSelect.innerHTML = '<option value="">Seleccione un mes...</option>';
            allMonths.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                monthSelect.appendChild(opt);
            });
            if (currentSelectedMonth && allMonths.includes(currentSelectedMonth)) {
                monthSelect.value = currentSelectedMonth;
                this.generateSuriTemplate(currentSelectedMonth);
            } else if (allMonths.length > 0) {
                monthSelect.value = allMonths[0];
                this.generateSuriTemplate(allMonths[0]);
            } else {
                this.generateSuriTemplate(null);
            }
        }

        if (allMonths.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; color: #8c8c8c; padding: 24px; font-style:italic;">
                        No hay suficientes facturas cobradas para armar reportes históricos.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        allMonths.forEach(m => {
            const data = this.getMonthlyData(m);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${data.mes}</strong>
                    ${data.isManual ? `<div style="font-size:10px; color:var(--color-warning); font-weight:600; margin-top:2px;">[Manual]</div>` : (data.isEdited ? `<div style="font-size:10px; color:var(--color-moss-green); font-weight:600; margin-top:2px;">[Editado]</div>` : '')}
                </td>
                <td style="text-align:center;">${data.total_facturas}</td>
                <td>
                    <input type="number" step="0.01" class="report-edit-input" data-month="${data.mes}" data-field="ingresos_subtotal" value="${data.ingresos_subtotal.toFixed(2)}" style="width:80px; padding:3px 6px; border:1px solid var(--color-gray-border); border-radius:4px; text-align:right; font-family:inherit; font-size:12.5px;">
                </td>
                <td>
                    <input type="number" step="0.01" class="report-edit-input" data-month="${data.mes}" data-field="ivu_estatal" value="${data.ivu_estatal.toFixed(2)}" style="width:75px; padding:3px 6px; border:1px solid var(--color-gray-border); border-radius:4px; text-align:right; font-family:inherit; font-size:12.5px; font-weight:600; color:var(--color-moss-green);">
                </td>
                <td>
                    <input type="number" step="0.01" class="report-edit-input" data-month="${data.mes}" data-field="ivu_municipal" value="${data.ivu_municipal.toFixed(2)}" style="width:70px; padding:3px 6px; border:1px solid var(--color-gray-border); border-radius:4px; text-align:right; font-family:inherit; font-size:12.5px; font-weight:600; color:var(--color-olive-brown);">
                </td>
                <td style="font-weight:600; text-align:right; padding-right:12px;">${MONEY.format(data.total_facturado)}</td>
                <td style="font-weight:600; color:var(--color-olive-brown); text-align:right; padding-right:12px;">${MONEY.format(data.total_facturado * 0.10)}</td>
                <td>
                    <input type="number" step="0.01" class="report-edit-input" data-month="${data.mes}" data-field="total_recaudado" value="${data.total_recaudado.toFixed(2)}" style="width:85px; padding:3px 6px; border:1px solid var(--color-gray-border); border-radius:4px; text-align:right; font-family:inherit; font-size:12.5px; font-weight:600; color:var(--color-success);">
                </td>
                <td style="color:var(--color-warning); font-weight:600; text-align:right; padding-right:12px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                         <span>${MONEY.format(data.total_pendiente)}</span>
                         ${data.isManual ? `
                            <button class="btn-reset-report-month btn-delete-manual-month" data-month="${data.mes}" title="Eliminar período manual" style="background:none; border:none; color:var(--color-danger); cursor:pointer; padding:2px; font-size:12px; display:inline-flex; align-items:center;">
                                <i data-lucide="trash-2" style="width:13px; height:13px;"></i>
                            </button>
                         ` : (data.isEdited ? `
                            <button class="btn-reset-report-month" data-month="${data.mes}" title="Reestablecer valores originales de base de datos" style="background:none; border:none; color:var(--color-danger); cursor:pointer; padding:2px; font-size:12px; display:inline-flex; align-items:center;">
                                <i data-lucide="rotate-ccw" style="width:13px; height:13px;"></i>
                            </button>
                         ` : '')}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Vincular eventos a los inputs de la tabla de reportes
        tbody.querySelectorAll('.report-edit-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const month = e.target.getAttribute('data-month');
                const field = e.target.getAttribute('data-field');
                const val = parseFloat(e.target.value);
                
                if (isNaN(val) || val < 0) {
                    alert("Por favor ingrese un valor numérico válido mayor o igual a 0.");
                    this.renderReports();
                    return;
                }

                // Guardar override
                let overrides = {};
                try {
                    overrides = JSON.parse(localStorage.getItem('ivu_overrides') || '{}');
                } catch (err) {}

                if (!overrides[month]) overrides[month] = {};
                overrides[month][field] = val;
                
                localStorage.setItem('ivu_overrides', JSON.stringify(overrides));
                
                // Recargar y actualizar
                this.renderReports();
                
                // Actualizar SURI en caso de que esté seleccionado ese mes
                const mSelect = document.getElementById('suri-month-select');
                if (mSelect && mSelect.value === month) {
                    this.generateSuriTemplate(month);
                }
            });
        });

        // Vincular eventos para reestablecer valores o eliminar período manual
        tbody.querySelectorAll('.btn-reset-report-month').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const month = btn.getAttribute('data-month');
                const isManual = btn.classList.contains('btn-delete-manual-month');
                if (isManual) {
                    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el período manual ${month}?`)) {
                        let manualMonths = [];
                        try {
                            manualMonths = JSON.parse(localStorage.getItem('manual_months') || '[]');
                        } catch (err) {}
                        manualMonths = manualMonths.filter(m => m !== month);
                        localStorage.setItem('manual_months', JSON.stringify(manualMonths));

                        let overrides = {};
                        try {
                            overrides = JSON.parse(localStorage.getItem('ivu_overrides') || '{}');
                        } catch (err) {}
                        delete overrides[month];
                        localStorage.setItem('ivu_overrides', JSON.stringify(overrides));

                        this.renderReports();
                    }
                } else {
                    if (confirm(`¿Estás seguro de que deseas reestablecer los valores del período ${month} a los calculados por la base de datos?`)) {
                        let overrides = {};
                        try {
                            overrides = JSON.parse(localStorage.getItem('ivu_overrides') || '{}');
                        } catch (err) {}

                        delete overrides[month];
                        localStorage.setItem('ivu_overrides', JSON.stringify(overrides));
                        
                        this.renderReports();
                        const mSelect = document.getElementById('suri-month-select');
                        if (mSelect && mSelect.value === month) {
                            this.generateSuriTemplate(month);
                        }
                    }
                }
            });
        });

        lucide.createIcons();
    },

    generateSuriTemplate(monthStr) {
        const output = document.getElementById('suri-template-output');
        if (!output) return;

        if (!monthStr) {
            output.value = "Selecciona un período arriba para ver la plantilla de declaración...";
            return;
        }

        const data = this.getMonthlyData(monthStr);
        if (!data) {
            output.value = "No se encontraron datos para el mes seleccionado.";
            return;
        }

        const subtotal = data.ingresos_subtotal || 0.0;
        const ivaEstatal = data.ivu_estatal || 0.0;
        const ivaMunicipal = data.ivu_municipal || 0.0;
        const total = data.total_facturado || 0.0;
        const cobrado = data.total_recaudado || 0.0;
        const pendiente = data.total_pendiente || 0.0;
        const diezPorciento = total * 0.10;

        // Estimar exento e impone municipal
        const tributableMunicipal = ivaMunicipal * 100;
        const exentoMunicipal = Math.max(0.0, subtotal - tributableMunicipal);

        // Gastos del período
        const monthExpenses = this.gastos ? this.gastos.filter(g => g.fecha.startsWith(monthStr)) : [];
        const monthExpensesTotal = monthExpenses.reduce((s, g) => s + g.monto, 0);
        const monthNetIncome = subtotal - monthExpensesTotal;

        const expBreakdown = {};
        monthExpenses.forEach(g => {
            expBreakdown[g.categoria] = (expBreakdown[g.categoria] || 0) + g.monto;
        });
        
        let expBreakdownStr = "";
        for (const [cat, amt] of Object.entries(expBreakdown)) {
            expBreakdownStr += `      - ${cat}: $${amt.toFixed(2)}\n`;
        }
        if (!expBreakdownStr) expBreakdownStr = "      - Ninguno\n";

        // Calcular rango de fechas dinámico: del 20 del mes anterior al 19 del mes seleccionado
        const parts = monthStr.split('-');
        const year = parseInt(parts[0]);
        const monthIndex = parseInt(parts[1]) - 1; // 0-indexed
        const prevDateObj = new Date(year, monthIndex - 1, 1);
        const prevYear = prevDateObj.getFullYear();
        const prevMonth = String(prevDateObj.getMonth() + 1).padStart(2, '0');
        const rangoFechas = `del 20 de ${prevMonth}/${prevYear} al 19 de ${parts[1]}/${year}`;

        const template = `📄 INFORME DE DECLARACIÓN MENSUAL (SURI / CONTABILIDAD)
Evergreen Love — Período: ${monthStr} (${rangoFechas})

1. PLANILLA MENSUAL DE IVU ESTATAL (Form SC 2915 en SURI):
   • Sección: Ventas de Servicios y Productos
     - Ventas Tributables (Subtotal): $${subtotal.toFixed(2)}
     - Tasa del Impuesto Aplicable: 10.5%
     - IVU Estatal Devengado (SURI): $${ivaEstatal.toFixed(2)}

2. PLANILLA MENSUAL DE IVU MUNICIPAL (Municipio local):
   • Ventas Tributables Municipales (Tasa 1.0%): $${tributableMunicipal.toFixed(2)}
   • Ventas Exentas Municipales (Modelo exento): $${exentoMunicipal.toFixed(2)}
   • Tasa del Impuesto Municipal: 1.0%
   • IVU Municipal Devengado: $${ivaMunicipal.toFixed(2)}

3. BORRADOR PLANILLA DE CONTRIBUCIÓN SOBRE INGRESOS (Hacienda PR):
   • Ingresos Brutos del Período (Subtotal): $${subtotal.toFixed(2)}
   • Deducciones por Gastos Ordinarios y Necesarios:
${expBreakdownStr}     Total Gastos Deducibles: $${monthExpensesTotal.toFixed(2)}
   • Ingreso Neto Sujeto a Contribución (Ganancia Neta): $${monthNetIncome.toFixed(2)}

4. RESUMEN FINANCIERO ERP:
   • Total Ventas Bruto Facturado: $${total.toFixed(2)}
   • Retención Sugerida de Impuestos (10%): $${diezPorciento.toFixed(2)}
   • Total de Efectivo Recaudado (Caja): $${cobrado.toFixed(2)}
   • Cuentas por Cobrar Pendientes: $${pendiente.toFixed(2)}

Generado de forma segura por el ERP de Evergreen Love el ${new Date().toLocaleDateString('es-PR')}`;

        output.value = template;
    },

    renderDetailContent(id, items) {
        const contentDiv = document.getElementById(`detail-content-${id}`);
        if (!contentDiv) return;
        
        if (!items || items.length === 0) {
            contentDiv.innerHTML = `<p style="font-style:italic; color:#8c8270; margin:4px 0;">Esta factura no tiene productos registrados.</p>`;
            return;
        }
        
        let rowsHtml = '';
        items.forEach((item, index) => {
            const fotoUrl = item.foto_ruta;
            const fotoHtml = fotoUrl
                ? `<img src="${getFullImageUrl(fotoUrl)}" style="width:24px; height:24px; object-fit:cover; border-radius:4px; border: 1px solid var(--color-gray-border); background:#f5f5f5; vertical-align:middle;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
                   <div style="display:none; width:24px; height:24px; border-radius:4px; border:1px dashed var(--color-gray-border); background:var(--color-gray-light); align-items:center; justify-content:center; flex-shrink:0; vertical-align:middle;">
                       <i data-lucide="image" style="width:10px;height:10px;color:#ccc; display:block;"></i>
                   </div>`
                : `<div style="display:inline-flex; width:24px; height:24px; border-radius:4px; border:1px dashed var(--color-gray-border); background:var(--color-gray-light); align-items:center; justify-content:center; flex-shrink:0; vertical-align:middle;">
                       <i data-lucide="image" style="width:10px;height:10px;color:#ccc; display:block;"></i>
                   </div>`;
                   
            const prodName = item.nombre_producto || item.producto_nombre || "Producto";
            
            rowsHtml += `
                <tr>
                    <td style="width: 40px; text-align:center;">${fotoHtml}</td>
                    <td><strong>${index + 1}.</strong> ${prodName}</td>
                    <td>${item.cantidad}</td>
                    <td>${MONEY.format(item.precio_unitario)}</td>
                    <td style="font-weight:600; color:var(--color-moss-green); text-align:right;">${MONEY.format(item.total)}</td>
                </tr>
            `;
        });
        
        contentDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                <span style="font-size:12.5px; color:#8c8270; font-weight:600;"><i data-lucide="package" style="width:14px; height:14px; display:inline; vertical-align:-2px; margin-right:4px;"></i>Partidas de la Factura</span>
                <button class="btn btn-secondary" style="padding:5px 10px; font-size:11.5px; display:inline-flex; align-items:center; gap:4px; font-weight:600;" onclick="FacturasComponent.imprimirTicketTaller(${id})">
                    <i data-lucide="printer" style="width:13.5px; height:13.5px;"></i> Ticket de Taller
                </button>
            </div>
            <table class="invoice-detail-table">
                <thead>
                    <tr>
                        <th style="width: 40px;">Foto</th>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Precio Unit.</th>
                        <th style="text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
        
        lucide.createIcons();
    },

    imprimirTicketTaller(facturaId) {
        const factura = this.facturas.find(f => f.id === facturaId);
        if (!factura) return alert("Factura no encontrada.");

        // Consultar partidas e imágenes asociadas a esta factura
        EvergreenAPI.getFactura(facturaId).then(res => {
            const data = res.data;
            const items = res.items || [];
            
            // Crear una ventana de impresión aislada
            const printWindow = window.open('', '_blank', 'width=350,height=600');
            if (!printWindow) {
                alert("Por favor, permite ventanas emergentes para poder imprimir el ticket.");
                return;
            }

            const itemsHtml = items.map(item => `
                <tr style="border-bottom:1px dashed #ccc;">
                    <td style="padding:5px 0; font-size:12px; text-align:left;">
                        <strong>${item.nombre_producto}</strong><br>
                        ${item.cantidad} x $${item.precio_unitario.toFixed(2)}
                    </td>
                    <td style="padding:5px 0; text-align:right; font-size:12px; font-weight:bold; vertical-align:bottom;">
                        $${(item.cantidad * item.precio_unitario).toFixed(2)}
                    </td>
                </tr>
            `).join('');

            const dateStr = factura.fecha_emision;
            const totalRestante = Math.max(0, factura.total - (factura.monto_pagado || 0));
            
            const parsedCliente = getClienteDisplayData(
                factura.cliente_nombre,
                factura.notas,
                factura.cliente_email,
                factura.cliente_telefono
            );
            const clienteNombre = parsedCliente.name;
            const telefonoCliente = parsedCliente.phone;
            const emailCliente = parsedCliente.email;
            const notasAdicionales = parsedCliente.notas;

            printWindow.document.write(`
                <html>
                <head>
                    <title>Ticket Taller - ${factura.numero_factura}</title>
                    <style>
                        @page { margin: 0; }
                        body {
                            font-family: 'Courier New', Courier, monospace;
                            width: 260px;
                            margin: 0;
                            padding: 12px;
                            color: #000;
                            background: #fff;
                        }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .bold { font-weight: bold; }
                        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
                        table { width: 100%; border-collapse: collapse; }
                    </style>
                </head>
                <body>
                    <div class="text-center">
                        <strong style="font-size: 15px;">EVERGREEN LOVE</strong><br>
                        <span style="font-size: 11px;">Taller de Grabado Láser</span><br>
                        <span style="font-size: 11px;">Tel: (787) 960-1431</span>
                    </div>
                    <hr>
                    <div style="font-size:12px; line-height: 1.4;">
                        <strong>ORDEN DE TRABAJO</strong><br>
                        Factura: ${factura.numero_factura}<br>
                        Fecha: ${dateStr}<br>
                        Cliente: ${clienteNombre}<br>
                        ${telefonoCliente ? `Tel: ${telefonoCliente}<br>` : ''}
                        ${emailCliente && emailCliente !== 'N/A' ? `Email: ${emailCliente}<br>` : ''}
                    </div>
                    <hr>
                    <table>
                        <thead>
                            <tr style="border-bottom: 1px dashed #000;">
                                <th style="text-align:left; font-size:12px; padding-bottom:4px;">Descripción</th>
                                <th style="text-align:right; font-size:12px; padding-bottom:4px;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                    <hr>
                    <table style="line-height: 1.3;">
                        <tr>
                            <td style="font-size:12px;">Subtotal:</td>
                            <td class="text-right" style="font-size:12px;">$${factura.subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="font-size:12px;">IVU Estatal (10.5%):</td>
                            <td class="text-right" style="font-size:12px;">$${factura.ivu_estatal.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="font-size:12px;">IVU Mun. (1.0%):</td>
                            <td class="text-right" style="font-size:12px;">$${factura.ivu_municipal.toFixed(2)}</td>
                        </tr>
                        <tr class="bold">
                            <td style="font-size:13px;">Total:</td>
                            <td class="text-right" style="font-size:13px;">$${factura.total.toFixed(2)}</td>
                        </tr>
                        <tr style="color:#666;">
                            <td style="font-size:12px;">Pagado:</td>
                            <td class="text-right" style="font-size:12px;">$${(factura.monto_pagado || 0).toFixed(2)}</td>
                        </tr>
                        <tr class="bold" style="border-top:1px dashed #000; padding-top:4px;">
                            <td style="font-size:13px;">Balance:</td>
                            <td class="text-right" style="font-size:13px;">$${totalRestante.toFixed(2)}</td>
                        </tr>
                    </table>
                    ${notasAdicionales ? `
                    <hr>
                    <div style="font-size:11px; line-height: 1.3;">
                        <strong>Notas de Taller:</strong><br>
                        ${notasAdicionales}
                    </div>
                    ` : ''}
                    <hr>
                    <div class="text-center" style="font-size: 10px; margin-top: 15px; line-height: 1.2;">
                        ¡Muchas gracias por su compra!<br>
                        evergreenlov@gmail.com
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }).catch(err => {
            console.error("Error al imprimir ticket:", err);
            alert("Error al cargar detalles de la factura para impresión.");
        });
    },

    openPaymentModal(factura) {
        this.paymentModalFactura = factura;
        const modal = document.getElementById('payment-modal');
        document.getElementById('payment-modal-title').innerText = `Cobrar Factura ${factura.numero_factura}`;
        
        // Show invoice total info
        const infoDiv = document.getElementById('payment-modal-total-info');
        if (infoDiv) {
            const prevPaid = factura.monto_pagado || 0;
            const prevBalance = Math.max(0, factura.total - prevPaid);
            infoDiv.innerHTML = `
                <span style="font-weight:600;">Total Factura:</span> ${MONEY.format(factura.total)}<br>
                ${prevPaid > 0 ? `<span style="font-weight:600;">Pagado anteriormente:</span> ${MONEY.format(prevPaid)}<br>` : ''}
                <span style="font-weight:600; color: var(--color-moss-green);">Balance Pendiente:</span> ${MONEY.format(prevBalance)}
            `;
        }
        
        // Pre-fill monto with full balance due
        const prevPaid = factura.monto_pagado || 0;
        const balanceDue = Math.max(0, factura.total - prevPaid);
        const montoInput = document.getElementById('pay-monto');
        if (montoInput) montoInput.value = balanceDue.toFixed(2);
        
        // Set today's date in pay-fecha input
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('pay-fecha').value = today;
        document.getElementById('pay-cheque').value = "";
        
        const chequeContainer = document.getElementById('pay-cheque-container');
        chequeContainer.style.display = document.getElementById('pay-metodo').value === "Cheque" ? "flex" : "none";

        modal.style.display = 'flex';
    },

    closePaymentModal() {
        document.getElementById('payment-modal').style.display = 'none';
        this.paymentModalFactura = null;
    },

    calculateCartSummary() {
        let subtotal = 0.0;
        this.cart.forEach(item => {
            subtotal += item.total;
        });

        const stateTaxRate = 0.105; // 10.5%
        const municipalTaxRate = this.municipalTaxEnabled ? 0.01 : 0.0; // 1.0%

        const stateTax = subtotal * stateTaxRate;
        const municipalTax = subtotal * municipalTaxRate;
        const total = subtotal + stateTax + municipalTax;

        document.getElementById('inv-summary-subtotal').innerText = MONEY.format(subtotal);
        document.getElementById('inv-summary-estatal').innerText = MONEY.format(stateTax);
        document.getElementById('inv-summary-municipal').innerText = MONEY.format(municipalTax);
        document.getElementById('inv-summary-total').innerText = MONEY.format(total);
    },

    renderCart() {
        const tbody = document.getElementById('inv-cart-body');
        if (this.cart.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: #8c8c8c; padding: 20px; font-style:italic;">No hay partidas añadidas aún.</td>
                </tr>
            `;
            this.calculateCartSummary();
            return;
        }

        tbody.innerHTML = '';
        this.cart.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'animate-fade-in';
            tr.innerHTML = `
                <td><strong>${item.nombre_producto}</strong></td>
                <td>${item.cantidad}</td>
                <td>${MONEY.format(item.precio_unitario)}</td>
                <td style="font-weight:600; color:var(--color-moss-green);">${MONEY.format(item.total)}</td>
                <td style="text-align:right;">
                    <button class="btn btn-secondary btn-remove-cart-item" style="padding: 2px 6px; font-size:11px; border:none; background:none; box-shadow:none; color:var(--color-danger);" data-index="${index}">
                        Quitar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-remove-cart-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-index'));
                this.cart.splice(index, 1);
                this.renderCart();
            });
        });

        this.calculateCartSummary();
    },

    setupListeners() {
        // Filtros de gastos — reaplican sobre datos ya cargados sin tocar el backend
        ['filter-gasto-desde', 'filter-gasto-hasta', 'filter-gasto-categoria',
         'filter-gasto-metodo', 'filter-gasto-recibo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderExpenses());
        });
        const btnLimpiar = document.getElementById('btn-limpiar-filtros-gastos');
        if (btnLimpiar) btnLimpiar.addEventListener('click', () => {
            ['filter-gasto-desde','filter-gasto-hasta'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            ['filter-gasto-categoria','filter-gasto-metodo','filter-gasto-recibo'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            this.renderExpenses();
        });

        // IVU por Periodo
        const btnCalc = document.getElementById('btn-calcular-ivu-periodo');
        if (btnCalc) btnCalc.addEventListener('click', () => this.calcularIvuPeriodo());

        const btnExcel = document.getElementById('btn-exportar-ivu-excel');
        if (btnExcel) btnExcel.addEventListener('click', () => this.exportarIvuExcel());

        const btnExportarGastos = document.getElementById('btn-exportar-gastos-excel');
        if (btnExportarGastos) btnExportarGastos.addEventListener('click', () => this.exportarGastosExcel());

        const btnActual = document.getElementById('btn-periodo-ivu-actual');
        if (btnActual) btnActual.addEventListener('click', () => {
            const hoy = new Date();
            const anioActual = hoy.getFullYear();
            const mesActual  = hoy.getMonth() + 1; // 1-based
            // Ciclo: del 20 del mes anterior al 19 del mes actual
            const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
            const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;
            const pad = (n) => String(n).padStart(2, '0');
            document.getElementById('ivu-periodo-inicio').value = `${anioAnterior}-${pad(mesAnterior)}-20`;
            document.getElementById('ivu-periodo-fin').value    = `${anioActual}-${pad(mesActual)}-19`;
        });

        // Tab switching
        const tabs = document.querySelectorAll('.facturas-nav-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tabName = tab.getAttribute('data-tab');
                this.activeTab = tabName;
                
                document.querySelectorAll('.factura-section').forEach(sec => sec.style.display = 'none');
                document.getElementById(`view-section-${tabName}`).style.display = 'block';
                
                if (tabName === 'list' || tabName === 'reports' || tabName === 'expenses') {
                    this.loadData();
                } else if (tabName === 'create') {
                    this.updateAutoInvoiceNumber();
                }
            });
        });

        // Toggle payment modal cheque display
        const payMetodo = document.getElementById('pay-metodo');
        if (payMetodo) {
            payMetodo.addEventListener('change', (e) => {
                const chequeContainer = document.getElementById('pay-cheque-container');
                chequeContainer.style.display = e.target.value === "Cheque" ? "flex" : "none";
            });
        }

        // Live balance preview when typing monto pagado
        const payMonto = document.getElementById('pay-monto');
        if (payMonto) {
            payMonto.addEventListener('input', () => {
                const preview = document.getElementById('pay-balance-preview');
                if (!preview || !this.paymentModalFactura) return;
                const val = parseFloat(payMonto.value);
                const total = this.paymentModalFactura.total;
                if (!isNaN(val) && val >= 0) {
                    const balance = Math.max(0, total - val);
                    if (val >= total) {
                        preview.style.color = 'var(--color-moss-green)';
                        preview.textContent = '✓ Cubre el total — marcará como Pagada';
                    } else {
                        preview.style.color = 'var(--color-warning)';
                        preview.textContent = `Balance restante: ${MONEY.format(balance)} — quedará Pendiente`;
                    }
                } else {
                    preview.textContent = '';
                }
            });
        }

        // Close payment modal
        const btnClosePayment = document.getElementById('btn-close-payment-modal');
        if (btnClosePayment) {
            btnClosePayment.addEventListener('click', () => this.closePaymentModal());
        }

        // Submit payment form
        const formPayment = document.getElementById('form-registrar-pago');
        if (formPayment) {
            formPayment.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!this.paymentModalFactura) return;

                const montoInput = document.getElementById('pay-monto');
                const montoPagadoVal = montoInput && montoInput.value !== '' ? parseFloat(montoInput.value) : null;
                const totalFactura = this.paymentModalFactura.total;
                
                // Determine estado: if monto_pagado covers total → Pagada, otherwise keep Pendiente
                const estadoNuevo = (montoPagadoVal !== null && montoPagadoVal >= totalFactura) ? "Pagada" : "Pendiente";

                const payData = {
                    estado: estadoNuevo,
                    metodo_pago: document.getElementById('pay-metodo').value,
                    numero_cheque: document.getElementById('pay-cheque').value.trim() || null,
                    fecha_pago: document.getElementById('pay-fecha').value,
                    monto_pagado: montoPagadoVal
                };

                try {
                    await EvergreenAPI.updateFacturaEstado(this.paymentModalFactura.id, payData);
                    const msg = estadoNuevo === 'Pagada'
                        ? `Pago completo registrado para la factura ${this.paymentModalFactura.numero_factura}.`
                        : `Pago parcial de ${MONEY.format(montoPagadoVal)} registrado. Balance restante: ${MONEY.format(Math.max(0, totalFactura - montoPagadoVal))}.`;
                    alert(msg);
                    this.closePaymentModal();
                    await this.loadData();
                } catch (err) {
                    alert("Error al registrar pago: " + err.message);
                }
            });
        }

        // Client select trigger: load B2B catalogue
        const selectCliente = document.getElementById('inv-cliente-id');
        const detailCliente = document.getElementById('inv-cliente-detail');
        if (selectCliente) {
            selectCliente.addEventListener('change', async (e) => {
                const idVal = e.target.value;
                if (idVal) {
                    const id = parseInt(idVal);
                    this.selectedClienteId = id;
                    const client = this.clientes.find(c => c.id === id);
                    
                    // Display client B2B details
                    detailCliente.style.display = 'block';
                    detailCliente.innerHTML = `
                        <strong>Representante:</strong> ${client.contacto || 'Sin contacto directo'}<br>
                        <strong>Correo:</strong> ${client.email || 'N/A'}<br>
                        <strong>Teléfono:</strong> ${client.telefono || 'N/A'}<br>
                        <strong>Notas comerciales:</strong> <em>${client.notes || 'Ninguna'}</em>
                    `;

                    // Fetch current catalogue for special prices
                    try {
                        const res = await EvergreenAPI.getCatalogoCliente(id);
                        this.currentClientCatalog = res.data || [];
                    } catch (err) {
                        console.error("Error al obtener catálogo B2B para factura:", err);
                        this.currentClientCatalog = [];
                    }
                } else {
                    this.selectedClienteId = null;
                    detailCliente.style.display = 'none';
                    detailCliente.innerHTML = '';
                    this.currentClientCatalog = [];
                }

                // Refresh product selected prices in case selected product was already picked
                const selectAddProduct = document.getElementById('inv-add-producto-id');
                if (selectAddProduct) selectAddProduct.dispatchEvent(new Event('change'));
            });
        }

        // Add Product selector trigger in creator
        const selectAddProduct = document.getElementById('inv-add-producto-id');
        const inputAddPrecio = document.getElementById('inv-add-precio');
        const priceBadgeContainer = document.getElementById('inv-price-badge-container');

        if (selectAddProduct) {
            selectAddProduct.addEventListener('change', (e) => {
                const idVal = e.target.value;
                if (!idVal) {
                    inputAddPrecio.value = '';
                    priceBadgeContainer.innerHTML = '';
                    this.selectedProductId = "";
                    return;
                }

                const id = parseInt(idVal);
                this.selectedProductId = id;
                const product = this.productos.find(p => p.id === id);

                // Check special client catalogue pricing
                let pactadoItem = null;
                if (this.selectedClienteId && this.currentClientCatalog.length > 0) {
                    pactadoItem = this.currentClientCatalog.find(item => item.producto_id === id);
                }

                if (pactadoItem) {
                    this.selectedProductPrice = pactadoItem.precio_especial;
                    this.selectedProductIsPactado = true;
                    inputAddPrecio.value = pactadoItem.precio_especial.toFixed(2);
                    priceBadgeContainer.innerHTML = `
                        <span class="badge badge-success" style="font-size:10.5px; background-color: var(--color-moss-green-light); color:var(--color-moss-green); border:1px solid rgba(95,90,48,0.2);">
                            Precio Mayorista Pactado B2B
                        </span>
                        <span style="font-size:11.5px; color:#8c8270; margin-left:6px;">(Retail: $${product.precio_final.toFixed(2)})</span>
                    `;
                } else {
                    this.selectedProductPrice = product.precio_final;
                    this.selectedProductIsPactado = false;
                    inputAddPrecio.value = product.precio_final.toFixed(2);
                    priceBadgeContainer.innerHTML = `
                        <span class="badge badge-pending" style="font-size:10.5px; background-color: #FEF3C7; color:#D97706; border:1px solid rgba(217,119,6,0.15);">
                            Precio Retail Sugerido
                        </span>
                        <span style="font-size:11.5px; color:#8c8270; margin-left:6px;">(Costo: $${product.costo_total.toFixed(2)})</span>
                    `;
                }
            });
        }

        // Add Item to Cart button
        const btnAddItemCart = document.getElementById('btn-add-item-cart');
        if (btnAddItemCart) {
            btnAddItemCart.addEventListener('click', () => {
                const prodIdVal = selectAddProduct.value;
                if (!prodIdVal) {
                    alert("Por favor seleccione un producto.");
                    return;
                }

                const qtyVal = parseInt(document.getElementById('inv-add-qty').value);
                if (isNaN(qtyVal) || qtyVal <= 0) {
                    alert("Por favor introduzca una cantidad válida.");
                    return;
                }

                const priceVal = parseFloat(inputAddPrecio.value);
                if (isNaN(priceVal) || priceVal < 0) {
                    alert("Por favor introduzca un precio unitario válido.");
                    return;
                }

                const product = this.productos.find(p => p.id === parseInt(prodIdVal));
                
                // Add or merge to cart
                const existingIndex = this.cart.findIndex(item => item.producto_id === product.id);
                if (existingIndex > -1) {
                    // Update existing
                    this.cart[existingIndex].cantidad += qtyVal;
                    this.cart[existingIndex].total = this.cart[existingIndex].cantidad * priceVal;
                    this.cart[existingIndex].precio_unitario = priceVal;
                } else {
                    this.cart.push({
                        producto_id: product.id,
                        nombre_producto: product.nombre,
                        cantidad: qtyVal,
                        precio_unitario: priceVal,
                        total: qtyVal * priceVal
                    });
                }

                this.renderCart();
                
                // Reset select & values
                selectAddProduct.value = "";
                inputAddPrecio.value = "";
                document.getElementById('inv-add-qty').value = "1";
                priceBadgeContainer.innerHTML = "";
            });
        }

        // Municipal IVU Checkbox Toggle
        const chkMuniIvu = document.getElementById('inv-ivu-municipal-enabled');
        if (chkMuniIvu) {
            chkMuniIvu.addEventListener('change', (e) => {
                this.municipalTaxEnabled = e.target.checked;
                this.calculateCartSummary();
            });
        }

        // Cancel invoice creator
        const btnCancel = document.getElementById('btn-cancel-invoice');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                if (confirm("¿Estás seguro de que deseas vaciar y cancelar la creación de la factura?")) {
                    this.cart = [];
                    this.renderCart();
                    document.getElementById('tab-list').click(); // Ir a listado
                }
            });
        }

        // Save Invoice Submit
        const btnSave = document.getElementById('btn-save-invoice');
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                if (!this.selectedClienteId) {
                    alert("Por favor seleccione un cliente comercial B2B.");
                    return;
                }

                if (this.cart.length === 0) {
                    alert("No puede guardar una factura sin partidas/productos.");
                    return;
                }

                // Build values
                let subtotal = 0.0;
                this.cart.forEach(item => {
                    subtotal += item.total;
                });

                const stateTax = subtotal * 0.105;
                const municipalTax = this.municipalTaxEnabled ? (subtotal * 0.01) : 0.0;
                const total = subtotal + stateTax + municipalTax;

                const payload = {
                    numero_factura: document.getElementById('inv-numero-manual').value.trim() || null,
                    cliente_id: this.selectedClienteId,
                    fecha_emision: document.getElementById('inv-fecha-emision').value,
                    fecha_vencimiento: document.getElementById('inv-fecha-vence').value || null,
                    subtotal: parseFloat(subtotal.toFixed(2)),
                    ivu_estatal: parseFloat(stateTax.toFixed(2)),
                    ivu_municipal: parseFloat(municipalTax.toFixed(2)),
                    total: parseFloat(total.toFixed(2)),
                    notas: document.getElementById('inv-notas').value.trim() || null,
                    estado: "Pendiente",
                    items: this.cart.map(item => ({
                        producto_id: item.producto_id,
                        nombre_producto: item.nombre_producto,
                        cantidad: item.cantidad,
                        precio_unitario: item.precio_unitario,
                        total: item.total
                    }))
                };

                btnSave.disabled = true;
                btnSave.innerHTML = '<span class="spinner" style="width:14px; height:14px; margin-bottom:0; display:inline-block; vertical-align:middle; border-width:2px;"></span> Guardando...';

                try {
                    const res = await EvergreenAPI.createFactura(payload);
                    if (res.status === 'success') {
                        alert(`¡Factura ${res.numero_factura} guardada con éxito en SQLite!`);
                        
                        // Clear form
                        this.cart = [];
                        this.selectedClienteId = null;
                        document.getElementById('inv-cliente-id').value = "";
                        document.getElementById('inv-cliente-detail').style.display = 'none';
                        document.getElementById('inv-numero-manual').value = "";
                        this.initDates();
                        this.renderCart();
                        
                        // Switch view
                        document.getElementById('tab-list').click();
                    }
                } catch (err) {
                    alert("Error al registrar factura: " + err.message);
                } finally {
                    btnSave.disabled = false;
                    btnSave.innerHTML = '<i data-lucide="check"></i> Guardar Factura';
                    lucide.createIcons();
                }
            });
        }

        // SURI Month Select change event
        const suriMonthSelect = document.getElementById('suri-month-select');
        if (suriMonthSelect) {
            suriMonthSelect.addEventListener('change', (e) => {
                this.generateSuriTemplate(e.target.value);
            });
        }

        // Copy SURI template button click event
        const btnCopySuri = document.getElementById('btn-copy-suri-template');
        if (btnCopySuri) {
            btnCopySuri.addEventListener('click', () => {
                const output = document.getElementById('suri-template-output');
                if (!output || !output.value || output.value.startsWith("Selecciona")) {
                    alert("Por favor selecciona un mes válido primero.");
                    return;
                }
                navigator.clipboard.writeText(output.value).then(() => {
                    alert("Plantilla de declaración SURI copiada al portapapeles con éxito.");
                }).catch(err => {
                    alert("Error al copiar plantilla: " + err);
                });
            });
        }

        // Copy IVU table to clipboard
        const btnCopyReport = document.getElementById('btn-copy-ivu-report');
        if (btnCopyReport) {
            btnCopyReport.addEventListener('click', () => {
                const table = document.getElementById('ivu-report-table');
                if (!table) return;

                let csv = [];
                const rows = table.querySelectorAll('tr');
                for (let i = 0; i < rows.length; i++) {
                    const row = [], cols = rows[i].querySelectorAll('td, th');
                    for (let j = 0; j < cols.length; j++) {
                        row.push(cols[j].innerText.trim());
                    }
                    csv.push(row.join('\t')); // Tab delimited for excel copy paste
                }

                const textToCopy = csv.join('\n');
                navigator.clipboard.writeText(textToCopy).then(() => {
                    alert("Tabla copiada al portapapeles. Puedes pegarla en Excel o Numbers directamente.");
                }).catch(err => {
                    alert("Error al copiar al portapapeles: " + err);
                });
            });
        }

        // Add manual month period button click event
        const btnAddManualMonth = document.getElementById('btn-add-manual-month');
        if (btnAddManualMonth) {
            btnAddManualMonth.addEventListener('click', () => {
                this._openAddManualMonthModal();
            });
        }

        // Submit expense form
        const formExpense = document.getElementById('expense-form');
        if (formExpense) {
            formExpense.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btnSubmit = formExpense.querySelector('button[type="submit"]');
                
                const descripcion = document.getElementById('exp-descripcion').value;
                const categoria = document.getElementById('exp-categoria').value;
                const monto = parseFloat(document.getElementById('exp-monto').value);
                const fecha = document.getElementById('exp-fecha').value;
                const metodo_pago = document.getElementById('exp-metodo').value;
                const notas = document.getElementById('exp-notas') ? document.getElementById('exp-notas').value : '';
                
                if (!descripcion || !categoria || isNaN(monto) || !fecha || !metodo_pago) {
                    alert("Por favor rellene todos los campos requeridos.");
                    return;
                }
                
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<span class="spinner" style="width:14px; height:14px; margin-bottom:0; display:inline-block; vertical-align:middle; border-width:2px;"></span> Registrando...';
                
                try {
                    const archivoRecibo = document.getElementById('exp-recibo')?.files[0] || null;

                    const resultado = await EvergreenAPI.createGasto({
                        concepto: descripcion,
                        categoria,
                        monto,
                        fecha,
                        metodo_pago,
                        notas
                    });

                    if (archivoRecibo && resultado.id) {
                        try {
                            await EvergreenAPI.subirReciboGasto(resultado.id, archivoRecibo);
                        } catch (reciboErr) {
                            console.warn("Gasto creado pero fallo al subir recibo:", reciboErr.message);
                        }
                    }

                    // Clear form
                    formExpense.reset();
                    // Set today date as default
                    const todayStr = new Date().toISOString().split('T')[0];
                    document.getElementById('exp-fecha').value = todayStr;

                    // Reload data
                    await this.loadData();
                    alert("¡Gasto registrado con éxito!");
                } catch (err) {
                    alert("Error al registrar el gasto: " + err.message);
                } finally {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = '<i data-lucide="check-circle"></i> Guardar Gasto';
                    lucide.createIcons();
                }
            });
        }
    }
};
