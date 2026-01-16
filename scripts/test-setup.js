const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Design Token Exporter Setup');
console.log('======================================\n');

// Test 1: Check if required directories exist
console.log('1. Checking directory structure...');
const requiredDirs = [
  'scripts',
  '.github/workflows'
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(dirPath)) {
    console.log(`   ✅ ${dir}/`);
  } else {
    console.log(`   ❌ ${dir}/ - MISSING`);
  }
});

// Test 2: Check if required files exist
console.log('\n2. Checking required files...');
const requiredFiles = [
  'package.json',
  'config.js',
  'scripts/build-tokens.js',
  '.github/workflows/process-design-tokens.yml',
  'README.md',
  '.gitignore'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
  }
});

// Test 3: Check token source files
console.log('\n3. Checking token source files...');
const sourceTokens = [
  path.join(__dirname, '..', 'tokens/design-tokens.tokens-2.json')
];

sourceTokens.forEach(tokenPath => {
  if (fs.existsSync(tokenPath)) {
    const stats = fs.statSync(tokenPath);
    console.log(`   ✅ ${path.basename(tokenPath)} (${Math.round(stats.size / 1024)}KB)`);
  } else {
    console.log(`   ❌ ${path.basename(tokenPath)} - NOT FOUND`);
  }
});

// Test 4: Validate package.json
console.log('\n4. Validating package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  
  if (packageJson.dependencies && packageJson.dependencies['style-dictionary']) {
    console.log(`   ✅ Style Dictionary dependency: ${packageJson.dependencies['style-dictionary']}`);
  } else {
    console.log('   ❌ Style Dictionary dependency missing');
  }
  
  if (packageJson.scripts && packageJson.scripts['build:tokens']) {
    console.log('   ✅ build:tokens script defined');
  } else {
    console.log('   ❌ build:tokens script missing');
  }
} catch (error) {
  console.log('   ❌ package.json is invalid JSON');
}

// Test 5: Validate GitHub Actions workflow
console.log('\n5. Validating GitHub Actions workflow...');
try {
  const workflowContent = fs.readFileSync(
    path.join(__dirname, '..', '.github/workflows/process-design-tokens.yml'), 
    'utf8'
  );
  
  if (workflowContent.includes('Allegion-Plc/adu-app-ios')) {
    console.log('   ✅ iOS repository reference found');
  } else {
    console.log('   ❌ iOS repository reference missing');
  }
  
  if (workflowContent.includes('Allegion-Plc/adu-app-android')) {
    console.log('   ✅ Android repository reference found');
  } else {
    console.log('   ❌ Android repository reference missing');
  }
  
  if (workflowContent.includes('npm run build:tokens')) {
    console.log('   ✅ Build command reference found');
  } else {
    console.log('   ❌ Build command reference missing');
  }
} catch (error) {
  console.log('   ❌ GitHub workflow file not readable');
}

console.log('\n======================================');
console.log('Setup validation complete! 🎉');
console.log('\nNext steps:');
console.log('1. Run "npm install" to install dependencies');
console.log('2. Copy token files to /tokens directory');
console.log('3. Run "npm run build:tokens" to test token processing');
console.log('4. Commit and push to trigger GitHub Actions');
console.log('\nTarget repositories for deployment:');
console.log('- iOS: https://github.com/Allegion-Plc/adu-app-ios');
console.log('- Android: https://github.com/Allegion-Plc/adu-app-android');
