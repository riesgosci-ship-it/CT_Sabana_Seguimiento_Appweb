import React, { useState, useMemo } from "react";
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
  Loader2 
} from "lucide-react";
import { CaseRecord } from "../types";

interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newRecordData: Partial<CaseRecord>) => Promise<{ success: boolean; error?: string }>;
  existingRecords: CaseRecord[];
}

export function AddCaseModal({ isOpen, onClose, onSave, existingRecords }: AddCaseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [boleta, setBoleta] = useState("");
  const [idTienda, setIdTienda] = useState("");
  const [tienda, setTienda] = useState("");
  const [formato, setFormato] = useState("MASS");
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
  const [comentarios, setComentarios] = useState("");

  // Auto-complete dictionary of existing Tiendas
  const uniqueTiendasMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    existingRecords.forEach(r => {
      const tName = r["TIENDA"];
      const tId = r["ID TIENDA"];
      if (tName && tId) {
        map.set(tName.trim().toUpperCase(), { 
          id: String(tId).trim(), 
          name: tName.trim() 
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanedBoleta = boleta.trim();
    if (!cleanedBoleta) {
      setErrorMsg("El N° de Boleta es obligatorio.");
      return;
    }

    if (!tienda.trim()) {
      setErrorMsg("La Tienda es obligatoria.");
      return;
    }

    setIsSubmitting(true);

    // Validation
    if ((hallazgos === "ERROR OPERATIVO" || hallazgos === "HURTO")) {
      if (accDisciplinaria === "Ninguna") {
        setErrorMsg("La Acción Disciplinaria es obligatoria para este hallazgo.");
        return;
      }
      if (!cargoReal) {
        setErrorMsg("El Cargo Real es obligatorio para este hallazgo.");
        return;
      }
      if (!cartaDescuento.trim()) {
        setErrorMsg("La Carta Descuento es obligatoria para este hallazgo.");
        return;
      }
    }
    
    if (hallazgos === "ERROR CSTV" && !cstvDetail) {
      setErrorMsg("El detalle del Error CSTV es obligatorio.");
      return;
    }

    const newRecordData: Partial<CaseRecord> = {
      "N° BOLETA": cleanedBoleta,
      "ID TIENDA": idTienda.trim() || undefined,
      "TIENDA": tienda.trim(),
      "FORMATO": formato.trim(),
      "ALERTA": alerta.trim() || "Frente de Seguridad FDC",
      "CANTIDAD ALERTA": cantidadAlerta.trim() !== "" ? Number(cantidadAlerta) || 1 : 1,
      "ABORADO": importeAbordado.trim() !== "" ? Number(importeAbordado) || 0 : 0,
      "COLABORADOR": colaborador.trim() || undefined,
      "DNI": dni.trim() || undefined,
      "CARGO": cargo.trim() || undefined,
      "SECCIÓN": seccion.trim() || undefined,
      "DESCRIPCIÓN DEL EVENTO": descripcion.trim() || undefined,
      "STATUS INVESTIGACIÓN": hallazgos === "PENDIENTE" ? "EN PROCESO" : "CERRADO",
      "HALLAZGOS": hallazgos,
      "ACCIÓN DISCIPLINARIA": accDisciplinaria,
      "CARGO REAL": cargoReal,
      "CARTA DESCUENTO": cartaDescuento.trim() !== "" ? Number(cartaDescuento) : undefined,
      "Comentarios": comentarios.trim() || undefined,
      "COMENTARIOS ERROR CSTV": hallazgos === "ERROR CSTV" ? cstvDetail : undefined,
    };

    try {
      const res = await onSave(newRecordData);
      if (res.success) {
        // Reset and close
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
        setComentarios("");
        onClose();
      } else {
        setErrorMsg(res.error || "Ocurrió un error al guardar el registro.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error de conexión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="add-case-modal-container"
        className="bg-white rounded-3xl border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-white p-2.5 rounded-2xl flex items-center justify-center shadow-xs">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950 uppercase font-mono tracking-tight">
                Agregar Nuevo Registro
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Sábana de Investigación FDC Seguridad
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs animate-in slide-in-from-top-2 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Alerta & Boleta */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" /> 1. Datos Identificatorios de la Alerta
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  N° Boleta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. BK92-00123456"
                  value={boleta}
                  onChange={(e) => setBoleta(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Tipo Alerta
                </label>
                <input
                  type="text"
                  placeholder="Ej. Alerta DIN04"
                  value={alerta}
                  onChange={(e) => setAlerta(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Cantidad Alerta
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ej. 1"
                  value={cantidadAlerta}
                  onChange={(e) => setCantidadAlerta(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Tienda & Formato */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" /> 2. Ubicación & Formato
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Seleccionar Tienda Existente
                </label>
                <select
                  onChange={handleTiendaSelect}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700 font-medium"
                >
                  <option value="">-- Autocompletar con Tienda --</option>
                  {uniqueTiendasList.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} (ID: {t.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Nombre Tienda *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Massaro 2 CHI MS"
                  value={tienda}
                  onChange={(e) => setTienda(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  ID Tienda
                </label>
                <input
                  type="text"
                  placeholder="Ej. 1462"
                  value={idTienda}
                  onChange={(e) => setIdTienda(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Formato
                </label>
                <select
                  value={formato}
                  onChange={(e) => setFormato(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700"
                >
                  <option value="MASS">MASS</option>
                  <option value="PLAZA VEA">PLAZA VEA</option>
                  <option value="VIVANDA">VIVANDA</option>
                  <option value="MAKRO">MAKRO</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Importe Abordado (S/.)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">S/.</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={importeAbordado}
                    onChange={(e) => setImporteAbordado(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
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
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  placeholder="Nombre del Colaborador"
                  value={colaborador}
                  onChange={(e) => setColaborador(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  DNI / Documento Identidad
                </label>
                <input
                  type="text"
                  placeholder="Número de DNI"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Cargo / Puesto
                </label>
                <input
                  type="text"
                  placeholder="Ej. Cajero"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Sección / Área
                </label>
                <input
                  type="text"
                  placeholder="Ej. Cajas"
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
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                Descripción del Evento / Alerta
              </label>
              <textarea
                rows={3}
                placeholder="Escriba los detalles del incidente detectado..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Resultado / Hallazgo
                </label>
                <select
                  value={hallazgos}
                  onChange={(e) => setHallazgos(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white text-slate-700"
                >
                  <option value="PENDIENTE">PENDIENTE (Caso en proceso)</option>
                  <option value="CONFORME">CONFORME (Sin hallazgo irregular)</option>
                  <option value="ERROR OPERATIVO">ERROR OPERATIVO</option>
                  <option value="HURTO">HURTO</option>
                  <option value="ERROR CSTV">ERROR CSTV</option>
                </select>
              </div>

              {hallazgos === "ERROR CSTV" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                    Detalle Error CSTV
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
                  type="number"
                  step="0.01"
                  placeholder="Ej. 10.34"
                  value={cartaDescuento}
                  onChange={(e) => setCartaDescuento(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 font-mono">
                  Comentarios Finales de Investigación
                </label>
                <textarea
                  rows={2}
                  placeholder="Conclusiones o comentarios del cierre..."
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white resize-none"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer text-center disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all cursor-pointer text-center flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Crear Registro</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
