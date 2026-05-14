const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so workspace packages (game-core, protocol) hot-reload.
config.watchFolders = [workspaceRoot];

// Resolve modules from both the app and the workspace root (pnpm hoists some deps there).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// pnpm uses symlinks for workspace packages — Metro must follow them.
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = false;

// Our shared packages export raw .ts/.tsx; Metro must transform them.
config.resolver.sourceExts = [...config.resolver.sourceExts, "cjs", "mjs"];

module.exports = withNativeWind(config, { input: "./global.css" });
