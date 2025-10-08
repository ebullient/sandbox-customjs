---
<%* 
const { Dated } = await window.cJS();
const result = Dated.parseDate(tp.file.title);
tR += `tags: ["me/✅/✍️ "]`;
%>
---
# Week of <% result.monday.format("MMM D") %>

## Weekly plan
![<% result.monday.format("YYYY-MM-DD") %>_week](<% Dated.weeklyFile(result.monday) %>#Logs)

## Journals:

<%* 
// Generate journal embeds for each day of the week (Monday through Sunday)
for (let day = 1; day <= 7; day++) {
    const date = Dated.dateOfWeek(result.monday, day);
    const journalPath = `demesne/self/journal/${result.monday.format("YYYY")}/${date}.md`;
    tR += `![${date}](${journalPath})\n\n`;
}
%>

## Reflection

