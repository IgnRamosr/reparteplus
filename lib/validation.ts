// lib/validations.ts
import { z } from 'zod';

/** Email normalizado y validado */
const baseEmail = z
  .string() // (sin required_error)
  .trim()
  .toLowerCase()
  .min(1, { message: 'Ingresa tu correo' }) // mensaje cuando viene vacío
  .email({ message: 'Correo inválido' });

// Normaliza (deja solo dígitos)
const normalizePhone = (v: string) => v.replace(/[^\d]/g, '');

const phoneSchema = z
  .string()                     // ← obligatorio
  .trim()
  .transform(normalizePhone)    // "9 1234 5678" → "912345678"
  .refine(v => v.length >= 8 && v.length <= 15, {
    message: 'Teléfono inválido (8–15 dígitos)',
  });

/** Contraseña igual a la política por defecto de Cognito */
const passwordSchema = z
  .string() // (sin required_error)
  .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  .refine((v) => /[a-z]/.test(v), { message: 'Debe incluir al menos una minúscula' })
  .refine((v) => /[A-Z]/.test(v), { message: 'Debe incluir al menos una mayúscula' })
  .refine((v) => /\d/.test(v),   { message: 'Debe incluir al menos un número' })
  .refine((v) => /[^A-Za-z0-9]/.test(v), { message: 'Debe incluir al menos un símbolo' });

/** Token de invitación opcional */
const SubCognitoSchema = z
  .string()

/** Nombre requerido */
const nameSchema = z
  .string() // (sin required_error)
  .trim()
  .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  .max(80, { message: 'Máximo 80 caracteres' });

/** Esquemas */
export const registerSchema = z.object({
  name: nameSchema,
  email: baseEmail,
  phone: phoneSchema,
  password: passwordSchema,
  sub_cognito: SubCognitoSchema,

});
export type RegisterSchema = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: baseEmail,
  password: z.string().min(1, { message: 'Ingresa tu contraseña' }),
});
export type LoginSchema = z.infer<typeof loginSchema>;

export const forgotPwdSchema = z.object({
  email: baseEmail,
});
export type ForgotPwdSchema = z.infer<typeof forgotPwdSchema>;