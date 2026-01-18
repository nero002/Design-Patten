const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration for target repositories
const REPOS = {
  ios: {
    url: "git@github.com:Allegion-Plc/adu-app-ios.git",
    targetPath: "DesignTokens/",
    branch: "design-tokens-update",
    files: [
      "Colors.swift",
      "Spacing.swift",
      "Typography.swift",
      "BorderRadius.swift",
      "Grid.swift",
      "Elevation.swift",
    ],
  },
  android: {
    url: "git@github.com:nero002/try-app.git",
    targetPath: "app/src/main/res/values/",
    branch: "design-tokens-update",
    files: ["colors.xml", "dimens.xml", "typography.xml"],
    directories: [
      {
        buildDir: "android-compose",
        targetPath: "app/src/main/java/com/allegion/designtokens/",
        clean: true,
      },
    ],
  },
};

function listTopLevelEntries(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
  }));
}

function cleanTargetEntries(sourceDir, targetDir) {
  const entries = listTopLevelEntries(sourceDir);
  entries.forEach((entry) => {
    const targetEntry = path.join(targetDir, entry.name);
    if (!fs.existsSync(targetEntry)) {
      return;
    }
    if (entry.isDirectory) {
      execSync(`rm -rf "${targetEntry}"`, { stdio: "inherit" });
      return;
    }
    fs.unlinkSync(targetEntry);
  });
}

function copyDirectoryContents(sourceDir, targetDir, clean) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  if (clean) {
    cleanTargetEntries(sourceDir, targetDir);
  }

  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

function countFilesInDir(dir, extension) {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFilesInDir(entryPath, extension);
      return;
    }
    if (!extension || entry.name.endsWith(extension)) {
      count += 1;
    }
  });
  return count;
}

async function deployToRepository(platform) {
  const config = REPOS[platform];
  if (!config) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const tempDir = path.join(__dirname, "..", "temp", platform);
  const buildRoot = path.join(__dirname, "..", "build");
  const buildDir = path.join(__dirname, "..", "build", platform);

  console.log(`\n🚀 Deploying ${platform.toUpperCase()} tokens...`);

  try {
    // Check if build output exists
    if (config.files) {
      if (!fs.existsSync(buildDir)) {
        throw new Error(`Build directory not found: ${buildDir}`);
      }
      const buildFiles = fs.readdirSync(buildDir);
      if (buildFiles.length === 0) {
        throw new Error(`No files found in build directory: ${buildDir}`);
      }
    }
    if (config.directories) {
      config.directories.forEach((dirConfig) => {
        const sourceDir = path.join(buildRoot, dirConfig.buildDir);
        if (!fs.existsSync(sourceDir)) {
          throw new Error(`Build directory not found: ${sourceDir}`);
        }
      });
    }

    // Create temp directory
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf "${tempDir}"`, { stdio: "inherit" });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Clone the repository
    console.log(`📂 Cloning repository: ${config.url}`);
    execSync(`git clone "${config.url}" "${tempDir}"`, { stdio: "inherit" });

    // Navigate to repository
    process.chdir(tempDir);

    // Create and checkout branch
    console.log(`🌿 Creating branch: ${config.branch}`);
    try {
      execSync(`git checkout -b "${config.branch}"`, { stdio: "inherit" });
    } catch (error) {
      // Branch might already exist, try to checkout
      console.log(`🌿 Checking out existing branch: ${config.branch}`);
      execSync(`git checkout "${config.branch}"`, { stdio: "inherit" });
    }

    // Create target directory if it doesn't exist
    const targetDir = path.join(tempDir, config.targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Copy files from build directory
    if (config.files) {
      console.log(`📋 Copying files to ${config.targetPath}`);
      for (const file of config.files) {
        const sourcePath = path.join(buildDir, file);
        const targetPath = path.join(targetDir, file);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`   ✓ ${file}`);
        } else {
          console.log(`   ⚠️  ${file} (not found in build)`);
        }
      }
    }

    if (config.directories) {
      for (const dirConfig of config.directories) {
        const sourceDir = path.join(buildRoot, dirConfig.buildDir);
        const destinationDir = path.join(tempDir, dirConfig.targetPath);
        console.log(`📂 Copying directory ${dirConfig.buildDir} to ${dirConfig.targetPath}`);
        copyDirectoryContents(sourceDir, destinationDir, dirConfig.clean);
      }
    }

    // Check if there are any changes
    const statusOutput = execSync("git status --porcelain", {
      encoding: "utf8",
    });
    if (!statusOutput.trim()) {
      console.log("   ℹ️  No changes detected");
      return;
    }

    // Stage changes
    console.log("📝 Staging changes...");
    execSync("git add .", { stdio: "inherit" });

    // Commit changes
    const commitMessage = `Update ${platform} design tokens

🤖 Generated with Design Token Exporter`;

    execSync(`git commit -m "${commitMessage}"`, { stdio: "inherit" });

    // Push changes
    console.log("⬆️  Pushing changes...");
    execSync(`git push origin "${config.branch}"`, { stdio: "inherit" });

    // Create pull request (if gh CLI is available)
    try {
      const prTitle = `Update ${platform} design tokens`;
      const fileLines = config.files
        ? config.files.map((file) => `- \`${config.targetPath}${file}\``).join("\n")
        : "- No file list configured";
      const directoryLines = config.directories
        ? config.directories
            .map((dirConfig) => {
              const count = countFilesInDir(path.join(buildRoot, dirConfig.buildDir), ".kt");
              return `- \`${dirConfig.targetPath}\` (${count} files)`;
            })
            .join("\n")
        : "";
      const prBody = `## Summary
- Updates ${platform} design tokens from Figma export
- Automated generation using Style Dictionary

## Files Updated
${fileLines}
${directoryLines ? `\n## Directories Updated\n${directoryLines}` : ""}

## Test plan
- [ ] Review generated token files
- [ ] Verify token values match design specs
- [ ] Test token usage in existing components

🤖 Generated with [Design Token Exporter](https://github.com/Allegion-Plc/design-token-exporter)`;

      execSync(`gh pr create --title "${prTitle}" --body "${prBody}"`, {
        stdio: "inherit",
      });
      console.log("✅ Pull request created successfully!");
    } catch (error) {
      console.log(
        "⚠️  Could not create pull request automatically. Please create manually."
      );
      console.log(`   Branch: ${config.branch}`);
      console.log(`   Repository: ${config.url}`);
    }
  } catch (error) {
    console.error(`❌ Deployment failed for ${platform}:`, error.message);
    throw error;
  } finally {
    // Clean up
    if (fs.existsSync(tempDir)) {
      try {
        process.chdir(path.join(__dirname, ".."));
        execSync(`rm -rf "${tempDir}"`, { stdio: "inherit" });
      } catch (cleanupError) {
        console.warn(
          "⚠️  Could not clean up temp directory:",
          cleanupError.message
        );
      }
    }
  }
}

async function deployAll() {
  console.log("🎯 Starting deployment to target repositories...");

  for (const platform of Object.keys(REPOS)) {
    try {
      await deployToRepository(platform);
      console.log(
        `✅ ${platform.toUpperCase()} deployment completed successfully!`
      );
    } catch (error) {
      console.error(
        `❌ ${platform.toUpperCase()} deployment failed:`,
        error.message
      );
      // Continue with other platforms
    }
  }

  console.log("\n🏁 Deployment process completed!");
}

// CLI handling
if (require.main === module) {
  const platform = process.argv[2];

  if (platform && REPOS[platform]) {
    deployToRepository(platform)
      .then(() =>
        console.log(`✅ ${platform.toUpperCase()} deployment completed!`)
      )
      .catch((error) => {
        console.error("❌ Deployment failed:", error.message);
        process.exit(1);
      });
  } else if (platform === "all" || !platform) {
    deployAll().catch((error) => {
      console.error("❌ Deployment failed:", error.message);
      process.exit(1);
    });
  } else {
    console.error(`❌ Unknown platform: ${platform}`);
    console.log("Available platforms:", Object.keys(REPOS).join(", "));
    console.log("Usage: node scripts/deploy.js [platform|all]");
    process.exit(1);
  }
}

module.exports = { deployToRepository, deployAll };
