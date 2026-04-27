const appJson = require('./app.json');

const allowCleartext = process.env.CLAWFACE_ALLOW_CLEARTEXT === 'true';

module.exports = {
  ...appJson.expo,
  plugins: appJson.expo.plugins.map(plugin => {
    if (Array.isArray(plugin) && plugin[0] === 'expo-build-properties') {
      return [
        plugin[0],
        {
          ...plugin[1],
          android: {
            ...plugin[1].android,
            usesCleartextTraffic: allowCleartext,
          },
        },
      ];
    }
    return plugin;
  }),
};
