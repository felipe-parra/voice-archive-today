import { mkdir, writeFile, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Mailer } from '../domain/ports.js';
export interface ResendConfig { apiKey: string; from: string }
export class ResendMailer implements Mailer {
  constructor(private config: ResendConfig) {}
  private async send(to: string, subject: string, text: string) {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: this.config.from, to: [to], subject, text }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Email provider failed (${response.status})`);
  }
  sendLink(email: string, url: string) { return this.send(email,'Sign in to Voice Archive',`Use this single-use link to sign in. It expires in 15 minutes.\n\n${url}\n\nIf you did not request this email, ignore it.`); }
  sendDocument(email: string, title: string, markdown: string) { return this.send(email,title,markdown); }
}
/** Explicit development-only inbox; never logs link tokens. Files expire after one day. */
export class DevelopmentMailer implements Mailer {
  constructor(private directory: string) {}
  private async send(to: string, subject: string, text: string) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    for (const name of await readdir(this.directory)) {
      if (!/^[0-9a-f-]+\.json$/.test(name)) continue;
      const path = join(this.directory,name);
      try { if ((await stat(path)).mtimeMs < Date.now()-86400000) await unlink(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    await writeFile(join(this.directory,`${randomUUID()}.json`),JSON.stringify({to,subject,text},null,2),{mode:0o600,flag:'wx'});
  }
  sendLink(email: string,url: string) { return this.send(email,'Development sign-in link',url); }
  sendDocument(email: string,title: string,markdown: string) { return this.send(email,title,markdown); }
}
