/**
 * Combined preview vendor — one React instance for the sandboxed iframe.
 * Built as an IIFE that assigns to globalThis.__ATOMS_PREVIEW_VENDOR__.
 */
import React from "react";
import { Fragment, jsx, jsxs, jsxDEV } from "react/jsx-runtime";
import { createRoot, hydrateRoot } from "react-dom/client";

const vendor = {
  default: React,
  ...React,
  Fragment,
  jsx,
  jsxs,
  jsxDEV,
  createRoot,
  hydrateRoot,
};

globalThis.__ATOMS_PREVIEW_VENDOR__ = vendor;
export default vendor;
