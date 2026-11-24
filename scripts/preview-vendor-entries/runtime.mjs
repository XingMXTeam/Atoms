/**
 * Combined preview vendor — one React instance for the sandboxed iframe.
 * Built as a minified production IIFE on globalThis.__ATOMS_PREVIEW_VENDOR__.
 */
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { createRoot, hydrateRoot } from "react-dom/client";

const vendor = {
  default: React,
  ...React,
  Fragment: jsxRuntime.Fragment,
  jsx: jsxRuntime.jsx,
  jsxs: jsxRuntime.jsxs,
  jsxDEV: jsxRuntime.jsxDEV ?? jsxRuntime.jsx,
  createRoot,
  hydrateRoot,
};

globalThis.__ATOMS_PREVIEW_VENDOR__ = vendor;
export default vendor;
