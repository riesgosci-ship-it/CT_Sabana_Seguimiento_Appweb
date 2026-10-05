import React, { useState, useRef } from "react";
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  Table, 
  Sparkles, 
  RefreshCw,
  FileCheck,
  Building2,
  Info
} from "lucide-react";
import { CaseRecord } from "../types";
import { 
  downloadAlertsTemplate, 
  parseAlertsExcelFile, 
  ParsedAlertResult 
} from "../utils/excelAlerts";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBulkSave: (parsedResults: ParsedAlertResult[]) => Promise<{ success: boolean; count?: number; error?: string }>;
  existingRecords: CaseRecord[];
  selectedSabana: "mass" | "fdc" | "makro" | null;
  currentUserName: string;
}

export function BulkUploadModal({
  isOpen,
  onClose,
  onBulkSave,
  existingRecords,
  selectedSabana,
  currentUserName
}: BulkUploadModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadSuccessCount, setUploadSuccessCount] = useState<number | null>(null);
  const [previewRecords, setPreviewRecords] = useState<CaseRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const sabanaTitle = selectedSabana === "fdc" 
    ? "Sábana de Investigación CFR (Plaza Vea / Vivanda)" 
    : selectedSabana === "makro" 
    ? "Sábana de Investigación MAKRO" 
    : "Sábana de Investigación MASS";

  const formatTag = selectedSabana === "fdc"
    ? "CFR (PLAZA VEA / VIVANDA)"
    : selectedSabana === "makro"
    ? "MAKRO"
    : "MASS";

  const themeColorClass = selectedSabana === "fdc"
    ? "bg-indigo-600 text-indigo-600 border-indigo-600 shadow-indigo-600/20"
    : selectedSabana === "makro"
    ? "bg-sky-600 text-sky-600 border-sky-600 shadow-sky-600/20"
    : "bg-emerald-600 text-emerald-600 border-emerald-600 shadow-emerald-600/20";

  const themeBgBadge = selectedSabana === "fdc"
    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
    : selectedSabana === "makro"
    ? "bg-sky-50 text-sky-800 border-sky-200"
    : "bg-emerald-50 text-emerald-800 border-emerald-200";

  const handleDownloadTemplate = () => {
    try {
      downloadAlertsTemplate(selectedSabana, existingRecords);
    } catch (err: any) {
      setErrorMsg("Error al generar la plantilla Excel: " + (err.message || String(err)));
    }
  };

  // Immediate upload and process upon file selection
  const processFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    setProcessingStep("Leyendo archivo Excel...");
    setUploadSuccessCount(null);
    setPreviewRecords([]);

    try {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        throw new Error("El archivo seleccionado debe tener extensión .xlsx o .xls");
      }

      setProcessingStep("Interpretando y estructurando registros...");
      const parsedResults = await parseAlertsExcelFile(
        file,
        selectedSabana,
        currentUserName,
        existingRecords
      );

      setProcessingStep(`Guardando y añadiendo ${parsedResults.length} alertas a la base de datos...`);
      const saveRes = await onBulkSave(parsedResults);

      if (saveRes.success) {
        setUploadSuccessCount(saveRes.count ?? parsedResults.length);
        setPreviewRecords(parsedResults.map(p => p.record).slice(0, 8));
        setProcessingStep("");
      } else {
        throw new Error(saveRes.error || "Ocurrió un error al guardar los registros.");
      }
    } catch (err: any) {
      console.error("Error en carga masiva:", err);
      setErrorMsg(err.message || "Error al procesar el archivo Excel.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleResetForNewUpload = () => {
    setUploadSuccessCount(null);
    setPreviewRecords([]);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="bulk-upload-modal-container"
        className="bg-white rounded-3xl border border-slate-100 shadow-[0_25px_60px_rgba(0,0,0,0.25)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`p-2.5 rounded-2xl flex items-center justify-center text-white shadow-xs ${
              selectedSabana === "fdc" ? "bg-indigo-600" : selectedSabana === "makro" ? "bg-sky-600" : "bg-emerald-600"
            }`}>
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-950 uppercase font-mono tracking-tight flex items-center gap-2">
                <span>Carga Masiva de Alertas</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${themeBgBadge}`}>
                  {formatTag}
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs animate-in slide-in-from-top-2 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1">
                <span className="font-semibold">{errorMsg}</span>
                <p className="text-[11px] text-rose-600 mt-1">
                  Revise que el archivo sea un Excel válido (.xlsx o .xls). Recuerde que no se exige que todos los campos estén llenos.
                </p>
              </div>
            </div>
          )}

          {uploadSuccessCount !== null ? (
            /* Success Summary View */
            <div className="space-y-6 animate-in zoom-in-95 duration-200">
              <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base sm:text-lg font-bold text-emerald-950 font-mono">
                  ¡Carga Masiva Exitosa!
                </h4>
                <p className="text-xs text-emerald-800 max-w-md mx-auto">
                  Se añadieron correctamente <span className="font-bold text-emerald-950 text-sm font-mono">{uploadSuccessCount}</span> alertas manuales a la base de datos de {sabanaTitle}.
                </p>
              </div>

              {previewRecords.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-slate-400" />
                      Vista previa de alertas cargadas ({uploadSuccessCount} en total)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Mostrando primeras {previewRecords.length}</span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[9.5px] tracking-wider sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">Boleta</th>
                            <th className="py-2.5 px-3">Tienda</th>
                            <th className="py-2.5 px-3">Alerta</th>
                            <th className="py-2.5 px-3 text-right">Monto</th>
                            <th className="py-2.5 px-3">Colaborador</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                          {previewRecords.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 truncate max-w-[110px]">
                                {r["N° BOLETA"]}
                              </td>
                              <td className="py-2 px-3 truncate max-w-[130px]" title={r["TIENDA"]}>
                                {r["TIENDA"]}
                              </td>
                              <td className="py-2 px-3 truncate max-w-[120px]" title={r["ALERTA"]}>
                                {r["ALERTA"]}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                S/. {Number(r["ABORADO"] || 0).toFixed(2)}
                              </td>
                              <td className="py-2 px-3 truncate max-w-[130px]" title={r["COLABORADOR"] || "No especificado"}>
                                {r["COLABORADOR"] || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetForNewUpload}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Subir otro archivo</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                    selectedSabana === "fdc" 
                      ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20" 
                      : selectedSabana === "makro" 
                      ? "bg-sky-600 hover:bg-sky-700 shadow-sky-600/20" 
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cerrar y Ver Alertas en la Tabla</span>
                </button>
              </div>
            </div>
          ) : (
            /* Upload Steps View */
            <div className="space-y-6">
              {/* Step 1: Download Template */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                      Paso 1
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      Recomendado
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Descargar formato Excel (.xlsx) oficial
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed max-w-md">
                    Descargue la plantilla prediseñada con las columnas exactas de la sábana ({formatTag}). Complete los registros y adjúntela abajo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-100/80 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Descargar Plantilla .xlsx</span>
                  <Download className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                </button>
              </div>

              {/* Step 2: Upload Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                    Paso 2: Adjuntar archivo completado
                  </span>
                  <span className="text-[10.5px] text-slate-400 font-medium flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-400" /> Sin restricciones de subida
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="excel-file-upload-input"
                />

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3.5 select-none ${
                    isDragging
                      ? "border-emerald-500 bg-emerald-50/60 scale-[1.01]"
                      : isProcessing
                      ? "border-slate-200 bg-slate-50/60 cursor-not-allowed opacity-90"
                      : "border-slate-300 hover:border-slate-400 bg-slate-50/40 hover:bg-slate-50/80"
                  }`}
                >
                  {isProcessing ? (
                    <div className="space-y-3 py-4 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md animate-pulse">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-900 font-mono">
                          {processingStep || "Procesando archivo Excel..."}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Sincronizando de inmediato con la base de datos...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs ${
                        selectedSabana === "fdc" ? "bg-indigo-100 text-indigo-700" : selectedSabana === "makro" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        <UploadCloud className="w-7 h-7" />
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-900">
                          Arrastre su archivo Excel aquí o <span className="underline decoration-slate-400 underline-offset-2">haga clic para examinar</span>
                        </p>
                        <p className="text-[11px] text-slate-500 leading-normal max-w-sm mx-auto">
                          Apenas adjunte el archivo (.xlsx o .xls), se cargará, procesará y añadirá automáticamente a la sábana.
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/60 text-slate-600 text-[10px] font-bold font-mono">
                        <FileCheck className="w-3 h-3 text-slate-500" />
                        <span>Formatos admitidos: .xlsx, .xls</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Tips note */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 text-amber-900 text-[11px] flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Flexibilidad total:</span> No se restringe la subida si algunos campos no están completos. Si no especifica número de boleta, se creará un identificador automático; si omite la fecha, se asignará la fecha actual; y si deja hallazgos en blanco, el caso quedará como <span className="font-bold">PENDIENTE</span>.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            Plataforma Control Tower • SPSA
          </span>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer text-center disabled:opacity-50"
          >
            {uploadSuccessCount !== null ? "Listo" : "Cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}
