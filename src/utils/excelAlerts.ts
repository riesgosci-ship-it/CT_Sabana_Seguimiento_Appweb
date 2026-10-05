import * as XLSX from "xlsx";
import { CaseRecord } from "../types";
import { normalizeHallazgo } from "../App";

// Helper to get Peru timezone today's date in YYYY-MM-DD
export function getPeruToday(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch (e) {
    return new Date().toISOString().split("T")[0];
  }
}

// Convert various date values (Excel serial numbers, slash/dash dates, Date objects) to YYYY-MM-DD
export function parseExcelDate(val: any): string {
  if (val === null || val === undefined || val === "") {
    return getPeruToday();
  }

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return getPeruToday();
  }

  // If number: Excel serial date
  if (typeof val === "number" || (!isNaN(Number(val)) && !String(val).includes("-") && !String(val).includes("/"))) {
    const num = Number(val);
    if (num > 20000 && num < 80000) {
      // Excel epoch begins Dec 30 1899
      const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(jsDate.getTime())) {
        const y = jsDate.getUTCFullYear();
        const m = String(jsDate.getUTCMonth() + 1).padStart(2, "0");
        const d = String(jsDate.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
  }

  const str = String(val).trim();
  if (!str) return getPeruToday();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  // If DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // If MM/DD/YYYY or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Attempt standard Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return getPeruToday();
}

// Clean number parsing (handles S/., $, commas, percentages)
export function parseCleanNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : val;

  let str = String(val).trim();
  // Remove currency symbols, spaces, letters
  str = str.replace(/[S\/$\s]/gi, "");
  // Replace comma with dot if it's the decimal separator
  if (str.includes(",") && !str.includes(".")) {
    str = str.replace(",", ".");
  } else if (str.includes(",") && str.includes(".")) {
    // If e.g. 1,250.50, remove commas
    str = str.replace(/,/g, "");
  }

  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

// Normalize a header key for resilient matching
function normalizeHeaderKey(key: string): string {
  return key
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

// Map of canonical field names to possible header variants
const HEADER_VARIANTS: Record<string, string[]> = {
  boleta: [
    "NBOLETA", "BOLETA", "NODEBOLETA", "NUMEROBOLETA", "NROBOLETA", "NRODEBOLETA", 
    "ID", "TICKET", "CODIGO", "IDBOLETA", "IDENTIFICADOR", "NUMERODOCUMENTO", "DOCUMENTO"
  ],
  fecha_deteccion: [
    "FECHADETECCION", "FECHA", "FECHADEDETECCION", "FECHAALERTA", "DATE", "FECHAREGISTRO"
  ],
  tienda: [
    "TIENDA", "NOMBRETIENDA", "NOMBREDETIENDA", "LOCAL", "NOMBRELOCAL", "SUCURSAL", "DESCRIPCIONTIENDA"
  ],
  id_tienda: [
    "IDTIENDA", "CARRION1", "CODTIENDA", "CODLOCAL", "CODIGOTIENDA", "CODIGOLOCAL", "IDLOCAL"
  ],
  formato: [
    "FORMATO", "CADENA", "MARCA", "FORMATOCOMERCIAL"
  ],
  alerta: [
    "ALERTA", "TIPOALERTA", "TIPODEALERTA", "NOMBREALERTA", "INCIDENCIA", "NOMBREDELALERTA"
  ],
  cantidad_alerta: [
    "CANTIDADALERTA", "CANTIDAD", "CANTIDADDEALERTAS", "CANTALERTAS", "CANT"
  ],
  monto: [
    "IMPORTEABORDADO", "IMPORTEABORDADOMUESTRA", "ABORADO", "MONTO", "IMPORTE", 
    "IMPORTETOTAL", "IMPACTOTOTAL", "PERDIDA", "VALOR", "MONTOABORDADO"
  ],
  colaborador: [
    "COLABORADOR", "NOMBRECOLABORADOR", "NOMBREDELCOLABORADOR", "NOMBRECAJERO", 
    "EMPLEADO", "PERSONAL", "TRABAJADOR", "NOMBRE"
  ],
  dni: [
    "DNI", "DNICOLABORADOR", "DNICAJERO", "DOCIDENTIDAD", "DOCUMENTOIDENTIDAD"
  ],
  cargo: [
    "CARGO", "PUESTO", "CARGOCOLABORADOR", "POSICION", "OCUPACION"
  ],
  seccion: [
    "SECCION", "AREA", "DEPARTAMENTO", "ZONA"
  ],
  descripcion: [
    "DESCRIPCIONDELEVENTO", "DESCRIPCION", "DETALLE", "MOTIVO", "OBSERVACION", "EVENTO", "RESUMEN"
  ],
  hallazgos: [
    "HALLAZGOS", "HALLAZGO", "ESTADOHALLAZGO", "RESULTADO", "CONCLUSION"
  ],
  accion_disciplinaria: [
    "ACCIONDISCIPLINARIA", "MEDIDADISCIPLINARIA", "SANCION", "ACCION"
  ],
  cargo_real: [
    "CARGOREAL", "CARGOEFECTIVO"
  ],
  carta_descuento: [
    "CARTADESCUENTO", "CARTADEDESCUENTO", "DESCUENTO"
  ],
  contribucion_total: [
    "CONTRIBUCIONTOTALESTIMADA", "CONTRIBUCIONESTIMADA", "TOTALESTIMADO"
  ],
  cstv_detail: [
    "COMENTARIOSERRORCSTV", "COMENTARIOSERRORCCTV", "ERRORCCTV", "DETALLECCTV", "ERRORCSTV"
  ],
  comentarios: [
    "COMENTARIOS", "COMENTARIO", "OBSERVACIONES", "NOTAS", "CONCLUSIONES"
  ]
};

/**
 * Downloads a pre-formatted Excel template (.xlsx) tailored to the active sábana view.
 */
export function downloadAlertsTemplate(
  selectedSabana: "fdc" | "makro" | "mass" | null,
  existingRecords: CaseRecord[] = []
) {
  const today = getPeruToday();

  // Find sample store from existing records if available
  let sampleTienda = "Massaro 2 CHI MS";
  let sampleIdTienda = "1462";
  let defaultFormato = "MASS";
  let defaultAlerta = "Alerta DIN55";
  let prefix = "MASS";

  if (selectedSabana === "fdc") {
    defaultFormato = "PLAZA VEA";
    defaultAlerta = "Frente de Seguridad FDC";
    sampleTienda = "PV Brasil";
    sampleIdTienda = "1102";
    prefix = "CFR";
  } else if (selectedSabana === "makro") {
    defaultFormato = "MAKRO";
    defaultAlerta = "Alerta MAKRO";
    sampleTienda = "Makro Surco";
    sampleIdTienda = "3001";
    prefix = "MAKRO";
  }

  // Try to pick real store from existing records
  const realSample = existingRecords.find(r => r["TIENDA"] && r["TIENDA"].trim().length > 0);
  if (realSample) {
    sampleTienda = realSample["TIENDA"]!.trim();
    sampleIdTienda = String(realSample["ID TIENDA"] || realSample["CARRION 1"] || sampleIdTienda).trim();
  }

  // Pre-fill columns matching sábana & AddCaseModal
  const templateRows = [
    {
      "N° BOLETA": "BK92-00123456",
      "FECHA DETECCIÓN": today,
      "TIENDA": sampleTienda,
      "ID TIENDA": sampleIdTienda,
      "FORMATO": defaultFormato,
      "ALERTA": defaultAlerta,
      "CANTIDAD ALERTA": 1,
      "IMPORTE ABORDADO": 45.50,
      "COLABORADOR": "GARCIA PEREZ JUAN CARLOS",
      "DNI": "74829102",
      "CARGO": "CAJERO",
      "SECCIÓN": "CAJAS",
      "DESCRIPCIÓN DEL EVENTO": "Anulación o borrado de línea sin sustento operativo.",
      "HALLAZGOS": "PENDIENTE",
      "ACCIÓN DISCIPLINARIA": "Ninguna",
      "CARGO REAL": "Administrador",
      "CARTA DESCUENTO": "",
      "CONTRIBUCION TOTAL ESTIMADA": "",
      "COMENTARIOS": "Caso ingresado para revisión de cámaras."
    },
    {
      "N° BOLETA": "BK92-00123457",
      "FECHA DETECCIÓN": today,
      "TIENDA": sampleTienda,
      "ID TIENDA": sampleIdTienda,
      "FORMATO": defaultFormato,
      "ALERTA": defaultAlerta,
      "CANTIDAD ALERTA": 1,
      "IMPORTE ABORDADO": 120.00,
      "COLABORADOR": "MENDOZA FLORES ANA",
      "DNI": "45981234",
      "CARGO": "OPERADOR DE TIENDA",
      "SECCIÓN": "CAJAS",
      "DESCRIPCIÓN DEL EVENTO": "Diferencia de caja detectada en arqueo.",
      "HALLAZGOS": "ERROR OPERATIVO",
      "ACCIÓN DISCIPLINARIA": "Suspendido/amonestado",
      "CARGO REAL": "Operador",
      "CARTA DESCUENTO": 50.00,
      "CONTRIBUCION TOTAL ESTIMADA": 120.00,
      "COMENTARIOS": "Colaborador reconoce error involuntario."
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateRows);

  // Set optimal column widths
  ws["!cols"] = [
    { wch: 18 }, // N° BOLETA
    { wch: 16 }, // FECHA DETECCIÓN
    { wch: 25 }, // TIENDA
    { wch: 12 }, // ID TIENDA
    { wch: 14 }, // FORMATO
    { wch: 25 }, // ALERTA
    { wch: 16 }, // CANTIDAD ALERTA
    { wch: 18 }, // IMPORTE ABORDADO
    { wch: 30 }, // COLABORADOR
    { wch: 14 }, // DNI
    { wch: 20 }, // CARGO
    { wch: 16 }, // SECCIÓN
    { wch: 45 }, // DESCRIPCIÓN DEL EVENTO
    { wch: 18 }, // HALLAZGOS
    { wch: 22 }, // ACCIÓN DISCIPLINARIA
    { wch: 16 }, // CARGO REAL
    { wch: 18 }, // CARTA DESCUENTO
    { wch: 26 }, // CONTRIBUCION TOTAL ESTIMADA
    { wch: 40 }, // COMENTARIOS
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Alertas Manuales");

  const fileName = `Plantilla_Alertas_Manuales_${prefix}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export interface ParsedAlertResult {
  record: CaseRecord;
  payload: any;
}

/**
 * Parses an uploaded .xlsx or .xls file and extracts alert records without strict restrictions.
 */
export async function parseAlertsExcelFile(
  file: File,
  selectedSabana: "fdc" | "makro" | "mass" | null,
  currentUserName: string,
  existingRecords: CaseRecord[] = []
): Promise<ParsedAlertResult[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  if (!wb.SheetNames.length) {
    throw new Error("El archivo Excel no contiene ninguna hoja.");
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  // Convert sheet to array of objects
  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("La hoja de cálculo está vacía o no contiene filas con datos.");
  }

  // Lookup map for existing Tienda <-> ID
  const storeMapByName = new Map<string, string>();
  const storeMapById = new Map<string, string>();
  existingRecords.forEach(r => {
    const tName = r["TIENDA"] ? r["TIENDA"].trim() : "";
    const tId = r["ID TIENDA"] || r["CARRION 1"] || r["CARRION1"];
    const idStr = tId ? String(tId).trim() : "";
    if (tName) {
      storeMapByName.set(tName.toUpperCase(), idStr);
      if (idStr) storeMapById.set(idStr.toUpperCase(), tName);
    }
  });

  const defaultFormato = selectedSabana === "makro" 
    ? "MAKRO" 
    : selectedSabana === "fdc" 
    ? "PLAZA VEA" 
    : "MASS";

  const defaultAlerta = selectedSabana === "fdc" 
    ? "Frente de Seguridad FDC" 
    : selectedSabana === "makro" 
    ? "Alerta MAKRO" 
    : "Alerta DIN55";

  const todayStr = getPeruToday();
  const parsedResults: ParsedAlertResult[] = [];

  rawRows.forEach((row, index) => {
    // Build normalized row dictionary
    const rowNorm: Record<string, any> = {};
    for (const rawKey of Object.keys(row)) {
      const normKey = normalizeHeaderKey(rawKey);
      rowNorm[normKey] = row[rawKey];
    }

    // Helper to find value from variants
    const findVal = (fieldVariants: string[]): any => {
      for (const v of fieldVariants) {
        if (rowNorm[v] !== undefined && rowNorm[v] !== "") {
          return rowNorm[v];
        }
      }
      return "";
    };

    // Check if the entire row is completely empty
    const hasAnyContent = Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== "");
    if (!hasAnyContent) {
      return; // Skip empty rows
    }

    // Extract raw fields with lenient fallback
    let rawBoleta = String(findVal(HEADER_VARIANTS.boleta)).trim();
    
    // Skip template placeholder rows if unaltered
    if (
      (rawBoleta === "BK92-00123456" || rawBoleta === "BK92-00123457") &&
      String(findVal(HEADER_VARIANTS.colaborador)).includes("GARCIA PEREZ JUAN CARLOS")
    ) {
      // It's the example row from the template, skip it unless user customized it
      return;
    }

    // If boleta is missing, do NOT restrict: auto-generate unique identifier
    if (!rawBoleta) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      rawBoleta = `ALT-MAN-${todayStr.replace(/-/g, "")}-${String(index + 1).padStart(3, "0")}-${randomSuffix}`;
    }

    const rawFecha = findVal(HEADER_VARIANTS.fecha_deteccion);
    const fechaDeteccion = parseExcelDate(rawFecha);

    let rawTienda = String(findVal(HEADER_VARIANTS.tienda)).trim();
    let rawIdTienda = String(findVal(HEADER_VARIANTS.id_tienda)).trim();

    // Cross-fill tienda / id_tienda if one is missing
    if (!rawTienda && rawIdTienda && storeMapById.has(rawIdTienda.toUpperCase())) {
      rawTienda = storeMapById.get(rawIdTienda.toUpperCase()) || "";
    }
    if (!rawIdTienda && rawTienda && storeMapByName.has(rawTienda.toUpperCase())) {
      rawIdTienda = storeMapByName.get(rawTienda.toUpperCase()) || "";
    }

    if (!rawTienda) {
      rawTienda = "TIENDA NO ESPECIFICADA";
    }

    let formato = String(findVal(HEADER_VARIANTS.formato)).trim().toUpperCase();
    if (!formato) {
      formato = defaultFormato;
    }

    let alerta = String(findVal(HEADER_VARIANTS.alerta)).trim();
    if (!alerta) {
      alerta = defaultAlerta;
    }

    const cantidadAlerta = parseCleanNumber(findVal(HEADER_VARIANTS.cantidad_alerta), 1);
    const monto = parseCleanNumber(findVal(HEADER_VARIANTS.monto), 0);

    const colaborador = String(findVal(HEADER_VARIANTS.colaborador)).trim() || undefined;
    const rawDni = String(findVal(HEADER_VARIANTS.dni)).trim();
    const dni = rawDni ? rawDni.replace(/[^0-9]/g, "").slice(0, 8) || rawDni : undefined;
    const cargo = String(findVal(HEADER_VARIANTS.cargo)).trim() || undefined;
    const seccion = String(findVal(HEADER_VARIANTS.seccion)).trim() || undefined;
    const descripcion = String(findVal(HEADER_VARIANTS.descripcion)).trim() || undefined;

    // Findings
    const rawHallazgo = String(findVal(HEADER_VARIANTS.hallazgos)).trim();
    const normHallazgo = normalizeHallazgo(rawHallazgo);
    const isClosed = !!normHallazgo && normHallazgo !== "PENDIENTE";

    const accionDisciplinaria = String(findVal(HEADER_VARIANTS.accion_disciplinaria)).trim() || undefined;
    const cargoReal = String(findVal(HEADER_VARIANTS.cargo_real)).trim() || undefined;

    const rawCartaDescuento = findVal(HEADER_VARIANTS.carta_descuento);
    const cartaDescuento = rawCartaDescuento !== "" ? parseCleanNumber(rawCartaDescuento, 0) : undefined;

    const rawContribucionTotal = findVal(HEADER_VARIANTS.contribucion_total);
    const contribucionTotal = rawContribucionTotal !== "" ? parseCleanNumber(rawContribucionTotal, 0) : undefined;

    const cstvDetail = String(findVal(HEADER_VARIANTS.cstv_detail)).trim() || undefined;
    const comentarios = String(findVal(HEADER_VARIANTS.comentarios)).trim() || undefined;

    const finalFechaCierre = isClosed ? todayStr : null;
    const finalUsuario = isClosed ? (currentUserName || "Auditor") : null;
    const contribucionMensual = (normHallazgo === "HURTO" || normHallazgo === "ERROR OPERATIVO") ? monto : null;

    // Database payload
    const payload: any = {
      boleta: rawBoleta,
      carrion1: rawIdTienda || null,
      tienda: rawTienda || null,
      fecha_deteccion: fechaDeteccion || todayStr,
      fecha_cierra: finalFechaCierre,
      formato: formato,
      alerta: alerta,
      importe_abordado_muestra: monto,
      descripcion_evento: descripcion || null,
      status_investigacion: isClosed ? "CERRADO" : "ABIERTO",
      hallazgos: normHallazgo && normHallazgo !== "PENDIENTE" ? normHallazgo : null,
      comentarios: comentarios || null,
      colaborador: colaborador || null,
      dni: dni || null,
      cargo: cargo || null,
      seccion: seccion || null,
      carta_descuento: cartaDescuento !== undefined ? cartaDescuento : null,
      contribucion_total_estimada: contribucionTotal !== undefined ? contribucionTotal : null,
      contribucion_mensual: contribucionMensual,
      accion_disciplinaria: accionDisciplinaria || null,
      cargo_real: cargoReal || null,
      comentarios_error_cstv: cstvDetail || null,
      usuario: finalUsuario,
      actualizado_en: new Date().toISOString()
    };

    // Client memory model
    const record: CaseRecord = {
      _rowNum: index + 1,
      "N° BOLETA": rawBoleta,
      boleta: rawBoleta,
      "CARRION 1": rawIdTienda,
      "TIENDA": rawTienda,
      "ID TIENDA": rawIdTienda,
      "FECHA DETECCIÓN": fechaDeteccion,
      "FECHA DE CIERRE": finalFechaCierre || "",
      "FECHA DE CIERRA": finalFechaCierre || "",
      "ALERTA": alerta,
      "CANTIDAD ALERTA": cantidadAlerta,
      "ABORADO": monto,
      "MONTO": monto,
      "DESCRIPCIÓN DEL EVENTO": descripcion || "",
      "STATUS INVESTIGACIÓN": isClosed ? "CERRADO" : "ABIERTO",
      "HALLAZGOS": normHallazgo && normHallazgo !== "PENDIENTE" ? normHallazgo : "",
      "Comentarios": comentarios || "",
      "COLABORADOR": colaborador || "",
      "DNI": dni || "",
      "CARGO": cargo || "",
      "SECCIÓN": seccion || "",
      "CARTA DESCUENTO": cartaDescuento !== undefined ? cartaDescuento : "",
      "CONTRIBUCION TOTAL ESTIMADA": contribucionTotal !== undefined ? contribucionTotal : "",
      "CONTRIBUCION MENSUAL": contribucionMensual !== null ? contribucionMensual : "",
      "ACCIÓN DISCIPLINARIA": accionDisciplinaria || "",
      "COMENTARIOS ERROR CSTV": cstvDetail || "",
      "CARGO REAL": cargoReal || "",
      "USUARIO": finalUsuario || "",
      "FORMATO": formato
    } as unknown as CaseRecord;

    parsedResults.push({ record, payload });
  });

  if (parsedResults.length === 0) {
    throw new Error("No se encontraron filas válidas para cargar en el archivo Excel adjuntado.");
  }

  return parsedResults;
}
