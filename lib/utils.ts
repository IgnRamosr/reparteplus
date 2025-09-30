/*// lib/utils.ts
export type SimpleIntegrante = { id: string; nombre: string };

/**
 * Formatea un monto a CLP sin decimales.
 * Ejemplo: 123456 -> $123.456
 */
/*export const formatCLP = (monto: number) =>
new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
}).format(Math.round(monto));

/**
 * Reparte el total en CLP (enteros).
 * Usa división entera y reparte el "resto" a los primeros N integrantes.
 */
/*export function calcularRepartoCLP(total: number, integrantes: SimpleIntegrante[]) {
const n = integrantes.length;
if (!n) return [];
const base = Math.floor(total / n);
  let resto = total - base * n;

/*return integrantes.map((p, i) => ({
    participanteId: p.id,
    monto: base + (i < resto ? 1 : 0), // reparte 1 peso extra a los primeros "resto"
}));
}

/*/