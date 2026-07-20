git add DECISIONS.md README.md S2C.md next.config.ts package.json package-lock.json
git commit -m "chore: update documentation and core configurations"

git add convex/
git commit -m "feat(backend): implement convex schema and queries"

git add "src/app/(protected)/dashboard/billing/" "src/components/buttons/checkout-button.tsx" "src/hooks/use-billing.ts" "src/lib/billing.ts" "src/redux/api/billing/" "src/app/(protected)/dashboard/page.tsx"
git commit -m "feat(billing): integrate payments and subscription gating"

git add "src/app/api/project/" "src/components/projects/" "src/hooks/use-autosave.ts" "src/hooks/use-project.ts" "src/redux/api/project/" "src/redux/slices/projects/"
git commit -m "feat(projects): add project management and autosave functionality"

git add "src/app/api/generate/" "src/redux/slices/chat/"
git commit -m "feat(ai): enhance generation context and chat state"

git add "src/components/canvas/" "src/hooks/use-canvas-drawing.ts" "src/hooks/use-canvas.ts" "src/lib/canvas-hit-test.ts" "src/lib/frame-snapshot.ts" "src/redux/slices/shapes/"
git commit -m "feat(canvas): implement core canvas engine and shapes"

git add src/app/globals.css src/app/layout.tsx src/app/page.tsx "src/components/navbar/" "src/components/theme-toggle.tsx" "src/inngest/" "src/lib/preload.ts"
git commit -m "feat(ui): update application layouts and components"

git push
