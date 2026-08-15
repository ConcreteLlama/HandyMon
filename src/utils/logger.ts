import fs from 'fs';
import path from 'path';
import { LogLevelSetting } from '@/types/app-config';
import { getAppConfig } from './app-config';
import { LOG_DIR } from './dirs';

// A simple, file-backed logger for debugging live issues on the host — the
// app runs as a background scheduled task with no visible console, so
// exceptions caught-and-summarized into an API response are otherwise the
// only trace of what went wrong. Configurable level (persisted in
// AppConfig.logLevel), host-only viewer in Settings.
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024; // rotate at 5MB, keep one backup

const LEVEL_RANK: Record<LogLevelSetting, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function currentLevel(): LogLevelSetting {
  try {
    return getAppConfig().logLevel;
  } catch {
    return 'info';
  }
}

function rotateIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size < MAX_LOG_BYTES) return;
    const backupPath = LOG_FILE + '.1';
    fs.rmSync(backupPath, { force: true });
    fs.renameSync(LOG_FILE, backupPath);
  } catch {
    // File doesn't exist yet — nothing to rotate.
  }
}

function write(level: LogLevelSetting, message: string, meta?: unknown) {
  if (LEVEL_RANK[level] > LEVEL_RANK[currentLevel()]) return;

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    rotateIfNeeded();
    const ts = new Date().toISOString();
    const metaStr = meta !== undefined ? ' ' + safeStringify(meta) : '';
    fs.appendFileSync(LOG_FILE, `[${ts}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}\n`);
  } catch {
    // Logging must never itself break the caller.
  }
}

function safeStringify(meta: unknown): string {
  if (meta instanceof Error) return meta.stack || meta.message;
  try { return JSON.stringify(meta); } catch { return String(meta); }
}

export const log = {
  error: (message: string, meta?: unknown) => write('error', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
};

export function readLogTail(maxLines = 500): string[] {
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}
