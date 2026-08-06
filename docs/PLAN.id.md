# RVC Backstage — Rencana Task Management System

Sistem task management untuk **Raw Vision Collective (RVC)** — EO/promotor konser skala internasional (rawvision.demo-wit.id).

Nama kerja: **RVC Backstage** ("semua yang ada di balik panggung"). Bahasa UI sistem: **Inggris**.

> Versi Inggris: [PLAN.en.md](PLAN.en.md)

---

## 1. Visi & tujuan

- Satu workspace per event (konser), dipakai bersama lintas divisi, dengan kepemilikan task yang jelas.
- Cepat diadopsi: staff harus paham alur "My Tasks → kerjakan → selesai" dalam waktu kurang dari 5 menit.
- Lintas divisi sejak desain: handoff dan dependency antar divisi adalah fitur kelas satu.
- Pihak eksternal (vendor, artist management, venue, sponsor) bisa input dan update di dalam sistem — terbatas scope-nya, aman, dan ter-audit.
- Owner mendapat executive summary: kesehatan portofolio, penyerapan budget, dan antrian approval dengan approve/reject sekali klik.

## 2. Bahasa desain

Diturunkan dari website RVC (rawvision.demo-wit.id):

- Palet monokrom: hitam / putih / abu-abu, kontras tinggi. Latar netral; warna datang dari poster event.
- Sans-serif geometris modern, hierarki berbasis tipografi, whitespace lega, grid bergaya galeri.
- Elemen khas yang dipakai ulang: **countdown timer ke hari H** di setiap event workspace, motif panah kanan-atas (↗) untuk link/aksi, lockup logo minimalis.
- Dark theme sebagai default (nuansa backstage), light theme tersedia. Permukaan flat, border tipis, tanpa gradien dekoratif.

## 3. Struktur organisasi

**Eksekutif**
- Owner / CEO — approval final, executive dashboard, visibilitas penuh.
- (Opsional nanti: COO / Managing Director dengan hak approval terdelegasi.)

**Divisi** (masing-masing punya satu Division Head + Staff):

| # | Divisi | Tanggung jawab (contoh) |
|---|--------|--------------------------|
| 1 | Talent & Booking | Scouting artis, penawaran, kontrak booking, intake rider, artist advancing |
| 2 | Production | Panggung, sound, lighting, video/visual, SFX, pemenuhan technical rider, site build, soundcheck |
| 3 | Operations & Logistics | Koordinasi venue, penjadwalan, transportasi, freight/customs artis internasional, akomodasi, akreditasi, katering |
| 4 | Security & Safety | Rencana crowd management, vendor keamanan, medis, tanggap darurat |
| 5 | Hospitality & Artist Liaison | Penanganan artis, backstage/green room, hospitality rider, tamu VIP |
| 6 | Marketing & Communications | Brand, aset kreatif, kalender konten, media sosial, PR/media partner, pengumuman |
| 7 | Ticketing & Sales | Setup platform tiket, tier harga, presale, box office, operasional gate, laporan penjualan harian |
| 8 | Sponsorship & Partnership | Pipeline sponsor, proposal, delivery aktivasi, laporan pasca-event |
| 9 | Finance | Budget event, proses expense/PO, pembayaran vendor, fee artis & pajak, settlement |
| 10 | Legal & Licensing | Perizinan (polisi/kota/venue), lisensi pertunjukan, imigrasi/izin kerja, review kontrak, asuransi |
| 11 | HR & Volunteers | Rekrutmen crew, pengelolaan volunteer, jadwal shift, briefing |

**Kolaborator eksternal** (akses guest, dibatasi per event):
- Vendor & supplier (sound system, staging, katering, merch…)
- Artist management / booking agency
- Perwakilan venue
- Perwakilan sponsor
- Crew freelance

## 4. Role & permission

Lima role. Semuanya ditegakkan di API/service layer (satu modul otorisasi terpusat), bukan hanya di UI — nanti bisa diperkuat dengan Postgres RLS native.

| Kapabilitas | Owner | Admin | Division Head | Staff | External |
|---|---|---|---|---|---|
| Lihat semua event & semua divisi | ✓ | ✓ | ringkasan saja | — | — |
| Lihat task divisi sendiri (semua event) | ✓ | ✓ | ✓ | ✓ | — |
| Lihat task yang di-assign saja | ✓ | ✓ | ✓ | ✓ | ✓ (sesuai undangan) |
| Buat / arsipkan event | ✓ | ✓ | — | — | — |
| Kelola user, divisi, settings | ✓ | ✓ | — | — | — |
| Buat / edit task di divisi sendiri | ✓ | ✓ | ✓ | ✓ | — |
| Assign task di dalam divisi | ✓ | ✓ | ✓ | diri/rekan | — |
| Request handoff lintas divisi | ✓ | ✓ | ✓ | ✓ | — |
| Update status / komentar / upload di task yang di-assign | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submit form terstruktur (quotation, rider, manifest) | — | — | — | — | ✓ |
| Undang kolaborator eksternal (divisi sendiri, per event) | ✓ | ✓ | ✓ | — | — |
| Review/terima submission eksternal | ✓ | ✓ | ✓ | staff yang ditugaskan | — |
| Buat budget / expense request | ✓ | ✓ | ✓ | ✓ (perlu approval Head) | — |
| Lihat budget | semua | semua | divisi sendiri | — | — |
| Approve: level divisi (tier 1) | ✓ | — | ✓ | — | — |
| Approve: final / nilai besar / kontrak / artist offer | ✓ | — | — | — | — |
| Executive dashboard | ✓ | read-only (opsional) | — | — | — |
| Audit log | ✓ | ✓ | — | — | — |

Prinsip:
- **Ter-scope per divisi secara default** — staff melihat dunia divisinya plus apa pun yang di-assign atau di-watch.
- **Ter-scope per event untuk eksternal** — guest yang diundang ke "YE Live Concert / Production" hanya melihat task dan form miliknya di event itu. Tidak pernah melihat budget, vendor lain, atau task internal.
- **Data finansial** — Owner, Admin, dan divisi Finance melihat semua; Division Head hanya melihat lini budget divisinya sendiri.

## 5. Model kolaborator eksternal

- Diundang oleh Division Head via email → **login magic link** (tanpa ribet password).
- Scope undangan: satu event + satu divisi + assignment task/form eksplisit.
- Yang bisa mereka lakukan: lihat task yang di-assign, update status, komentar, upload deliverable, isi form terstruktur:
  - Form quotation vendor
  - Form technical rider (artist management)
  - Manifest logistik (freight, daftar peralatan)
  - Daftar crew / tamu
- Setiap submission eksternal masuk ke **review queue** divisi pemilik (accept / request changes).
- Undangan kedaluwarsa (default: 7 hari setelah settlement event); akses bisa dicabut kapan saja; semua aksi ter-audit.

## 6. Modul inti

### 6.1 Events (workspace)
Satu konser = satu event workspace. Field: nama, artis, venue, tanggal show, kapasitas, status, cover image (poster). Fase lifecycle: **Planning → Pre-production → Promotion → Show week → Show day → Settlement**. Health status per event (On track / At risk / Critical) dihitung otomatis dari task overdue + blocked dan penyerapan budget.

### 6.2 Event template ("playbook")
Membuat event dari template "International Concert" otomatis men-generate checklist standar tiap divisi (mis. Legal: checklist perizinan dengan lead time; Production: checklist technical advance). Template bisa diedit; ini tuas terbesar untuk "cepat dipakai".

### 6.3 Tasks
Judul, deskripsi, divisi, event, assignee, watcher, prioritas (Low/Medium/High/Urgent), tanggal mulai/tenggat, status (**Backlog → To do → In progress → In review → Blocked → Done**), subtask/checklist, label, lampiran, komentar dengan @mention, dependency (blocked by / blocks), task berulang.

### 6.4 Handoff lintas divisi
Sebuah task bisa me-request pekerjaan ke divisi lain ("Marketing butuh render desain panggung dari Production"). Division Head penerima meng-accept → task muncul di board mereka, ter-link sebagai dependency. Tidak ada lagi request hilang di WhatsApp.

### 6.5 Views
- **My Tasks** (landing default staff — hari ini / minggu ini / overdue)
- Kanban per divisi per event
- List dengan filter tersimpan
- Timeline (Gantt) per event — critical path menuju hari H
- Kalender (deadline, milestone, tanggal show)

### 6.6 Run of show
Rundown menit-per-menit untuk hari H (doors, opener, changeover, headliner, curfew), dimiliki Production/Ops, bisa dibaca semua divisi, bisa dicetak/diekspor.

### 6.7 File & dokumen
Lampiran di task + pustaka dokumen per event (kontrak, izin, rider, stage plot) dengan kontrol akses per divisi.

### 6.8 Budget & pengadaan
Budget per event → lini budget per divisi → expense request (nominal, vendor, justifikasi, lampiran quotation) yang mengalir ke approval engine. Committed vs actual vs budget, terlihat oleh Finance dan Owner.

### 6.9 Approval engine
Rantai approval multi-langkah yang generik, bisa dikonfigurasi per tipe:

| Tipe | Rantai (default) |
|---|---|
| Expense ≤ threshold A | Division Head |
| Expense threshold A–B | Division Head → Finance |
| Expense > threshold B | Division Head → Finance → **Owner** |
| Artist offer | Talent Head → Finance → **Owner** |
| Kontrak (apa pun) | Review Legal → **Owner** |
| Deal sponsorship | Sponsorship Head → Legal → **Owner** |
| Konten/pengumuman publik | Marketing Head |

Threshold dan mata uang bisa diatur (org settings). Tiap langkah: approve / reject / request changes, dengan komentar. Riwayat lengkap tersimpan.

### 6.10 Notifikasi

| Trigger | In-app | Email | Penerima |
|---|---|---|---|
| Task di-assign ke Anda | ✓ | ✓ | assignee |
| @mention di komentar | ✓ | ✓ | user yang di-mention |
| Due dalam 24 jam / overdue | ✓ | ✓ | assignee + Head (overdue) |
| Dependency selesai (unblocked) | ✓ | — | assignee |
| Approval diminta | ✓ | ✓ | approver |
| Approval diputuskan | ✓ | ✓ | pemohon |
| Submission eksternal masuk | ✓ | ✓ | reviewer divisi |
| Request handoff | ✓ | ✓ | Head penerima |
| Daily digest (opt-in) | — | ✓ | semua internal |
| Weekly executive digest | — | ✓ | Owner |

In-app = realtime via SSE (server-sent events). Opsi nanti: bridge WhatsApp/Telegram.

### 6.11 Executive dashboard (Owner)
- **Kartu portofolio**: setiap event aktif dengan countdown, fase, health status, % penyerapan budget.
- **Antrian pending approvals**: approve/reject inline dengan komentar — permukaan aksi utama Owner.
- Budget vs actual per event; total committed seluruh portofolio.
- Milestone terdekat (14 hari ke depan) + blocker lintas divisi dan titik rawan overdue.
- Snapshot penjualan tiket (input manual harian oleh Ticketing di MVP; integrasi menyusul).
- Feed aktivitas terbaru.

### 6.12 Audit & activity log
Setiap create/update/approval/perubahan permission tercatat (siapa, apa, kapan). Bisa difilter; terlihat oleh Owner/Admin.

### 6.13 Pencarian
Pencarian global lintas task, event, file, orang — sesuai permission.

## 7. Tech stack

Self-hosted — tanpa layanan cloud terkelola. Database adalah PostgreSQL lokal di server perusahaan; aplikasi di-deploy ke server yang sama.

| Layer | Pilihan | Alasan |
|---|---|---|
| App | Next.js (App Router, TypeScript) + Tailwind + shadcn/ui bergaya monokrom RVC | Full-stack satu codebase, sesuai estetika minimal |
| Database | **PostgreSQL (lokal, self-hosted)** + Drizzle ORM + migrations | Kontrol penuh, tanpa vendor lock-in |
| Auth | Auth.js (NextAuth v5): email+password untuk staff internal, **magic link untuk guest eksternal** | Akses guest tanpa friksi password |
| Otorisasi | Modul permission terpusat di service layer (scope role + divisi + event) | Satu tempat untuk diaudit; opsi hardening Postgres RLS nanti |
| Notifikasi realtime | SSE (server-sent events) | Tanpa infrastruktur tambahan |
| Penyimpanan file | Disk server (`/uploads`, dilayani nginx, digated auth); MinIO nanti jika perlu | Sederhana, ikut backup server |
| Email | SMTP (SMTP perusahaan atau Resend) | Transaksional + digest |
| Background jobs | node-cron (pengingat due date, digest, hitung ulang health) | Berjalan di dalam proses app |
| Deployment | Docker Compose (Next.js + Postgres + nginx reverse proxy) di server perusahaan | Reproducible, mudah backup/restore |

## 8. Data model (tabel utama)

`profiles`, `divisions`, `division_members` (user + divisi + role), `events`, `event_divisions`, `tasks`, `task_assignees`, `task_watchers`, `task_dependencies`, `task_checklist_items`, `labels`, `comments`, `attachments`, `documents`, `budgets`, `budget_lines`, `expense_requests`, `approvals`, `approval_steps`, `form_templates`, `form_submissions`, `external_invites`, `notifications`, `activity_log`, `run_of_show_items`, `ticket_sales_snapshots`, `event_templates`.

## 9. Roadmap

**Fase 1 — Fondasi (langsung bisa dipakai)**
Auth + struktur organisasi + role (modul otorisasi terpusat), event, task (list + kanban), My Tasks, komentar/@mention, lampiran, notifikasi in-app, tema monokrom RVC + countdown event.

**Fase 2 — Layer Owner**
Approval engine, budget + expense request, executive dashboard, notifikasi email, activity log.

**Fase 3 — Eksternal & skala**
Guest portal (magic link), form submission terstruktur + review queue, template playbook event, timeline (Gantt) + kalender, run of show, snapshot penjualan tiket.

**Fase 4 — Polish**
Digest harian/mingguan, laporan & ekspor (laporan settlement event), pencarian global, UI audit, polish mobile/PWA.

## 10. Pertanyaan terbuka

1. Angka threshold approval & mata uang (IDR? USD? keduanya?) — default sudah diusulkan, butuh angka dari Owner.
2. Kanal notifikasi selain email — perlukah WhatsApp/Telegram sejak awal?
3. Ticketing: snapshot manual harian cukup untuk MVP, atau ada API platform ticketing yang bisa diintegrasikan?
4. Satu organisasi (RVC saja) atau dukungan multi-brand nanti?
