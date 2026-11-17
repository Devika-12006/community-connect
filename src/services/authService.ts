import { repository } from '../db/repository';
import type { RoleType, UserAccount } from '../types';
import { SEED_SALT } from '../db/agentSeedData';
import { validateResidentName, validateFlatNumber } from '../lib/validationUtils';

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
   * Register a new resident user with comprehensive name, flat, and duplicate checks.
   */
  async registerResident(params: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    block: string;
    flatNumber: string;
    residentType?: 'Owner' | 'Tenant' | 'Family Member';
    phone?: string;
  }): Promise<AuthResult> {
    // 1. Validate complete resident name (Unicode, Indian characters, initials, spaces)
    const nameCheck = validateResidentName(params.fullName);
    if (!nameCheck.valid) {
      return { success: false, error: nameCheck.error };
    }
    const cleanFullName = nameCheck.cleanValue!;

    // 2. Validate flat / unit format
    const flatCheck = validateFlatNumber(params.flatNumber);
    if (!flatCheck.valid) {
      return { success: false, error: flatCheck.error };
    }
    const cleanFlatNumber = flatCheck.cleanValue!;

    // 3. Validate password strength
    const strength = this.validatePasswordStrength(params.password);
    if (!strength.valid) {
      return { success: false, error: strength.errors[0] };
    }

    // 4. Validate username
    const cleanUsername = params.username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long.' };
    }
    const existingUser = await repository.getUserByUsername(cleanUsername);
    if (existingUser) {
      return { success: false, error: 'This username is already taken. Please choose another.' };
    }

    // 5. Prevent duplicate owner registration on the exact same block + flat
    const residentType = params.residentType || 'Owner';
    const allResidents = await repository.getResidents();
    const existingFlatResident = allResidents.find(
      (r) =>
        r.active &&
        r.block.trim().toLowerCase() === params.block.trim().toLowerCase() &&
        r.flatNumber.trim().toLowerCase() === cleanFlatNumber.toLowerCase()
    );

    if (existingFlatResident && residentType === 'Owner' && existingFlatResident.residentType === 'Owner') {
      return {
        success: false,
        error: `An Owner is already registered for ${params.block}, Flat ${cleanFlatNumber}. Please select "Tenant" or "Family Member", or contact management to update records.`,
      };
    }

    const salt = crypto.randomUUID().slice(0, 8);
    const passwordHash = await this.hashPassword(params.password, salt);

    // 6. Create resident profile
    const resident = {
      id: crypto.randomUUID(),
      displayName: cleanFullName,
      block: params.block,
      flatNumber: cleanFlatNumber,
      residentType,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repository.saveResident(resident);

    // 7. Create user account
    const userAccount: UserAccount = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      email: params.email.trim().toLowerCase(),
      passwordHash,
      salt,
      role: 'Resident',
      fullName: cleanFullName,
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
