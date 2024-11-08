import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '@/config/constants';
import type { ISessionManager } from '@/server/common/session-manager';
import type { IAuthQueries } from '@/server/queries/auth/auth.queries';
import { TranslatedError } from '@/server/utils/errors';
import { TotpAuthenticator } from '@/server/utils/totp';
import { getLocaleFromString } from '@/shared/internationalization/locales';
import type { ICache } from '@runtipi/cache';
import type { User } from '@runtipi/db';
import { pathExists } from '@runtipi/shared/node';
import * as argon2 from 'argon2';
import { inject, injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import { TipiConfig } from '../../core/TipiConfig';
import { decrypt, encrypt } from '../../utils/encryption';

type UsernamePasswordInput = {
  username: string;
  password: string;
  locale?: string;
};

export interface IAuthService {
  login: (input: UsernamePasswordInput) => Promise<{ sessionId?: string; totpSessionId?: string }>;
  verifyTotp: (params: { totpSessionId: string; totpCode: string }) => Promise<boolean>;
  getTotpUri: (params: { userId: number; password: string }) => Promise<{ uri: string; key: string }>;
  setupTotp: (params: { userId: number; totpCode: string }) => Promise<boolean>;
  disableTotp: (params: { userId: number; password: string }) => Promise<boolean>;
  register: (input: UsernamePasswordInput) => Promise<boolean>;
  me: (userId: number | undefined) => Promise<Pick<User, 'id' | 'username' | 'totpEnabled' | 'locale' | 'operator'> | null>;
  logout: (sessionId: string) => Promise<boolean>;
  isConfigured: () => Promise<boolean>;
  changeOperatorPassword: (params: { newPassword: string }) => Promise<{ email: string }>;
  checkPasswordChangeRequest: () => Promise<boolean>;
  changePassword: (params: { currentPassword: string; newPassword: string; userId: number }) => Promise<boolean>;
  changeUsername: (params: { newUsername: string; password: string; userId: number }) => Promise<boolean>;
  cancelPasswordChangeRequest: () => Promise<boolean>;
}

@injectable()
export class AuthService implements IAuthService {
  constructor(
    @inject('IAuthQueries') private queries: IAuthQueries,
    @inject('ICache') private cache: ICache,
    @inject('ISessionManager') private sessionManager: ISessionManager,
  ) {}

  /**
   * Authenticate user with given username and password
   *
   * @param {UsernamePasswordInput} input - An object containing the user's username and password
   */
  public login = async (input: UsernamePasswordInput) => {
    const { password, username } = input;
    const user = await this.queries.getUserByUsername(username);

    if (!user) {
      throw new TranslatedError('AUTH_ERROR_USER_NOT_FOUND');
    }

    const isPasswordValid = await argon2.verify(user.password, password);

    if (!isPasswordValid) {
      throw new TranslatedError('AUTH_ERROR_INVALID_CREDENTIALS');
    }

    if (user.totpEnabled) {
      const totpSessionId = this.sessionManager.generateSessionId('otp');
      await this.cache.set(totpSessionId, user.id.toString());
      return { totpSessionId };
    }

    const sessionId = uuidv4();
    await this.sessionManager.setSession(sessionId, user.id.toString());

    return { sessionId };
  };

  /**
   * Verify TOTP code and return a JWT token
   *
   * @param {object} params - An object containing the TOTP session ID and the TOTP code
   * @param {string} params.totpSessionId - The TOTP session ID
   * @param {string} params.totpCode - The TOTP code
   */
  public verifyTotp = async (params: { totpSessionId: string; totpCode: string }) => {
    const { totpSessionId, totpCode } = params;
    const userId = await this.cache.get(totpSessionId);

    if (!userId) {
      throw new TranslatedError('AUTH_ERROR_TOTP_SESSION_NOT_FOUND');
    }

    const user = await this.queries.getUserById(Number(userId));

    if (!user) {
      throw new TranslatedError('AUTH_ERROR_USER_NOT_FOUND');
    }

    if (!user.totpEnabled || !user.totpSecret || !user.salt) {
      throw new TranslatedError('AUTH_ERROR_TOTP_NOT_ENABLED');
    }

    const totpSecret = decrypt(user.totpSecret, user.salt);
    const isValid = TotpAuthenticator.check(totpCode, totpSecret);

    if (!isValid) {
      throw new TranslatedError('AUTH_ERROR_TOTP_INVALID_CODE');
    }

    const sessionId = uuidv4();
    await this.sessionManager.setSession(sessionId, user.id.toString());

    return true;
  };

  /**
   * Given a userId returns the TOTP URI and the secret key
   *
   * @param {object} params - An object containing the userId and the user's password
   * @param {number} params.userId - The user's ID
   * @param {string} params.password - The user's password
   */
  public getTotpUri = async (params: { userId: number; password: string }) => {
    if (TipiConfig.getConfig().demoMode) {
      throw new TranslatedError('SERVER_ERROR_NOT_ALLOWED_IN_DEMO');
    }

    const { userId, password } = params;

    const user = await this.queries.getUserById(userId);

    if (!user) {
      throw new TranslatedError('AUTH_ERROR_USER_NOT_FOUND');
    }

    const isPasswordValid = await argon2.verify(user.password, password);
    if (!isPasswordValid) {
      throw new TranslatedError('AUTH_ERROR_INVALID_PASSWORD');
    }

    if (user.totpEnabled) {
      throw new TranslatedError('AUTH_ERROR_TOTP_ALREADY_ENABLED');
    }

    let { salt } = user;
    const newTotpSecret = TotpAuthenticator.generateSecret();

    if (!salt) {
      salt = this.sessionManager.generateSessionId('');
    }

    const encryptedTotpSecret = encrypt(newTotpSecret, salt);

    await this.queries.updateUser(userId, { totpSecret: encryptedTotpSecret, salt });

    const uri = TotpAuthenticator.keyuri(user.username, 'Runtipi', newTotpSecret);

    return { uri, key: newTotpSecret };
  };

  public setupTotp = async (params: { userId: number; totpCode: string }) => {
    if (TipiConfig.getConfig().demoMode) {
      throw new TranslatedError('SERVER_ERROR_NOT_ALLOWED_IN_DEMO');
    }

    const { userId, totpCode } = params;
    const user = await this.queries.getUserById(userId);

    if (!user) {
      throw new TranslatedError('AUTH_ERROR_USER_NOT_FOUND');
    }

    if (user.totpEnabled || !user.totpSecret || !user.salt) {
      throw new TranslatedError('AUTH_ERROR_TOTP_ALREADY_ENABLED');
    }

    const totpSecret = decrypt(user.totpSecret, user.salt);
    const isValid = TotpAuthenticator.check(totpCode, totpSecret);

    if (!isValid) {
      throw new TranslatedError('AUTH_ERROR_TOTP_INVALID_CODE');
    }

    await this.queries.updateUser(userId, { totpEnabled: true });

    return true;
  };

  public disableTotp = async (params: { userId: number; password: string }) => {
    const { userId, password } = params;

    const user = await this.queries.getUserById(userId);

    if (!user) {
      throw new TranslatedError('AUTH_ERROR_USER_NOT_FOUND');
    }

    if (!user.totpEnabled) {
      throw new TranslatedError('AUTH_ERROR_TOTP_NOT_ENABLED');
    }

    const isPasswordValid = await argon2.verify(user.password, password);
    if (!isPasswordValid) {
      throw new TranslatedError('AUTH_ERROR_INVALID_PASSWORD');
    }

    await this.queries.updateUser(userId, { totpEnabled: false, totpSecret: null });

    return true;
  };

  /**
   * Creates a new user with the provided email and password and returns a session token
   *
   * @param {UsernamePasswordInput} input - An object containing the email and password fields
   */
  public register = async (input: UsernamePasswordInput) => {
    const operators = await this.queries.getOperators();

    if (operators.length > 0) {
      throw new TranslatedError('AUTH_ERROR_ADMIN_ALREADY_EXISTS');
    }

    const { password, username } = input;
    const email = username.trim().toLowerCase();

    if (!username || !password) {
      throw new TranslatedError('AUTH_ERROR_MISSING_EMAIL_OR_PASSWORD');
    }

    if (username.length < 3 || !validator.isEmail(email)) {
      throw new TranslatedError('AUTH_ERROR_INVALID_USERNAME');
    }

    const user = await this.queries.getUserByUsername(email);

    if (user) {
      throw new TranslatedError('AUTH_ERROR_USER_ALREADY_EXISTS');
    }

    const hash = await argon2.hash(password);

    const newUser = await this.queries.createUser({ username: email, password: hash, operator: true, locale: getLocaleFromString(input.locale) });

    if (!newUser) {
      throw new TranslatedError('AUTH_ERROR_ERROR_CREATING_USER');
    }

    const sessionId = uuidv4();
    await this.sessionManager.setSession(sessionId, newUser.id.toString());

    return true;
  };

  /**
   * Retrieves the user with the provided ID
   *
   * @param {number|undefined} userId - The user ID to retrieve
   */
  public me = async (userId: number | undefined) => {
    if (!userId) return null;

    const user = await this.queries.getUserDtoById(userId);

    if (!user) return null;

    return user;
  };

  /**
   * Logs out the current user by removing the session token
   *
   * @param {string} sessionId - The session token to remove
   * @returns {Promise<boolean>} - Returns true if the session token is removed successfully
   */
  public logout = async (sessionId: string): Promise<boolean> => {
    await this.cache.del(`session:${sessionId}`);

    return true;
  };

  /**
   * Check if the system is configured and has at least one user
   *
   * @returns {Promise<boolean>} - A boolean indicating if the system is configured or not
   */
  public isConfigured = async (): Promise<boolean> => {
    const operators = await this.queries.getOperators();

    return operators.length > 0;
  };

  /**
   * Change the password of the operator user
   *
   * @param {object} params - An object containing the new password
   * @param {string} params.newPassword - The new password
   */
  public changeOperatorPassword = async (params: { newPassword: string }) => {
    const isRequested = await this.checkPasswordChangeRequest();

    if (!isRequested) {
      throw new TranslatedError('AUTH_ERROR_NO_CHANGE_PASSWORD_REQUEST');
    }

    const { newPassword } = params;

    const user = await this.queries.getFirstOperator();

    if (!user) {
      throw new TranslatedError('AUTH_ERROR_OPERATOR_NOT_FOUND');
    }

    const hash = await argon2.hash(newPassword);

    await this.queries.updateUser(user.id, { password: hash, totpEnabled: false, totpSecret: null });

    await fs.promises.unlink(path.join(DATA_DIR, 'state', 'password-change-request'));

    await this.destroyAllSessionsByUserId(user.id);

    return { email: user.username };
  };

  /*
   * Check if there is a pending password change request for the given email
   * Returns true if there is a file in the password change requests folder with the given email
   *
   * @returns {boolean} - A boolean indicating if there is a password change request or not
   */
  public checkPasswordChangeRequest = async () => {
    const REQUEST_TIMEOUT_SECS = 15 * 60; // 15 minutes
    const resetPasswordFilePath = path.join(DATA_DIR, 'state', 'password-change-request');

    try {
      if (await pathExists(resetPasswordFilePath)) {
        const timestamp = await fs.promises.readFile(resetPasswordFilePath, 'utf8');

        const requestCreation = Number(timestamp);
        return requestCreation + REQUEST_TIMEOUT_SECS > Date.now() / 1000;
      }
    } catch {
      return false;
    }

    return false;
  };

  /*
   * If there is a pending password change request, remove it
   * Returns true if the file is removed successfully
   *
   * @returns {boolean} - A boolean indicating if the file is removed successfully or not
   * @throws {Error} - If the file cannot be removed
   */
  public cancelPasswordChangeRequest = async () => {
    const changeRequestPath = path.join(DATA_DIR, 'state', 'password-change-request');

    if (await pathExists(changeRequestPath)) {
      await fs.promises.unlink(changeRequestPath);
    }

    return true;
  };

  /**
   * Given a user ID, destroy all sessions for that user
   *
   * @param {number} userId - The user ID
   */
  private destroyAllSessionsByUserId = async (userId: number) => {
    const sessions = await this.cache.getByPrefix(`session:${userId}:`);

    await Promise.all(
      sessions.map(async (session) => {
        await this.cache.del(session.key);
        if (session.val) await this.cache.del(session.val);
      }),
    );
  };

  public changePassword = async (params: { currentPassword: string; newPassword: string; userId: number }) => {
    if (TipiConfig.getConfig().demoMode) {
      throw new TranslatedError('SERVER_ERROR_NOT_ALLOWED_IN_DEMO');
    }

    const { currentPassword, newPassword, userId } = params;

    const user = await this.queries.getUserById(userId);

    if (!user) {
      throw new TranslatedError('AUTH_ERROR_USER_NOT_FOUND');
    }

    const valid = await argon2.verify(user.password, currentPassword);

    if (!valid) {
      throw new TranslatedError('AUTH_ERROR_INVALID_PASSWORD');
    }

    if (newPassword.length < 8) {
      throw new TranslatedError('AUTH_ERROR_INVALID_PASSWORD_LENGTH');
    }

    const hash = await argon2.hash(newPassword);
    await this.queries.updateUser(user.id, { password: hash });
    await this.destroyAllSessionsByUserId(user.id);

    return true;
  };

  public changeUsername = async (params: { newUsername: string; password: string; userId: number }) => {
    if (TipiConfig.getConfig().demoMode) {
      throw new TranslatedError('SERVER_ERROR_NOT_ALLOWED_IN_DEMO');
    }

    const { newUsername, password, userId } = params;

    const user = await this.queries.getUserById(userId);

    if (!user) {
      throw new TranslatedError('AUTH_ERROR_USER_NOT_FOUND');
    }

    const valid = await argon2.verify(user.password, password);

    if (!valid) {
      throw new TranslatedError('AUTH_ERROR_INVALID_PASSWORD');
    }

    const email = newUsername.trim().toLowerCase();

    if (!validator.isEmail(email)) {
      throw new TranslatedError('AUTH_ERROR_INVALID_USERNAME');
    }

    const existingUser = await this.queries.getUserByUsername(email);

    if (existingUser) {
      throw new TranslatedError('AUTH_ERROR_USER_ALREADY_EXISTS');
    }

    await this.queries.updateUser(user.id, { username: email });
    await this.destroyAllSessionsByUserId(user.id);

    return true;
  };
}
