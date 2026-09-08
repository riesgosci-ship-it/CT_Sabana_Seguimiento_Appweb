export interface CaseRecord {
  _rowNum: number;
  "ID TIENDA"?: number | string;
  "TIENDA"?: string;
  "CARRION1"?: string;
  "CARRION 1"?: string;
  "CARRION_1"?: string;
  "FECHA DETECCIÓN"?: string;
  "FECHA DE CIERRE"?: string;
  "ALERTA"?: string;
  "ABORADO"?: number | string;
  "DESCRIPCIÓN DEL EVENTO"?: string;
  "STATUS INVESTIGACIÓN"?: string;
  "HALLAZGOS"?: string;
  "Comentarios"?: string;
  "COLABORADOR"?: string;
  "DNI"?: string | number;
  "CARGO"?: string;
  "SECCIÓN"?: string;
  "N° BOLETA": string;
  "USUARIO"?: string;
  "INVESTIGADOR"?: string;
  "FORMATO"?: string;
  "CANTIDAD ALERTA"?: number | string;
  "ACCIÓN DISCIPLINARIA"?: string;
  "CARGO REAL"?: string;
  "CARTA DESCUENTO"?: number | string;
  "COMENTARIOS ERROR CSTV"?: string;
  "MONTO"?: number | string;
  "N° TOTAL DE ALERTAS (6 meses)"?: number;
  "PÉRDIDA ESTIMADA ACUM. (6 meses)"?: number;
  "CONTRIBUCION TOTAL ESTIMADA"?: number | string;
  "CONTRIBUCION MENSUAL"?: number | string;
  _isPendingChange?: boolean;
}

export interface SharePointStatus {
  connected: boolean;
  mode: "online" | "offline";
  lastAttempt: string;
  logs: string[];
  error: string | null;
}

export interface PendingChange {
  type: "add" | "update";
  boleta: string;
  data: any;
  timestamp: string;
}
