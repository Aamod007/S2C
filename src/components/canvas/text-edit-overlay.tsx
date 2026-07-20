"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { removeShape, shapesSelectors, updateShape } from "@/redux/slices/shapes";
import { worldToScreen } from "@/redux/slices/viewport";
import { TextShape } from "@/redux/slices/shapes";

interface TextEditOverlayProps {
  editingTextId: string;
  onDone: () => void;
}

/**
 * Absolutely-positioned HTML input over the canvas at a text shape's screen
 * position, styled to match the canvas-rendered text (spec 4f). Commit on
 * blur/Enter (empty text removes the shape), Escape cancels.
 */
export function TextEditOverlay({ editingTextId, onDone }: TextEditOverlayProps) {
  const dispatch = useAppDispatch();
  const shape = useAppSelector((state) =>
    shapesSelectors.selectById(state, editingTextId)
  ) as TextShape | undefined;
  const scale = useAppSelector((state) => state.viewport.scale);
  const translate = useAppSelector((state) => state.viewport.translate);

  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(shape?.text ?? "");
  // Original text captured once, for Escape-cancel.
  const originalTextRef = useRef(shape?.text ?? "");
  // Guards double-commit (Enter triggers blur).
  const doneRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // If the shape disappears externally (autosave re-hydration, undo…) while
  // the overlay is open, release editing state — otherwise editingTextId
  // stays set and permanently blocks every canvas keyboard shortcut.
  const shapeGone = !shape || shape.type !== "text";
  useEffect(() => {
    if (shapeGone && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }, [shapeGone, onDone]);

  if (!shape || shape.type !== "text") return null;

  const screen = worldToScreen(shape.x, shape.y, scale, translate);
  const fontSize = (shape.fontSize ?? 16) * scale;

  const commit = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const text = value.trim();
    if (text === "") {
      dispatch(removeShape(shape.id));
    } else {
      dispatch(updateShape({ id: shape.id, patch: { text } }));
    }
    onDone();
  };

  const cancel = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (originalTextRef.current.trim() === "") {
      dispatch(removeShape(shape.id)); // brand-new empty text → discard
    }
    onDone();
  };

  // Default dark-era inks map to the theme's foreground color (matches the
  // canvas renderer's themedInk mapping); custom colors pass through.
  const isDefaultInk =
    !shape.color || ["#ffffff", "#fff", "#e4e4e7"].includes(shape.color.toLowerCase());

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation(); // canvas shortcuts must not fire while editing
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") cancel();
      }}
      className="absolute z-20 min-w-[4ch] border-none bg-transparent p-0 text-foreground outline-none ring-1 ring-primary/60"
      style={{
        left: screen.x,
        top: screen.y,
        fontSize,
        fontFamily: shape.fontFamily ?? "sans-serif",
        fontWeight: shape.fontWeight ?? "normal",
        fontStyle: shape.fontStyle ?? "normal",
        ...(isDefaultInk ? {} : { color: shape.color }),
        lineHeight: 1,
        width: `${Math.max(value.length + 2, 4)}ch`,
      }}
      spellCheck={false}
    />
  );
}

