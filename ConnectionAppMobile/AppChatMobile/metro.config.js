const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure Metro to handle Zego native modules
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
};

// Disable minification for Zego packages to avoid bundler issues
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  mangle: {
    ...config.transformer.minifierConfig?.mangle,
    keep_fnames: true,
  },
  compress: {
    ...config.transformer.minifierConfig?.compress,
    keep_fnames: true,
  },
};

module.exports = config;
