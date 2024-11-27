## Icon Generation

Generate `.svg` icon `.png`

```sh
npm run icon:gen
```

## Release Process

### Setup

Update version in `package.json`

### Verification

1. Verify contents to publish `vsce ls`
1. Package local `.vsix` for testing `npx vsce package`

### Publishing

#### Pre-Release

Run the following script to do a pre-release:

1. Update version number in `package.json` (probably can use npm version but need to investigate)
1. Run `npm i` to update package-lock.
1. Run `pre-release` script targetting new version.

```sh
# Update pre-release version in command before running it
scripts/pre-release.sh 0.1.X
```

#### Release

```sh
vsce publish patch --allow-star-activation
git push
git push --tags
```
