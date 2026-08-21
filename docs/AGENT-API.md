# Agent API — Panduan Penggunaan

API untuk agent eksternal (OpenClaw / Hermes / n8n / skrip apa pun) agar bisa
**membaca, menulis, dan meng-update** RVC Backstage atas nama orang yang
sedang berbicara dengan agent — misalnya lewat WhatsApp.

- **Base URL**: `https://rvc.reddie.id/api/agent`
- **Format**: JSON, UTF-8. Semua respons dibungkus `{ "ok": true, "data": … }`
  atau `{ "ok": false, "error": "…" }`.
- **Shipped**: EPIC-023, 2026-08-18. Diuji end-to-end terhadap server live.

---

## 1. Konsep inti: dua kredensial per request

Tidak ada token all-access. Setiap request wajib membawa **dua** header:

| Header | Isi | Membuktikan |
|---|---|---|
| `Authorization` | `Bearer rvca_…` | **Agent mana** yang memanggil |
| `X-On-Behalf-Of` | nomor WA, mis. `081809078014` | **Manusia mana** yang diwakili |

Server mencocokkan nomor itu dengan nomor HP di profil user, lalu menjalankan
request **dengan hak akses user tersebut** melalui modul permission — sama
persis seperti user itu mengklik sendiri di aplikasi. Konsekuensinya:

- Owner mengirim perintah → agent bertindak sebagai Owner (akses penuh).
- Staf mengirim → hanya sebatas hak staf itu (divisi, task yang di-assign).
- Nomor tak terdaftar → **403**. Key tanpa nomor → **401**. Key saja tidak
  bisa membaca apa pun.
- Di **grup WA**: identitas = **nomor PENGIRIM pesan**, bukan grup. Jangan
  pernah hardcode satu nomor untuk semua anggota grup — itu membuka kembali
  celah "semua orang di grup = admin" yang desain ini tutup.

Format nomor fleksibel: `0812…`, `62812…`, `+62 812…` semuanya diterima
(dinormalisasi ke msisdn).

### Menerbitkan / mencabut key

Admin → **Agent API keys** → Create key. Token `rvca_…` **tampil sekali saja**
(yang tersimpan hanya hash SHA-256) — langsung salin ke config agent. Daftar
key menunjukkan nama, 4 karakter terakhir, dan kapan terakhir dipakai;
tombol **Revoke** mematikannya seketika.

### Batas & audit

- **Rate limit**: 120 request/menit per key → lewat itu **429**.
- **Audit**: setiap mutasi tercatat di activity log atas nama **user**-nya
  (bukan key), dan task/komentar buatan agent membawa sufiks terlihat
  `— via <nama-key>` supaya tidak menyamar sebagai ketikan tangan.
- Akun **external** dan akun nonaktif ditolak (403).

---

## 2. Endpoint

### `GET /me` — cek identitas

Panggilan pertama yang harus dilakukan agent (health-check + tahu hak akses).

```bash
curl https://rvc.reddie.id/api/agent/me \
  -H "Authorization: Bearer rvca_XXXX" \
  -H "X-On-Behalf-Of: 081809078014"
```

```json
{ "ok": true, "data": {
  "userId": "6a2a676a-…", "name": "Super Admin", "role": "owner",
  "memberships": [],
  "actingVia": { "key": "openclaw-wa", "phone": "6281809078014" }
}}
```

### `GET /events` — daftar event yang terlihat

Mengikuti aturan visibility aplikasi: admin/owner melihat semua; user lain
hanya event yang melibatkan mereka.

```json
{ "ok": true, "data": [
  { "id": "c3757e43-…", "name": "Moodymann Jakarta",
    "showDate": "2026-08-25T13:00:00.000Z", "venue": "Zoo SCBD",
    "health": "at_risk" }
]}
```

### `GET /events/{id}` — detail satu event

Header event, PIC & member, divisi aktif, dan **angka tiket terkini** (dari
snapshot harian — gabungan semua channel, dengan catatan kebasian per channel).

```json
{ "ok": true, "data": {
  "id": "…", "name": "Moodymann Jakarta", "artists": "Moodymann",
  "venue": "Zoo SCBD", "showDate": "…", "capacity": 600,
  "health": "at_risk", "phase": "Production",
  "pic": { "id": "…", "name": "Super Admin" },
  "members": [ { "id": "…", "name": "…" } ],
  "divisions": [ { "id": "finance", "name": "Finance" }, … ],
  "tickets": { "day": "2026-08-20", "sold": 124, "revenue": 46500000,
               "note": "Synced from Megatix + Tessera (as of 2026-08-17)" }
}}
```

> `tickets.revenue` = nilai tiket (face value), bukan jumlah yang dibayar
> pembeli. Satu definisi revenue di seluruh aplikasi.

### `GET /tasks?eventId={id}` · `GET /tasks?mine=1` — daftar task

- `?eventId=…` — task satu event (bisa ditambah `&status=todo` dll).
  Task yang di-restrict head tetap tersaring sesuai hak pemanggil.
- `?mine=1` — task milik si pengirim (lead / assignee), lintas event.

```json
{ "ok": true, "data": [
  { "id": "…", "title": "Booking venue", "status": "in_progress",
    "priority": "high", "dueDate": "2026-08-22T…", "divisionId": "production" }
]}
```

Status yang valid: `backlog · todo · in_progress · in_review · blocked · done
· cancelled`. Priority: `low · medium · high · urgent`.

### `POST /tasks` — buat task

```bash
curl -X POST https://rvc.reddie.id/api/agent/tasks \
  -H "Authorization: Bearer rvca_XXXX" \
  -H "X-On-Behalf-Of: 081809078014" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId":   "c3757e43-…",
    "divisionId":"production",
    "title":     "Cek sound system",
    "description":"Pastikan rider Moodymann terpenuhi",
    "priority":  "high",
    "dueDate":   "2026-08-23T17:00:00+07:00"
  }'
```

Wajib: `eventId`, `divisionId`, `title`. `dueDate` menerima ISO — **selalu
sertakan offset `+07:00`** untuk jam WIB. Respons: `{ "id": "…", "title": "…" }`.
Deskripsi otomatis diberi jejak `— via <key> (wa:<nomor>)`.

### `GET /tasks/{id}` — detail task

Seluruh field task + `assigneeIds` + `isAssigned` (apakah si pengirim
termasuk pengerjanya). Task tersegel yang tak boleh dilihat → 404.

### `PATCH /tasks/{id}` — update task

Field yang bisa diubah: `status`, `priority`, `title`, `dueDate`
(`null` = hapus due date). Kirim hanya yang berubah:

```bash
curl -X PATCH https://rvc.reddie.id/api/agent/tasks/{id} \
  -H "Authorization: Bearer rvca_XXXX" \
  -H "X-On-Behalf-Of: 0812…" \
  -H "Content-Type: application/json" \
  -d '{ "status": "done" }'
```

Respons: `{ "changed": ["status"] }`. Hak edit mengikuti aturan aplikasi:
pemilik divisi/lead bisa edit penuh; assignee bisa update task-nya sendiri.

### `POST /tasks/{id}/comments` — komentar

```bash
-d '{ "body": "Sudah dikonfirmasi vendor, besok loading in." }'
```

Komentar tampil di timeline task dengan sufiks `— via <key>`. Mention `@all`
di body akan meng-mention seluruh divisi task itu (perilaku sama dengan app).

---

## 3. Kode error — dan apa yang harus dilakukan agent

| HTTP | Arti | Aksi agent |
|---|---|---|
| 401 | Token hilang/salah/dicabut, **atau** header `X-On-Behalf-Of` kosong | Periksa config; jangan retry membabi-buta |
| 403 | Nomor tak terdaftar / user nonaktif / user tak berhak untuk aksi itu | Balas ke pengguna: "nomor kamu belum terdaftar di Backstage" atau "kamu tidak punya akses untuk itu" |
| 404 | Task/event tidak ada **atau tak terlihat** oleh user ini | Jangan bocorkan bahwa objeknya ada |
| 400 | Body/parameter salah — pesan errornya menyebut field mana | Perbaiki lalu ulangi |
| 429 | >120 req/menit untuk key ini | Backoff, coba lagi setelah ~1 menit |

Semua error berbentuk `{ "ok": false, "error": "kalimat yang bisa dibaca" }` —
aman untuk diteruskan ke LLM sebagai umpan balik tool.

---

## 4. Pola integrasi WhatsApp (OpenClaw / Hermes)

```
pesan WA masuk
  └─ ambil nomor PENGIRIM  (di grup: participant, bukan JID grup)
       └─ jadikan header X-On-Behalf-Of
            └─ LLM memilih tool → panggil endpoint → balas hasil ke chat
```

Definisikan endpoint sebagai **tools** dengan skema eksplisit (bukan menyuruh
LLM mengarang URL). Contoh definisi tool minimum:

```json
[
  { "name": "rvc_me",          "method": "GET",  "path": "/me" },
  { "name": "rvc_events",      "method": "GET",  "path": "/events" },
  { "name": "rvc_event",       "method": "GET",  "path": "/events/{eventId}" },
  { "name": "rvc_tasks",       "method": "GET",  "path": "/tasks?eventId={eventId}" },
  { "name": "rvc_my_tasks",    "method": "GET",  "path": "/tasks?mine=1" },
  { "name": "rvc_create_task", "method": "POST", "path": "/tasks",
    "body": ["eventId","divisionId","title","description?","priority?","dueDate?"] },
  { "name": "rvc_update_task", "method": "PATCH","path": "/tasks/{taskId}",
    "body": ["status?","priority?","title?","dueDate?"] },
  { "name": "rvc_comment",     "method": "POST", "path": "/tasks/{taskId}/comments",
    "body": ["body"] }
]
```

Contoh handler (Node, apa pun framework WA-nya):

```js
async function callRvc(method, path, senderPhone, body) {
  const res = await fetch(`https://rvc.reddie.id/api/agent${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.RVC_AGENT_KEY}`,
      "x-on-behalf-of": senderPhone,           // ← per pesan, dari WA
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json(); // { ok, data | error } — teruskan ke LLM apa adanya
}
```

---

## 5. Checklist sebelum go-live

- [ ] Key diterbitkan di Admin → Agent API keys, tersimpan di config agent
      (env var, **jangan** di-commit).
- [ ] **Nomor HP setiap anggota tim terisi di profilnya** (Admin → Users) —
      nomor kosong = orang itu tak bisa memakai agent.
- [ ] Agent memakai **nomor WA khusus**, bukan nomor pribadi (gateway tidak
      resmi berisiko banned oleh Meta).
- [ ] Di grup, kode mengambil nomor **participant** pengirim — sudah diuji.
- [ ] `GET /me` dipakai sebagai smoke test saat agent boot.
- [ ] Rencana rotasi: kalau key bocor → Revoke di Admin → terbitkan baru.

## 6. Keamanan — keputusan desain yang disengaja

- **Tidak ada god token.** Pesan injeksi dari siapa pun di grup mentok di hak
  pengirimnya sendiri; dataroom sealed, task restricted, dan visibility event
  tetap berlaku penuh.
- Plaintext key tak pernah disimpan (hash SHA-256 saja) dan tak pernah
  dikembalikan ke browser setelah dibuat.
- Jejak ganda: activity log per user + sufiks "via <key>" pada konten buatan
  agent.
- Error 404 tidak membedakan "tidak ada" dan "tidak boleh dilihat".

---

*Referensi teknis: `src/lib/agent/auth.ts` (autentikasi & key),
`src/lib/agent/respond.ts` (bungkus respons), `src/app/api/agent/**` (route),
epic: `docs/epics/EPIC-023-agent-api.md`.*
