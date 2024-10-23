import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import chokidar from 'chokidar';

const command = process.argv[2] || 'push';
const startWatch = command === 'watch';

const devTargets = path.resolve('./.dev-target.json');
const distDir = path.resolve('./dist');

function copyFileAndMap(fileName, target) {
    const srcFile = path.resolve(distDir, fileName);
    const tgtFile = path.join(target, fileName);

    console.log(`🖨️  copy ${fileName} to ${tgtFile}`);
    // We have to clean up the generated file: some content doesn't work w/ customJS
    const content = readFileSync(srcFile, 'utf-8')
        .replace(/export class/, 'class');
    writeFileSync(tgtFile, content, 'utf-8');
}

function pushAll(data) {
    Object.keys(data).forEach((key) => {
        pushFile(data, key);
    });
}

function pushFile(data, key) {
    const targets = data[key];
    if (targets === undefined) {
        return;
    } else if (Array.isArray(targets)) {
        targets.forEach((t) => {
            copyFileAndMap(key, t);
        })
    } else {
        copyFileAndMap(key, targets);
    }
}

try {
    if (!existsSync(devTargets)) {
        console.log(`No ${devTargets} file found. Exiting.`);
        process.exit(0);
    }

    const data = JSON.parse(readFileSync(devTargets, 'utf-8'));
    if (startWatch) {
        chokidar.watch(distDir, {
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        }).on('change', f => {
            const key = path.basename(f);
            console.log(`🚀 ${key} changed`);
            pushFile(data, key);
        });
    } else {
        pushAll(data);
    }
} catch (err) {
    console.error(err);
    process.exit(1);
}
