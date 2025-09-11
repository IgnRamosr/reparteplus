import { z } from 'zod';

/** Email normalizado y validado */
const baseEmail = z
  .string({ required_error: 'Ingresa tu correo' })
  .trim()
  .toLowerCase()
  .min(6, 'El correo es muy corto')
  .email('Correo inválido');

/** Teléfono opcional (solo dígitos, 8–15). Si quieres forzar formato CL, deja activo el regex. */
const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\D/g, ''))
  .refine((v) => v.length === 0 || (v.length >= 8 && v.length <= 15), 'Teléfono inválido')
  // .refine((v) => v.length === 0 || /^(\+?56)?9\d{8}$/.test(v), 'Usa formato chileno: 9 XXXXXXXX')
  .transform((v) => (v.length === 0 ? undefined : v));

/** Password fuerte */
const passwordSchema = z
  .string({ required_error: 'Ingresa una contraseña' })
  .min(8, 'Mínimo 8 caracteres')
  .max(64, 'Máximo 64 caracteres')
  .refine((v) => !/\s/.test(v), 'La contraseña no debe contener espacios')
  .refine((v) => /[a-z]/.test(v), 'Debe incluir al menos una minúscula')
  .refine((v) => /[A-Z]/.test(v), 'Debe incluir al menos una mayúscula')
  .refine((v) => /\d/.test(v), 'Debe incluir al menos un número')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Debe incluir al menos un símbolo');

/** Token de invitación opcional */
const inviteTokenSchema = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

/** === Schemas de formularios === */
export const registerSchema = z.object({
  email: baseEmail,
  phone: phoneSchema.optional(),
  password: passwordSchema,
  inviteToken: inviteTokenSchema,
});
export type RegisterSchema = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: baseEmail,
  password: z
    .string({ required_error: 'Ingresa tu contraseña' })
    .min(6, 'Mínimo 6 caracteres'),
});
export type LoginSchema = z.infer<typeof loginSchema>;

export const forgotPwdSchema = z.object({
  email: z
    .string({ required_error: 'Ingresa tu correo' })
    .trim()
    .toLowerCase()
    .min(6, 'Correo muy corto')
    .email('Correo inválido'),
});

export type ForgotPwdSchema = z.infer<typeof forgotPwdSchema>;
