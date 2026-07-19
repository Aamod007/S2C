# DECISIONS.md

Log of any deviations from the build spec (`readme.md`) made during implementation.
Paste this into every new phase's prompt so the AI stays consistent with the actual codebase.

---

## Phase 0 — Scaffold

- **Next.js version**: Used `create-next-app@15.4.6` as specified. npm warns of a security vulnerability (CVE-2025-66478) — will upgrade to a patched 15.4.x once available.
- **App created in subdirectory**: Scaffolded into `s2c-app/` instead of repo root because the parent directory name "Sketch" has a capital letter which npm rejects as a package name.
- **shadcn preset**: Used "Nova" preset (Lucide + Geist fonts) with Radix base and CSS variables. The spec says "neutral base color" — Nova defaults to neutral.
- **`next-themes`**: Already bundled as a dependency by shadcn. Used `forcedTheme="dark"` as specified.
- **TooltipProvider**: Added to root layout as required by shadcn's tooltip component.
- **Sonner Toaster**: Positioned `bottom-right` with `richColors` enabled.
