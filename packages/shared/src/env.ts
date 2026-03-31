import type { ZodTypeAny, infer as InferZodType } from 'zod';

export function parseEnv<TSchema extends ZodTypeAny>(
  schema: TSchema,
  env: NodeJS.ProcessEnv,
): InferZodType<TSchema> {
  const parsed = schema.parse(env) as InferZodType<TSchema>;
  return parsed;
}
