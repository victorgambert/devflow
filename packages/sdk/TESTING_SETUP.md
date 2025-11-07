# Testing Setup - Using .env File

## 🔧 Quick Setup (30 seconds)

### Step 1: Create .env file

```bash
cd /Users/victor/Sites/soma-squad-ai/packages/sdk

# Copy the example file
cp .env.example .env

# Or create it manually
echo "GITHUB_TOKEN=your_token_here" > .env
```

### Step 2: Add your GitHub token

Edit `.env` file:
```bash
# Open in your editor
code .env
# or
nano .env
# or
vim .env
```

Add your token:
```
GITHUB_TOKEN=ghp_your_actual_token_here
```

**Get your token:** https://github.com/settings/tokens
- Click "Generate new token (classic)"
- Select scope: `repo` (all)
- Copy the token

### Step 3: Run tests

```bash
# Now you can run tests without specifying the token each time!
npx ts-node src/__manual_tests__/test-integration-e2e.ts facebook/react

# Or with your own repo
npx ts-node src/__manual_tests__/test-integration-e2e.ts your-username/your-repo
```

---

## ✅ Benefits of Using .env

| Method | Command | Convenience |
|--------|---------|-------------|
| **❌ Inline** | `GITHUB_TOKEN="ghp_xxx" npx ts-node ...` | Have to type token every time |
| **✅ .env file** | `npx ts-node ...` | Set once, use forever |

---

## 🔒 Security

✅ `.env` file is in `.gitignore` - **Your token will NOT be committed**

✅ Only you can see this file on your machine

✅ Safe to use different tokens for dev/staging/production

---

## 📋 Full .env Example

```bash
# GitHub Personal Access Token (REQUIRED)
GITHUB_TOKEN=ghp_your_token_here

# Optional: Default test repository
TEST_REPO_OWNER=your-username
TEST_REPO_NAME=your-repo-name

# Optional: Other services (if you use them)
ANTHROPIC_API_KEY=sk-ant-xxx
NOTION_API_KEY=ntn_xxx
```

---

## 🧪 Testing Commands

Once `.env` is set up:

```bash
# Test with Express.js (public repo)
npx ts-node src/__manual_tests__/test-integration-e2e.ts expressjs/express

# Test with React (public repo)
npx ts-node src/__manual_tests__/test-integration-e2e.ts facebook/react

# Test with your private repo
npx ts-node src/__manual_tests__/test-integration-e2e.ts your-username/your-private-repo

# Run unit tests (no token needed)
npx ts-node src/__manual_tests__/test-codebase-modules.ts
```

---

## 🚨 Troubleshooting

**"GITHUB_TOKEN not found"**
- Check that `.env` file exists in `/Users/victor/Sites/soma-squad-ai/packages/sdk/`
- Check that the variable is named exactly `GITHUB_TOKEN` (case-sensitive)
- Make sure there's no space around the `=` sign

**"Bad credentials"**
- Token is invalid or expired
- Regenerate at https://github.com/settings/tokens
- Make sure you selected `repo` scope

**"Token was accidentally committed"**
- Revoke it immediately at https://github.com/settings/tokens
- Generate a new one
- Check `.gitignore` includes `.env`

---

## 📁 File Structure

```
packages/sdk/
├── .env                  # ← Your tokens (git-ignored)
├── .env.example          # ← Template (safe to commit)
├── .gitignore           # ← Contains .env
└── src/
    └── __manual_tests__/
        ├── test-integration-e2e.ts
        └── test-codebase-modules.ts
```

---

## 💡 Pro Tips

1. **Use different .env files per project**
   ```bash
   # Development
   .env.development

   # Production
   .env.production
   ```

2. **Token rotation**
   - Set token expiration to 90 days
   - Create calendar reminder to rotate
   - Store backup in password manager

3. **Multiple accounts**
   ```bash
   # Personal account
   GITHUB_TOKEN_PERSONAL=ghp_xxx

   # Work account
   GITHUB_TOKEN_WORK=ghp_yyy
   ```

4. **Use direnv for auto-loading**
   ```bash
   brew install direnv
   echo "export GITHUB_TOKEN=ghp_xxx" > .envrc
   direnv allow
   ```

---

**That's it! Set up once, test forever.** 🎉
