import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Storage abstraction. The app depends on this interface, never on a concrete
 * provider, so swapping the local-disk adapter for S3/R2/GCS later is a one-line
 * change in `createStorage()` with no call-site edits.
 */
export interface StoredObject {
  /** Public URL the browser can load. */
  url: string;
  /** Adapter-specific handle used to delete the object later. */
  key: string;
}

export interface PutObjectInput {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}

export interface StorageAdapter {
  put(input: PutObjectInput, opts: { prefix: string }): Promise<StoredObject>;
  remove(key: string): Promise<void>;
}

/** Collapse a user-supplied filename to a safe, short, URL-friendly basename. */
function safeFileName(name: string): string {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const base = path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "file"}${ext}`;
}

/**
 * Local-disk adapter. Writes under `public/uploads/<prefix>/...` so files are
 * served same-origin at `/uploads/...`. Suitable for development and single-node
 * deployments; not for serverless/multi-node (swap to an object store there).
 */
class LocalStorageAdapter implements StorageAdapter {
  private readonly root = path.join(process.cwd(), "public", "uploads");

  async put(input: PutObjectInput, opts: { prefix: string }): Promise<StoredObject> {
    const key = `${opts.prefix}/${randomUUID()}-${safeFileName(input.fileName)}`;
    const dest = path.join(this.root, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, input.buffer);
    return { url: `/uploads/${key}`, key };
  }

  async remove(key: string): Promise<void> {
    // Guard against path traversal in a stored key before touching the disk.
    const dest = path.join(this.root, key);
    if (!dest.startsWith(this.root)) return;
    await fs.rm(dest, { force: true });
  }
}

function createStorage(): StorageAdapter {
  // Future: branch on process.env.STORAGE_DRIVER for "s3" | "r2" | ...
  return new LocalStorageAdapter();
}

export const storage: StorageAdapter = createStorage();
