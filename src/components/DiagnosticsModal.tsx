import { X, RefreshCw, Server, AlertTriangle, ShieldCheck, Terminal, Copy, Check } from "lucide-react";
import { useState } from "react";
import { SharePointStatus } from "../types";

interface DiagnosticsModalProps {
  status: SharePointStatus;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export default function DiagnosticsModal({
  status,
  isOpen,
  onClose,
  onRefresh,
  isRefreshing,
}: DiagnosticsModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyLogs = () => {
    navigator.clipboard.writeText(status.logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="diagnostics-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-all duration-300">
      <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl shadow-xs ${status.connected ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Server className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-950 text-base leading-none font-mono uppercase tracking-tight">
                Estado del Servidor
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 font-sans">
                Conectividad y registros técnicos con SharePoint API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1">
          
          {/* Status Indicator Panel */}
          <div className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${
            status.connected 
              ? 'bg-emerald-50/30 border-emerald-100 text-emerald-950' 
              : 'bg-amber-50/30 border-amber-100 text-amber-950'
          }`}>
            <div className="mt-0.5 shrink-0">
              {status.connected ? (
                <div className="bg-emerald-500 text-white p-1 rounded-full">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              ) : (
                <div className="bg-amber-500 text-white p-1 rounded-full">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="space-y-1.5 flex-1">
              <h4 className="font-bold text-sm font-sans tracking-tight">
                {status.connected 
                  ? "Sincronización en Tiempo Real Activa" 
                  : "Modo de Datos Locales / Simulación"}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                {status.connected
                  ? "La plataforma está sincronizada directamente con la cuenta riesgos.ci@spsa.pe. Cada actualización realizada en Hallazgos o Comentarios de esta web se replica de manera inmediata en la hoja Excel alojada en SharePoint."
                  : "No fue posible entablar una comunicación segura por tokens con SharePoint en este momento. La plataforma inició en modo de redundancia local simulada: puedes auditar, editar y probar la interfaz con total normalidad; los datos se conservarán localmente en la sesión activa."}
              </p>
              {status.error && (
                <div className="mt-3 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-mono break-all max-h-28 overflow-y-auto">
                  <strong className="text-rose-800 uppercase tracking-wider text-[10px] block mb-1">Detalle del error técnico:</strong> 
                  {status.error}
                </div>
              )}
            </div>
          </div>

          {/* Configuration Summary */}
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Configuración de Autenticación
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/60 p-4 rounded-2xl border border-slate-100 font-mono">
              <div className="space-y-0.5">
                <span className="text-slate-400 text-[10px] uppercase block">Usuario Activo</span>
                <span className="text-slate-900 font-bold break-all">riesgos.ci@spsa.pe</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-400 text-[10px] uppercase block">Client ID (Graph)</span>
                <span className="text-slate-900 break-all font-bold">eab2f548...7d91</span>
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-slate-100/60 space-y-0.5">
                <span className="text-slate-400 text-[10px] uppercase block">Servidor SharePoint</span>
                <span className="text-slate-700 break-all block truncate text-[11px]" title="https://intercorpretail.sharepoint.com/sites/CONTROLTOWER-DINERO">
                  https://intercorpretail.sharepoint.com/sites/CONTROLTOWER-DINERO
                </span>
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-slate-100/60 space-y-0.5">
                <span className="text-slate-400 text-[10px] uppercase block">Archivo de Datos Relativo</span>
                <span className="text-slate-700 break-all block text-[11px]" title="/Documentos compartidos/Control Tower Mass/Sabana de Investigación Mass ISEG.xlsx">
                  /Documentos compartidos/Control Tower Mass/Sabana de Investigación Mass ISEG.xlsx
                </span>
              </div>
            </div>
          </div>

          {/* Connection Logs */}
          <div className="space-y-2 flex flex-col">
            <div className="flex items-center justify-between">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                <Terminal className="w-3.5 h-3.5 text-slate-400" /> Registro de Eventos (Logs)
              </h5>
              <button
                onClick={copyLogs}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 px-3 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar registro"}
              </button>
            </div>
            <div className="bg-slate-950 text-slate-300 font-mono text-[11px] p-5 rounded-2xl overflow-y-auto max-h-56 border border-slate-800 space-y-1.5 leading-relaxed shadow-inner">
              {status.logs.length === 0 ? (
                <span className="text-slate-500 italic block py-2">Ningún evento registrado en esta sesión.</span>
              ) : (
                status.logs.map((log, idx) => {
                  let colorClass = "text-slate-300";
                  if (log.includes("Error") || log.includes("Fallo")) colorClass = "text-rose-400 font-bold";
                  if (log.includes("exitoso") || log.includes("Éxito") || log.includes("con éxito")) colorClass = "text-emerald-400 font-bold";
                  if (log.includes("Iniciando") || log.includes("Buscando") || log.includes("Solicitando")) colorClass = "text-sky-400";
                  return (
                    <div key={`${idx}-${log}`} className={`${colorClass} break-all hover:bg-slate-900/40 px-1 py-0.5 rounded transition-colors`}>
                      <span className="text-slate-600 select-none mr-2">[{idx + 1}]</span>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            Último Intento: <span className="text-slate-600 font-bold">{status.lastAttempt ? new Date(status.lastAttempt).toLocaleTimeString() : 'Ninguno'}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-850 disabled:opacity-50 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Probar Conexión
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
