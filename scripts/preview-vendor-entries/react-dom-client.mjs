// Import through the package entry; react stays external via build flags so
// the preview IIFE shares one React instance with the app + jsx-runtime.
export { createRoot, hydrateRoot } from "react-dom/client";
import * as ReactDOMClient from "react-dom/client";
export default ReactDOMClient;
