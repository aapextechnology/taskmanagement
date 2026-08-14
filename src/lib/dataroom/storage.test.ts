import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Exercises the real filesystem in a temp root. The pure decisions live in
// quota.ts and paths.ts; what matters here is that bytes land where they
// should, that an oversized stream is stopped mid-flight, and that a failed
// write leaves nothing behind to count against a quota.

const EVENT = "00000000-0000-4000-8000-00000000e001";
const FILE = "11111111-1111-4111-8111-111111111111";

let root: string;
let storage: typeof import("./storage");

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "dataroom-test-"));
  process.env.DATAROOM_DIR = root;
  storage = await import("./storage");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function webStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("writeVersion", () => {
  it("stores a buffer and reports the byte count", async () => {
    const body = Buffer.from("kontrak vendor");
    const written = await storage.writeVersion(EVENT, FILE, 1, body, 1_000);
    expect(written).toBe(body.byteLength);

    const onDisk = await readFile(path.join(root, EVENT, FILE, "1"));
    expect(onDisk.toString()).toBe("kontrak vendor");
  });

  it("keeps versions side by side instead of overwriting", async () => {
    await storage.writeVersion(EVENT, FILE, 2, Buffer.from("revisi"), 1_000);
    expect((await readFile(path.join(root, EVENT, FILE, "1"))).toString()).toBe(
      "kontrak vendor",
    );
    expect((await readFile(path.join(root, EVENT, FILE, "2"))).toString()).toBe(
      "revisi",
    );
  });

  it("accepts a web stream", async () => {
    const written = await storage.writeVersion(
      EVENT,
      FILE,
      3,
      webStream([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]),
      1_000,
    );
    expect(written).toBe(5);
  });

  it("stops a stream that outgrows its allowance and leaves nothing behind", async () => {
    // the browser's declared size is a claim; this is what catches a lie
    const big = webStream([new Uint8Array(600), new Uint8Array(600)]);
    await expect(
      storage.writeVersion(EVENT, FILE, 9, big, 1_000),
    ).rejects.toBeInstanceOf(storage.OverAllowanceError);

    // a partial file would count against the quota while being unreadable
    expect(await storage.statVersion(EVENT, FILE, 9)).toBeNull();
  });

  it("refuses an id that is not a uuid", async () => {
    await expect(
      storage.writeVersion("../escape", FILE, 1, Buffer.from("x"), 100),
    ).rejects.toThrow();
  });
});

describe("statVersion / openVersion", () => {
  it("reports the size and streams the bytes back", async () => {
    const stored = await storage.statVersion(EVENT, FILE, 1);
    expect(stored?.sizeBytes).toBe(14);

    const stream = storage.openVersion(stored!);
    const text = await new Response(stream).text();
    expect(text).toBe("kontrak vendor");
  });

  it("streams only the requested range", async () => {
    const stored = await storage.statVersion(EVENT, FILE, 1);
    const stream = storage.openVersion(stored!, { start: 0, end: 6 });
    expect(await new Response(stream).text()).toBe("kontrak");
  });

  it("returns null when the index knows a file the disk does not", async () => {
    // an honest "missing", never a crash — the epic's drift rule
    expect(await storage.statVersion(EVENT, FILE, 42)).toBeNull();
  });
});

describe("parseRange", () => {
  it("returns null when there is no range to honour", () => {
    expect(storage.parseRange(null, 100)).toBeNull();
    expect(storage.parseRange("bytes=-", 100)).toBeNull();
    expect(storage.parseRange("nonsense", 100)).toBeNull();
  });

  it("reads an explicit range", () => {
    expect(storage.parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
  });

  it("treats an open end as the rest of the file", () => {
    expect(storage.parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
  });

  it("reads a suffix range as the last n bytes", () => {
    expect(storage.parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });

  it("clamps an end past the file instead of erroring", () => {
    expect(storage.parseRange("bytes=95-500", 100)).toEqual({ start: 95, end: 99 });
  });

  it("flags a range that starts past the end", () => {
    expect(storage.parseRange("bytes=500-600", 100)).toBe("unsatisfiable");
    expect(storage.parseRange("bytes=20-10", 100)).toBe("unsatisfiable");
  });
});

describe("purgeFile", () => {
  it("removes every version of one file", async () => {
    await storage.purgeFile(EVENT, FILE);
    expect(await storage.statVersion(EVENT, FILE, 1)).toBeNull();
    expect(await storage.statVersion(EVENT, FILE, 2)).toBeNull();
  });

  it("is silent when there is nothing to remove", async () => {
    await expect(storage.purgeFile(EVENT, FILE)).resolves.toBeUndefined();
  });
});

describe("freeDiskBytes", () => {
  it("reports real free space for the storage root", async () => {
    const free = await storage.freeDiskBytes();
    expect(free).toBeGreaterThan(0);
  });

  it("reports zero rather than infinite space when the root is unreadable", async () => {
    const missing = path.join(root, "gone");
    process.env.DATAROOM_DIR = missing;
    expect(await storage.freeDiskBytes()).toBe(0);
    process.env.DATAROOM_DIR = root;
  });
});

describe("isolation from the uploads volume", () => {
  it("never writes outside its own root", async () => {
    const sentinel = path.join(root, "..", "must-not-be-touched");
    await writeFile(sentinel, "whatsapp-session");
    await storage.writeVersion(EVENT, FILE, 1, Buffer.from("x"), 100);
    expect((await readFile(sentinel)).toString()).toBe("whatsapp-session");
    await rm(sentinel, { force: true });
  });
});
