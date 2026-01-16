# Contributing to Design Token Exporter

Thank you for your interest in contributing to the Design Token Exporter! This document provides guidelines and information for contributors.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/design-token-exporter.git
   cd design-token-exporter
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Validate setup:**
   ```bash
   npm test
   ```

## Token File Sources

The system processes token files exported from Figma using the 'Design Tokens' plugin:

- **Source location**: `/tokens`
- **File**: `design-tokens.tokens-2.json`
- **Format**: Design Tokens Community Group specification with Figma extensions

## Testing Changes

### Local Testing

1. **Test configuration changes:**
   ```bash
   npm run test:build
   ```

2. **Check generated output:**
   ```bash
   ls -la build/ios/
   ls -la build/android/
   ```

3. **Validate token structure:**
   - Ensure all required tokens are included
   - Verify naming conventions
   - Check color format conversions

### Testing with Real Token Files

1. Place test token files in `/tokens` directory
2. Run build process: `npm run build:tokens`
3. Inspect generated files for correctness
4. Test integration with iOS/Android projects

## Style Dictionary Configuration

### Adding New Transforms

1. **Register transform in `config.js`:**
   ```javascript
   StyleDictionary.registerTransform({
     name: 'custom/transform',
     type: 'value',
     matcher: function(prop) {
       return prop.attributes.category === 'your-category';
     },
     transformer: function(prop) {
       return `your-transformed-value`;
     }
   });
   ```

2. **Add to transform group:**
   ```javascript
   StyleDictionary.registerTransformGroup({
     name: 'your-platform',
     transforms: [
       'attribute/cti',
       'name/cti/camel',
       'custom/transform'
     ]
   });
   ```

### Adding New Platforms

1. **Add platform configuration in `config.js`:**
   ```javascript
   platforms: {
     'your-platform': {
       transformGroup: 'your-platform',
       buildPath: 'build/your-platform/',
       files: [
         {
           destination: 'tokens.ext',
           format: 'your-format',
           filter: {
             attributes: {
               category: 'color'
             }
           }
         }
       ]
     }
   }
   ```

2. **Update GitHub Actions workflow** to handle new platform
3. **Add deployment logic** if targeting external repositories

## GitHub Actions Workflow

### Workflow Triggers

- **Push to main**: When token files or configuration change
- **Pull requests**: For validation
- **Manual dispatch**: For manual deployments

### Workflow Jobs

1. **build-tokens**: Processes tokens and creates artifacts
2. **deploy-to-ios**: Creates PR in iOS repository
3. **deploy-to-android**: Creates PR in Android repository

### Testing Workflow Changes

1. **Fork the repository** for testing
2. **Update target repositories** in workflow for testing
3. **Test with workflow dispatch** before merging

## Token Format Guidelines

### Required Structure

```json
{
  "category": {
    "subcategory": {
      "token-name": {
        "type": "color|dimension|string",
        "value": "token-value",
        "extensions": {
          "org.lukasoppermann.figmaDesignTokens": {
            "collection": "Collection Name",
            "variableId": "VariableID:123:456",
            "exportKey": "variables"
          }
        }
      }
    }
  }
}
```

### Supported Token Types

- **Colors**: Hex, RGBA, HSLA
- **Dimensions**: Pixel values, rem, em
- **Typography**: Font families, sizes, weights
- **Spacing**: Margin, padding, gap values
- **Borders**: Radius, width values
- **Shadows**: Elevation tokens

## Platform-Specific Considerations

### iOS (Swift)

- **Naming**: camelCase convention
- **Colors**: UIColor syntax with RGBA values
- **Dimensions**: Points (pt) for iOS

### Android (XML)

- **Naming**: snake_case convention
- **Colors**: ARGB format for Android XML
- **Dimensions**: dp/sp units for Android

## Target Repository Integration

### iOS Repository: `adu-app-ios`

- **Deployment path**: `DesignTokens/`
- **File naming**: Organized by token category
- **Integration**: Import in Xcode project

### Android Repository: `adu-app-android`

- **Deployment path**: `app/src/main/res/values/`
- **File naming**: Android resource conventions
- **Integration**: Gradle build integration

## Code Quality Standards

### JavaScript/Node.js

- Use ES6+ features
- Follow consistent naming conventions
- Add comments for complex logic
- Handle errors gracefully

### Configuration Files

- Maintain consistent formatting
- Use clear, descriptive names
- Document custom transforms
- Keep platform configurations organized

## Pull Request Process

1. **Create feature branch** from main
2. **Make changes** following guidelines
3. **Test changes** locally
4. **Update documentation** if needed
5. **Submit pull request** with clear description

### PR Description Template

```markdown
## Changes
- Brief description of changes

## Testing
- [ ] Local build test passed
- [ ] Token validation successful
- [ ] Platform outputs verified

## Impact
- Affected platforms: iOS/Android/Both
- Breaking changes: Yes/No
- Migration required: Yes/No
```

## Release Process

1. **Version bump** in package.json
2. **Update CHANGELOG.md**
3. **Tag release** with semantic versioning
4. **Deploy to repositories** via workflow

## Getting Help

- **Issues**: GitHub Issues for bugs and features
- **Documentation**: README.md and inline comments
- **Testing**: Use test scripts for validation

## Common Issues

### Build Failures

1. **Check token file format**: Ensure valid JSON
2. **Verify file paths**: Ensure source files exist
3. **Check dependencies**: Run `npm install`

### Deployment Issues

1. **GitHub token permissions**: Ensure write access
2. **Repository access**: Verify target repo URLs
3. **Branch conflicts**: Check for existing PR branches

## Security Considerations

- **No secrets in code**: Use GitHub secrets for tokens
- **Repository access**: Limit to necessary permissions
- **Token validation**: Sanitize input values
- **Audit dependencies**: Keep packages updated
