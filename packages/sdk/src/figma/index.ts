/**
 * Figma Integration Module
 *
 * Exports Figma client and types for context extraction.
 */

export { FigmaClient, createFigmaClient } from './figma.client';
export type {
  FigmaFile,
  FigmaComment,
  FigmaScreenshot,
  FigmaDesignContext,
  FigmaUser,
  FigmaNode,
  FigmaImagesResponse,
} from './figma.types';
