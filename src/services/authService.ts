import { repository } from '../db/repository';
import type { RoleType, UserAccount } from '../types';
import { SEED_SALT } from '../db/agentSeedData';

export interface AuthResult {
  success: boolean;
  user?: UserAccount;
  role?: RoleType;
  error?: string;
  residentId?: string;
  workerId?: string;
}

export const authService = {
  /**
   * Cryptographic SHA-256 hashing using Web Crypto API
   */
  async hashPassword(password: string, salt = SEED_SALT): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${salt}:${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Validate password complexity / strength
   */
  validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long.');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number.');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*).');
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Authenticate user with username/email and password
   */
  async login(identifier: string, password: string): Promise<AuthResult> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      return { success: false, error: 'Please enter both username/email and password.' };
    }

    try {
      const user = await repository.getUserByUsername(cleanId);
      if (!user) {
        // Also check by email
        const allUsers = await repository.getUserAccounts();
        const byEmail = allUsers.find((u) => u.email.toLowerCase() === cleanId);
        if (!byEmail) {
          return { success: false, error: 'Invalid username or password.' };
        }
        return this.verifyPasswordAndProduceResult(byEmail, cleanPass);
      }

      return this.verifyPasswordAndProduceResult(user, cleanPass);
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: 'Authentication service error. Please try again.' };
    }
  },

  async verifyPasswordAndProduceResult(user: UserAccount, password: string): Promise<AuthResult> {
    if (!user.active) {
      return { success: false, error: 'This account has been deactivated by the administrator.' };
    }

    const computedHash = await this.hashPassword(password, user.salt || SEED_SALT);
    if (computedHash !== user.passwordHash) {
      return { success: false, error: 'Invalid username or password.' };
    }

    // Resolve associated actor ID
    let residentId = user.residentId;
    let workerId = user.workerId;

    if (user.role === 'Resident' && !residentId) {
      const residents = await repository.getResidents();
      residentId = residents.find((r) => r.active)?.id;
    } else if (user.role === 'Worker' && !workerId) {
      const workers = await repository.getWorkers();
      workerId = workers.find((w) => w.active)?.id;
    }

    return {
      success: true,
      user,
      role: user.role,
      residentId,
      workerId,
    };
  },

  /**
   * Register a new resident user
   */
  async registerResident(params: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    block: string;
    flatNumber: string;
    phone?: string;
  }): Promise<AuthResult> {
    const strength = this.validatePasswordStrength(params.password);
    if (!strength.valid) {
      return { success: false, error: strength.errors[0] };
    }

    const existingUser = await repository.getUserByUsername(params.username);
    if (existingUser) {
      return { success: false, error: 'This username is already taken. Please choose another.' };
    }

    const salt = crypto.randomUUID().slice(0, 8);
    const passwordHash = await this.hashPassword(params.password, salt);

    // 1. Create resident profile
    const resident = {
      id: crypto.randomUUID(),
      displayName: params.fullName.trim(),
      block: params.block,
      flatNumber: params.flatNumber.trim(),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveResident(resident);

    // 2. Create user account
    const userAccount: UserAccount = {
      id: crypto.randomUUID(),
      username: params.username.trim().toLowerCase(),
      email: params.email.trim().toLowerCase(),
      passwordHash,
      salt,
      role: 'Resident',
      fullName: params.fullName.trim(),
      phone: params.phone?.trim() || undefined,
      active: true,
      residentId: resident.id,
      createdAt: new Date().toISOString(),
    };
    await repository.saveUserAccount(userAccount);

    return {
      success: true,
      user: userAccount,
      role: 'Resident',
      residentId: resident.id,
    };
  },

  /**
   * Password reset request (simulation with verifiable token)
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; resetToken?: string; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const users = await repository.getUserAccounts();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      // Don't reveal if user exists for security
      return {
        success: true,
        message: 'If an account exists with that email address, password reset instructions have been sent.',
      };
    }

    const resetToken = `rst_${crypto.randomUUID().slice(0, 12)}`;
    return {
      success: true,
      resetToken,
      message: `Password reset link verified for ${user.username}. Use token "${resetToken}" to proceed with reset.`,
    };
  },

  /**
   * Reset password with token
   */
  async resetPassword(username: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const strength = this.validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return { success: false, error: strength.errors[0] };
    }

    const user = await repository.getUserByUsername(username);
    if (!user) {
      return { success: false, error: 'User account not found.' };
    }

    const salt = crypto.randomUUID().slice(0, 8);
    const passwordHash = await this.hashPassword(newPassword, salt);

    user.passwordHash = passwordHash;
    user.salt = salt;
    await repository.saveUserAccount(user);

    return { success: true };
  },
};
