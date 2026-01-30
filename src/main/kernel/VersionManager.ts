import { exec, execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface VersionInfo {
  hash: string;
  message: string;
  timestamp: Date;
}

export class VersionManager {
  private versionsDir: string;
  private initialized = false;

  constructor() {
    this.versionsDir = path.join(os.homedir(), '.promptbook', 'versions');
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Create versions directory if it doesn't exist
    await fs.mkdir(this.versionsDir, { recursive: true });

    // Check if git repo exists, if not initialize it
    try {
      await this.execGit('rev-parse --git-dir');
    } catch {
      await this.execGit('init');
      await this.execGit('config user.email "promptbook@local"');
      await this.execGit('config user.name "Promptbook"');
      // Create initial commit
      await fs.writeFile(
        path.join(this.versionsDir, '.gitkeep'),
        'Promptbook version history\n'
      );
      await this.execGit('add .');
      await this.execGit('commit -m "Initial commit"');
    }

    this.initialized = true;
  }

  private execGit(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(`git ${command}`, { cwd: this.versionsDir }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Save a version of the notebook state
   */
  async saveVersion(
    notebookId: string,
    content: string,
    message: string
  ): Promise<string> {
    await this.init();

    const fileName = `${notebookId}.yaml`;
    const filePath = path.join(this.versionsDir, fileName);

    // Write notebook content
    await fs.writeFile(filePath, content, 'utf-8');

    // Stage and commit
    await this.execGit(`add "${fileName}"`);

    try {
      await this.execGit(`commit -m "${message.replace(/"/g, '\\"')}"`);
      const hash = await this.execGit('rev-parse HEAD');
      return hash;
    } catch (error) {
      // If nothing to commit, return current HEAD
      const hash = await this.execGit('rev-parse HEAD');
      return hash;
    }
  }

  /**
   * Get version history for a notebook
   */
  async getHistory(notebookId: string, limit = 50): Promise<VersionInfo[]> {
    await this.init();

    const fileName = `${notebookId}.yaml`;

    try {
      const output = await this.execGit(
        `log --format="%H|%s|%aI" -n ${limit} -- "${fileName}"`
      );

      if (!output.trim()) {
        return [];
      }

      return output.split('\n').map((line) => {
        const [hash, message, timestamp] = line.split('|');
        return {
          hash,
          message,
          timestamp: new Date(timestamp),
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Get content at a specific version
   */
  async getVersion(notebookId: string, hash: string): Promise<string | null> {
    await this.init();

    const fileName = `${notebookId}.yaml`;

    try {
      const content = await this.execGit(`show ${hash}:"${fileName}"`);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Undo - go to previous version
   */
  async undo(notebookId: string): Promise<{ content: string; hash: string } | null> {
    const history = await this.getHistory(notebookId, 2);

    if (history.length < 2) {
      return null; // No previous version
    }

    const previousHash = history[1].hash;
    const content = await this.getVersion(notebookId, previousHash);

    if (!content) {
      return null;
    }

    // Create an undo commit
    await this.saveVersion(
      notebookId,
      content,
      `Undo to ${previousHash.slice(0, 7)}`
    );

    return { content, hash: previousHash };
  }

  /**
   * Get current version hash
   */
  async getCurrentHash(notebookId: string): Promise<string | null> {
    const history = await this.getHistory(notebookId, 1);
    return history.length > 0 ? history[0].hash : null;
  }

  /**
   * Check if undo is available
   */
  async canUndo(notebookId: string): Promise<boolean> {
    const history = await this.getHistory(notebookId, 2);
    return history.length >= 2;
  }
}

// Singleton instance
export const versionManager = new VersionManager();
