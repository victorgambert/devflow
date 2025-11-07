# Quick Test Guide - Test with Your Private Repo

## 🚀 Option 1: E2E Test (Recommended First)

This tests the full codebase analysis without needing the API running.

```bash
# 1. Navigate to SDK directory
cd /Users/victor/Sites/soma-squad-ai/packages/sdk

# 2. Run the test with YOUR private repo
GITHUB_TOKEN="your_token" npx ts-node src/__manual_tests__/test-integration-e2e.ts your-username/your-repo-name

# Example:
# GITHUB_TOKEN="ghp_xxx" npx ts-node src/__manual_tests__/test-integration-e2e.ts victor/my-private-app
```

**What this tests:**
- ✅ Repository URL parsing
- ✅ GitHub API access to your private repo
- ✅ Codebase structure analysis
- ✅ Dependency extraction
- ✅ Documentation scanning
- ✅ Similar code search
- ✅ AI context generation

**Expected output:**
```
🚀 Soma Squad AI GitHub Integration - End-to-End Test

📋 Step 1: Parsing Repository URL
✅ Repository parsed successfully
   Provider: github
   Owner:    your-username
   Repo:     your-repo-name

🔑 Step 2: Validating GitHub Access
✅ Repository access validated
   Name:           your-repo-name
   Full Name:      your-username/your-repo-name
   URL:            https://github.com/your-username/your-repo-name
   Default Branch: main

🔍 Step 3: Analyzing Codebase Context
   Analyzing structure...
✅ Analysis completed in 3.45s

   📊 Results:
   Language:     TypeScript (or whatever your repo uses)
   Framework:    Next.js (or whatever you use)
   Files:        234
   Dependencies: 45 main, 23 dev
   Conventions:  8 found
   Patterns:     3 found
   Similar code: 5 examples

[... more detailed output ...]

✅ ALL TESTS PASSED 🎉
```

---

## 🔧 Option 2: Full API Test (Complete Workflow)

This tests the entire Soma Squad AI workflow including database.

### Step 1: Make sure database is running

```bash
# Check if Postgres is running
docker ps | grep postgres

# If not, start it:
cd /Users/victor/Sites/soma-squad-ai
docker-compose up -d postgres
```

### Step 2: Start the API

```bash
cd /Users/victor/Sites/soma-squad-ai/packages/api

# Make sure GITHUB_TOKEN is in your .env file
echo "GITHUB_TOKEN=your_token_here" >> .env

# Start the API
npm run start:dev
```

**Wait for:**
```
Nest application successfully started
```

### Step 3: Create a Project

In a new terminal:

```bash
# Create a new project
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test Project",
    "description": "Testing GitHub integration",
    "repository": "",
    "config": {
      "version": "1.0",
      "project": {},
      "vcs": {},
      "commands": {},
      "ci": {},
      "code_agent": {},
      "quality_gates": {},
      "notifications": {},
      "files": {}
    }
  }'
```

**Save the project ID from the response!**

### Step 4: Link Your Private Repository

```bash
# Replace PROJECT_ID with the ID from step 3
# Replace the URL with your private repo
curl -X POST http://localhost:3000/projects/PROJECT_ID/link-repository \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryUrl": "https://github.com/your-username/your-private-repo"
  }'
```

**Expected response:**
```json
{
  "id": "project-xxx",
  "name": "My Test Project",
  "repository": "https://github.com/your-username/your-private-repo",
  "config": {
    "vcs": {
      "owner": "your-username",
      "repo": "your-private-repo",
      "provider": "github"
    },
    "project": {
      "owner": "your-username",
      "repo": "your-private-repo"
    }
  },
  ...
}
```

### Step 5: Verify the Config

```bash
# Get the project to see the config
curl http://localhost:3000/projects/PROJECT_ID
```

Check that `config.vcs.owner` and `config.vcs.repo` are set correctly.

---

## 🧪 Option 3: Test Directly in Code

Create a test script to analyze your repo:

```bash
cd /Users/victor/Sites/soma-squad-ai/packages/sdk
```

Create `test-my-repo.ts`:

```typescript
import { GitHubProvider, analyzeRepository, formatContextForAI } from './src/index';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Set GITHUB_TOKEN first!');
    process.exit(1);
  }

  const github = new GitHubProvider(token);

  // Replace with your repo
  const owner = 'your-username';
  const repo = 'your-private-repo';

  console.log(`Analyzing ${owner}/${repo}...`);

  const context = await analyzeRepository(
    github,
    owner,
    repo,
    'Add authentication feature' // Example task description
  );

  console.log('\n📊 Analysis Results:');
  console.log('Language:', context.structure.language);
  console.log('Framework:', context.structure.framework || 'N/A');
  console.log('Files:', context.structure.fileCount);
  console.log('Dependencies:', context.dependencies.mainLibraries.length);

  console.log('\n📝 AI Context (first 500 chars):');
  const aiContext = formatContextForAI(context);
  console.log(aiContext.substring(0, 500));
}

main().catch(console.error);
```

Run it:

```bash
GITHUB_TOKEN="your_token" npx ts-node test-my-repo.ts
```

---

## 🎯 What Each Test Shows You

### E2E Test Shows:
- ✅ Can parse your repo URL
- ✅ Has access to your private repo
- ✅ Can analyze structure (language, framework)
- ✅ Can extract dependencies
- ✅ Can scan documentation
- ✅ Can search for similar code
- ✅ Generates proper AI context

### API Test Shows:
- ✅ Can store repo info in database
- ✅ API endpoint works correctly
- ✅ Config is properly updated
- ✅ Ready for Temporal workflows

### Direct Code Test Shows:
- ✅ You can use the SDK in your own code
- ✅ Can customize the analysis
- ✅ Can access raw codebase context

---

## 🔍 What to Look For

### ✅ Success Indicators:

1. **Repository Access:**
   ```
   ✅ Repository access validated
   ```

2. **Structure Detected:**
   ```
   Language:     TypeScript
   Framework:    Next.js
   ```

3. **Dependencies Found:**
   ```
   Dependencies: 45 main, 23 dev
   ```

4. **Conventions Extracted:**
   ```
   Conventions:  8 found
   ```

### ❌ Common Issues:

**"Bad credentials"**
- Token expired or invalid
- Regenerate at https://github.com/settings/tokens

**"Not Found" (404)**
- Check owner/repo spelling
- Ensure token has `repo` scope

**"Rate limit exceeded"**
- Wait an hour or use GitHub App

---

## 🎓 Recommended Testing Order

1. **Start simple:** Run E2E test (Option 1) ✅
2. **Test API:** If E2E works, test API endpoint (Option 2)
3. **Custom test:** Create your own test script (Option 3)

---

## 💡 Pro Tips

1. **Test with a small repo first** - Faster analysis
2. **Check the output carefully** - Make sure it detected your tech stack correctly
3. **Try different task descriptions** - See how similar code search works
4. **Look at the AI context** - This is what will be sent to Claude for spec/code generation

---

**Ready to test? Start with Option 1!**

```bash
cd /Users/victor/Sites/soma-squad-ai/packages/sdk
GITHUB_TOKEN="your_token" npx ts-node src/__manual_tests__/test-integration-e2e.ts your-username/your-repo
```
