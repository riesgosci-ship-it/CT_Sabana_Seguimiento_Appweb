import { useState, useEffect, useMemo } from "react";
import { CaseRecord, SharePointStatus, PendingChange } from "./types";
import CaseDetailsPanel from "./components/CaseDetailsPanel";
import DiagnosticsModal from "./components/DiagnosticsModal";
import { LoginScreen } from "./components/LoginScreen";
import { AddCaseModal } from "./components/AddCaseModal";
import { createClient } from "@supabase/supabase-js";
import { 
  FileSpreadsheet, RefreshCw, Search, Filter, ShieldCheck, 
  AlertTriangle, Database, LayoutGrid, CheckCircle, 
  HelpCircle, UserX, TrendingUp, AlertOctagon,
  ChevronRight, ArrowUpDown, ChevronLeft, ChevronsLeft, ChevronsRight,
  LogOut, User, Plus, CloudUpload
} from "lucide-react";

function MultiSelectFilter({ label, values, selected, onChange }: {
  label: string;
  values: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleValues = values.filter((value) => value.toLowerCase().includes(query.toLowerCase()));
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium text-slate-700">
        {selected.length ? `${label} (${selected.length})` : label}
      </summary>
      <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Buscar ${label.toLowerCase()}...`}
          className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none"
        />
        <button type="button" onClick={() => onChange([])} className="mb-1 w-full rounded-lg px-2 py-1 text-left text-xs text-slate-500 hover:bg-slate-50">
          Todas
        </button>
        {visibleValues.map((value) => (
          <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={(event) => onChange(event.target.checked ? [...selected, value] : selected.filter((item) => item !== value))}
            />
            <span className="truncate">{value}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

// Instancia directa de Supabase en Frontend
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

export function normalizeHallazgo(val: string | undefined): string {
  if (!val) return "";
  const cleaned = val.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remueve tildes
  
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
    cleaned.includes("CSTV") || 
    cleaned.includes("CCTV")
  ) {
    return "ERROR CCTV";
  }
  if (cleaned === "CONFORME") {
    return "CONFORME";
  }
  return val.trim();
}

export function isRecordPending(r: CaseRecord): boolean {
  const hallazgo = normalizeHallazgo(r["HALLAZGOS"]);
  return !hallazgo;
}

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("spsa_logged_in") === "true";
  });
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem("spsa_user") || "";
  });
  const [currentUserName, setCurrentUserName] = useState<string>(() => {
    return localStorage.getItem("spsa_user_name") || "";
  });
  const [currentUserFormato, setCurrentUserFormato] = useState<string>(() => {
    return localStorage.getItem("spsa_user_formato") || "";
  });
  const [selectedSabana, setSelectedSabana] = useState<"mass" | "fdc" | null>(() => {
    const saved = localStorage.getItem("spsa_selected_sabana");
    return (saved === "mass" || saved === "fdc") ? saved : null;
  });

  const handleLoginSuccess = (user: string, name: string, role: string, formato: string) => {
    localStorage.setItem("spsa_logged_in", "true");
    localStorage.setItem("spsa_user", user);
    localStorage.setItem("spsa_user_name", name);
    localStorage.setItem("spsa_user_role", role);
    localStorage.setItem("spsa_user_formato", formato);
    setIsAuthenticated(true);
    setCurrentUser(user);
    setCurrentUserName(name);
    setCurrentUserFormato(formato);
    
    if (formato !== "TODOS") {
      setSelectedSabana("mass");
      localStorage.setItem("spsa_selected_sabana", "mass");
    } else {
      setSelectedSabana(null);
      localStorage.removeItem("spsa_selected_sabana");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("spsa_logged_in");
    localStorage.removeItem("spsa_user");
    localStorage.removeItem("spsa_user_name");
    localStorage.removeItem("spsa_user_role");
    localStorage.removeItem("spsa_user_formato");
    localStorage.removeItem("spsa_selected_sabana");
    setIsAuthenticated(false);
    setCurrentUser("");
    setCurrentUserName("");
    setCurrentUserFormato("");
    setSelectedSabana(null);
  };

  useEffect(() => {
    if (isAuthenticated) {
      const formato = currentUserFormato || localStorage.getItem("spsa_user_formato") || "";
      if (formato && formato !== "TODOS") {
        setSelectedSabana("mass");
        localStorage.setItem("spsa_selected_sabana", "mass");
      }
    }
  }, [isAuthenticated, currentUserFormato]);

  const [rawRecords, setRawRecords] = useState<CaseRecord[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>(() => {
    try {
      const saved = localStorage.getItem("pending_changes_fdc");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);

  useEffect(() => {
    if (pendingChanges.length === 0) {
      localStorage.removeItem("pending_changes_fdc");
    } else {
      localStorage.setItem("pending_changes_fdc", JSON.stringify(pendingChanges));
    }
  }, [pendingChanges]);

  const records = useMemo(() => {
    return rawRecords;
  }, [rawRecords]);

  const [status, setStatus] = useState<SharePointStatus>({
    connected: true,
    mode: "online",
    lastAttempt: "",
    logs: [],
    error: null,
  });
  
  const [selectedRecord, setSelectedRecord] = useState<CaseRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHallazgos, setSelectedHallazgos] = useState<string[]>([]);
  const [selectedTiendas, setSelectedTiendas] = useState<string[]>([]);
  const [selectedAlertas, setSelectedAlertas] = useState<string[]>([]);
  const [selectedFechas, setSelectedFechas] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Sort state
  const [sortField, setSortField] = useState<keyof CaseRecord | "">("");
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTiendas, selectedAlertas, selectedHallazgos, selectedFechas, selectedStatuses, selectedYears, selectedMonths, selectedDays]);

const fetchData = async () => {
    if (!selectedSabana) return;
    setIsLoading(true);
    try {
      let allRows: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("casos_mass")
          .select("*")
          .order("fecha_deteccion", { ascending: false, nullsFirst: false })
          .order("boleta", { ascending: true })
          .range(from, from + batchSize - 1);

        if (error) {
          console.error("Error al consultar Supabase casos_mass:", error.message);
          break;
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data);
          if (data.length < batchSize) {
            hasMore = false;
          } else {
            from += batchSize;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`Total registros descargados: ${allRows.length}`);

      const cleanDate = (d: any) => {
        if (!d) return "";
        return String(d).trim().slice(0, 10);
      };

      const mappedRecords: CaseRecord[] = allRows.map((r, index) => {
        const montoVal = r.importe_abordado_muestra ?? r.importe_abordad ?? r.monto ?? r.aborado ?? 0;
        
        return {
          _rowNum: index + 1,
          "N° BOLETA": r.boleta || "",
          boleta: r.boleta || "",
          "CARRION 1": r.carrion1 || "",
          "TIENDA": r.tienda || "",
          "ID TIENDA": r.carrion1 || "",
          "FECHA DETECCIÓN": cleanDate(r.fecha_deteccion),
          "FECHA DE CIERRE": cleanDate(r.fecha_cierra),
          "FECHA DE CIERRA": cleanDate(r.fecha_cierra),
          "ALERTA": r.alerta || "",
          "CANTIDAD ALERTA": 1,
          "ABORADO": Number(montoVal),
          "MONTO": Number(montoVal),
          "DESCRIPCIÓN DEL EVENTO": r.descripcion_evento || r.descripcion_ever || "",
          "STATUS INVESTIGACIÓN": r.status_investigacion || r.status_investigac || "ABIERTO",
          "HALLAZGOS": r.hallazgos || "",
          "Comentarios": r.comentarios || "",
          "COLABORADOR": r.colaborador || "",
          "DNI": r.dni || "",
          "CARGO": r.cargo || "",
          "SECCIÓN": r.seccion || "",
          "CARTA DESCUENTO": r.carta_descuento ?? "",
          "CONTRIBUCION TOTAL ESTIMADA": r.contribucion_total_estimada ?? r.contribucion_tota ?? "",
          "CONTRIBUCION MENSUAL": r.contribucion_mensual ?? r.contribucion_me ?? "",
          "ACCIÓN DISCIPLINARIA": r.accion_disciplinaria || r.accion_disciplina || "",
          "COMENTARIOS ERROR CSTV": r.comentarios_error_cstv || r.comentarios_erro || "",
          "CARGO REAL": r.cargo_real || "",
          "USUARIO": r.usuario || "",
          "FORMATO": "MASS"
        } as unknown as CaseRecord;
      });

      setRawRecords(mappedRecords);
      setStatus({
        connected: true,
        mode: "online",
        lastAttempt: new Date().toISOString(),
        logs: [`${mappedRecords.length} registros cargados exitosamente de Supabase.`],
        error: null,
      });

      const peruTime = new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "short",
        timeStyle: "medium"
      }).format(new Date());
      setLastUpdated(peruTime);

      if (selectedRecord) {
        const fresh = mappedRecords.find((r) => r["N° BOLETA"] === selectedRecord["N° BOLETA"]);
        if (fresh) setSelectedRecord(fresh);
      }
    } catch (err: any) {
      console.error("Error al cargar registros:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && selectedSabana) {
      fetchData();
    } else {
      setRawRecords([]);
    }
  }, [isAuthenticated, selectedSabana]);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Guardar boleta directamente en la tabla casos_mass de Supabase
  const handleSaveRecord = async (
    rowNum: number,
    boleta: string,
    hallazgos: string,
    comentarios: string,
    accDisciplinaria: string,
    cargoReal: string,
    cartaDescuento: string,
    contribucionTotalEstimada: string,
    cstvDetail: string,
    colaborador: string,
    dni: string,
    cargo: string,
    seccion: string
  ): Promise<{ success: boolean; error?: string }> => {
    const today = new Date();
    const offset = -5 * 60;
    const peruTime = new Date(today.getTime() + (today.getTimezoneOffset() + offset) * 60 * 1000);
    const todayStr = `${peruTime.getFullYear()}-${String(peruTime.getMonth() + 1).padStart(2, '0')}-${String(peruTime.getDate()).padStart(2, '0')}`;

    const finalFechaCierre = hallazgos ? todayStr : null;
    const finalUsuario = hallazgos ? currentUserName : null;

    try {
      const currentRecord = rawRecords.find((rec) => String(rec["N° BOLETA"] || "").trim() === boleta.trim());
      const normalizedHallazgo = normalizeHallazgo(hallazgos);
      const contribucionMensual = normalizedHallazgo === "HURTO" || normalizedHallazgo === "ERROR OPERATIVO"
        ? Number(currentRecord?.["MONTO"] || 0)
        : null;

      const { error } = await supabase
        .from("casos_mass")
        .update({
          hallazgos: hallazgos || null,
          comentarios: comentarios || null,
          accion_disciplinaria: accDisciplinaria || null,
          cargo_real: cargoReal || null,
          carta_descuento: cartaDescuento ? Number(cartaDescuento) : null,
          contribucion_total_estimada: contribucionTotalEstimada ? Number(contribucionTotalEstimada) : null,
          contribucion_mensual: contribucionMensual,
          comentarios_error_cstv: cstvDetail || null,
          colaborador: colaborador || null,
          dni: dni || null,
          cargo: cargo || null,
          seccion: seccion || null,
          fecha_cierra: finalFechaCierre,
          usuario: finalUsuario,
          status_investigacion: hallazgos ? "CERRADO" : "ABIERTO",
          actualizado_en: new Date().toISOString()
        })
        .eq("boleta", boleta.trim());

      if (error) {
        console.error("Error al actualizar caso en Supabase:", error.message);
        return { success: false, error: error.message };
      }

      // Actualizar estado en memoria inmediatamente
      setRawRecords((prev) =>
        prev.map((rec) => {
          if (String(rec["N° BOLETA"] || "").trim() === String(boleta || "").trim()) {
            return {
              ...rec,
              "HALLAZGOS": hallazgos,
              "Comentarios": comentarios,
              "ACCIÓN DISCIPLINARIA": accDisciplinaria,
              "CARGO REAL": cargoReal,
              "CARTA DESCUENTO": cartaDescuento,
              "CONTRIBUCION TOTAL ESTIMADA": contribucionTotalEstimada,
              "CONTRIBUCION MENSUAL": contribucionMensual ?? "",
              "COMENTARIOS ERROR CSTV": cstvDetail,
              "COLABORADOR": colaborador,
              "DNI": dni,
              "CARGO": cargo,
              "SECCIÓN": seccion,
              "FECHA DE CIERRE": finalFechaCierre || "",
              "FECHA DE CIERRA": finalFechaCierre || "",
              "USUARIO": finalUsuario || "",
              "STATUS INVESTIGACIÓN": hallazgos ? "CERRADO" : "ABIERTO"
            };
          }
          return rec;
        })
      );

      setSelectedRecord((prev) => {
        if (prev && String(prev["N° BOLETA"] || "").trim() === String(boleta || "").trim()) {
          return {
            ...prev,
            "HALLAZGOS": hallazgos,
            "Comentarios": comentarios,
            "ACCIÓN DISCIPLINARIA": accDisciplinaria,
            "CARGO REAL": cargoReal,
            "CARTA DESCUENTO": cartaDescuento,
            "CONTRIBUCION TOTAL ESTIMADA": contribucionTotalEstimada,
            "CONTRIBUCION MENSUAL": contribucionMensual ?? "",
            "COMENTARIOS ERROR CSTV": cstvDetail,
            "COLABORADOR": colaborador,
            "DNI": dni,
            "CARGO": cargo,
            "SECCIÓN": seccion,
            "FECHA DE CIERRE": finalFechaCierre || "",
            "FECHA DE CIERRA": finalFechaCierre || "",
            "USUARIO": finalUsuario || "",
            "STATUS INVESTIGACIÓN": hallazgos ? "CERRADO" : "ABIERTO"
          };
        }
        return prev;
      });

      return { success: true };
    } catch (err: any) {
      console.error("Error al guardar registro:", err);
      return { success: false, error: err.message || "Error al conectar con la base de datos." };
    }
  };

  const handleCreateRecord = async (
    newRecordData: Partial<CaseRecord>
  ): Promise<{ success: boolean; error?: string }> => {
    return { success: true };
  };

  const handleBatchSync = async () => {};

  // Filtros dinámicos
  const listTiendas = useMemo(() => {
    const tiendas = new Set<string>();
    records.forEach((r) => {
      if (r["TIENDA"]) tiendas.add(r["TIENDA"].trim());
    });
    return ["TODAS", ...Array.from(tiendas).sort()];
  }, [records]);

  const listAlertas = useMemo(() => {
    const alertas = new Set<string>();
    records.forEach((r) => {
      if (r["ALERTA"]) alertas.add(r["ALERTA"].trim());
    });
    return ["TODAS", ...Array.from(alertas).sort()];
  }, [records]);

  const listFechas = useMemo(() => {
    const fechas = new Set<string>();
    records.forEach((r) => {
      if (r["FECHA DETECCIÓN"]) fechas.add(r["FECHA DETECCIÓN"].trim());
    });
    return ["TODAS", ...Array.from(fechas).sort()];
  }, [records]);

  const listStatusInvestigacion = useMemo(() => {
    const statuses = new Set<string>();
    records.forEach((r) => {
      if (r["STATUS INVESTIGACIÓN"]) statuses.add(r["STATUS INVESTIGACIÓN"].trim());
    });
    return ["TODOS", ...Array.from(statuses).sort()];
  }, [records]);

  // Cálculo de Métricas y Estadísticas
  const stats = useMemo(() => {
    let total = records.length;
    let conforme = 0;
    let errOperativo = 0;
    let hurto = 0;
    let errorCctv = 0;
    let pendiente = 0;

    records.forEach((r) => {
      const hallazgo = normalizeHallazgo(r["HALLAZGOS"]);
      if (hallazgo === "CONFORME") conforme++;
      else if (hallazgo === "ERROR OPERATIVO") errOperativo++;
      else if (hallazgo === "HURTO") hurto++;
      else if (hallazgo === "ERROR CCTV") errorCctv++;
      
      if (isRecordPending(r)) pendiente++;
    });

    const totalRevisados = conforme + errOperativo + hurto + errorCctv;
    const porcentajeRevisados = total > 0 ? Math.round((totalRevisados / total) * 100) : 0;

    return { total, conforme, errOperativo, hurto, errorCctv, pendiente, porcentajeRevisados };
  }, [records]);

  const handleSort = (field: keyof CaseRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filtrado y Búsqueda
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        const tienda = String(r["TIENDA"] || "").toLowerCase();
        const colaborador = String(r["COLABORADOR"] || "").toLowerCase();
        const boleta = String(r["N° BOLETA"] || "").toLowerCase();
        const dni = String(r["DNI"] || "").toLowerCase();
        const formato = String(r["FORMATO"] || "").toLowerCase();
        return (
          tienda.includes(q) ||
          colaborador.includes(q) ||
          boleta.includes(q) ||
          dni.includes(q) ||
          formato.includes(q)
        );
      });
    }

    if (selectedTiendas.length > 0) {
      result = result.filter((r) => selectedTiendas.includes(r["TIENDA"]?.trim() || ""));
    }

    if (selectedAlertas.length > 0) {
      result = result.filter((r) => selectedAlertas.includes(r["ALERTA"]?.trim() || ""));
    }

    if (selectedFechas.length > 0) {
      result = result.filter((r) => selectedFechas.includes(r["FECHA DETECCIÓN"]?.trim() || ""));
    }

    if (selectedYears.length > 0 || selectedMonths.length > 0 || selectedDays.length > 0) {
      result = result.filter((r) => {
        const [year, month, day] = (r["FECHA DETECCIÓN"]?.trim() || "").split("-");
        return (selectedYears.length === 0 || selectedYears.includes(year)) &&
          (selectedMonths.length === 0 || selectedMonths.includes(month)) &&
          (selectedDays.length === 0 || selectedDays.includes(day));
      });
    }

    if (selectedStatuses.length > 0) {
      result = result.filter((r) => selectedStatuses.includes(r["STATUS INVESTIGACIÓN"]?.trim() || ""));
    }

    if (selectedHallazgos.length > 0) {
      result = result.filter((r) => selectedHallazgos.some((hallazgo) =>
        hallazgo === "PENDIENTE" ? isRecordPending(r) : normalizeHallazgo(r["HALLAZGOS"]) === hallazgo
      ));
    }

    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA === undefined || valA === null) return sortAsc ? 1 : -1;
        if (valB === undefined || valB === null) return sortAsc ? -1 : 1;

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [records, searchQuery, selectedTiendas, selectedAlertas, selectedHallazgos, selectedFechas, selectedStatuses, selectedYears, selectedMonths, selectedDays, sortField, sortAsc]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredRecords.length / pageSize) || 1;
  }, [filteredRecords, pageSize]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, currentPage, pageSize]);

  const startItem = filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, filteredRecords.length);

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (!selectedSabana) {
    return (
      <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col justify-between antialiased relative overflow-hidden selection:bg-emerald-500 selection:text-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/15 text-emerald-400 p-2.5 rounded-2xl border border-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider font-mono">Control Tower</h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">SPSA • Sábanas de Investigación</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl pl-3 pr-2 py-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-white leading-tight">
                  {currentUserName || "Usuario SPSA"}
                </span>
                <span className="text-[9px] font-medium text-slate-400 leading-none">
                  {currentUser}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="ml-1.5 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12 flex flex-col items-center justify-center flex-1 w-full relative z-10 text-center space-y-10">
          <div className="space-y-3 max-w-lg">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
              Seleccione la Sábana de Investigación
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Su cuenta tiene privilegios globales (<span className="text-emerald-400 font-bold">TODOS</span>). Por favor, elija la sábana a la que desea ingresar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <button
              onClick={() => {
                setSelectedSabana("mass");
                localStorage.setItem("spsa_selected_sabana", "mass");
              }}
              className="bg-slate-950/40 hover:bg-slate-950/80 border border-white/10 hover:border-emerald-500/40 p-6 sm:p-8 rounded-3xl text-left transition-all duration-300 group cursor-pointer hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] flex flex-col justify-between min-h-[280px] relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center bg-emerald-500/10 text-emerald-400 p-3.5 rounded-2xl border border-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Sábana de Investigación MASS
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sábana de investigación principal para tiendas Mass. Registros de alertas y control operativo.
                  </p>
                </div>
              </div>
              
              <div className="mt-8 pt-4 border-t border-white/5 w-full">
                <div className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[11px] font-bold text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/15 group-hover:border-emerald-500/30 transition-all uppercase tracking-wider font-mono">
                  <span>Ingresar a MASS</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>

            <button
              className="bg-slate-950/40 border border-white/10 p-6 sm:p-8 rounded-3xl text-left cursor-default flex flex-col justify-between min-h-[280px] relative overflow-hidden opacity-70"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center bg-indigo-500/10 text-indigo-400 p-3.5 rounded-2xl border border-indigo-500/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">
                    Sábana de Investigación CFR
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sábana de investigación. Pendiente de configuración.
                  </p>
                </div>
              </div>
              
              <div className="mt-8 pt-4 border-t border-white/5 w-full">
                <div className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[11px] font-bold text-slate-500 bg-slate-900 border border-slate-800 uppercase tracking-wider font-mono">
                  <span>Próximamente</span>
                </div>
              </div>
            </button>
          </div>
        </main>

        <footer className="w-full max-w-7xl mx-auto px-6 py-5 border-t border-white/5 text-[10.5px] text-slate-500 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>© 2026 SPSA Plataforma Control Tower. Todos los derechos reservados.</span>
          <span>Acceso seguro • Conectado con Supabase Database</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 font-sans flex flex-col antialiased">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.015)]">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-sm flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-950 tracking-tight uppercase font-mono">
                  SÁBANA DE INVESTIGACIÓN MASS
                </h1>
              </div>
              <p className="text-xs text-slate-700 font-semibold mt-0.5">
                PLATAFORMA DE CONTROL TOWER
              </p>
              {lastUpdated && (
                <p className="text-[10.5px] text-slate-400 mt-1 font-mono">
                  Actualizado: <span className="text-slate-600 font-bold">{lastUpdated}</span> (Fecha y hora peruana)
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            {currentUserFormato === "TODOS" && (
              <button
                onClick={() => {
                  setSelectedSabana(null);
                  localStorage.removeItem("spsa_selected_sabana");
                  setSelectedRecord(null);
                  setRawRecords([]);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-900 text-emerald-400 border border-slate-800 hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
              >
                <LayoutGrid className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Menú Principal</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-semibold border shadow-xs select-none bg-emerald-50/50 border-emerald-100 text-emerald-800">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>Datos Conectados</span>
            </div>

            {currentUser && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl pl-3 pr-2 py-1.5 shadow-xs">
                <div className="bg-slate-900 text-emerald-400 p-1.5 rounded-xl shrink-0 flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-bold text-slate-800 leading-tight">
                    {currentUserName || currentUser}
                  </span>
                  <span className="text-[9px] font-medium text-slate-400 leading-none">
                    {currentUser}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-1.5 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={handleManualSync}
              disabled={isLoading || isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 hover:text-slate-950 hover:border-slate-300 disabled:opacity-50 cursor-pointer shadow-xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || (isLoading && records.length === 0) ? "animate-spin" : ""}`} />
              Refrescar
            </button>
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 space-y-6">
        
        {/* Tarjetas de Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Total Casos</span>
              <div className="bg-slate-50 p-1.5 rounded-lg text-slate-400">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold font-mono text-slate-950">
                {isLoading && records.length === 0 ? "..." : stats.total}
              </span>
              <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                Registrados en la sabana general
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-slate-900 h-full rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Pendientes</span>
              <div className="bg-amber-50 p-1.5 rounded-lg text-amber-500">
                <HelpCircle className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold font-mono text-amber-600">
                {isLoading && records.length === 0 ? "..." : stats.pendiente}
              </span>
              <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                {stats.porcentajeRevisados}% de avance general
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${100 - stats.porcentajeRevisados}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Conformes</span>
              <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-500">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold font-mono text-emerald-600">
                {isLoading && records.length === 0 ? "..." : stats.conforme}
              </span>
              <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                Total casos conformes
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.total > 0 ? (stats.conforme / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Err. Operativos</span>
              <div className="bg-orange-50 p-1.5 rounded-lg text-orange-500">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold font-mono text-orange-600">
                {isLoading && records.length === 0 ? "..." : stats.errOperativo}
              </span>
              <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                {stats.total > 0 ? Math.round((stats.errOperativo / stats.total) * 100) : 0}% del total general
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: `${stats.total > 0 ? (stats.errOperativo / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono font-bold">Hurtos</span>
              <div className="bg-rose-50 p-1.5 rounded-lg text-rose-500">
                <AlertOctagon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold font-mono text-rose-600">
                {isLoading && records.length === 0 ? "..." : stats.hurto}
              </span>
              <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                {stats.total > 0 ? Math.round((stats.hurto / stats.total) * 100) : 0}% del total general
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${stats.total > 0 ? (stats.hurto / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Err. CCTV</span>
              <div className="bg-sky-50 p-1.5 rounded-lg text-sky-500">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-extrabold font-mono text-sky-600">
                {isLoading && records.length === 0 ? "..." : stats.errorCctv}
              </span>
              <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                {stats.total > 0 ? Math.round((stats.errorCctv / stats.total) * 100) : 0}% del total general
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full" style={{ width: `${stats.total > 0 ? (stats.errorCctv / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

        </div>

        {/* Tabla y Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <div className={`transition-all duration-300 flex flex-col gap-6 ${
            selectedRecord ? "lg:col-span-8" : "lg:col-span-12"
          }`}>
            
            <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.015)] flex flex-col overflow-hidden">
            
            {/* Filtros */}
            <div className="p-5 border-b border-slate-100 space-y-4 bg-slate-50/20">
              
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar incidentes por Tienda, Colaborador, DNI o N° de Boleta..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 text-xs text-slate-900 placeholder-slate-400 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <MultiSelectFilter label="Tiendas" values={listTiendas.filter((t) => t !== "TODAS")} selected={selectedTiendas} onChange={setSelectedTiendas} />
                  </div>

                  <div className="flex items-center gap-2">
                    <MultiSelectFilter label="Alertas" values={listAlertas.filter((a) => a !== "TODAS")} selected={selectedAlertas} onChange={setSelectedAlertas} />
                  </div>

                  <div className="flex items-center gap-2">
                    <MultiSelectFilter label="Fechas" values={listFechas.filter((f) => f !== "TODAS")} selected={selectedFechas} onChange={setSelectedFechas} />
                    <MultiSelectFilter label="Años" values={Array.from(new Set(listFechas.slice(1).map((f) => f.slice(0, 4))))} selected={selectedYears} onChange={setSelectedYears} />
                    <MultiSelectFilter label="Meses" values={Array.from(new Set(listFechas.slice(1).map((f) => f.slice(5, 7)))).sort()} selected={selectedMonths} onChange={setSelectedMonths} />
                    <MultiSelectFilter label="Días" values={Array.from(new Set(listFechas.slice(1).map((f) => f.slice(8, 10)))).sort()} selected={selectedDays} onChange={setSelectedDays} />
                  </div>

                  <div className="flex items-center gap-2">
                    <MultiSelectFilter label="Estados Inv." values={listStatusInvestigacion.filter((s) => s !== "TODOS")} selected={selectedStatuses} onChange={setSelectedStatuses} />
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline font-mono">Hallazgos:</span>
                  <MultiSelectFilter
                    label="Hallazgos"
                    values={["PENDIENTE", "CONFORME", "ERROR OPERATIVO", "HURTO", "ERROR CCTV"]}
                    selected={selectedHallazgos}
                    onChange={setSelectedHallazgos}
                  />
                </div>

              </div>

              {(selectedTiendas.length > 0 || selectedAlertas.length > 0 || selectedFechas.length > 0 || selectedStatuses.length > 0 || selectedYears.length > 0 || selectedMonths.length > 0 || selectedDays.length > 0 || selectedHallazgos.length > 0 || searchQuery !== "") && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Filtros Activos:</span>
                    
                    {searchQuery && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Búsqueda: "{searchQuery}"
                      </span>
                    )}

                    {selectedTiendas.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Tienda: {selectedTiendas.join(", ")}
                      </span>
                    )}

                    {selectedAlertas.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Alerta: {selectedAlertas.join(", ")}
                      </span>
                    )}

                    {(selectedFechas.length > 0 || selectedYears.length > 0 || selectedMonths.length > 0 || selectedDays.length > 0) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Fecha: {[...selectedFechas, ...selectedYears.map((v) => `año ${v}`), ...selectedMonths.map((v) => `mes ${v}`), ...selectedDays.map((v) => `día ${v}`)].join(", ")}
                      </span>
                    )}

                    {selectedStatuses.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Edo. Inv: {selectedStatuses.join(", ")}
                      </span>
                    )}

                    {selectedHallazgos.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Hallazgo: {selectedHallazgos.join(", ")}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedTiendas([]);
                      setSelectedAlertas([]);
                      setSelectedFechas([]);
                      setSelectedStatuses([]);
                      setSelectedYears([]);
                      setSelectedMonths([]);
                      setSelectedDays([]);
                      setSelectedHallazgos([]);
                    }}
                    className="text-xs font-bold text-slate-900 hover:text-slate-700 hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    Limpiar todos los filtros
                  </button>
                </div>
              )}

            </div>

            {/* Listado Principal de Incidentes */}
            <div className="overflow-x-auto relative max-h-[620px] flex-1">
              {isLoading && records.length === 0 ? (
                <div className="py-28 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-9 h-9 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-xs font-bold text-slate-800">Cargando base de datos Supabase...</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm text-center leading-relaxed">
                    Sincronizando los registros en tiempo real.
                  </p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-28 flex flex-col items-center justify-center text-slate-400">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-4 text-slate-300">
                    <UserX className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">No se encontraron resultados para la búsqueda</p>
                  <p className="text-[11px] text-slate-400 mt-1">Prueba a reajustar los filtros o borra los términos de búsqueda.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
                  <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-md text-slate-600 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 select-none z-10">
                    <tr>
                      <th className="w-[18%] py-4 px-5 cursor-pointer hover:bg-slate-200/50 transition-colors" onClick={() => handleSort("N° BOLETA")}>
                        <div className="flex items-center gap-1.5">
                          ID / Boleta
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th className="w-[18%] py-4 px-4 cursor-pointer hover:bg-slate-200/50 transition-colors" onClick={() => handleSort("TIENDA")}>
                        <div className="flex items-center gap-1.5">
                          Tienda
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th className="w-[24%] py-4 px-4 cursor-pointer hover:bg-slate-200/50 transition-colors" onClick={() => handleSort("COLABORADOR")}>
                        <div className="flex items-center gap-1.5">
                          Colaborador / Puesto
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th className="w-[12%] py-4 px-4 text-right cursor-pointer hover:bg-slate-200/50 transition-colors" onClick={() => handleSort("ABORADO")}>
                        <div className="flex items-center justify-end gap-1.5">
                          Monto
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th className="w-[13%] py-4 px-4 cursor-pointer hover:bg-slate-200/50 transition-colors" onClick={() => handleSort("ALERTA")}>
                        <div className="flex items-center gap-1.5">
                          Alerta
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th className="w-[15%] py-4 px-4 cursor-pointer hover:bg-slate-200/50 transition-colors" onClick={() => handleSort("HALLAZGOS")}>
                        <div className="flex items-center gap-1.5">
                          Hallazgos
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th className="w-[10%] py-4 px-4 text-right cursor-pointer hover:bg-slate-200/50 transition-colors">
                        <div className="flex items-center justify-end gap-1.5">
                          N° ALT (6m)
                        </div>
                      </th>
                      <th className="w-[10%] py-4 px-4 text-right cursor-pointer hover:bg-slate-200/50 transition-colors">
                        <div className="flex items-center justify-end gap-1.5">
                          PÉRDIDA (6m)
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {paginatedRecords.map((rec) => {
                      const dni = rec["DNI"];
                      const sixMonthsAgo = new Date();
                      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                      
                      let count = 0;
                      let sum = 0;
                      
                      rawRecords.forEach(r => {
                        if (dni && String(r["DNI"]).trim() === String(dni).trim() &&
                            ["HURTO", "ERROR OPERATIVO"].includes(normalizeHallazgo(r["HALLAZGOS"]))) {
                          const fecha = new Date(r["FECHA DETECCIÓN"] || "");
                          if (!isNaN(fecha.getTime()) && fecha >= sixMonthsAgo) {
                            count++;
                            const val = r["MONTO"] || r["ABORADO"] || "0";
                            sum += parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
                          }
                        }
                      });
                      
                      const metrics = { count, sum };
                      const isSelected = selectedRecord && String(selectedRecord["N° BOLETA"] || "") === String(rec["N° BOLETA"] || "");
                      const hallazgoVal = normalizeHallazgo(rec["HALLAZGOS"]);

                      let badgeClass = "bg-amber-50 border-amber-200 text-amber-700 font-bold";
                      let displayHallazgo = "Pendiente";
                      
                      if (hallazgoVal === "CONFORME") {
                        badgeClass = "bg-emerald-50 border-emerald-100 text-emerald-800 font-bold";
                        displayHallazgo = "Conforme";
                      } else if (hallazgoVal === "ERROR OPERATIVO") {
                        badgeClass = "bg-amber-50 border-amber-100 text-amber-800 font-bold";
                        displayHallazgo = "Err. Op.";
                      } else if (hallazgoVal === "HURTO") {
                        badgeClass = "bg-rose-50 border-rose-100 text-rose-800 font-bold";
                        displayHallazgo = "Hurto";
                      } else if (hallazgoVal === "ERROR CCTV") {
                        badgeClass = "bg-indigo-50 border-indigo-100 text-indigo-800 font-bold";
                        displayHallazgo = "Error CCTV";
                      }

                      return (
                        <tr
                          key={rec["N° BOLETA"]}
                          onClick={() => setSelectedRecord(rec)}
                          className={`hover:bg-slate-50/70 transition-all cursor-pointer group ${
                            isSelected 
                              ? "bg-slate-900/[0.03] border-l-4 border-slate-900" 
                              : "border-l-4 border-transparent"
                          }`}
                        >
                          <td className="py-4 px-5 font-mono text-[11px] text-slate-900 group-hover:text-slate-950 font-bold">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{rec["N° BOLETA"]}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                              {rec["FECHA DETECCIÓN"] || ""}
                            </div>
                          </td>

                          <td className="py-4 px-4 overflow-hidden truncate">
                            <span className="font-bold text-slate-800 block truncate" title={rec["TIENDA"]}>
                              {rec["TIENDA"]}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              ID: {rec["ID TIENDA"] || "-"}
                            </span>
                          </td>

                          <td className="py-4 px-4 overflow-hidden truncate">
                            <span className="block font-semibold text-slate-900 truncate" title={rec["COLABORADOR"] || "No registrado"}>
                              {rec["COLABORADOR"] || "No registrado"}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                              <span>DNI {rec["DNI"] || "-"}</span>
                              <span>•</span>
                              <span className="truncate">{rec["CARGO"] || "-"}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-right font-mono font-bold text-slate-950 text-xs sm:text-xs">
                            S/. {
                              (() => {
                                const val = rec["ABORADO"] || rec["MONTO"] || "0";
                                const num = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
                                return isNaN(num) ? "0.00" : num.toFixed(2);
                              })()
                            }
                          </td>

                          <td className="py-4 px-4 overflow-hidden truncate text-center">
                            <span className="inline-block text-[10px] font-mono px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 truncate text-center w-full" title={rec["ALERTA"]}>
                              {rec["ALERTA"]}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex items-center justify-between">
                              <span className={`inline-block text-[10px] px-2.5 py-0.5 border rounded-full ${badgeClass}`}>
                                {displayHallazgo}
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pr-1" />
                            </div>
                          </td>

                          <td className="py-4 px-4 text-[11px] font-mono text-slate-900 text-right font-bold">
                             {metrics.count}
                          </td>
                          <td className="py-4 px-4 text-[11px] font-mono text-slate-900 text-right font-bold">
                             {metrics.sum.toLocaleString("es-PE", { style: "currency", currency: "PEN" })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginación */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 flex flex-col sm:flex-row gap-4 justify-between items-center font-medium">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <span className="font-semibold text-slate-600">
                  Mostrando <span className="text-slate-900 font-bold">{startItem}</span> - <span className="text-slate-900 font-bold">{endItem}</span> de <span className="text-slate-900 font-bold">{filteredRecords.length}</span> incidentes (Total: {records.length})
                </span>
                
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">Filas:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-700 font-bold cursor-pointer"
                  >
                    {[25, 50, 100, 200, 500].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-all cursor-pointer"
                  title="Primera página"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1 px-2.5 text-xs font-bold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Ant.
                </button>
                
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200/60 font-mono">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1 px-2.5 text-xs font-bold"
                >
                  Sig.
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-all cursor-pointer"
                  title="Última página"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          </div>

          {/* Panel Lateral de Detalle */}
          {selectedRecord && (
            <div className="col-span-12 lg:col-span-4 lg:sticky lg:top-[85px] animate-in slide-in-from-right-4 fade-in duration-300">
              <CaseDetailsPanel
                record={selectedRecord}
                onClose={() => setSelectedRecord(null)}
                onSave={handleSaveRecord}
                selectedSabana={selectedSabana}
              />
            </div>
          )}

        </div>

      </main>

      <footer className="mt-12 bg-white border-t border-slate-100 py-8 text-xs text-slate-400">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex flex-col items-center gap-5">
          <div className="inline-flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 text-amber-800 font-medium text-xs shadow-[0_1px_2px_rgba(0,0,0,0.02)] max-w-xl mx-auto text-left leading-normal">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Cualquier duda o sugerencia por favor escribir al correo{" "}
              <a href="mailto:riesgos.ci@spsa.pe" className="underline font-bold text-amber-950 hover:text-amber-700 transition-colors">
                riesgos.ci@spsa.pe
              </a>.
            </span>
          </div>

          <p className="max-w-2xl mx-auto leading-relaxed text-center">
            Sistemas de Control y Gestión de Incidentes de Tienda. 
            Conectado de forma segura con base de datos en la nube.
          </p>
        </div>
      </footer>

      <DiagnosticsModal
        status={status}
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        onRefresh={handleManualSync}
        isRefreshing={isRefreshing}
      />

      <AddCaseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleCreateRecord}
        existingRecords={records}
      />

    </div>
  );
}
