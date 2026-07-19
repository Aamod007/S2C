"use client";

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  addUserMessage,
  finishedStreamingResponse,
  handleError,
  initializeChat,
  startStreamingResponse,
  updateStreamingContent,
} from "@/redux/slices/chat";
import { shapesSelectors, updateShape } from "@/redux/slices/shapes";
import { GeneratedUIShape, Shape } from "@/types/shapes";
import {
  readHtmlStream,
  toGenerationError,
  toastGenerationError,
  GenerationRequestError,
} from "@/hooks/use-frame";

/**
 * Per-generated-UI chat redesign (spec §7.3). Wraps the chat slice keyed by
 * shape id: send(message) streams a full replacement HTML from
 * /api/generate/redesign into both the assistant bubble and the shape.
 */
export function useChatWindow(shapeId: string, projectId: string) {
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.chat.sessions[shapeId]);
  const shape = useAppSelector((state) =>
    shapesSelectors.selectById(state, shapeId)
  ) as GeneratedUIShape | undefined;

  const messages = session?.messages ?? [];
  const isStreaming = session?.isStreaming ?? false;

  const send = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim();
      if (!message || isStreaming) return;

      const currentHtml =
        shape && typeof shape.uiSpecData === "string" ? shape.uiSpecData : "";
      if (!currentHtml.trim()) {
        toast.error("This design has no content to redesign yet.");
        return;
      }

      dispatch(initializeChat(shapeId));
      dispatch(
        addUserMessage({
          shapeId,
          message: {
            id: uuidv4(),
            role: "user",
            content: message,
            timestamp: Date.now(),
          },
        })
      );
      const assistantId = uuidv4();
      dispatch(startStreamingResponse({ shapeId, messageId: assistantId }));
      dispatch(
        updateShape({
          id: shapeId,
          changes: { status: "streaming" } as Partial<Shape>,
        })
      );

      try {
        const res = await fetch("/api/generate/redesign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            message,
            currentHtml,
            shapeId,
            requestId: uuidv4(),
          }),
        });
        if (!res.ok) throw await toGenerationError(res);

        // Stream: live-update both the chat bubble and the shape's HTML
        // (single throttled flush drives both dispatches).
        const html = await readHtmlStream(res, (acc) => {
          dispatch(updateStreamingContent({ shapeId, content: acc }));
          dispatch(
            updateShape({
              id: shapeId,
              changes: { uiSpecData: acc } as Partial<Shape>,
            })
          );
        });

        dispatch(updateStreamingContent({ shapeId, content: html }));
        dispatch(finishedStreamingResponse(shapeId));
        dispatch(
          updateShape({
            id: shapeId,
            changes: { uiSpecData: html, status: "ready" } as Partial<Shape>,
          })
        );
        toast.success("Design updated");
      } catch (error) {
        dispatch(
          handleError({
            shapeId,
            error:
              error instanceof Error && error.message
                ? error.message
                : "Redesign failed",
          })
        );
        // Restore the pre-redesign HTML so a failed stream doesn't leave a
        // half-replaced design on the canvas.
        dispatch(
          updateShape({
            id: shapeId,
            changes: {
              uiSpecData: currentHtml,
              status: "ready",
            } as Partial<Shape>,
          })
        );
        toastGenerationError(error, "Redesign failed. Please try again.");
        if (
          error instanceof GenerationRequestError &&
          error.status === 402
        ) {
          return; // toast already explains; nothing else to do
        }
      }
    },
    [dispatch, isStreaming, projectId, shape, shapeId]
  );

  return { messages, isStreaming, send };
}
