---
<%*
const { Dated } = await window.cJS();
const result = Dated.parseDate(tp.file.title);

const year = result.monday.format("YYYY");
const summaryPath = `chronicles/work/${year}/${tp.file.title}`;

if (`${summaryPath}.md` !== tp.file.path(true)) {
    console.log(summaryPath, tp.file.title, tp.file.path(true));
    await tp.file.move(summaryPath);
}

// Get the finalized weekly file
const weeklyFile = Dated.weeklyFile(result.monday).replace(".md", "");
const file = tp.file.find_tfile(weeklyFile);


let workSection = "";
if (file) {
    const fileCache = tp.app.metadataCache.getFileCache(file);

    if (fileCache?.headings) {
        const workIndex = fileCache.headings.findIndex((x) => x.heading.toLowerCase() === "work");

        if (workIndex >= 0) {
            const content = await tp.app.vault.cachedRead(file);
            const lines = content.split("\n");
            const startLine = fileCache.headings[workIndex].position.start.line + 1;
            const endLine = fileCache.headings[workIndex + 1]?.position.start.line || lines.length;

            // Extract lines, filtering out callouts (any line starting with >)
            workSection = lines
                .slice(startLine, endLine)
                .filter((line) => !line.startsWith(">"))
                .map((line) => line.replace(/\[_(\d{4}-\d{2}-\d{2})_\]\(.*?\)/, "$1"))
                .join("\n");
        }
    }
}

tR += `tags:\n- "me/✅/📓"`;
%>
---
# 👩‍💻 Week of <% result.monday.format("MMM D") %>

<% workSection.trim() %>
