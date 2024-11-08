'use server';

import { authActionClient } from '@/lib/safe-action';
import { getClass } from 'src/inversify.config';
import { z } from 'zod';

const input = z.object({ password: z.string() });

/**
 * Given user's password, return the TOTP URI and key
 */
export const getTotpUriAction = authActionClient.schema(input).action(async ({ parsedInput: { password }, ctx: { user } }) => {
  const authService = getClass('IAuthService');
  const { key, uri } = await authService.getTotpUri({ userId: user.id, password });

  return { success: true, key, uri };
});
