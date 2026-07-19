"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Palette } from "lucide-react";
import { SwatchGroup } from "@/components/style/swatch";
import { TypographyGroupSection } from "@/components/style/typography";
import type { StyleGuide } from "@/types/style-guide";

/** Rendered style guide: theme header + Colors / Typography tabs. */
export function StyleGuideView({ styleGuide }: { styleGuide: StyleGuide }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          {styleGuide.theme}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {styleGuide.description}
        </p>
      </div>

      <Tabs defaultValue="colors">
        <TabsList>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="space-y-8 pt-4">
          {styleGuide.colors.map((group) => (
            <SwatchGroup key={group.title} group={group} />
          ))}
        </TabsContent>

        <TabsContent value="typography" className="space-y-8 pt-4">
          {styleGuide.typography.map((group) => (
            <TypographyGroupSection key={group.title} group={group} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Shown when the project has no style guide yet. */
export function StyleGuideEmptyState() {
  return (
    <Empty className="border border-dashed border-border/60 py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Palette />
        </EmptyMedia>
        <EmptyTitle>No style guide yet</EmptyTitle>
        <EmptyDescription>
          Upload mood board images above, then generate a style guide with AI —
          it will extract a color palette and typography system from your
          references.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
