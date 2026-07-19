"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { TypographyGroup, TypographyStyle } from "@/types/style-guide";

const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog";

/** Compact "prop: value" meta line under each type sample. */
function metaLine(style: TypographyStyle): string {
  return [
    style.fontFamily,
    style.fontSize,
    style.fontWeight && `weight ${style.fontWeight}`,
    style.lineHeight && `line-height ${style.lineHeight}`,
    style.letterSpacing && `tracking ${style.letterSpacing}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A single text style rendered as a live sample with its CSS applied. */
export function TypographySample({ style }: { style: TypographyStyle }) {
  return (
    <Card className="py-0">
      <CardContent className="space-y-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {style.name}
        </p>
        <p
          className="truncate text-foreground"
          style={{
            fontFamily: style.fontFamily || undefined,
            fontSize: style.fontSize || undefined,
            fontWeight: style.fontWeight || undefined,
            lineHeight: style.lineHeight || undefined,
            letterSpacing: style.letterSpacing || undefined,
          }}
        >
          {SAMPLE_TEXT}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {metaLine(style)}
        </p>
        {style.description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {style.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** A titled group of text styles (Headings, Body, …). */
export function TypographyGroupSection({ group }: { group: TypographyGroup }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
      <div className="space-y-3">
        {group.styles.map((style) => (
          <TypographySample key={`${group.title}-${style.name}`} style={style} />
        ))}
      </div>
    </section>
  );
}
