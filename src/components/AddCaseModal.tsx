import React, { useState, useMemo, useEffect } from "react";
import { 
  X, 
  Plus, 
  FileSpreadsheet, 
  Building2, 
  User, 
  Shield, 
  AlertCircle, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { CaseRecord } from "../types";

interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newRecordData: Partial<CaseRecord>) => Promise<{ success: boolean; error?: string }>;
  existingRecords: CaseRecord[];
  selectedSabana?: "mass" | "fdc" | "makro" | null;
  onOpenBulkUpload?: () => void;
}

// Helper to get Peru timezone today's date in YYYY-MM-DD
function getPeruToday(): string {
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

export function AddCaseModal({ isOpen, onClose, onSave, existingRecords, selectedSabana, onOpenBulkUpload }: AddCaseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Determine initial formato based on active sábana
  const defaultFormato = useMemo(() => {
    if (selectedSabana === "makro") return "MAKRO";
    if (selectedSabana === "fdc") return "PLAZA VEA";
    return "MASS";
  }, [selectedSabana]);

  // Form Fields
  const [boleta, setBoleta] = useState("");
  const [fechaDeteccion, setFechaDeteccion] = useState(getPeruToday());
  const [idTienda, setIdTienda] = useState("");
  const [tienda, setTienda] = useState("");
  const [formato, setFormato] = useState(defaultFormato);
  const [alerta, setAlerta] = useState("");
  const [cantidadAlerta, setCantidadAlerta] = useState("1");
  const [importeAbordado, setImporteAbordado] = useState("");
  const [colaborador, setColaborador] = useState("");
  const [dni, setDni] = useState("");
  const [cargo, setCargo] = useState("");
  const [seccion, setSeccion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [hallazgos, setHallazgos] = useState("PENDIENTE");
  const [cstvDetail, setCstvDetail] = useState("");
  const [accDisciplinaria, setAccDisciplinaria] = useState("Ninguna");
  const [cargoReal, setCargoReal] = useState("Administrador");
  const [cartaDescuento, setCartaDescuento] = useState("");
  const [contribucionTotalEstimada, setContribucionTotalEstimada] = useState("");
  const [comentarios, setComentarios] = useState("");

  // Reset/sync form when opening or changing sábana
  useEffect(() => {
    if (isOpen) {
      setFormato(defaultFormato);
      setFechaDeteccion(getPeruToday());
      setErrorMsg(null);
    }
  }, [isOpen, defaultFormato]);

  // Auto-complete dictionary of existing Tiendas
  const uniqueTiendasMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    existingRecords.forEach(r => {
      const tName = r["TIENDA"];
      const tId = r["ID TIENDA"] || r["CARRION 1"] || r["CARRION1"];
      if (tName) {
        const key = tName.trim().toUpperCase();
        if (!map.has(key)) {
          map.set(key, { 
            id: tId ? String(tId).trim() : "", 
            name: tName.trim() 
          });
        }
      }
    });
    return map;
  }, [existingRecords]);

  const uniqueTiendasList = useMemo(() => {
    const list = Array.from(uniqueTiendasMap.values()) as Array<{ id: string; name: string }>;
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [uniqueTiendasMap]);

  if (!isOpen) return null;

  const handleTiendaSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    if (!selectedName) {
      setTienda("");
      setIdTienda("");
      return;
    }
    const matched = uniqueTiendasMap.get(selectedName.toUpperCase());
    if (matched) {
      setTienda(matched.name);
      setIdTienda(matched.id);
    } else {
      setTienda(selectedName);
    }
  };

  const handleAlertaPreset = (preset: string) => {
    setAlerta(preset);
  };

  const sabanaTitle = selectedSabana === "fdc" 
    ? "Sábana de Investigación CFR (Plaza Vea / Vivanda)" 
    : selectedSabana === "makro" 
    ? "Sábana de Investigación MAKRO" 
    : "Sábana de Investigación MASS";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanedBoleta = boleta.trim();
    if (!cleanedBoleta) {
      setErrorMsg("El N° de Boleta / Identificador es obligatorio.");
      return;
    }

    if (!tienda.trim()) {
      setErrorMsg("La Tienda es obligatoria.");
      return;
    }

    // Validation for findings
    if ((hallazgos === "ERROR OPERATIVO" || hallazgos === "HURTO")) {
      if (accDisciplinaria === "Ninguna") {
        setErrorMsg("La Acción Disciplinaria es obligatoria cuando se registra Hurto o Error Operativo.");
        return;
      }
      if (!cargoReal) {
        setErrorMsg("El Cargo Real es obligatorio para este hallazgo.");
        return;
      }
    }
    
    if (hallazgos === "ERROR CSTV" && !cstvDetail) {
      setErrorMsg("El detalle del Error CSTV es obligatorio.");
      return;
    }

    setIsSubmitting(true);

    const newRecordData: Partial<CaseRecord> = {
      "N° BOLETA": cleanedBoleta,
      "ID TIENDA": idTienda.trim() || undefined,
      "CARRION 1": idTienda.trim() || undefined,
      "TIENDA": tienda.trim(),
      "FORMATO": formato.trim(),
      "FECHA DETECCIÓN": fechaDeteccion.trim() || getPeruToday(),
      "ALERTA": alerta.trim() || (selectedSabana === "fdc" ? "Frente de Seguridad FDC" : selectedSabana === "makro" ? "Alerta MAKRO" : "Alerta DIN55"),
      "CANTIDAD ALERTA": cantidadAlerta.trim() !== "" ? Number(cantidadAlerta) || 1 : 1,
      "ABORADO": importeAbordado.trim() !== "" ? Number(importeAbordado) || 0 : 0,
      "MONTO": importeAbordado.trim() !== "" ? Number(importeAbordado) || 0 : 0,
      "COLABORADOR": colaborador.trim() || undefined,
      "DNI": dni.trim() || undefined,
      "CARGO": cargo.trim() || undefined,
      "SECCIÓN": seccion.trim() || undefined,
      "DESCRIPCIÓN DEL EVENTO": descripcion.trim() || undefined,
      "STATUS INVESTIGACIÓN": (hallazgos === "PENDIENTE" || !hallazgos) ? "ABIERTO" : "CERRADO",
      "HALLAZGOS": hallazgos === "PENDIENTE" ? "" : hallazgos,
      "ACCIÓN DISCIPLINARIA": accDisciplinaria !== "Ninguna" ? accDisciplinaria : undefined,
      "CARGO REAL": cargoReal || undefined,
      "CARTA DESCUENTO": cartaDescuento.trim() !== "" ? Number(cartaDescuento) : undefined,
      "CONTRIBUCION TOTAL ESTIMADA": contribucionTotalEstimada.trim() !== "" ? Number(contribucionTotalEstimada) : undefined,
      "Comentarios": comentarios.trim() || undefined,
      "COMENTARIOS ERROR CSTV": hallazgos === "ERROR CSTV" ? cstvDetail : undefined,
    };

    try {
      const res = await onSave(newRecordData);
      if (res.success) {
        // Reset fields
        setBoleta("");
        setIdTienda("");
        setTienda("");
        setAlerta("");
        setCantidadAlerta("1");
        setImporteAbordado("");
        setColaborador("");
        setDni("");
        setCargo("");
        setSeccion("");
        setDescripcion("");
        setHallazgos("PENDIENTE");
        setCstvDetail("");
        setAccDisciplinaria("Ninguna");
        setCargoReal("Administrador");
        setCartaDescuento("");
        setContribucionTotalEstimada("");
        setComentarios("");
        onClose();
      } else {
        setErrorMsg(res.error || "Ocurrió un error al guardar el nuevo registro.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error de conexión con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="add-case-modal-container"
        className="bg-white rounded-3xl border border-slate-100 shadow-[0_25px_60px_rgba(0,0,0,0.25)] w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`p-2.5 rounded-2xl flex items-center justify-center text-white shadow-xs ${
              selectedSabana === "fdc" ? "bg-indigo-600" : selectedSabana === "makro" ? "bg-sky-600" : "bg-emerald-600"
            }`}>
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-950 uppercase font-mono tracking-tight flex items-center gap-2">
                <span>Registrar Nueva Alerta / Caso</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                  Manual
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                {sabanaTitle}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200/60 rounded-xl transition-all text-slate-400 hover:text-slate-700 cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs animate-in slide-in-from-top-2 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {onOpenBulkUpload && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    ¿Deseas registrar múltiples alertas a la vez?
                  </p>
                  <p className="text-[10.5px] text-slate-500">
                    Descarga el formato Excel (.xlsx) y sube todos tus registros de forma masiva.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBulkUpload();
                }}
                className="w-full sm:w-auto px-3.5 py-1.5 text-xs font-bold bg-white text-emerald-800 border border-emerald-300 rounded-xl hover:bg-emerald-50 transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center gap-1.5"
              >
                <span>Carga Masiva Excel</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section 1: Alerta & Boleta & Fecha */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" /> 1. Datos Identificatorios de la Alerta
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  N° Boleta / Identificador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. BK92-00123456 o ALT-001"
                  value={boleta}
                  onChange={(e) => setBoleta(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Fecha Detección *
                </label>
                <input
                  type="date"
                  required
                  value={fechaDeteccion}
                  onChange={(e) => setFechaDeteccion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Cantidad de Alertas
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={cantidadAlerta}
                  onChange={(e) => setCantidadAlerta(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono">
                Tipo / Nombre de Alerta
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej. Alerta DIN55, Frente de Seguridad FDC, Alerta Manual, etc."
                  value={alerta}
                  onChange={(e) => setAlerta(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-medium">Sugerencias rápidas:</span>
                {["Alerta DIN55", "Alerta DIN04", "Frente de Seguridad FDC", "Alerta Manual Fraude", "Diferencia de Cajas"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAlertaPreset(preset)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200/60"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Tienda & Formato */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" /> 2. Ubicación & Formato Comercial
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Autocompletar Tienda
                </label>
                <select
                  onChange={handleTiendaSelect}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700 font-medium"
                >
                  <option value="">-- Seleccionar de la lista --</option>
                  {uniqueTiendasList.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} {t.id ? `(ID: ${t.id})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Nombre Tienda *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Massaro 2 CHI MS, PV Centro, etc."
                  value={tienda}
                  onChange={(e) => setTienda(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  ID Tienda / Carrión 1
                </label>
                <input
                  type="text"
                  placeholder="Ej. 1462"
                  value={idTienda}
                  onChange={(e) => setIdTienda(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Formato Comercial
                </label>
                <select
                  value={formato}
                  onChange={(e) => setFormato(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-800 font-bold"
                >
                  <option value="MASS">MASS</option>
                  <option value="PLAZA VEA">PLAZA VEA</option>
                  <option value="VIVANDA">VIVANDA</option>
                  <option value="MAKRO">MAKRO</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Importe Abordado / Monto (S/.)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono font-bold">S/.</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={importeAbordado}
                    onChange={(e) => setImporteAbordado(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Colaborador */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" /> 3. Información del Colaborador Implicado
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  placeholder="Apellidos y Nombres del Colaborador"
                  value={colaborador}
                  onChange={(e) => setColaborador(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  DNI / Documento Identidad
                </label>
                <input
                  type="text"
                  placeholder="Número de DNI (8 dígitos)"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Cargo / Puesto Asignado
                </label>
                <input
                  type="text"
                  placeholder="Ej. Cajero, Operador de Tienda, Administrador, etc."
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Sección / Área
                </label>
                <input
                  type="text"
                  placeholder="Ej. Cajas, Perecibles, Abarrotes, etc."
                  value={seccion}
                  onChange={(e) => setSeccion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Detalle & Resolución */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-400" /> 4. Detalles del Evento, Hallazgos & Resolución
            </h4>
            
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                Descripción del Evento / Alerta
              </label>
              <textarea
                rows={2}
                placeholder="Describa el motivo o anomalía detectada en la alerta..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Estado / Resultado Hallazgo
                </label>
                <select
                  value={hallazgos}
                  onChange={(e) => setHallazgos(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-800 font-bold"
                >
                  <option value="PENDIENTE">PENDIENTE (Caso Abierto)</option>
                  <option value="CONFORME">CONFORME (Sin anomalía irregular)</option>
                  <option value="ERROR OPERATIVO">ERROR OPERATIVO</option>
                  <option value="HURTO">HURTO</option>
                  <option value="ERROR CSTV">ERROR CCTV</option>
                </select>
              </div>

              {hallazgos === "ERROR CSTV" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                    Detalle Error CCTV
                  </label>
                  <select
                    value={cstvDetail}
                    onChange={(e) => setCstvDetail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700"
                  >
                    <option value="">Seleccione motivo...</option>
                    <option value="Sin enlace">Sin enlace</option>
                    <option value="Sin visión">Sin visión</option>
                    <option value="Sin grabación">Sin grabación</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Acción Disciplinaria
                </label>
                <select
                  value={accDisciplinaria}
                  onChange={(e) => setAccDisciplinaria(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700"
                >
                  <option value="Ninguna">Ninguna</option>
                  <option value="Cesado">Cesado</option>
                  <option value="Suspendido/amonestado">Suspendido/amonestado</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Cargo Real
                </label>
                <select
                  value={cargoReal}
                  onChange={(e) => setCargoReal(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700"
                >
                  <option value="Administrador">Administrador</option>
                  <option value="Operador">Operador</option>
                  <option value="Encargado">Encargado</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Carta Descuento (S/.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 10.34"
                  value={cartaDescuento}
                  onChange={(e) => setCartaDescuento(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                  Contribución Total Estimada (S/.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 150.00"
                  value={contribucionTotalEstimada}
                  onChange={(e) => setContribucionTotalEstimada(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">
                Comentarios Finales de Investigación
              </label>
              <textarea
                rows={2}
                placeholder="Conclusiones o comentarios del cierre de la alerta..."
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/70 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer text-center disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs font-bold text-white transition-all cursor-pointer text-center flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${
              selectedSabana === "fdc" 
                ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20" 
                : selectedSabana === "makro" 
                ? "bg-sky-600 hover:bg-sky-700 shadow-sky-600/20" 
                : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando en BD...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Crear y Registrar Alerta</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
