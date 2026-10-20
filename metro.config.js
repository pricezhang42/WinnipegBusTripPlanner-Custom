const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const root = escape(__dirname + path.sep);
const existing = config.resolver.blockList;

// Database tools and private files are Node-only, never mobile dependencies.
// Expo watches .local files; Git ignores do not exclude them from Metro.
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  new RegExp(`^${root}\\.env\\.database(?:\\..*)?$`),
  new RegExp(`^${root}(?:\\.database|scripts/database|supabase)(?:[/\\\\]|$)`),
  new RegExp(`^${root}prod-ca-2021[^/\\\\]*\\.crt$`),
];

module.exports = config;
