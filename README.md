# Design Token Exporter

Automated design token processing and deployment for iOS and Android platforms using Figma Design Tokens plugin and Amazon Style Dictionary.

## Overview

This repository processes design tokens exported from Figma using the 'Design Tokens' plugin and automatically generates platform-specific token files for iOS (Swift) and Android (XML). The automation creates pull requests in the target repositories when tokens are updated.

## Features

- 🎨 **Figma Integration**: Processes tokens exported via the Figma Design Tokens plugin
- 📱 **Multi-Platform Support**: Generates tokens for iOS (Swift) and Android (XML)
- 🤖 **Automated Deployment**: Creates PRs in target repositories automatically
- 🔄 **CI/CD Pipeline**: GitHub Actions automation for token processing
- 📊 **Comprehensive Token Types**: Colors, spacing, typography, borders, grids, and elevation

## Token Files

Place your exported Figma token file in the `/tokens` directory:

- `design-tokens.tokens-2.json` - Design Tokens plugin export (colors, typography, effects, spacing, grids, borders, elevation)

Optional environment variables:

- `TOKEN_V2_PATH` - Override the path to the `design-tokens.tokens-2.json` file
- `TOKEN_GROUP_DEPTH` - Folder depth based on JSON path segments for Android Compose output

## Flow Diagram

```text
Figma Design Tokens export
  |
  v
tokens/design-tokens.tokens-2.json
  |
  v
npm run build:tokens
  |
  v
scripts/build-tokens.js
  - normalize v2 tokens
  - write tokens/tokens.generated.tokens.json
  |
  v
Style Dictionary (config.js)
  |
  v
build/ios/*.swift
build/android/*.xml
build/android-compose/**/Tokens.kt
  |
  v
npm run deploy (optional)
  |
  v
PRs to iOS/Android repos
```

Output folders and package names mirror the token key hierarchy in the input JSON.

## Generated Output

### iOS (Swift)
Generated files in `build/ios/`:
- `Colors.swift` - Color definitions
- `Spacing.swift` - Spacing scale
- `Typography.swift` - Font definitions
- `BorderRadius.swift` - Border radius values
- `Grid.swift` - Grid system
- `Elevation.swift` - Shadow/elevation tokens

### Android (XML)
Generated files in `build/android/`:
- `colors.xml` - Color resources
- `dimens.xml` - Dimension resources
- `typography.xml` - Font dimension resources

### Android Compose (Kotlin)
Generated files in `build/android-compose/<path>/Tokens.kt`, where `<path>` matches JSON
path segments (normalized to `lower_snake`). Each file includes an auto-generated header
comment with the JSON path. Token values are flat (no nested Kotlin objects). If leaf
names collide within a file, a short hash suffix is appended.

Documentation: `docs/android-compose.md`

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Place token file:**
   Copy `design-tokens.tokens-2.json` to the `/tokens` directory

3. **Build tokens:**
   ```bash
   npm run build:tokens
   ```

## Deployment

### Manual Deployment

Deploy to both iOS and Android repositories:
```bash
npm run deploy
```

Deploy to specific platform:
```bash
npm run deploy:ios     # Deploy only to iOS repository
npm run deploy:android # Deploy only to Android repository
```

### Prerequisites for Deployment

1. **GitHub CLI Installation:**
   ```bash
   # macOS
   brew install gh
   
   # Or download from: https://cli.github.com/
   ```

2. **Authentication:**
   ```bash
   gh auth login
   ```

3. **Repository Access:**
   Ensure you have write access to the target repositories:
   - `https://github.com/Allegion-Plc/adu-app-ios`
   - `https://github.com/Allegion-Plc/adu-app-android`

## Automation

### GitHub Actions Workflow

The automation runs on:
- Push to `main` branch (when token files change)
- Pull requests affecting token files
- Manual workflow dispatch

### Target Repositories

The automation creates pull requests in:
- **iOS**: `https://github.com/Allegion-Plc/adu-app-ios`
- **Android**: `https://github.com/Allegion-Plc/adu-app-android`

### File Deployment Paths

- **iOS**: Files are copied to `DesignTokens/` directory
- **Android**: Files are copied to `app/src/main/res/values/` directory
- **Android Compose**: Files are copied to `app/src/main/java/com/allegion/designtokens/`

## Token Structure

The system processes tokens in the Design Tokens Community Group format with Figma extensions:

```json
{
  "color": {
    "brand": {
      "primary": {
        "p-80": {
          "type": "color",
          "value": "#ccccccff",
          "extensions": {
            "org.lukasoppermann.figmaDesignTokens": {
              "collection": "Color/Brand",
              "variableId": "VariableID:14264:310",
              "exportKey": "variables"
            }
          }
        }
      }
    }
  }
}
```

Output paths and package names are derived from the token key hierarchy. Brand names such as `allegion`
only appear in generated output if they are present in the input token keys.

## Custom Transforms

### iOS Transforms
- **Color Transform**: Converts hex colors to UIColor Swift syntax
- **Size Transform**: Converts px values to rem units
- **Naming**: Uses camelCase naming convention

### Android Transforms
- **Color Transform**: Converts RGBA to ARGB format for Android XML
- **Size Transform**: Converts px to dp/sp units
- **Naming**: Uses snake_case naming convention

## Configuration

The main configuration is in `config.js`. Key sections:

- **Source**: Token file paths
- **Platforms**: iOS, Android, SCSS, CSS output configurations
- **Transforms**: Custom value transformations
- **Filters**: Token filtering logic

## Manual Usage

```bash
# Clean build directory
npm run clean

# Build all platforms
npm run build

# Build with custom token processing
npm run build:tokens
```

## Development

### Testing Locally

1. Place test token files in `/tokens`
2. Run `npm run build:tokens`
3. Check generated files in `/build`

### Adding New Platforms

1. Register new transform group in `config.js`
2. Add platform configuration
3. Update build script if needed

## Troubleshooting

### Common Issues

1. **Token files not found**: Ensure files are in `/tokens` directory
2. **Build failures**: Check token file format and syntax
3. **Missing dependencies**: Run `npm install`

### Environment Variables

The GitHub Actions workflow requires a `REPO_ACCESS_TOKEN` secret with write access to target repositories. To set this up:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a token with `repo` scope for the target repositories
3. Add the token as `REPO_ACCESS_TOKEN` in this repository's secrets

### GitHub Actions Issues

1. **Permission errors**: Ensure `REPO_ACCESS_TOKEN` has write access to target repositories
2. **Repository not found**: Verify target repository URLs in `scripts/deploy.js`
3. **PR creation fails**: Check if branch already exists or if GitHub CLI authentication is working
4. **Token file changes not detected**: Ensure token files are in the `tokens/` directory

## Token Format Requirements

- Must follow Design Tokens Community Group specification
- Figma extensions are preserved but not required
- Value types: `color`, `dimension`, `string`
- Valid color formats: hex, rgba, hsla

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes to configuration or scripts
4. Test with sample token files
5. Submit pull request

## License

Copyright © 2025 Allegion. All rights reserved.
# Design-Patten
