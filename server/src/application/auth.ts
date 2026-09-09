import { AppError, type Repository, type Mailer } from '../domain/ports.js';

export interface Tokens { create(): string; hash(value: string): string }
/** Authentication proves identity; session issuance is reusable by a future passkey flow. */
export class AuthService {
  constructor(private repo: Repository, private mail: Mailer, private tokens: Tokens,
    private now: () => Date, private webUrl: string) {}

  async requestLink(email: string) {
    const normalized = email.trim().toLowerCase();
    const token = this.tokens.create();
    const hash = this.tokens.hash(token);
    const now = this.now();
    if (!await this.repo.requestLink(normalized, hash, new Date(+now + 15 * 60_000), now)) return;
    try {
      await this.mail.sendLink(normalized, `${this.webUrl}/auth/verify#token=${token}`);
    } catch {
      await this.repo.revokeLink(hash);
      throw new AppError(503, 'EMAIL_UNAVAILABLE', 'Email delivery is temporarily unavailable. Please try again later.');
    }
  }

  async verify(token: string) {
    const session = this.tokens.create();
    const now = this.now();
    const user = await this.repo.consumeLink(this.tokens.hash(token), this.tokens.hash(session), new Date(+now + 30 * 86400_000), now);
    if (!user) throw new AppError(400, 'INVALID_LINK', 'This link has expired or already been used. Request a new link.');
    return { user, session };
  }

  async session(token?: string) {
    if (!token) return null;
    const user = await this.repo.getSession(this.tokens.hash(token), this.now());
    return user ? { user } : null;
  }

  async logout(token?: string) {
    if (token) await this.repo.deleteSession(this.tokens.hash(token));
  }
}
