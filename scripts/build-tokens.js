const StyleDictionary = require('style-dictionary').default;
const config = require('../config.js');
const fs = require('fs');
const path = require('path');

function isTokenObject(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, 'type')
    && Object.prototype.hasOwnProperty.call(value, 'value');
}

function hasCustomFontStyle(tokens) {
  let found = false;
  (function walk(obj) {
    if (found || !obj || typeof obj !== 'object') {
      return;
    }
    if (isTokenObject(obj) && obj.type === 'custom-fontStyle') {
      found = true;
      return;
    }
    Object.values(obj).forEach(child => walk(child));
  })(tokens);
  return found;
}

function isShadowGroup(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value).filter(([key]) => key !== 'description');
  if (!entries.length) {
    return false;
  }
  return entries.every(([, entryValue]) => isTokenObject(entryValue) && entryValue.type === 'custom-shadow');
}

function mapShadowLayer(shadowValue) {
  const safe = shadowValue && typeof shadowValue === 'object' ? shadowValue : {};
  return {
    color: safe.color || '#00000000',
    x: safe.offsetX || 0,
    y: safe.offsetY || 0,
    blur: safe.radius || 0,
    spread: safe.spread || 0
  };
}

function normalizeTokensFromV2(tokens) {
  const dropTypography = tokens
    && tokens.font
    && tokens.typography
    && hasCustomFontStyle(tokens.font);

  function transform(value) {
    if (Array.isArray(value)) {
      return value.map(item => transform(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    if (isTokenObject(value)) {
      if (value.type === 'custom-fontStyle') {
        return {
          ...value,
          type: 'typography'
        };
      }
      if (value.type === 'custom-shadow') {
        return {
          ...value,
          type: 'boxShadow',
          value: [mapShadowLayer(value.value)]
        };
      }
      return value;
    }
    if (isShadowGroup(value)) {
      const layers = Object.entries(value)
        .filter(([key]) => key !== 'description')
        .sort((a, b) => {
          const aNum = Number(a[0]);
          const bNum = Number(b[0]);
          if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
            return aNum - bNum;
          }
          return a[0].localeCompare(b[0]);
        })
        .map(([, entryValue]) => mapShadowLayer(entryValue.value));
      const token = {
        type: 'boxShadow',
        value: layers
      };
      if (Object.prototype.hasOwnProperty.call(value, 'description') && value.description) {
        token.description = value.description;
      }
      return token;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, transform(child)])
    );
  }

  const normalized = transform(tokens);
  if (dropTypography && normalized && normalized.typography) {
    delete normalized.typography;
  }
  return normalized;
}

function prepareTokensFromV2(sourcePath, tokensDir) {
  const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const normalized = normalizeTokensFromV2(raw);
  const outputPath = path.join(tokensDir, 'tokens.generated.tokens.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return outputPath;
}

async function buildTokens() {
  console.log('Build started...');
  console.log('\n==============================================');

  const tokensDir = path.join(__dirname, '../tokens');
  if (!fs.existsSync(tokensDir)) {
    fs.mkdirSync(tokensDir, { recursive: true });
  }

  const tokensV2Path =
    process.env.TOKEN_V2_PATH || path.join(__dirname, '../tokens/design-tokens.tokens-2.json');

  if (!fs.existsSync(tokensV2Path)) {
    console.error(`Token source not found: ${tokensV2Path}`);
    process.exit(1);
  }

  if (process.env.TOKEN_V2_PATH) {
    console.log('Using TOKEN_V2_PATH for token build.');
  } else {
    console.log('Using design-tokens.tokens-2.json for token build.');
  }
  const generatedPath = prepareTokensFromV2(tokensV2Path, tokensDir);
  config.source = [generatedPath];

  // Create and configure StyleDictionary instance
  const sd = new StyleDictionary(config);

  // Build for all platforms
  console.log('\nBuilding tokens for all platforms...');

  try {
    await sd.buildAllPlatforms();
  console.log('\n==============================================');
  console.log('Build completed successfully!');
  
  // Log the generated files
  const buildDir = path.join(__dirname, '../build');
  if (fs.existsSync(buildDir)) {
    console.log('\nGenerated files:');
    const platforms = fs.readdirSync(buildDir);
    platforms.forEach(platform => {
      const platformDir = path.join(buildDir, platform);
      if (fs.statSync(platformDir).isDirectory()) {
        console.log(`\n${platform.toUpperCase()}:`);
        const files = fs.readdirSync(platformDir);
        files.forEach(file => {
          const filePath = path.join(platformDir, file);
          const stats = fs.statSync(filePath);
          console.log(`  - ${file} (${stats.size} bytes)`);
        });
      }
    });
  }
  
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }

  console.log('\n==============================================');
}

buildTokens().catch(error => {
  console.error('Build failed:', error.message);
  process.exit(1);
});
