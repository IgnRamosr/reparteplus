import { z } from 'zod';

/** Email normalizado y validado */
const baseEmail = z
  .string({ required_error: 'Ingresa tu correo' })
  .trim()
  .toLowerCase()
  .min(1, 'El correo es muy corto')
  .email('Correo inválido');

/** Teléfono opcional (8–15 dígitos) */
const phoneSchema = z
  .string()
  .trim()
  .optional()
  .refine((v) => v === undefined || (v.length >= 8 && v.length <= 15), 'Teléfono inválido')
  .transform((v) => (v?.length === 0 ? undefined : v));

/** Contraseña igual a la política por defecto de Cognito */
const passwordSchema = z
  .string({ required_error: 'Ingresa una contraseña' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .refine((v) => /[a-z]/.test(v), 'Debe incluir al menos una minúscula')
  .refine((v) => /[A-Z]/.test(v), 'Debe incluir al menos una mayúscula')
  .refine((v) => /\d/.test(v),   'Debe incluir al menos un número')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Debe incluir al menos un símbolo');

/** Token de invitación opcional */
const inviteTokenSchema = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

/** Nombre requerido */
const nameSchema = z
  .string({ required_error: 'Ingresa tu nombre' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(80, 'Máximo 80 caracteres');

/** Esquemas */
export const registerSchema = z.object({
  name: nameSchema,
  email: baseEmail,
  phone: phoneSchema,
  password: passwordSchema, // ← usa la misma política que Cognito
  inviteToken: inviteTokenSchema,
});
export type RegisterSchema = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: baseEmail,
  password: z
    .string({ required_error: 'Ingresa tu contraseña' })
    .min(1, 'Ingresa tu contraseña'),
});
export type LoginSchema = z.infer<typeof loginSchema>;

export const forgotPwdSchema = z.object({
  email: baseEmail,
});
export type ForgotPwdSchema = z.infer<typeof forgotPwdSchema>;
