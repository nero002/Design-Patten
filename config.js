const StyleDictionary = require('style-dictionary').default;
const fs = require('fs');
const path = require('path');

const tokenSegmentCache = new WeakMap();
const tokensV2Path = process.env.TOKEN_V2_PATH || path.join(__dirname, 'tokens/design-tokens.tokens-2.json');

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

function normalizeTokensForGroups(tokens) {
  function transform(value) {
    if (Array.isArray(value)) {
      return value.map(item => transform(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    if (isShadowGroup(value)) {
      return {
        type: 'boxShadow',
        value: []
      };
    }
    if (isTokenObject(value)) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, transform(child)])
    );
  }

  return transform(tokens);
}

function toNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return '0';
  }
  return Number.isInteger(value) ? `${value}` : `${value}`;
}

function formatUnit(value, unit) {
  const num = toNumber(value);
  if (num === null) {
    return `0.${unit}`;
  }
  const numString = formatNumber(num);
  return num < 0 ? `(${numString}).${unit}` : `${numString}.${unit}`;
}

function formatFloat(value) {
  const num = toNumber(value);
  const result = num === null ? 0 : num;
  return Number.isInteger(result) ? `${result}f` : `${result}f`;
}

function toArgbHex(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch) {
    const hex = hexMatch[1].toUpperCase();
    if (hex.length === 6) {
      return `0xFF${hex}`;
    }
    const rr = hex.slice(0, 2);
    const gg = hex.slice(2, 4);
    const bb = hex.slice(4, 6);
    const aa = hex.slice(6, 8);
    return `0x${aa}${rr}${gg}${bb}`;
  }

  const rgbaMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map(part => part.trim());
    if (parts.length >= 3) {
      const r = Number.parseFloat(parts[0]);
      const g = Number.parseFloat(parts[1]);
      const b = Number.parseFloat(parts[2]);
      const a = parts.length === 4 ? Number.parseFloat(parts[3]) : 1;
      if ([r, g, b, a].every(num => Number.isFinite(num))) {
        const clamp = num => Math.max(0, Math.min(255, Math.round(num)));
        const alpha = Math.max(0, Math.min(1, a));
        const toHex = num => clamp(num).toString(16).padStart(2, '0').toUpperCase();
        const aa = Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0')
          .toUpperCase();
        return `0x${aa}${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
    }
  }

  return null;
}

function escapeKotlinString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function toKotlinIdentifier(name) {
  const safe = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(safe) ? `token${safe}` : safe;
}

function toPackageSegment(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitSegment(value) {
  return String(value)
    .replace(/iOS/g, 'IOS')
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean);
}

function splitPathSegment(value) {
  return String(value)
    .split('/')
    .map(part => part.trim())
    .filter(Boolean);
}

function getCachedTokenSegments(token) {
  if (tokenSegmentCache.has(token)) {
    return tokenSegmentCache.get(token);
  }
  const segments = getFullTokenSegments(token);
  tokenSegmentCache.set(token, segments);
  return segments;
}

function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function toValueName(segment) {
  const words = splitSegment(segment);
  if (!words.length) {
    return 'value';
  }
  const name = words
    .map((word, index) => {
      if (/^[A-Z0-9]+$/.test(word)) {
        return index === 0 ? word.toLowerCase() : word;
      }
      const lower = word.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
  return toKotlinIdentifier(name);
}

function getFullTokenSegments(token) {
  if (!Array.isArray(token.path) || !token.path.length) {
    return token.name ? splitPathSegment(token.name) : [];
  }

  return token.path.flatMap(segment => splitPathSegment(segment));
}

function getGroupSegments(segments, groupDepth) {
  if (segments.length < 2) {
    return [];
  }
  const groupSegments = segments.slice(0, -1);
  if (!groupDepth || groupDepth <= 0) {
    return groupSegments;
  }
  return groupSegments.slice(0, Math.min(groupDepth, groupSegments.length));
}

function renderTokenValue(token) {
  switch (token.type) {
    case 'color': {
      const argb = toArgbHex(token.value);
      return argb ? `Color(${argb})` : 'Color(0xFF000000)';
    }
    case 'boxShadow': {
      const shadows = Array.isArray(token.value) ? token.value : [token.value];
      const layers = shadows
        .filter(layer => layer && typeof layer === 'object')
        .map(layer => {
          const argb = toArgbHex(layer.color);
          const colorValue = argb ? `Color(${argb})` : 'Color(0xFF000000)';
          const x = formatFloat(layer.x);
          const y = formatFloat(layer.y);
          const blur = formatFloat(layer.blur);
          const spread = formatFloat(layer.spread);
          return `ShadowLayer(color = ${colorValue}, x = ${x}, y = ${y}, blur = ${blur}, spread = ${spread})`;
        });
      return `ElevationToken(layers = listOf(${layers.join(', ')}))`;
    }
    case 'dimension':
      return formatUnit(token.value, 'dp');
    case 'text':
      return `"${escapeKotlinString(String(token.value || ''))}"`;
    default:
      return `"${escapeKotlinString(String(token.value ?? ''))}"`;
  }
}

function collectGroupDefinitions(tokens, selectedSets, groupDepth) {
  const groups = new Map();

  function walk(obj, pathSegments) {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'type') && Object.prototype.hasOwnProperty.call(obj, 'value')) {
      const fullSegments = pathSegments.flatMap(segment => splitPathSegment(segment));
      const groupSegments = getGroupSegments(fullSegments, groupDepth);
      if (groupSegments.length < 1) {
        return;
      }
      const key = groupSegments.join('/');
      if (!groups.has(key)) {
        groups.set(key, { segments: groupSegments });
      }
      return;
    }

    Object.entries(obj).forEach(([key, value]) => walk(value, pathSegments.concat(key)));
  }

  selectedSets.forEach(setName => {
    if (!tokens[setName]) {
      return;
    }
    walk(tokens[setName], [setName]);
  });

  return [...groups.values()].sort((a, b) => a.segments.join('/').localeCompare(b.segments.join('/')));
}

function loadTokenData() {
  if (!fs.existsSync(tokensV2Path)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(tokensV2Path, 'utf8'));
  } catch (error) {
    return null;
  }
}

StyleDictionary.registerTransformGroup({
  name: 'compose',
  transforms: ['attribute/cti', 'name/camel']
});

StyleDictionary.registerFormat({
  name: 'android/compose',
  format: function ({ dictionary, file }) {
    const packageName = file.options?.packageName || 'com.allegion.designtokens';
    const className = file.options?.className || 'Tokens';
    const tokens = dictionary.allTokens || [];
    const hasColors = tokens.some(token => token.type === 'color');
    const hasDimensions = tokens.some(token => token.type === 'dimension');
    const hasTypography = tokens.some(token => token.type === 'typography');
    const hasBoxShadows = tokens.some(token => token.type === 'boxShadow');

    const imports = new Set();
    if (hasColors || hasBoxShadows) {
      imports.add('androidx.compose.ui.graphics.Color');
    }
    if (hasDimensions) {
      imports.add('androidx.compose.ui.unit.dp');
    }
    if (hasTypography) {
      imports.add('androidx.compose.ui.text.font.FontWeight');
      imports.add('androidx.compose.ui.unit.TextUnit');
      imports.add('androidx.compose.ui.unit.sp');
      imports.add('androidx.compose.ui.unit.em');
    }

    const lines = [];
    lines.push('// Auto-generated by Style Dictionary. Do not edit.');
    if (file.options?.groupPath) {
      lines.push(`// Path: ${file.options.groupPath}`);
    }
    lines.push(`package ${packageName}`);
    lines.push('');

    if (imports.size) {
      [...imports].sort().forEach(entry => lines.push(`import ${entry}`));
      lines.push('');
    }

    if (hasBoxShadows) {
      lines.push('data class ShadowLayer(');
      lines.push('  val color: Color,');
      lines.push('  val x: Float,');
      lines.push('  val y: Float,');
      lines.push('  val blur: Float,');
      lines.push('  val spread: Float');
      lines.push(')');
      lines.push('');
      lines.push('data class ElevationToken(');
      lines.push('  val layers: List<ShadowLayer>');
      lines.push(')');
      lines.push('');
    }

    if (hasTypography) {
      lines.push('data class TypographyToken(');
      lines.push('  val fontFamily: String,');
      lines.push('  val fontWeight: FontWeight,');
      lines.push('  val fontSize: TextUnit,');
      lines.push('  val lineHeight: TextUnit,');
      lines.push('  val letterSpacing: TextUnit');
      lines.push(')');
      lines.push('');
    }

    lines.push(`object ${className} {`);
    const usedNames = new Map();
    const sortedTokens = tokens
      .slice()
      .sort((a, b) => getCachedTokenSegments(a).join('/').localeCompare(getCachedTokenSegments(b).join('/')));
    sortedTokens.forEach(token => {
      const segments = getCachedTokenSegments(token);
      const leaf = segments[segments.length - 1] || token.name || 'value';
      const baseName = toValueName(leaf);
      const count = usedNames.get(baseName) || 0;
      const name = count === 0 ? baseName : `${baseName}_${hashString(segments.join('/')).slice(0, 6)}`;
      usedNames.set(baseName, count + 1);

      if (token.type === 'typography') {
        const value = token.value || {};
        const fontFamily = escapeKotlinString(String(value.fontFamily || ''));
        const fontWeight = toNumber(value.fontWeight);
        const fontSize = formatUnit(value.fontSize, 'sp');
        const lineHeight = formatUnit(value.lineHeight, 'sp');
        const letterSpacingValue = toNumber(value.letterSpacing);
        const letterUnit = letterSpacingValue !== null && Math.abs(letterSpacingValue) < 1 ? 'em' : 'sp';
        const letterSpacing = formatUnit(value.letterSpacing, letterUnit);
        lines.push(`  val ${name} = TypographyToken(`);
        lines.push(`    fontFamily = "${fontFamily}",`);
        lines.push(
          `    fontWeight = FontWeight(${fontWeight === null ? 400 : formatNumber(fontWeight)}),`
        );
        lines.push(`    fontSize = ${fontSize},`);
        lines.push(`    lineHeight = ${lineHeight},`);
        lines.push(`    letterSpacing = ${letterSpacing}`);
        lines.push('  )');
        return;
      }

      const value = renderTokenValue(token);
      lines.push(`  val ${name} = ${value}`);
    });

    lines.push('}');
    lines.push('');

    return lines.join('\n');
  }
});

const tokensData = loadTokenData();
const tokensForGroups = (() => {
  if (!tokensData || typeof tokensData !== 'object') {
    return null;
  }
  const normalized = normalizeTokensForGroups(tokensData);
  if (normalized.font && normalized.typography && hasCustomFontStyle(normalized.font)) {
    const pruned = { ...normalized };
    delete pruned.typography;
    return pruned;
  }
  return normalized;
})();
const selectedSets = tokensForGroups
  ? Object.keys(tokensForGroups).filter(key => !key.startsWith('$'))
  : [];
const groupDepth = (() => {
  if (!process.env.TOKEN_GROUP_DEPTH) {
    return null;
  }
  const parsed = Number.parseInt(process.env.TOKEN_GROUP_DEPTH, 10);
  return Number.isNaN(parsed) ? null : Math.max(parsed, 1);
})();
const groupDefinitions = collectGroupDefinitions(tokensForGroups || {}, selectedSets, groupDepth);
const basePackage = 'com.allegion.designtokens';

const composeFiles = groupDefinitions.map(group => {
  const packageSegments = group.segments.map(toPackageSegment).filter(Boolean);
  const packageName = [basePackage, ...packageSegments].filter(Boolean).join('.');
  const outputDir = packageSegments.length ? `${packageSegments.join('/')}/` : '';
  const groupPath = group.segments.join('/');

  return {
    destination: `${outputDir}Tokens.kt`,
    format: 'android/compose',
    options: {
      packageName,
      className: 'Tokens',
      groupPath
    },
    filter: token => {
      const segments = getCachedTokenSegments(token);
      const groupSegments = getGroupSegments(segments, groupDepth);
      if (!groupSegments.length) {
        return false;
      }
      return groupSegments.join('/') === groupPath;
    }
  };
});

if (!composeFiles.length) {
  composeFiles.push({
    destination: 'Tokens.kt',
    format: 'android/compose',
    options: {
      packageName: basePackage,
      className: 'Tokens'
    }
  });
}

module.exports = {
  source: [tokensV2Path],
  platforms: {
    ios: {
      transformGroup: 'ios',
      buildPath: 'build/ios/',
      files: [
        {
          destination: 'Colors.swift',
          format: 'ios-swift/class.swift',
          className: 'Tokens',
          filter: {
            type: 'color'
          }
        },
        {
          destination: 'Spacing.swift',
          format: 'ios-swift/class.swift',
          className: 'Spacing',
          filter: {
            type: 'dimension'
          }
        },
        {
          destination: 'Typography.swift',
          format: 'ios-swift/class.swift',
          className: 'Typography',
          filter: {
            type: 'typography'
          }
        },
        {
          destination: 'BorderRadius.swift',
          format: 'ios-swift/class.swift',
          className: 'BorderRadius',
          filter: {
            category: 'border-radius'
          }
        },
        {
          destination: 'Grid.swift',
          format: 'ios-swift/class.swift',
          className: 'Grid',
          filter: {
            category: 'grid'
          }
        },
        {
          destination: 'Elevation.swift',
          format: 'ios-swift/class.swift',
          className: 'Elevation',
          filter: {
            category: 'elevation'
          }
        }
      ]
    },
    android: {
      transformGroup: 'android',
      buildPath: 'build/android/',
      files: [
        {
          destination: 'colors.xml',
          format: 'android/colors',
          filter: {
            type: 'color'
          }
        },
        {
          destination: 'dimens.xml',
          format: 'android/dimens',
          filter: {
            type: 'dimension'
          }
        },
        {
          destination: 'typography.xml',
          format: 'android/fontDimens',
          filter: {
            type: 'typography'
          }
        }
      ]
    },
    androidCompose: {
      transformGroup: 'compose',
      buildPath: 'build/android-compose/',
      files: composeFiles
    },
    css: {
      transformGroup: 'css',
      buildPath: 'build/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables'
        }
      ]
    },
    scss: {
      transformGroup: 'scss',
      buildPath: 'build/scss/',
      files: [
        {
          destination: '_tokens.scss',
          format: 'scss/variables'
        }
      ]
    }
  }
};
