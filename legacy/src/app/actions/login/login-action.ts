'use server';

import { publicActionClient } from '@/lib/safe-action';
import { revalidatePath } from 'next/cache';
import { getClass } from 'src/inversify.config';
import { z } from 'zod';

const input = z.object({
  username: z.string(),
  password: z.string(),
});

/**
 * Given a username and password, logs in the user and returns a totpSessionId
 * if that user has 2FA enabled.
 */
export const loginAction = publicActionClient.schema(input).action(async ({ parsedInput: { username, password } }) => {
  const authService = getClass('IAuthService');

  const { totpSessionId } = await authService.login({ username, password });

  if (!totpSessionId) {
    revalidatePath('/login');
  }

  return { totpSessionId, success: true };
});
