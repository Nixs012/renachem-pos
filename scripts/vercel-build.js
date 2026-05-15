const fs = require('fs');
const path = require('path');

function copyFolderRecursiveSync(source, target) {
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });

    if (fs.lstatSync(source).isDirectory()) {
        const files = fs.readdirSync(source);
        files.forEach(file => {
            const curSource = path.join(source, file);
            const curTarget = path.join(target, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, curTarget);
            } else {
                fs.copyFileSync(curSource, curTarget);
            }
        });
    }
}

console.log('--- Starting Professional Cloud Build ---');

const publicDir = path.join(__dirname, '..', 'public');
const rendererDir = path.join(__dirname, '..', 'renderer');
const assetsDir = path.join(__dirname, '..', 'assets');

try {
    // 1. Clean public directory
    if (fs.existsSync(publicDir)) {
        console.log('Cleaning existing public folder...');
        fs.rmSync(publicDir, { recursive: true, force: true });
    }
    fs.mkdirSync(publicDir);

    // 2. Copy renderer contents to public root
    console.log('Deploying renderer files...');
    if (fs.existsSync(rendererDir)) {
        const files = fs.readdirSync(rendererDir);
        files.forEach(file => {
            const src = path.join(rendererDir, file);
            const dest = path.join(publicDir, file);
            if (fs.lstatSync(src).isDirectory()) {
                copyFolderRecursiveSync(src, dest);
            } else {
                fs.copyFileSync(src, dest);
            }
        });
    }

    // 3. Copy assets to public/assets
    console.log('Deploying assets...');
    if (fs.existsSync(assetsDir)) {
        copyFolderRecursiveSync(assetsDir, path.join(publicDir, 'assets'));
    }

    console.log('--- Build Successful! ---');
} catch (error) {
    console.error('--- Build Failed! ---');
    console.error(error);
    process.exit(1);
}
