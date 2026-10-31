import { z } from 'zod';

export const gcUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  nombre: z.string(),
  debeCambiarContrasena: z.boolean(),
});

export const gcLoginResponseSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
  session: z.object({ id: z.string(), expiresAt: z.string() }),
  user: gcUserSchema,
});

export const gcMeSchema = z.object({
  user: gcUserSchema,
  roles: z.array(z.unknown()),
});

export const gcCapabilitiesSchema = z.object({
  sucursalId: z.string().nullable(),
  permissions: z.array(z.string()),
});

export const gcBranchAccessSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    codigo: z.string(),
    nombre: z.string(),
    zonaHoraria: z.string(),
    roles: z.array(z.object({
      codigo: z.string(), nombre: z.string(), alcance: z.string(),
    })),
  })),
});

export type GcUser = z.infer<typeof gcUserSchema>;
export type GcLoginResponse = z.infer<typeof gcLoginResponseSchema>;
export type GcBranch = z.infer<typeof gcBranchAccessSchema>['data'][number];

export interface GcLoginCredentials { email: string; password: string }
export interface GcChangePassword { oldPassword: string; newPassword: string }
