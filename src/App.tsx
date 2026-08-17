import { useState, useEffect, useMemo } from "react";
import { CaseRecord, SharePointStatus, PendingChange } from "./types";
import CaseDetailsPanel from "./components/CaseDetailsPanel";
import DiagnosticsModal from "./components/DiagnosticsModal";
import { LoginScreen } from "./components/LoginScreen";
import { AddCaseModal } from "./components/AddCaseModal";
import { 
  FileSpreadsheet, RefreshCw, Search, Filter, ShieldCheck, 
  AlertTriangle, Database, Info, LayoutGrid, CheckCircle, 
  HelpCircle, UserX, TrendingUp, AlertOctagon, HelpCircle as HelpIcon,
  ChevronRight, ArrowUpDown, WifiOff, ChevronLeft, ChevronsLeft, ChevronsRight,
  LogOut, User, ExternalLink, Plus, CloudUpload
} from "lucide-react";

export function normalizeHallazgo(val: string | undefined): string {
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
  
  // Si no hay hallazgo, está pendiente
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

  // Auto-assign "mass" if logged in and formato is not TODOS
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
    if (selectedSabana === "fdc") {
      let list = [...rawRecords];
      
      const today = new Date();
      const offset = -5 * 60; // Peru UTC-5
      const peruTime = new Date(today.getTime() + (today.getTimezoneOffset() + offset) * 60 * 1000);
      const yyyy = peruTime.getFullYear();
      const mm = String(peruTime.getMonth() + 1).padStart(2, '0');
      const dd = String(peruTime.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      // 1. Apply updates
      pendingChanges.forEach((change) => {
        if (change.type === "update") {
          list = list.map((rec) => {
            if (String(rec["N° BOLETA"] || "").trim().toLowerCase() === String(change.boleta || "").trim().toLowerCase()) {
              return {
                ...rec,
                "HALLAZGOS": change.data.hallazgos,
                "Comentarios": change.data.comentarios,
                "FECHA DE CIERRE": change.data.hallazgos ? todayStr : "",
                "FECHA DE CIERRA": change.data.hallazgos ? todayStr : "",
                "USUARIO": change.data.hallazgos ? change.data.usuarioName : "",
                _isPendingChange: true,
              };
            }
            return rec;
          });
        }
      });

      // 2. Apply additions
      const additions = pendingChanges.filter((c) => c.type === "add");
      const addedRecords = additions.map((change) => {
        return {
          _rowNum: -1,
          _isPendingChange: true,
          "ITEM": "Nuevo",
          "FECHA DETECCIÓN": change.data["FECHA DETECCIÓN"] || todayStr,
          ...change.data,
        } as CaseRecord;
      });

      return [...addedRecords, ...list];
    }
    return rawRecords;
  }, [rawRecords, pendingChanges, selectedSabana]);

  const [status, setStatus] = useState<SharePointStatus>({
    connected: false,
    mode: "offline",
    lastAttempt: "",
    logs: [],
    error: null,
  });
  
  const [selectedRecord, setSelectedRecord] = useState<CaseRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTienda, setSelectedTienda] = useState("TODAS");
  const [selectedAlerta, setSelectedAlerta] = useState("TODAS");
  const [selectedHallazgo, setSelectedHallazgo] = useState("TODOS");
  const [selectedFecha, setSelectedFecha] = useState("TODAS");
  const [selectedStatusInvestigacion, setSelectedStatusInvestigacion] = useState("TODOS");
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTienda, selectedAlerta, selectedHallazgo, selectedFecha, selectedStatusInvestigacion]);

  // Load initial cases on mount
  useEffect(() => {
    if (isAuthenticated && selectedSabana) {
      fetchData();
    } else {
      setRawRecords([]);
    }
  }, [isAuthenticated, selectedSabana]);

  const fetchData = async () => {
    if (!selectedSabana) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/cases?sabana=${selectedSabana}`);
      const result = await res.json();
      
      if (result.data) {
        setRawRecords(result.data);
        setStatus(result.status);
        
        try {
          const peruTime = new Intl.DateTimeFormat("es-PE", {
            timeZone: "America/Lima",
            dateStyle: "short",
            timeStyle: "medium"
          }).format(new Date());
          setLastUpdated(peruTime);
        } catch (e) {
          setLastUpdated(new Date().toLocaleString("es-PE"));
        }
        
        // If we had a selected record, update it with fresh data
        if (selectedRecord) {
          const fresh = result.data.find(
            (r: CaseRecord) => r["N° BOLETA"] === selectedRecord["N° BOLETA"]
          );
          if (fresh) setSelectedRecord(fresh);
        }
      }
    } catch (err) {
      console.error("Error al cargar registros:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Save record to database
  const handleSaveRecord = async (
    rowNum: number,
    boleta: string,
    hallazgos: string,
    comentarios: string,
    accDisciplinaria: string,
    cargoReal: string,
    cartaDescuento: string,
    contribucionTotalEstimada: string,
    cstvDetail: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Calculate today's date in Peru format (YYYY-MM-DD)
    const today = new Date();
    const offset = -5 * 60; // Peru UTC-5
    const peruTime = new Date(today.getTime() + (today.getTimezoneOffset() + offset) * 60 * 1000);
    const yyyy = peruTime.getFullYear();
    const mm = String(peruTime.getMonth() + 1).padStart(2, '0');
    const dd = String(peruTime.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const finalFechaCierre = hallazgos ? todayStr : "";
    const finalUsuario = hallazgos ? currentUserName : "";

    if (selectedSabana === "fdc") {
      // Local cache update for FDC
      const newUpdate: PendingChange = {
        type: "update",
        boleta,
        data: {
          hallazgos,
          comentarios,
          "ACCIÓN DISCIPLINARIA": accDisciplinaria,
          "CARGO REAL": cargoReal,
          "CARTA DESCUENTO": cartaDescuento,
          "CONTRIBUCION TOTAL ESTIMADA": contribucionTotalEstimada,
          "COMENTARIOS ERROR CSTV": cstvDetail,
          usuarioName: currentUserName,
          todayStr,
        },
        timestamp: new Date().toISOString(),
      };

      setPendingChanges((prev) => {
        const filtered = prev.filter((c) => !(c.type === "update" && String(c.boleta || "").toLowerCase() === String(boleta || "").toLowerCase()));
        return [...filtered, newUpdate];
      });

      // Update selected record in detail panel immediately for fast feedback
      setSelectedRecord((prev) => {
        if (prev && String(prev["N° BOLETA"] || "").trim().toLowerCase() === String(boleta || "").trim().toLowerCase()) {
          return {
            ...prev,
            "HALLAZGOS": hallazgos,
            "Comentarios": comentarios,
            "ACCIÓN DISCIPLINARIA": accDisciplinaria,
            "CARGO REAL": cargoReal,
            "CARTA DESCUENTO": cartaDescuento,
            "CONTRIBUCION TOTAL ESTIMADA": contribucionTotalEstimada,
            "COMENTARIOS ERROR CSTV": cstvDetail,
            "FECHA DE CIERRE": finalFechaCierre,
            "FECHA DE CIERRA": finalFechaCierre,
            "USUARIO": finalUsuario,
            _isPendingChange: true,
          };
        }
        return prev;
      });

      return { success: true };
    }

    try {
      const res = await fetch("/api/cases/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rowNum,
          boleta,
          hallazgos,
          comentarios,
          accDisciplinaria,
          cargoReal,
          cartaDescuento,
          contribucionTotalEstimada,
          cstvDetail,
          usuarioName: currentUserName,
          sabana: selectedSabana,
        }),
      });

      const result = await res.json();
      
      if (res.ok && result.success) {
        // Update records in local state immediately for fast feedback (MASS)
        setRawRecords((prev) =>
          prev.map((rec) => {
            if (String(rec["N° BOLETA"] || "") === String(boleta || "")) {
              return {
                ...rec,
                "HALLAZGOS": hallazgos,
                "Comentarios": comentarios,
                "ACCIÓN DISCIPLINARIA": accDisciplinaria,
                "CARGO REAL": cargoReal,
                "CARTA DESCUENTO": cartaDescuento,
                "CONTRIBUCION TOTAL ESTIMADA": contribucionTotalEstimada,
                "COMENTARIOS ERROR CSTV": cstvDetail,
                "FECHA DE CIERRE": finalFechaCierre,
                "FECHA DE CIERRA": finalFechaCierre,
                "USUARIO": finalUsuario,
              };
            }
            return rec;
          })
        );
        
        // Update selected record in detail panel too
        setSelectedRecord((prev) => {
          if (prev && String(prev["N° BOLETA"] || "") === String(boleta || "")) {
            return {
              ...prev,
              "HALLAZGOS": hallazgos,
              "Comentarios": comentarios,
              "ACCIÓN DISCIPLINARIA": accDisciplinaria,
              "CARGO REAL": cargoReal,
              "CARTA DESCUENTO": cartaDescuento,
              "CONTRIBUCION TOTAL ESTIMADA": contribucionTotalEstimada,
              "FECHA DE CIERRE": finalFechaCierre,
              "FECHA DE CIERRA": finalFechaCierre,
              "USUARIO": finalUsuario,
            };
          }
          return prev;
        });

        // Refetch background status to ensure logs and status match
        const statusRes = await fetch("/api/sharepoint-status");
        if (statusRes.ok) {
          const freshStatus = await statusRes.json();
          setStatus(freshStatus);
        }

        return { success: true };
      } else {
        console.error("Fallo de guardado:", result.error);
        return { success: false, error: result.error || "Fallo de guardado." };
      }
    } catch (err: any) {
      console.error("Error al guardar registro:", err);
      return { success: false, error: err.message || "Error al conectar con el servidor." };
    }
  };

  // Create new record in database
  const handleCreateRecord = async (
    newRecordData: Partial<CaseRecord>
  ): Promise<{ success: boolean; error?: string }> => {
    const today = new Date();
    const offset = -5 * 60; // Peru UTC-5
    const peruTime = new Date(today.getTime() + (today.getTimezoneOffset() + offset) * 60 * 1000);
    const yyyy = peruTime.getFullYear();
    const mm = String(peruTime.getMonth() + 1).padStart(2, '0');
    const dd = String(peruTime.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const boleta = newRecordData["N° BOLETA"] || "";

    if (selectedSabana === "fdc") {
      // Local cache create for FDC
      const newAdd: PendingChange = {
        type: "add",
        boleta,
        data: {
          ...newRecordData,
          "FECHA DETECCIÓN": todayStr,
          "STATUS INVESTIGACIÓN": newRecordData["HALLAZGOS"] && newRecordData["HALLAZGOS"] !== "PENDIENTE" ? "CERRADO" : "EN PROCESO",
          INVESTIGADOR: currentUserName,
          USUARIO: currentUserName,
        },
        timestamp: new Date().toISOString(),
      };

      setPendingChanges((prev) => {
        const filtered = prev.filter((c) => !(c.type === "add" && String(c.boleta || "").toLowerCase() === String(boleta || "").toLowerCase()));
        return [...filtered, newAdd];
      });

      // Automatically select the newly created record for an exceptionally smooth user experience
      const mockRecord: CaseRecord = {
        _rowNum: -1,
        _isPendingChange: true,
        "ITEM": "Nuevo",
        "FECHA DETECCIÓN": todayStr,
        ...newRecordData,
        "STATUS INVESTIGACIÓN": newRecordData["HALLAZGOS"] && newRecordData["HALLAZGOS"] !== "PENDIENTE" ? "CERRADO" : "EN PROCESO",
        "FECHA DE CIERRE": newRecordData["HALLAZGOS"] && newRecordData["HALLAZGOS"] !== "PENDIENTE" ? todayStr : "",
        "FECHA DE CIERRA": newRecordData["HALLAZGOS"] && newRecordData["HALLAZGOS"] !== "PENDIENTE" ? todayStr : "",
        "USUARIO": newRecordData["HALLAZGOS"] && newRecordData["HALLAZGOS"] !== "PENDIENTE" ? currentUserName : "",
        "INVESTIGADOR": currentUserName,
      } as CaseRecord;
      setSelectedRecord(mockRecord);

      return { success: true };
    }

    try {
      const res = await fetch("/api/cases/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newRecordData,
          INVESTIGADOR: currentUserName,
          USUARIO: currentUserName,
        }),
      });

      const result = await res.json();
      
      if (res.ok && result.success) {
        const addedRecord = result.data;
        setRawRecords((prev) => [addedRecord, ...prev]);
        
        // Refetch background status to ensure logs and status match
        const statusRes = await fetch("/api/sharepoint-status");
        if (statusRes.ok) {
          const freshStatus = await statusRes.json();
          setStatus(freshStatus);
        }

        return { success: true };
      } else {
        return { success: false, error: result.error || "Ocurrió un error al agregar el registro." };
      }
    } catch (err: any) {
      console.error("Error al agregar registro:", err);
      return { success: false, error: err.message || "Error de conexión con el servidor." };
    }
  };

  // Batch Synchronize all pending changes to SharePoint
  const handleBatchSync = async () => {
    if (pendingChanges.length === 0) return;
    setIsBatchSyncing(true);

    try {
      const res = await fetch("/api/cases/batch-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          changes: pendingChanges,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setPendingChanges([]);
        localStorage.removeItem("pending_changes_fdc");
        
        await fetchData();

        const statusRes = await fetch("/api/sharepoint-status");
        if (statusRes.ok) {
          const freshStatus = await statusRes.json();
          setStatus(freshStatus);
        }

        if (result.errors && result.errors.length > 0) {
          alert(`Sincronización completada parcialmente. Se guardaron los cambios, pero se omitieron algunos registros:\n\n${result.errors.join("\n")}`);
        } else {
          alert(`¡Sincronización completada con éxito! Todos los cambios (${result.processedCount}) han sido guardados en la base de datos.`);
        }
      } else {
        alert(`Error al sincronizar con la base de datos: ${result.error || "Ocurrió un error inesperado."}`);
      }
    } catch (err: any) {
      console.error("Error de sincronización:", err);
      alert(`Error de sincronización: ${err.message || "No se pudo conectar con el servidor."}`);
    } finally {
      setIsBatchSyncing(false);
    }
  };

  // Extract dynamic filters from records
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

  // Compute stats metrics
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

    const totalRevisados = selectedSabana === "mass"
      ? (conforme + errOperativo + hurto + errorCctv)
      : (conforme + errOperativo + hurto);
    const porcentajeRevisados = total > 0 ? Math.round((totalRevisados / total) * 100) : 0;

    return { total, conforme, errOperativo, hurto, errorCctv, pendiente, porcentajeRevisados };
  }, [records]);

  // Sorting handler
  const handleSort = (field: keyof CaseRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Text query search
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

    // Tienda selection filter
    if (selectedTienda !== "TODAS") {
      result = result.filter((r) => r["TIENDA"]?.trim() === selectedTienda);
    }

    // Alerta selection filter
    if (selectedAlerta !== "TODAS") {
      result = result.filter((r) => r["ALERTA"]?.trim() === selectedAlerta);
    }

    // Fecha selection filter
    if (selectedFecha !== "TODAS") {
      result = result.filter((r) => r["FECHA DETECCIÓN"]?.trim() === selectedFecha);
    }

    // Status Investigacion selection filter
    if (selectedStatusInvestigacion !== "TODOS") {
      result = result.filter((r) => r["STATUS INVESTIGACIÓN"]?.trim() === selectedStatusInvestigacion);
    }

    // Hallazgo status selection filter
    if (selectedHallazgo !== "TODOS") {
      if (selectedHallazgo === "PENDIENTE") {
        result = result.filter((r) => isRecordPending(r));
      } else {
        result = result.filter((r) => normalizeHallazgo(r["HALLAZGOS"]) === selectedHallazgo);
      }
    }

    // Apply Sorting
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
  }, [records, searchQuery, selectedTienda, selectedAlerta, selectedHallazgo, selectedFecha, selectedStatusInvestigacion, sortField, sortAsc]);

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
        {/* Ambient Decorative Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header with profile & logout */}
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

        {/* Main Body with Choices */}
        <main className="max-w-4xl mx-auto px-6 py-12 flex flex-col items-center justify-center flex-1 w-full relative z-10 text-center space-y-10">
          <div className="space-y-3 max-w-lg">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
              Seleccione la Sábana de Investigación
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Su cuenta tiene privilegios globales (<span className="text-emerald-400 font-bold">TODOS</span>). Por favor, elija la sábana a la que desea ingresar para gestionar incidentes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            {/* Card 1: MASS */}
            <button
              onClick={() => {
                setSelectedSabana("mass");
                localStorage.setItem("spsa_selected_sabana", "mass");
              }}
              className="bg-slate-950/40 hover:bg-slate-950/80 border border-white/10 hover:border-emerald-500/40 p-6 sm:p-8 rounded-3xl text-left transition-all duration-300 group cursor-pointer hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] flex flex-col justify-between min-h-[280px] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center bg-emerald-500/10 text-emerald-400 p-3.5 rounded-2xl border border-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Sábana de Investigación MASS
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sábana de investigación principal para tiendas Mass ISEG. Registros de alertas y control operativo.
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

            {/* Card 2: Sábana de Investigación CFR */}
            <button
              className="bg-slate-950/40 border border-white/10 p-6 sm:p-8 rounded-3xl text-left cursor-default flex flex-col justify-between min-h-[280px] relative overflow-hidden opacity-70"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
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

            {/* Card 3: Sábana de Investigación MAKRO */}
            <button
              className="bg-slate-950/40 border border-white/10 p-6 sm:p-8 rounded-3xl text-left cursor-default flex flex-col justify-between min-h-[280px] relative overflow-hidden opacity-70"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="space-y-4">
                <div className="inline-flex items-center justify-center bg-sky-500/10 text-sky-400 p-3.5 rounded-2xl border border-sky-500/20">
                  <Database className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">
                    Sábana de Investigación MAKRO
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

        {/* Footer */}
        <footer className="w-full max-w-7xl mx-auto px-6 py-5 border-t border-white/5 text-[10.5px] text-slate-500 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>© 2026 SPSA Plataforma Control Tower. Todos los derechos reservados.</span>
          <span>Acceso seguro • Conectado con SharePoint</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 font-sans flex flex-col antialiased">
      
      {/* 1. Header Section */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.015)]">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* SPSA Corporate Identity Branding */}
          <div className="flex items-center gap-3.5">
            <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-sm flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-950 tracking-tight uppercase font-mono">
                  {selectedSabana === "fdc" ? "SÁBANA DE INVESTIGACIÓN FDC SEGURIDAD" : "SÁBANA DE INVESTIGACIÓN MASS"}
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

           {/* Controls & Connection Status */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            {/* Menú Principal Button (only if user formato is TODOS) */}
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

            {/* "Agregar Registro" button moved down to search bar as per visual expert instructions */}

            {/* Sincronizar SharePoint Button (Only for FDC) */}
            {selectedSabana === "fdc" && (
              <button
                onClick={handleBatchSync}
                disabled={isBatchSyncing || pendingChanges.length === 0}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-[0.98] ${
                  pendingChanges.length > 0
                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-[0_0_15px_rgba(217,119,6,0.3)] border border-amber-500/30 cursor-pointer"
                    : "bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed"
                }`}
                title={pendingChanges.length > 0 ? `Subir ${pendingChanges.length} cambios a la base` : "No hay cambios pendientes por sincronizar"}
              >
                {isBatchSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : pendingChanges.length > 0 ? (
                  <CloudUpload className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 shrink-0 text-slate-400" />
                )}
                <span>
                  {isBatchSyncing 
                    ? "Sincronizando..." 
                    : pendingChanges.length > 0 
                      ? `Sincronizar (${pendingChanges.length})` 
                      : "Guardar"
                  }
                </span>
              </button>
            )}

            {/* Status Indicator Badge */}
            <div
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-semibold border shadow-xs select-none ${
                status.connected
                  ? "bg-emerald-50/50 border-emerald-100 text-emerald-800"
                  : "bg-amber-50/50 border-amber-100 text-amber-800"
              }`}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  status.connected ? "bg-emerald-400" : "bg-amber-400"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  status.connected ? "bg-emerald-500" : "bg-amber-500"
                }`}></span>
              </span>
              <span>
                {status.connected ? "Datos Conectados" : "Datos Conectados"}
              </span>
            </div>

            {/* User Session Info */}
            {currentUser && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl pl-3 pr-2 py-1.5 shadow-xs">
                <div className="bg-slate-900 text-emerald-400 p-1.5 rounded-xl shrink-0 flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-bold text-slate-800 leading-tight">
                    {currentUserName || (currentUser === "ccontroltower@spsa.pe" ? "Control Tower SPSA" : (currentUser === "riesgos.ci@spsa.pe" ? "Área de Riesgos" : currentUser))}
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

            {/* Sync Refresh Button */}
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

      {/* 2. Main Content Area */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 space-y-6">
        
        {/* 2.1 Metrics Summary Row - Bento Style */}
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4`}>
          
          {/* Total Casos */}
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

          {/* Pendientes */}
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

          {/* Conformes */}
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

          {/* Errores Operativos */}
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

          {/* Hurtos */}
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

          {/* Errores CCTV */}
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

        {/* 2.2 Split Workspace Layout: List (Left) + Editor (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Case Records Column (Spans 12 columns if no record selected, otherwise 8) */}
          <div className={`transition-all duration-300 flex flex-col gap-6 ${
            selectedRecord ? "lg:col-span-8" : "lg:col-span-12"
          }`}>
            
            {/* White Table Card */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.015)] flex flex-col overflow-hidden">
            
            {/* Search, Filter and Statistics bar */}
            <div className="p-5 border-b border-slate-100 space-y-4 bg-slate-50/20">
              
              {/* Row 1: Search Query input + Agregar Registro Button */}
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
                
                {selectedSabana === "fdc" && (
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shrink-0"
                    id="btn-agregar-registro-search"
                  >
                    <Plus className="w-4 h-4 shrink-0 text-white" />
                    <span>Agregar Registro</span>
                  </button>
                )}
              </div>

              {/* Row 2: Dynamic Select Dropdown Filters */}
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Selector Tiendas */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={selectedTienda}
                      onChange={(e) => setSelectedTienda(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs text-slate-700"
                    >
                      <option value="TODAS">Todas las Tiendas</option>
                      {listTiendas.filter(t => t !== "TODAS").map((tienda) => (
                        <option key={tienda} value={tienda}>{tienda}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector Alertas */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedAlerta}
                      onChange={(e) => setSelectedAlerta(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs text-slate-700"
                    >
                      <option value="TODAS">Todas las Alertas</option>
                      {listAlertas.filter(a => a !== "TODAS").map((alerta) => (
                        <option key={alerta} value={alerta}>{alerta}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector Fecha Boleta */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedFecha}
                      onChange={(e) => setSelectedFecha(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs text-slate-700"
                    >
                      <option value="TODAS">Todas las Fechas</option>
                      {listFechas.filter(f => f !== "TODAS").map((fecha) => (
                        <option key={fecha} value={fecha}>{fecha}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector Estado Investigación */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedStatusInvestigacion}
                      onChange={(e) => setSelectedStatusInvestigacion(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all shadow-xs text-slate-700"
                    >
                      <option value="TODOS">Todos los Estados Inv.</option>
                      {listStatusInvestigacion.filter(s => s !== "TODOS").map((statusInv) => (
                        <option key={statusInv} value={statusInv}>{statusInv}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selector Hallazgo */}
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline font-mono">Hallazgos:</span>
                  <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-xs">
                    {[
                      { key: "TODOS", label: "Todos" },
                      { key: "PENDIENTE", label: "Pendientes" },
                      { key: "CONFORME", label: "Conformes" },
                      { key: "ERROR OPERATIVO", label: "Err. Op." },
                      { key: "HURTO", label: "Hurtos" },
                      ...(selectedSabana === "mass" ? [{ key: "ERROR CCTV", label: "Error CCTV" }] : [])
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setSelectedHallazgo(opt.key)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                          selectedHallazgo === opt.key
                            ? "bg-white text-slate-950 shadow-xs font-bold"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Row 3: Active Filters Badges Row (Saves space, highly professional) */}
              {(selectedTienda !== "TODAS" || selectedAlerta !== "TODAS" || selectedFecha !== "TODAS" || selectedStatusInvestigacion !== "TODOS" || selectedHallazgo !== "TODOS" || searchQuery !== "") && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Filtros Activos:</span>
                    
                    {searchQuery && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Búsqueda: "{searchQuery}"
                      </span>
                    )}

                    {selectedTienda !== "TODAS" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Tienda: {selectedTienda}
                      </span>
                    )}

                    {selectedAlerta !== "TODAS" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Alerta: {selectedAlerta}
                      </span>
                    )}

                    {selectedFecha !== "TODAS" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Fecha: {selectedFecha}
                      </span>
                    )}

                    {selectedStatusInvestigacion !== "TODOS" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Edo. Inv: {selectedStatusInvestigacion}
                      </span>
                    )}

                    {selectedHallazgo !== "TODOS" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium">
                        Hallazgo: {selectedHallazgo}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedTienda("TODAS");
                      setSelectedAlerta("TODAS");
                      setSelectedFecha("TODAS");
                      setSelectedStatusInvestigacion("TODOS");
                      setSelectedHallazgo("TODOS");
                    }}
                    className="text-xs font-bold text-slate-900 hover:text-slate-700 hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    Limpiar todos los filtros
                  </button>
                </div>
              )}

            </div>

            {/* Table Header & Scrollable Body */}
            <div className="overflow-x-auto relative max-h-[620px] flex-1">
              {isLoading && records.length === 0 ? (
                <div className="py-28 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-9 h-9 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-xs font-bold text-slate-800">Descargando base de datos SharePoint...</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm text-center leading-relaxed">
                    Sincronizando la última sabana de investigación desde el servidor institucional.
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
                        if (String(r["DNI"]) === String(dni)) {
                          const fecha = new Date(r["FECHA DETECCIÓN"] || "");
                          if (!isNaN(fecha.getTime()) && fecha >= sixMonthsAgo) {
                            count++;
                            const val = r["MONTO"] || r["ABORADO"] || "0";
                            sum += parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
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
                              : rec._isPendingChange 
                                ? "bg-amber-50/40 border-l-4 border-amber-400 hover:bg-amber-50/60" 
                                : "border-l-4 border-transparent"
                          }`}
                        >
                          {/* ID / Boleta */}
                          <td className="py-4 px-5 font-mono text-[11px] text-slate-900 group-hover:text-slate-950 font-bold">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{rec["N° BOLETA"]}</span>
                              {rec._isPendingChange && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black rounded-md uppercase tracking-wide shrink-0 shadow-2xs">
                                  Pendiente
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                              {rec["FECHA DETECCIÓN"] || ""}
                            </div>
                          </td>

                          {/* Tienda */}
                          <td className="py-4 px-4 overflow-hidden truncate">
                            <span className="font-bold text-slate-800 block truncate" title={rec["TIENDA"]}>
                              {rec["TIENDA"]}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              ID: {rec["ID TIENDA"] || "-"}
                            </span>
                            {rec["FORMATO"] && (
                              <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-200/60 rounded-md text-slate-600 uppercase tracking-wider font-mono">
                                {rec["FORMATO"]}
                              </span>
                            )}
                          </td>

                          {/* Colaborador */}
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

                          {/* Monto */}
                          <td className="py-4 px-4 text-right font-mono font-bold text-slate-950 text-xs sm:text-xs">
                            S/. {
                              (() => {
                                const val = rec["ABORADO"] || rec["MONTO"] || "0";
                                const num = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
                                return isNaN(num) ? "0.00" : num.toFixed(2);
                              })()
                            }
                          </td>

                          {/* Alerta */}
                          <td className="py-4 px-4 overflow-hidden truncate text-center">
                            <span className="inline-block text-[10px] font-mono px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 truncate text-center w-full" title={rec["ALERTA"]}>
                              {rec["ALERTA"]}
                            </span>
                            {rec["CANTIDAD ALERTA"] !== undefined && String(rec["CANTIDAD ALERTA"]).trim() !== "" && (
                              <div className="text-[9px] text-slate-400 font-mono mt-1 font-medium">
                                Cant: <strong className="text-slate-600">{rec["CANTIDAD ALERTA"]}</strong>
                              </div>
                            )}
                          </td>

                          {/* Hallazgo Badge */}
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-between">
                              <span className={`inline-block text-[10px] px-2.5 py-0.5 border rounded-full ${badgeClass}`}>
                                {displayHallazgo}
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pr-1" />
                            </div>
                          </td>
                          {/* Nuevas métricas */}
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

            {/* List Footer Count with Pagination */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 flex flex-col sm:flex-row gap-4 justify-between items-center font-medium">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <span className="font-semibold text-slate-600">
                  Mostrando <span className="text-slate-900 font-bold">{startItem}</span> - <span className="text-slate-900 font-bold">{endItem}</span> de <span className="text-slate-900 font-bold">{filteredRecords.length}</span> incidentes (Total: {records.length})
                </span>
                
                {/* Page Size Selector */}
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

              {/* Navigation Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all cursor-pointer"
                  title="Primera página"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all cursor-pointer flex items-center gap-1 px-2.5 text-xs font-bold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Ant.
                </button>
                
                {/* Compact Page Number Indicator */}
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200/60 font-mono">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all cursor-pointer flex items-center gap-1 px-2.5 text-xs font-bold"
                >
                  Sig.
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition-all cursor-pointer"
                  title="Última página"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Pending Changes Banner (placed directly below the table inside the left column) */}
          {selectedSabana === "fdc" && pendingChanges.length > 0 && (
            <div className="bg-amber-50/75 border border-amber-200/80 rounded-3xl p-6 shadow-[0_4px_20px_rgba(245,158,11,0.04)] animate-in fade-in slide-in-from-bottom-4 duration-300 w-full">
              <div className="flex flex-col md:flex-row items-center justify-between gap-5">
                <div className="flex items-start gap-4 text-left">
                  <div className="bg-amber-500 text-white p-3 rounded-2xl flex items-center justify-center shadow-sm shrink-0 mt-1">
                    <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-950 uppercase font-mono tracking-tight flex items-center gap-1.5">
                      <span>Tienes {pendingChanges.length} cambios pendientes por sincronizar</span>
                      <span className="animate-ping inline-flex h-2 w-2 rounded-full bg-amber-600"></span>
                    </h4>
                    <p className="text-xs text-amber-900/80 mt-1.5 leading-relaxed font-medium">
                      Los nuevos registros y actualizaciones han sido guardados temporalmente en la caché local para un funcionamiento rápido. Presiona <strong>Sincronizar Cambios</strong> para subirlos a la base de datos en un solo lote eficiente.
                    </p>
                    
                    {/* Collapsible details of pending changes */}
                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      {pendingChanges.map((change, idx) => (
                        <span key={`${change.boleta}-${change.timestamp}`} className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 bg-white border border-amber-200/60 text-amber-800 rounded-lg shadow-2xs">
                          <span className={`w-1.5 h-1.5 rounded-full ${change.type === "add" ? "bg-emerald-500 animate-pulse" : "bg-indigo-500"}`} />
                          <strong className="text-amber-950">{change.boleta}</strong>
                          <span className="text-amber-600 font-sans font-medium">({change.type === "add" ? "Nuevo" : "Editado"})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto shrink-0">
                  <button
                    onClick={() => {
                      setPendingChanges([]);
                      localStorage.removeItem("pending_changes_fdc");
                      window.location.replace(window.location.pathname);
                    }}
                    disabled={isBatchSyncing}
                    className="w-full sm:w-auto px-4.5 py-2.5 rounded-2xl text-xs font-bold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 transition-all cursor-pointer text-center disabled:opacity-50"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleBatchSync}
                    disabled={isBatchSyncing}
                    className="w-full sm:w-auto px-5.5 py-2.5 rounded-2xl text-xs font-black bg-amber-600 text-white hover:bg-amber-700 hover:shadow-[0_4px_12px_rgba(217,119,6,0.2)] transition-all cursor-pointer text-center flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 min-w-[170px]"
                  >
                    {isBatchSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Sincronizando...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4 text-white" />
                        <span>Sincronizar Cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          </div>

          {/* RIGHT: Detail Inspector and Editor (Only rendered if selectedRecord is active) */}
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

      {/* 3. Footer */}
      <footer className="mt-12 bg-white border-t border-slate-100 py-8 text-xs text-slate-400">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 flex flex-col items-center gap-5">
          
          {/* Help & Suggestion Banner */}
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
            Conectado de forma segura con Microsoft Graph mediante tokens institucionales de SPSA. 
            Todos los accesos son auditados bajo normativas de Seguridad de la Información.
          </p>
        </div>
      </footer>

      {/* 4. Diagnostics Overlay Modal */}
      <DiagnosticsModal
        status={status}
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        onRefresh={handleManualSync}
        isRefreshing={isRefreshing}
      />

      {/* 5. Add Case Overlay Modal */}
      <AddCaseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleCreateRecord}
        existingRecords={records}
      />

    </div>
  );
}
