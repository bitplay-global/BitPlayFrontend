// Temporary polyfill for Node versions that do not support Array.prototype.toReversed (Node < 20)
// This unblocks Metro from using toReversed internally during bundling.
if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value: function () {
      return this.slice().reverse();
    },
    writable: true,
    configurable: true,
  });
}

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const config = {
  transformer: {
    ...defaultConfig.transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    sourceExts: [
      'js',
      'jsx',
      'json',
      'ts',
      'tsx',
      'cjs',
      'svg',
    ],
    ...defaultConfig.resolver,
    assetExts: defaultConfig.resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
    blockList: [
      // Exclude unnecessary directories to reduce file watchers
      /node_modules\/.*\/android\/.*/,
      /node_modules\/.*\/ios\/.*/,
      /node_modules\/.*\/\.git\/.*/,
      /node_modules\/.*\/docs\/.*/,
      /node_modules\/.*\/example\/.*/,
      /node_modules\/.*\/examples\/.*/,
      /node_modules\/.*\/test\/.*/,
      /node_modules\/.*\/tests\/.*/,
      /node_modules\/.*\/\.vscode\/.*/,
      /node_modules\/.*\/\.idea\/.*/,
      /node_modules\/react-native-fbsdk-next\/lib\/.*/,
      /node_modules\/react-native-fbsdk-next\/src\/.*/,
    ],
  },
  watchFolders: [],
};

module.exports = mergeConfig(defaultConfig, config);
