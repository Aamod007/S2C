"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ColorGroup, Swatch } from "@/types/style-guide";

/** A single color swatch card: color block + name, hex, description. */
export function SwatchCard({ swatch }: { swatch: Swatch }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div
        className="h-20 w-full border-b border-border/50"
        style={{ backgroundColor: swatch.hex }}
        aria-label={`${swatch.name} color: ${swatch.hex}`}
      />
      <CardContent className="space-y-1 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {swatch.name}
          </p>
          <code className="shrink-0 font-mono text-xs uppercase text-muted-foreground">
            {swatch.hex}
          </code>
        </div>
        {swatch.description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {swatch.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** A titled group of swatches (Primary, UI, Status, …). */
export function SwatchGroup({ group }: { group: ColorGroup }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {group.swatches.map((swatch) => (
          <SwatchCard key={`${group.title}-${swatch.name}`} swatch={swatch} />
        ))}
      </div>
    </section>
  );
}
