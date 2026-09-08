import React, { useState, useEffect } from "react";
import { CaseRecord } from "../types";
import { 
  X, Save, FileText, CheckCircle2, AlertCircle, User, 
  MapPin, Calendar, CreditCard, Shield, Banknote, HelpCircle,
  FileCheck, Sparkles, Building2, UserCheck, AlertOctagon, Undo2, WifiOff, Lock
} from "lucide-react";

interface CaseDetailsPanelProps {
  record: CaseRecord | null;
  onClose: () => void;
  onSave: (rowNum: number, boleta: string, hallazgos: string, comentarios: string, accDisciplinaria: string, cargoReal: string, cartaDescuento: string, contribucionTotalEstimada: string, cstvDetail: string, colaborador: string, dni: string, cargo: string, seccion: string) => Promise<{ success: boolean; error?: string }>;
  selectedSabana: "mass" | "fdc" | null;
}

function getFechaCierreValue(record: any): string {
  if (!record) return "";
  const keysToTry = [
    "FECHA DE CIERRE",
    "FECHA DE CIERRA",
    "FECHA CIERRE",
    "FECHA CIERRA",
    "CIERRE",
    "CIERRA",
  ];
  
  for (const key of keysToTry) {
    if (record[key] && String(record[key]).trim() !== "") {
      return String(record[key]).trim();
    }
  }

  // Fallback: search for keys containing CIERRE or CIERRA
  const recordKeys = Object.keys(record);
  for (const k of recordKeys) {
    const upperK = k.toUpperCase();
    if ((upperK.includes("CIERRE") || upperK.includes("CIERRA")) && upperK.includes("FECHA")) {
      const val = record[k];
      if (val && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
  }

  return "";
}

function getDisplayClosingDate(record: any): string {
  const dateStr = getFechaCierreValue(record);
  if (dateStr) {
    // If it's a date string like YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      try {
        const [year, month, day] = dateStr.split("-").map(Number);
        const dateObj = new Date(year, month - 1, day);
        return new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(dateObj);
      } catch (e) {
        return dateStr;
      }
    }
    return dateStr;
  }
  return "En proceso...";
}

export default function CaseDetailsPanel({
  record,
  onClose,
  onSave,
  selectedSabana,
}: CaseDetailsPanelProps) {
  const [hallazgos, setHallazgos] = useState<string>("");
  const [comentarios, setComentarios] = useState<string>("");
  const [cstvDetail, setCstvDetail] = useState<string>("");
  const [colaborador, setColaborador] = useState("");
  const [dni, setDni] = useState("");
  const [cargo, setCargo] = useState("");
  const [seccion, setSeccion] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync state when selected record changes
  useEffect(() => {
    if (record) {
      const rawHallazgo = record["HALLAZGOS"] || "";
      let norm = "";
      const cleaned = rawHallazgo.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      if (
        cleaned.includes("ROBO SISTEMATICO") || 
        cleaned === "ROBO" || 
        cleaned === "HURTO" || 
        cleaned.includes("HURTO")
      ) {
        norm = "HURTO";
      } else if (
        cleaned.includes("ERROR DE SISTEMA") || 
        cleaned.includes("ERROR OPERATIVO") ||
        cleaned === "ERROR"
      ) {
        norm = "ERROR OPERATIVO";
      } else if (
        cleaned.includes("NO ENLACE") || 
        cleaned.includes("NO ENLAZE") || 
        cleaned.includes("SIN ENLACE") || 
        cleaned.includes("SIN IP") ||
        cleaned.includes("CSTV") ||
        cleaned.includes("CCTV")
      ) {
        norm = "ERROR CSTV";
      } else if (cleaned === "CONFORME") {
        norm = "CONFORME";
      } else {
        norm = rawHallazgo;
      }

      setHallazgos(norm);
      setComentarios(record["Comentarios"] || "");
      setCstvDetail(record["COMENTARIOS ERROR CSTV"] || "");
      setColaborador(record["COLABORADOR"] || "");
      setDni(String(record["DNI"] || ""));
      setCargo(record["CARGO"] || "");
      setSeccion(record["SECCIÓN"] || "");
      setAccDisciplinaria(record["ACCIÓN DISCIPLINARIA"] || "");
      setCargoReal(record["CARGO REAL"] || "");
      setCartaDescuento(String(record["CARTA DESCUENTO"] || ""));
      setContribucionTotalEstimada(String(record["CONTRIBUCION TOTAL ESTIMADA"] || ""));
      setSaveSuccess(false);
      setSaveError(null);
    }
  }, [record]);

  const [accDisciplinaria, setAccDisciplinaria] = useState("");
  const [cargoReal, setCargoReal] = useState("");
  const [cartaDescuento, setCartaDescuento] = useState("");
  const [contribucionTotalEstimada, setContribucionTotalEstimada] = useState("");

  if (!record) {
    return (
      <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
        <div className="p-5 bg-slate-50/80 rounded-3xl mb-5 border border-slate-100 flex items-center justify-center text-slate-300">
          <FileCheck className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="font-semibold text-slate-800 text-base">Inspector de Incidentes</h3>
        <p className="text-xs text-slate-400 mt-2 max-w-[280px] leading-relaxed">
          Selecciona cualquier boleta o tienda de la lista para auditar los detalles del caso, registrar hallazgos y actualizar SharePoint.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    // Validation
    if (hallazgos === "ERROR CCTV" && !cstvDetail) {
      setSaveError("El detalle del Error CCTV es obligatorio.");
      setIsSaving(false);
      return;
    }

    try {
      // Need to include new fields in onSave!
      // But CaseDetailsPanel.tsx onSave prop is defined in the interface as:
      // onSave: (rowNum: number, boleta: string, hallazgos: string, comentarios: string) => Promise<{ success: boolean; error?: string }>;
      // This is a breaking change for the interface. I have to update it in App.tsx too.

      // Actually, I should update the onSave signature to be more flexible, but I will stick to the existing interface for now and pack everything in 'comentarios' if needed, or update the interface. 
      // Updating the interface is better.

      const result = await onSave(record._rowNum, record["N° BOLETA"], hallazgos, comentarios, accDisciplinaria, cargoReal, cartaDescuento, contribucionTotalEstimada, cstvDetail, colaborador, dni, cargo, seccion);
      if (result.success) {
        setSaveSuccess(true);
        // Hide success banner after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(result.error || "No se pudo conectar a SharePoint. El cambio quedó guardado localmente.");
      }
    } catch (err: any) {
      setSaveError(err.message || "Error de comunicación de red.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = hallazgos !== (record["HALLAZGOS"] || "") || comentarios !== (record["Comentarios"] || "") ||
    colaborador !== (record["COLABORADOR"] || "") || dni !== String(record["DNI"] || "") ||
    cargo !== (record["CARGO"] || "") || seccion !== (record["SECCIÓN"] || "") ||
    accDisciplinaria !== (record["ACCIÓN DISCIPLINARIA"] || "") ||
    cargoReal !== (record["CARGO REAL"] || "") ||
    cartaDescuento !== String(record["CARTA DESCUENTO"] || "") ||
    contribucionTotalEstimada !== String(record["CONTRIBUCION TOTAL ESTIMADA"] || "");
  const collaboratorFields: Array<{ label: string; value: string; setter: React.Dispatch<React.SetStateAction<string>> }> = [
    { label: "COLABORADOR", value: colaborador, setter: setColaborador },
    { label: "DNI", value: dni, setter: setDni },
    { label: "PUESTO", value: cargo, setter: setCargo },
    { label: "SECCIÓN", value: seccion, setter: setSeccion },
  ];

  return (
    <div className="h-full flex flex-col bg-white rounded-3xl border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.025)] overflow-hidden">
      {/* Detail Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
              AUDITORÍA ACTIVA
            </span>
            <span className="bg-slate-100 text-slate-700 text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold">
              Fila #{record._rowNum}
            </span>
          </div>
          <h3 className="font-bold text-slate-900 text-base font-mono mt-1 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-slate-500 shrink-0" />
            {record["N° BOLETA"]}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          title="Cerrar panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Detail Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
        
        {/* Alerts / Feedback Banners */}
        {saveSuccess && (
          selectedSabana === "fdc" ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs">
              <div className="bg-amber-500 text-white p-1 rounded-lg shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div className="leading-normal font-medium">
                <span className="font-bold text-amber-950 block">¡Diagnóstico Guardado Localmente!</span>
                El cambio se guardó en memoria. Recuerda presionar <strong>"Sincronizar Cambios"</strong> en la barra de arriba o abajo para subir todos tus cambios en lote.
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-xs flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs">
              <div className="bg-emerald-500 text-white p-1 rounded-lg shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold">¡Sincronizado con SharePoint!</span> El archivo Excel institucional se ha actualizado de inmediato.
              </div>
            </div>
          )
        )}

        {saveError && (
          <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-rose-500 text-white p-1 rounded-lg shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Error al Sincronizar:</span> {saveError}
              <div className="mt-1 text-[10px] text-rose-600 font-normal">
                La sabana de SharePoint no pudo actualizarse pero los datos están visibles localmente. Reintenta cuando haya conexión.
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <Sparkles className="w-4 h-4 text-slate-800" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Diagnóstico de Investigación
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {collaboratorFields.map(({ label, value, setter }) => (
              <label key={label} className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono">{label}</span>
                <input
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-900"
                />
              </label>
            ))}
          </div>

          {/* 1. HALLAZGOS SELECTOR - Premium Stacked Cards with descriptions */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Hallazgo de Auditoría</span>
              <span className="text-[10px] text-slate-400 font-normal">Afecta sabana SharePoint</span>
            </label>
            <div className="space-y-2">
              {[
                { 
                  value: "CONFORME", 
                  label: "Conforme", 
                  desc: "Transacción correcta sin discrepancias ni riesgos.",
                  icon: <CheckCircle2 className="w-4.5 h-4.5" />,
                  selectedBg: "border-emerald-500 bg-emerald-50/40 text-emerald-900",
                  selectedIconColor: "text-emerald-600",
                  selectedDot: "bg-emerald-500 border-emerald-500"
                },
                { 
                  value: "ERROR OPERATIVO", 
                  label: "Error Operativo", 
                  desc: "Fallo involuntario en procesos, registro o procedimiento.",
                  icon: <AlertCircle className="w-4.5 h-4.5" />,
                  selectedBg: "border-amber-500 bg-amber-50/40 text-amber-950",
                  selectedIconColor: "text-amber-600",
                  selectedDot: "bg-amber-500 border-amber-500"
                },
                { 
                  value: "HURTO", 
                  label: "Hurto", 
                  desc: "Sustracción patrimonial o pérdida confirmada.",
                  icon: <AlertOctagon className="w-4.5 h-4.5" />,
                  selectedBg: "border-rose-500 bg-rose-50/40 text-rose-950",
                  selectedIconColor: "text-rose-600",
                  selectedDot: "bg-rose-500 border-rose-500"
                },
                ...(selectedSabana === "mass" ? [{ 
                  value: "ERROR CCTV", 
                  label: "Error CCTV", 
                  desc: "Dispositivo sin enlace de red, comunicación IP desvinculada o error CCTV.",
                  icon: <WifiOff className="w-4.5 h-4.5" />,
                  selectedBg: "border-indigo-500 bg-indigo-50/40 text-indigo-950",
                  selectedIconColor: "text-indigo-600",
                  selectedDot: "bg-indigo-500 border-indigo-500"
                }] : [])
              ].map((opt) => {
                const isSelected = hallazgos === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setHallazgos(""); // Deselect!
                      } else {
                        setHallazgos(opt.value);
                      }
                    }}
                    className={`w-full text-left relative block cursor-pointer select-none rounded-2xl border transition-all shadow-xs focus:outline-none ${
                      isSelected ? opt.selectedBg : "border-slate-200 hover:bg-slate-50/50 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3.5 px-4 py-3.5">
                      {/* Circle Radio Indicator */}
                      <div className="mt-0.5 relative flex items-center justify-center w-4 h-4 rounded-full border border-slate-300 bg-white shrink-0">
                        <div className={`w-2 h-2 rounded-full transition-all ${
                          isSelected ? opt.selectedDot : "bg-transparent"
                        }`} />
                      </div>
                      {/* Content */}
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`shrink-0 ${
                            isSelected ? opt.selectedIconColor : "text-slate-400"
                          }`}>{opt.icon}</span>
                          <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-normal">{opt.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. COMENTARIOS TEXTAREA */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Observaciones e Investigación</span>
              <span className="text-[10px] text-slate-400 font-normal">{comentarios.length}/1000 caract.</span>
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Escribe un análisis detallado, justificación del hallazgo y cualquier evidencia o descargo del colaborador..."
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-3 text-xs text-slate-800 placeholder-slate-400 bg-slate-50/30 border border-slate-200 rounded-2xl focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all resize-none shadow-xs leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hallazgos === "ERROR CCTV" && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Detalle Error CCTV
                </label>
                <select
                  value={cstvDetail}
                  onChange={(e) => setCstvDetail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700"
                >
                  <option value="">Seleccione...</option>
                  <option value="Sin enlace">Sin enlace</option>
                  <option value="Sin visión">Sin visión</option>
                  <option value="Sin grabación">Sin grabación</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                Acción Disciplinaria
              </label>
              <select
                value={accDisciplinaria}
                onChange={(e) => setAccDisciplinaria(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700"
              >
                <option value="">Seleccione...</option>
                <option value="Ninguna">Ninguna</option>
                <option value="Cesado">Cesado</option>
                <option value="Suspendido/amonestado">Suspendido/amonestado</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                Cargo Real
              </label>
              <select
                value={cargoReal}
                onChange={(e) => setCargoReal(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700"
              >
                <option value="">Seleccione...</option>
                <option value="Administrador">Administrador</option>
                <option value="Operador">Operador</option>
                <option value="Encargado">Encargado</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                Carta Descuento
              </label>
              <input
                type="text"
                placeholder="Ej. 10.34"
                value={cartaDescuento}
                onChange={(e) => setCartaDescuento(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                Contribución Total Estimada
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 100.00"
                value={contribucionTotalEstimada}
                onChange={(e) => setContribucionTotalEstimada(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
              />
            </div>
          </div>

          {/* 3. FECHA DE CIERRE (READ-ONLY) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Fecha de Cierre (Automática)</span>
              <span className="text-[10px] text-slate-400 font-normal"></span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="text"
                readOnly
                value={getDisplayClosingDate(record)}
                className="w-full pl-10 pr-10 py-3 text-xs text-slate-500 bg-slate-50/30 border border-slate-200 rounded-2xl select-none font-medium cursor-not-allowed"
              />
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400" title="Este campo es de solo lectura y se establece automáticamente">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
          </div>

          {/* SAVE BUTTONS */}
          <div className="flex gap-2.5 pt-2 border-b border-slate-100 pb-5">
            <button
              type="submit"
              disabled={isSaving || !hasChanges}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl transition-all shadow-md cursor-pointer ${
                hasChanges && !isSaving ? "hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm" : ""
              }`}
            >
              {isSaving ? (
                selectedSabana === "fdc" ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando localmente...
                  </>
                ) : (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sincronizando SharePoint...
                  </>
                )
              ) : (
                selectedSabana === "fdc" ? (
                  hasChanges ? (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Guardar Cambio (Local)
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Guardado en Sesión
                    </>
                  )
                ) : (
                  hasChanges ? (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Sincronizar SharePoint
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Guardar
                    </>
                  )
                )
              )}
            </button>
            {hasChanges && (
              <button
                type="button"
                onClick={() => {
                  setHallazgos(record["HALLAZGOS"] || "");
                  setComentarios(record["Comentarios"] || "");
                  setContribucionTotalEstimada(String(record["CONTRIBUCION TOTAL ESTIMADA"] || ""));
                }}
                className="px-3.5 py-3 text-xs font-semibold text-slate-600 hover:text-slate-950 hover:bg-slate-50 border border-slate-200 rounded-2xl transition-all flex items-center gap-1 cursor-pointer"
                title="Descartar cambios no guardados"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Deshacer
              </button>
            )}
          </div>
        </form>

        {/* Read-only Metadata Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <FileText className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Metadatos del Incidente
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            
            {/* Tienda */}
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> TIENDA
              </span>
              <span className="font-bold text-slate-800 block">
                {record["TIENDA"] || "No especificada"}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                ID: {record["CARRION1"] || record["CARRION 1"] || record["CARRION_1"] || record["ID TIENDA"] || "-"}
              </span>
            </div>

            {/* Fecha Detección */}
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> DETECCIÓN
              </span>
              <span className="font-semibold text-slate-800 block font-mono">
                {record["FECHA DETECCIÓN"] || "Sin fecha"}
              </span>
              <span className="text-[10px] text-slate-400 block font-sans">
                Fecha del Suceso
              </span>
            </div>

            {/* Colaborador */}
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1.5 col-span-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" /> COLABORADOR IMPLICADO
              </span>
              <span className="font-bold text-slate-900 block leading-tight text-xs">
                {record["COLABORADOR"] || "No registrado"}
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-100/80">
                <span>DNI: <strong className="text-slate-700">{record["DNI"] || "-"}</strong></span>
                <span>•</span>
                <span>Puesto: <strong className="text-slate-700">{record["CARGO"] || "-"}</strong></span>
                <span>•</span>
                <span>Sección: <strong className="text-slate-700">{record["SECCIÓN"] || "-"}</strong></span>
              </div>
            </div>

            {/* Alerta */}
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                <Shield className="w-3.5 h-3.5 text-slate-400" /> ALERTA
              </span>
              <span className="inline-block text-[10px] font-mono bg-white border border-slate-200/80 rounded-lg px-2 py-0.5 text-slate-700 font-bold">
                {record["ALERTA"] || "General"}
              </span>
            </div>

            {/* Formato */}
            {record["FORMATO"] && (
              <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> FORMATO
                </span>
                <span className="font-semibold text-slate-800 block uppercase font-mono text-[10px] bg-slate-100/80 px-2 py-0.5 rounded-lg border border-slate-200/50 inline-block">
                  {record["FORMATO"]}
                </span>
              </div>
            )}

            {/* Cantidad Alerta */}
            {record["CANTIDAD ALERTA"] !== undefined && String(record["CANTIDAD ALERTA"]).trim() !== "" && (
              <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                  <Shield className="w-3.5 h-3.5 text-slate-400" /> CANT. ALERTA
                </span>
                <span className="font-mono font-bold text-slate-900 block text-xs">
                  {record["CANTIDAD ALERTA"]}
                </span>
              </div>
            )}

            {/* Abordado */}
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                <Banknote className="w-3.5 h-3.5 text-slate-400" /> ABORDADO
              </span>
              <span className="font-mono font-bold text-slate-900 block text-sm">
                S/. {typeof record["ABORADO"] === 'number' 
                  ? record["ABORADO"].toFixed(2) 
                  : (parseFloat(String(record["ABORADO"])) || 0).toFixed(2)
                }
              </span>
            </div>

            {/* Status Investigación */}
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> ESTADO INVEST.
              </span>
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border font-mono uppercase ${
                record["STATUS INVESTIGACIÓN"]?.toUpperCase() === "CERRADO"
                  ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                  : "bg-amber-50 border-amber-100 text-amber-700"
              }`}>
                {record["STATUS INVESTIGACIÓN"] || "PENDIENTE"}
              </span>
            </div>

            {/* Fecha Cierre */}
            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> FECHA CIERRE
              </span>
              <span className="font-mono text-slate-700 block">
                {getFechaCierreValue(record) || "En proceso..."}
              </span>
            </div>

            {/* Usuario / Investigador de Actualización */}
            {(record["USUARIO"] || record["INVESTIGADOR"]) && (
              <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-1 col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                  <User className="w-3.5 h-3.5 text-slate-400" /> INVESTIGADOR
                </span>
                <span className="font-semibold text-slate-800 block text-xs">
                  {record["USUARIO"] || record["INVESTIGADOR"]}
                </span>
              </div>
            )}

            {/* Descripción del Evento */}
            <div className="space-y-1.5 col-span-2 pt-3 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                SINOPSIS / HECHOS DETECTADOS
              </span>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/60 p-3.5 rounded-2xl border border-slate-100/80 font-mono text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                {record["DESCRIPCIÓN DEL EVENTO"] || "Ningún hecho o sinopsis redactada para este caso."}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
