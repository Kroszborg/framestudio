/**
 * Expo config plugin — copies our custom ProGuard rules into the Android project
 * and wires them into the release build configuration.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const withProguard = (config) => {
  return withAppBuildGradle(config, (mod) => {
    const buildGradle = mod.modResults.contents;

    // Copy proguard rules file to android/app/ if it exists in project root
    try {
      const src = path.join(mod.modRequest.projectRoot, 'android-proguard-rules.pro');
      const dest = path.join(mod.modRequest.projectRoot, 'android', 'app', 'framestudio-proguard-rules.pro');
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    } catch (_) {}

    // Add our rules file to the release buildType if not already present
    if (!buildGradle.includes('framestudio-proguard-rules.pro')) {
      mod.modResults.contents = buildGradle.replace(
        /release\s*\{([^}]*proguardFiles[^}]*)\}/s,
        (match, inner) => {
          if (inner.includes('framestudio-proguard-rules.pro')) return match;
          return match.replace(
            /proguardFiles[^\n]*/,
            (pf) => `${pf}\n            proguardFile 'framestudio-proguard-rules.pro'`
          );
        }
      );
    }

    return mod;
  });
};

module.exports = withProguard;
