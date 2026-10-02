import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as XLSX from "xlsx";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
// @ts-ignore
import XlsxPopulate from "xlsx-populate";
import { createClient } from "@supabase/supabase-js";
import "isomorphic-fetch";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase Configuration
let supabase: any = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are not configured.");
    }
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}


function normalizeHallazgo(val: string | undefined): string {
  if (!val) return "";
  const cleaned = val.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents like SISTEMÁTICO -> SISTEMATICO
  
  if (
    cleaned.includes("ROBO SISTEMATICO") || 
    cleaned === "ROBO" || 
    cleaned === "HURTO" || 
    cleaned.includes("HURTO")
  ) {
    return "HURTO";
  }
  if (
    cleaned.includes("ERROR DE SISTEMA") || 
    cleaned.includes("ERROR OPERATIVO") ||
    cleaned === "ERROR"
  ) {
    return "ERROR OPERATIVO";
  }
  if (
    cleaned.includes("NO ENLACE") || 
    cleaned.includes("NO ENLAZE") || 
    cleaned.includes("SIN ENLACE") || 
    cleaned.includes("SIN IP") ||
    cleaned.includes("CCTV")
  ) {
    return "ERROR CCTV";
  }
  if (cleaned === "CONFORME") {
    return "CONFORME";
  }
  return val.trim();
}

// Detailed Connection Logs for Diagnostics
let connectionStatus = {
  connected: false,
  mode: "offline" as "online" | "offline",
  lastAttempt: "",
  logs: [] as string[],
  error: null as string | null,
};

function addLog(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  connectionStatus.logs.push(logMessage);
  if (connectionStatus.logs.length > 50) {
    connectionStatus.logs.shift();
  }
}



function calculate6MonthMetrics(dni: string | number | undefined, records: any[]): { count: number; sum: number } {
  if (!dni) return { count: 0, sum: 0 };
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  let count = 0;
  let sum = 0;
  
  records.forEach(r => {
    if (String(r["DNI"]) === String(dni)) {
      const fecha = new Date(r["FECHA DETECCIÓN"] || "");
      if (fecha >= sixMonthsAgo) {
        count++;
        sum += Number(r["MONTO"] || 0);
      }
    }
  });
  
  return { count, sum };
}

// Site ID and metadata logic is deprecated as we are now querying the SharePoint REST API directly using server-relative paths, matching the Python script.
let cachedFileId: string | null = null;

// Mock database to fallback on if SharePoint connection fails or for fast loads during local dev
let mockDbMass = [
  {
    "_rowNum": 2,
    "ID TIENDA": 275,
    "TIENDA": "24Junio VES MS",
    "FECHA DETECCIÓN": "2026-06-23",
    "FECHA DE CIERRE": "2026-06-23",
    "ALERTA": "Alerta DIN55",
    "ABORADO": 7.90,
    "DESCRIPCIÓN DEL EVENTO": "BORRADO DE LÍNEA TOTAL - VTA POSEE <= 50% P",
    "STATUS INVESTIGACIÓN": "CERRADO",
    "HALLAZGOS": "CONFORME",
    "Comentarios": "Revisado conforme a procedimientos operativos sin anomalías.",
    "COLABORADOR": "RUIZ BARDALES ANDREA BELÉN",
    "DNI": "70640212",
    "CARGO": "CAJERO",
    "SECCIÓN": "CAJAS",
    "N° BOLETA": "BA22-01433973"
  },
  {
    "_rowNum": 3,
    "ID TIENDA": 1622,
    "TIENDA": "28 Jul5 IMP MS",
    "FECHA DETECCIÓN": "2026-06-23",
    "FECHA DE CIERRE": "2026-06-23",
    "ALERTA": "Alerta DIN55",
    "ABORADO": 15.40,
    "DESCRIPCIÓN DEL EVENTO": "BORRADO DE LÍNEA TOTAL - VTA POSEE <= 50% P",
    "STATUS INVESTIGACIÓN": "CERRADO",
    "HALLAZGOS": "CONFORME",
    "Comentarios": "Se verifica el descargo del cajero y el arqueo cuadra correctamente.",
    "COLABORADOR": "SÁNCHEZ ENCALADA CYNTHIA RAFAELA",
    "DNI": "46887715",
    "CARGO": "CAJERO",
    "SECCIÓN": "CAJAS",
    "N° BOLETA": "BI50-01408318"
  },
  {
    "_rowNum": 4,
    "ID TIENDA": 341,
    "TIENDA": "2Octubre 10 LO MS",
    "FECHA DETECCIÓN": "2026-06-23",
    "FECHA DE CIERRE": "2026-06-23",
    "ALERTA": "Alerta DIN55",
    "ABORADO": 7.50,
    "DESCRIPCIÓN DEL EVENTO": "BORRADO DE LÍNEA TOTAL - VTA POSEE <= 50% P",
    "STATUS INVESTIGACIÓN": "CERRADO",
    "HALLAZGOS": "HURTO",
    "Comentarios": "Se evidencia retiro de efectivo sin registrar boleta. Se inicia proceso disciplinario.",
    "COLABORADOR": "KATLIN JERCY",
    "DNI": "79646131",
    "CARGO": "CAJERO",
    "SECCIÓN": "CAJAS",
    "N° BOLETA": "BA60-01510413"
  },
  {
    "_rowNum": 5,
    "ID TIENDA": 341,
    "TIENDA": "2Octubre 10 LO MS",
    "FECHA DETECCIÓN": "2026-06-23",
    "FECHA DE CIERRE": "2026-06-23",
    "ALERTA": "Alerta DIN55",
    "ABORADO": 9.20,
    "DESCRIPCIÓN DEL EVENTO": "BORRADO DE LÍNEA TOTAL - VTA POSEE <= 50% P",
    "STATUS INVESTIGACIÓN": "CERRADO",
    "HALLAZGOS": "ERROR OPERATIVO",
    "Comentarios": "Error de tipeo del monto durante la anulación. Capacitado nuevamente.",
    "COLABORADOR": "KATLIN JERCY",
    "DNI": "79646131",
    "CARGO": "CAJERO",
    "SECCIÓN": "CAJAS",
    "N° BOLETA": "BA60-01510505"
  },
  {
    "_rowNum": 6,
    "ID TIENDA": 341,
    "TIENDA": "2Octubre 10 LO MS",
    "FECHA DETECCIÓN": "2026-06-23",
    "FECHA DE CIERRE": "2026-06-23",
    "ALERTA": "Alerta DIN55",
    "ABORADO": 7.60,
    "DESCRIPCIÓN DEL EVENTO": "BORRADO DE LÍNEA TOTAL - VTA POSEE <= 50% P",
    "STATUS INVESTIGACIÓN": "CERRADO",
    "HALLAZGOS": "CONFORME",
    "Comentarios": "Anulación autorizada por supervisor de turno con firma conforme.",
    "COLABORADOR": "KATLIN JERCY",
    "DNI": "79646131",
    "CARGO": "CAJERO",
    "SECCIÓN": "CAJAS",
    "N° BOLETA": "BA60-01510367"
  },
  {
    "_rowNum": 7,
    "ID TIENDA": 2014,
    "TIENDA": "9Octu4 CIX MS",
    "FECHA DETECCIÓN": "2026-06-23",
    "FECHA DE CIERRE": "2026-06-23",
    "ALERTA": "Alerta DIN55",
    "ABORADO": 6.30,
    "DESCRIPCIÓN DEL EVENTO": "BORRADO DE LÍNEA TOTAL - VTA POSEE <= 50% P",
    "STATUS INVESTIGACIÓN": "CERRADO",
    "HALLAZGOS": "CONFORME",
    "Comentarios": "El cliente desistió de la compra. Transacción sustentada.",
    "COLABORADOR": "SALINAS SÁNCHEZ FRANCISCO ALEXANDER",
    "DNI": "76595958",
    "CARGO": "CAJERO",
    "SECCIÓN": "CAJAS",
    "N° BOLETA": "BK92-00368202"
  },
  {
    "_rowNum": 8,
    "ID TIENDA": 2014,
    "TIENDA": "9Octu4 CIX MS",
    "FECHA DETECCIÓN": "2026-06-23",
    "FECHA DE CIERRE": "2026-06-23",
    "ALERTA": "Alerta DIN55",
    "ABORADO": 6.20,
    "DESCRIPCIÓN DEL EVENTO": "BORRADO DE LÍNEA TOTAL - VTA POSEE <= 50% P",
    "STATUS INVESTIGACIÓN": "CERRADO",
    "HALLAZGOS": "ERROR OPERATIVO",
    "Comentarios": "Se registró dos veces el mismo producto por equivocación.",
    "COLABORADOR": "DIESTRA ÑAÑEZ JIMENA ALEXANDRA",
    "DNI": "74829729",
    "CARGO": "CAJERO",
    "SECCIÓN": "CAJAS",
    "N° BOLETA": "BK92-00368046"
  },
  {
    "_rowNum": 9,
    "ID TIENDA": 2014,
    "TIENDA": "9Octu4 CIX MS",
    "FECHA DETECCIÓN": "2026-06-23",
    "FECHA DE CIERRE": "2026-06-23",
    "ALERTA": "Alerta DIN55",
    "ABORADO": 11.40,
    "DESCRIPCIÓN DEL EVENTO": "BORRADO DE LÍNEA TOTAL - VTA POSEE <= 50% P",
    "STATUS INVESTIGACIÓN": "CERRADO",
    "HALLAZGOS": "CONFORME",
    "Comentarios": "Soporte de anulación archivado en file físico.",
    "COLABORADOR": "BARRENO VERA JESSICA LILIANA",
    "DNI": "71076076",
    "CARGO": "CAJERO",
    "SECCIÓN": "CAJAS",
    "N° BOLETA": "BK92-00351159"
  }
];

let mockDbFdc = mockDbMass.map((item, idx) => ({
  ...item,
  "ALERTA": idx % 2 === 0 ? "Frente de Seguridad FDC" : "Alerta de Fraude FDC",
  "RESPONSABLE INVESTIGACIÓN": "Supervisor FDC",
  "EQUIPO CONTROL TOWER": "Equipo Dinero"
}));

function getMockDb(sabana: string) {
  return sabana === "fdc" ? mockDbFdc : mockDbMass;
}

// Helper to format date cells safely
function formatExcelDate(cellValue: any): string {
  if (!cellValue) return "";
  if (cellValue instanceof Date) {
    return cellValue.toISOString().split("T")[0];
  }
  // If it's a number (Excel serial date)
  if (typeof cellValue === "number") {
    const date = new Date((cellValue - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  return String(cellValue);
}

// Helper to get Peru timezone today's date
function getPeruDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(new Date());
  } catch (e) {
    return new Date().toISOString().split("T")[0];
  }
}

// REST Endpoints
app.get("/api/sharepoint-status", (req, res) => {
  res.json(connectionStatus);
});

app.post("/api/cases/update", async (req, res) => {
  const { rowNum, boleta, hallazgos, comentarios, accDisciplinaria, cargoReal, cartaDescuento, contribucionTotalEstimada, cstvDetail, usuarioName, sabana } = req.body;
  addLog(`Actualizando caso para boleta: ${boleta}...`);
  try {
    const { error } = await getSupabase()
      .from("casos_mass")
      .update({
        hallazgos,
        comentarios,
        accion_disciplinaria: accDisciplinaria,
        cargo_real: cargoReal,
        carta_descuento: cartaDescuento === "" ? null : cartaDescuento,
        contribucion_total_estimada: contribucionTotalEstimada === "" ? null : contribucionTotalEstimada,
        comentarios_error_cstv: cstvDetail,
        fecha_cierra: hallazgos ? getPeruDateString() : null,
        usuario: usuarioName
      })
      .eq("boleta", boleta);

    if (error) {
      throw new Error(`Error de Supabase al actualizar caso: ${error.message}`);
    }

    addLog(`Caso actualizado exitosamente para boleta: ${boleta}`);
    res.json({ success: true });
  } catch (error: any) {
    addLog(`Error al actualizar caso en Supabase: ${error.message}`);
    res.status(500).json({ success: false, error: `No se pudo actualizar el caso: ${error.message}` });
  }
});

app.post("/api/cases/create", async (req, res) => {
  const { 
    boleta, 
    idTienda, 
    tienda, 
    formato, 
    fechaDeteccion, 
    alerta, 
    importeAbordado, 
    colaborador, 
    dni, 
    cargo, 
    seccion, 
    descripcion, 
    hallazgos, 
    cstvDetail, 
    accDisciplinaria, 
    cargoReal, 
    cartaDescuento, 
    contribucionTotalEstimada, 
    comentarios, 
    usuarioName, 
    sabana 
  } = req.body;

  addLog(`Creando nueva alerta/caso para boleta: ${boleta}...`);
  try {
    const targetTable = (sabana === "fdc" || sabana === "makro") ? "casos_fdc" : "casos_mass";
    const normHallazgo = normalizeHallazgo(hallazgos);
    const isClosed = !!normHallazgo;
    const montoNum = Number(importeAbordado || 0);

    const payload: any = {
      boleta: String(boleta).trim(),
      carrion1: idTienda || null,
      tienda: tienda || null,
      fecha_deteccion: fechaDeteccion || getPeruDateString(),
      fecha_cierra: isClosed ? getPeruDateString() : null,
      formato: formato || (sabana === "makro" ? "MAKRO" : (sabana === "fdc" ? "PLAZA VEA" : "MASS")),
      alerta: alerta || null,
      importe_abordado_muestra: montoNum,
      descripcion_evento: descripcion || null,
      status_investigacion: isClosed ? "CERRADO" : "ABIERTO",
      hallazgos: normHallazgo || null,
      comentarios: comentarios || null,
      colaborador: colaborador || null,
      dni: dni ? String(dni).trim() : null,
      cargo: cargo || null,
      seccion: seccion || null,
      carta_descuento: cartaDescuento !== "" && cartaDescuento !== undefined ? Number(cartaDescuento) : null,
      contribucion_total_estimada: contribucionTotalEstimada !== "" && contribucionTotalEstimada !== undefined ? Number(contribucionTotalEstimada) : null,
      contribucion_mensual: (normHallazgo === "HURTO" || normHallazgo === "ERROR OPERATIVO") ? montoNum : null,
      accion_disciplinaria: accDisciplinaria || null,
      cargo_real: cargoReal || null,
      comentarios_error_cstv: cstvDetail || null,
      usuario: usuarioName || null,
      actualizado_en: new Date().toISOString()
    };

    let { error } = await getSupabase()
      .from(targetTable)
      .upsert([payload], { onConflict: "boleta" });

    if (error && targetTable === "casos_fdc") {
      const fb = await getSupabase().from("casos_mass").upsert([payload], { onConflict: "boleta" });
      error = fb.error;
    }

    if (error) {
      throw new Error(`Error de Supabase: ${error.message}`);
    }

    addLog(`Alerta/caso creado exitosamente para boleta: ${boleta}`);
    res.json({ success: true });
  } catch (error: any) {
    addLog(`Error al crear caso en Supabase: ${error.message}`);
    res.status(500).json({ success: false, error: `No se pudo crear el caso: ${error.message}` });
  }
});


function getEncodedPath(rawPath: string): string {
  return rawPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

const SITE_ID = "intercorpretail.sharepoint.com,1ed8096d-f160-417d-a3fb-f327f6b7669e,dae09ca8-c803-476f-8e5d-7303fa1425be";

app.get("/api/cases", async (req, res) => {
  const sabana = req.query.sabana === "fdc" ? "fdc" : "mass";
  addLog(`Obteniendo casos de Supabase para sábana: ${sabana}...`);
  try {
    const { data, error } = await getSupabase()
      .from("casos_mass")
      .select("*");

    if (error) {
      throw new Error(`Error de Supabase al descargar casos: ${error.message}`);
    }

    addLog(`Obtenidos ${data.length} casos de Supabase.`);
    
    // Normalize data to match the expected format for the frontend
    const formattedRows = data.map((row: any, i: number) => {
        addLog(`Processing row: ${JSON.stringify(row)}`);
        return {
            _rowNum: i + 2,
            ...row,
            "N° BOLETA": row["boleta"] || row.boleta,
            "TIENDA": row["tienda"] || row.tienda,
            "COLABORADOR": row["colaborador"] || row.colaborador,
            "DNI": row["dni"] || row.dni,
            "ABORADO": row["importe_abordado_muestra"] || row.monto || row.aborado,
            "MONTO": row["importe_abordado_muestra"] || row.monto || row.aborado,
            "ALERTA": row["alerta"] || row.alerta,
            "N° TOTAL DE ALERTAS (6 meses)": row["n_alt"] || row.n_alt || 0,
            "PÉRDIDA ESTIMADA ACUM. (6 meses)": row["perdida_6m"] || row.perdida_6m || 0,
            "HALLAZGOS": normalizeHallazgo(row["hallazgos"] || row.hallazgos),
            "Comentarios": row["comentarios"] || row.comentarios,
            "FECHA DE CIERRE": row["fecha_cierra"] || row.fecha_cierra,
            "FECHA DE CIERRA": row["fecha_cierra"] || row.fecha_cierra,
            "FECHA DETECCIÓN": row["fecha_deteccion"] || row.fecha_deteccion,
            "USUARIO": row["usuario"] || row.usuario
        };
    });
    
    res.json({ source: "supabase", data: formattedRows, status: { connected: true, mode: "online" } });
  } catch (error: any) {
    addLog(`Error al obtener casos de Supabase: ${error.message}`);
    res.status(500).json({ error: `No se pudo obtener casos: ${error.message}` });
  }
});

// Helper to convert column index to Excel column letter
function colNumToLetter(colNum: number): string {
  let temp, letter = "";
  while (colNum > 0) {
    temp = (colNum - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colNum = (colNum - temp - 1) / 26;
  }
  return letter;
}

const USERS_FILE_PATH = "/sites/CONTROLTOWER-DINERO/Documentos compartidos/Control Tower Mass/Lista de Usuarios Sabana CT.xlsx";
let cachedUsers: any[] | null = null;
let usersCacheExpiresAt = 0;

async function getSupabaseUsers(): Promise<any[]> {
  const now = Date.now();
  if (cachedUsers && now < usersCacheExpiresAt) {
    addLog("Usando lista de usuarios desde la caché en memoria.");
    return cachedUsers;
  }

  try {
    addLog("Descargando usuarios desde Supabase...");
    const { data, error } = await getSupabase()
      .from("usuarios")
      .select("*");

    if (error) {
      throw new Error(`Error de Supabase al descargar usuarios: ${error.message}`);
    }

    addLog(`Leídos ${data.length} usuarios de Supabase.`);

    const users = data.map((row: any) => ({
        "USER": row.user_email,
        "PASSWORD": row.password,
        "NOMBRES Y APELLIDOS": row.nombre_completo,
        "CARGO": row.cargo,
        "FORMATO": row.formato
    }));

    cachedUsers = users;
    usersCacheExpiresAt = now + 10 * 60 * 1000; // Cache for 10 minutes
    return users;
  } catch (error: any) {
    addLog(`Error al obtener usuarios de Supabase: ${error.message}`);
    throw error;
  }
}
  app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Debe ingresar el usuario y la contraseña." });
  }

  addLog(`Intento de login para usuario: ${username}`);
  
  try {
    const users = await getSupabaseUsers();
    const normalizedInputUser = username.trim().toLowerCase();
    
    const matchedUser = users.find((u) => {
      const dbUser = (u["USER"] || "").toLowerCase().trim();
      const dbPassword = String(u["PASSWORD"] || "").trim();
      return dbUser === normalizedInputUser && dbPassword === password;
    });

    if (matchedUser) {
      addLog(`Login exitoso para: ${normalizedInputUser} (${matchedUser["NOMBRES Y APELLIDOS"]})`);
      return res.json({
        success: true,
        user: {
          username: matchedUser["USER"] || normalizedInputUser,
          name: matchedUser["NOMBRES Y APELLIDOS"] || "Usuario Autorizado",
          role: matchedUser["CARGO"] || "AUDITOR",
          formato: matchedUser["FORMATO"] || "TODOS"
        }
      });
    } else {
      addLog(`Login fallido para: ${normalizedInputUser} (Credenciales incorrectas o usuario no autorizado)`);
      return res.status(401).json({ error: "usuario no permitido o usuario no válido" });
    }
  } catch (error: any) {
    addLog(`Error en el endpoint de login: ${error.message}`);
    return res.status(500).json({ error: "Error interno al procesar el inicio de sesión." });
  }
});

// Vite middleware setup
if (process.env.NODE_ENV !== "production") {
  (async () => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  })();
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
