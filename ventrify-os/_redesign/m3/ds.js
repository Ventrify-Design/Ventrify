// SHIM — the M3 render layer now lives at ventrify-os/shared/m3/ (a DEPLOYING location,
// so the live workspace can load it; _redesign/ stays vercelignored). This forwards the
// workshop's `./ds.js` imports to the single source of truth. Edit shared/m3/ds.js, never this.
export * from '../../shared/m3/ds.js';
