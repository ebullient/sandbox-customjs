import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

const command = process.argv[2] || "push";
const startWatch = command === "watch";
const startDev = command === "dev";

const devTargets = path.resolve("./.dev-target.json");
const distDir = path.resolve("./dist");

function copyFileAndMap(fileName, target) {
    const srcFile = path.resolve(distDir, fileName);
    const pos = fileName.lastIndexOf("/");
    const tgtFile = path.join(target, pos > 0 ? fileName.substring(pos + 1) : fileName);

    console.log(`🖨️  copy ${fileName} to ${tgtFile}`);
    // We have to clean up the generated file: some content doesn't work w/ customJS
    const content = readFileSync(srcFile, "utf-8").replace(
        /export class/,
        "class",
    );
    writeFileSync(tgtFile, content, "utf-8");
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
    }
    if (Array.isArray(targets)) {
        targets.forEach((t) => {
            copyFileAndMap(key, t);
        });
    } else {
        copyFileAndMap(key, targets);
    }
}

try {
    if (!existsSync(devTargets)) {
        console.log(`No ${devTargets} file found. Exiting.`);
        process.exit(0);
    }

    const data = JSON.parse(readFileSync(devTargets, "utf-8"));
    if (startDev) {
        // Run both processes concurrently
        startDevelopment();
    } else if (startWatch) {
        chokidar
            .watch(distDir, {
                awaitWriteFinish: {
                    stabilityThreshold: 2000,
                    pollInterval: 100,
                },
            })
            .on("change", (f) => {
                const key = path.relative(distDir, f);
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

// Function to run a command and pipe its output to the main process
function runCommand(command, args, name) {
    console.log(`🚀 Starting ${name}...`);

    const proc = spawn(command, args, {
        stdio: ["inherit", "pipe", "pipe"],
        shell: true,
    });

    // Prefix output with the process name
    proc.stdout.on("data", (data) => {
        const lines = data.toString().trim().split("\n");
        console.log(lines.map((x) => `[${name}] ${x}`));
    });

    proc.stderr.on("data", (data) => {
        const lines = data.toString().trim().split("\n");
        console.error(lines.map((x) => `[${name}] ${x}`));
    });

    proc.on("close", (code) => {
        console.log(`[${name}] Process exited with code ${code}`);
    });

    return proc;
}

// Function to run both development processes concurrently
function startDevelopment() {
    console.log("🔄 Starting development mode for customjs, plugin, and plugin-tasks...");

    // Start TypeScript in watch mode for customjs
    const tscProcess = runCommand("tsc", ["-w"], "tsc");

    // Start watch mode for customjs distribution
    startWatcher();

    // Start plugin development
    const pluginProcess = runCommand(
        "node",
        ["./plugin/esbuild.config.mjs"],
        "plugin",
    );

    // Start plugin-tasks development
    const pluginTasksProcess = runCommand(
        "node",
        ["./plugin-tasks/esbuild.config.mjs"],
        "plugin-tasks",
    );

    // Handle process termination
    process.on("SIGINT", () => {
        console.log("\n🛑 Shutting down all processes...");
        tscProcess.kill();
        pluginProcess.kill();
        pluginTasksProcess.kill();
        process.exit(0);
    });
}

// Function to start the watcher
function startWatcher() {
    try {
        if (!existsSync(devTargets)) {
            console.log(`No ${devTargets} file found. Skipping watch.`);
            return;
        }

        const data = JSON.parse(readFileSync(devTargets, "utf-8"));
        console.log("👀 Watching for file changes in dist directory...");

        chokidar
            .watch(distDir, {
                awaitWriteFinish: {
                    stabilityThreshold: 2000,
                    pollInterval: 100,
                },
            })
            .on("change", (f) => {
                const key = path.relative(distDir, f);
                console.log(`🚀 ${key} changed`);
                pushFile(data, key);
            });
    } catch (err) {
        console.error("Error starting watcher:", err);
    }
}
