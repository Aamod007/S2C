import { z } from "zod";

/**
 * Style guide schema per spec §7.1 — the exact shape produced by
 * `generateObject` in /api/generate/style and stored in `projects.style_guide`.
 */

export const swatchSchema = z.object({
  name: z
    .string()
    .describe("Short, evocative swatch name, e.g. 'Midnight Indigo'"),
  hex: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .describe("Hex color value, e.g. '#1e1b4b'"),
  description: z
    .string()
    .describe("Where and how this color should be used in the UI"),
});

export const colorGroupSchema = z.object({
  title: z
    .string()
    .describe(
      "Color group title — one of: 'Primary Colors', 'Secondary & Accent Colors', 'UI Component Colors', 'Utility & Form Colors', 'Status & Feedback Colors'"
    ),
  swatches: z
    .array(swatchSchema)
    .min(1)
    .describe("The swatches belonging to this group"),
});

export const typographyStyleSchema = z.object({
  name: z
    .string()
    .describe("Style name, e.g. 'H1 / Page Title', 'Body', 'Caption'"),
  fontFamily: z
    .string()
    .describe("CSS font-family stack, e.g. \"'Inter', sans-serif\""),
  fontSize: z.string().describe("CSS font-size, e.g. '2.25rem'"),
  fontWeight: z.string().describe("CSS font-weight, e.g. '700'"),
  lineHeight: z.string().describe("CSS line-height, e.g. '1.2'"),
  letterSpacing: z
    .string()
    .optional()
    .describe("CSS letter-spacing, e.g. '-0.02em'"),
  description: z
    .string()
    .optional()
    .describe("When to use this text style"),
});

export const typographyGroupSchema = z.object({
  title: z
    .string()
    .describe("Typography group title, e.g. 'Headings', 'Body Text'"),
  styles: z
    .array(typographyStyleSchema)
    .min(1)
    .describe("The text styles belonging to this group"),
});

export const styleGuideSchema = z.object({
  theme: z
    .string()
    .describe("A short name for the overall visual theme, e.g. 'Calm Fintech Dark'"),
  description: z
    .string()
    .describe("2-4 sentences describing the design language, mood, and aesthetic direction"),
  colors: z
    .array(colorGroupSchema)
    .min(3)
    .describe(
      "Color groups covering primary, secondary/accent, UI/neutral, and status colors"
    ),
  typography: z
    .array(typographyGroupSchema)
    .min(1)
    .describe("Typography groups covering headings, body, and supporting text"),
});

export type Swatch = z.infer<typeof swatchSchema>;
export type ColorGroup = z.infer<typeof colorGroupSchema>;
export type TypographyStyle = z.infer<typeof typographyStyleSchema>;
export type TypographyGroup = z.infer<typeof typographyGroupSchema>;
export type StyleGuide = z.infer<typeof styleGuideSchema>;

/**
 * Schema for the workflow "derive pages" mode (spec §7.4 improvement):
 * dynamically suggested next pages based on the main page's content,
 * instead of the source project's hardcoded list.
 */
export const suggestedPagesSchema = z.object({
  pages: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Short page name, e.g. 'Analytics Dashboard'"),
        description: z
          .string()
          .describe(
            "One sentence on what this page contains and why it logically follows from the main page"
          ),
      })
    )
    .min(3)
    .max(4)
    .describe("3-4 pages that would logically extend this product"),
});

export type SuggestedPages = z.infer<typeof suggestedPagesSchema>;
