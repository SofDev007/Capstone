# Troubleshooting Guide

## esbuild Issues

If you encounter esbuild-related errors, try the following:

### 1. Install esbuild explicitly
```bash
npm install --save-dev esbuild
```

### 2. Clear cache and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

### 3. Platform-specific issues (Windows)

If you're on Windows and getting esbuild errors:

```bash
# Delete node_modules and reinstall
rmdir /s node_modules
del package-lock.json
npm install
```

### 4. Use npm instead of yarn
Sometimes yarn can cause dependency resolution issues:
```bash
npm install
```

### 5. Check Node.js version
Ensure you're using Node.js v16 or higher:
```bash
node --version
```

### 6. Force reinstall esbuild
```bash
npm install esbuild --force
```

## Common Build Errors

### "Cannot find module 'esbuild'"
Solution: Run `npm install --save-dev esbuild`

### "esbuild: Failed to load native addon"
Solution: 
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. If on Windows, try running as Administrator

### Vite build errors
Solution:
1. Clear Vite cache: `rm -rf node_modules/.vite`
2. Reinstall dependencies
3. Try `npm run build` again

## Still having issues?

1. Check Node.js version: `node --version` (should be 16+)
2. Check npm version: `npm --version`
3. Try using a different package manager (npm/yarn/pnpm)
4. Check for conflicting global packages

