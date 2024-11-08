'use server';

import { authActionClient } from '@/lib/safe-action';
import { getClass } from 'src/inversify.config';
import { z } from 'zod';

const input = z.object({ currentPassword: z.string(), newPassword: z.string() });

/**
 * Given the current password and a new password, change the password of the current user.
 */
export const changePasswordAction = authActionClient
  .schema(input)
  .action(async ({ parsedInput: { currentPassword, newPassword }, ctx: { user } }) => {
    const authService = getClass('IAuthService');

    await authService.changePassword({ userId: user.id, currentPassword, newPassword });

    return { success: true };
  });
