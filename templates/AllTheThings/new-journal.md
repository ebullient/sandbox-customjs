---
<%*
const { Dated } = await window.cJS();
const isWeekly = tp.file.title.endsWith("_week");
const result = Dated.parseDate(tp.file.title);

// Move file to journal folder based on year from filename
// Weekly uses monday, daily uses the exact day
const fileDate = isWeekly ? result.monday : result.day;
const year = fileDate.format("YYYY");
const journalPath = `/chronicles/journal/${year}/${tp.file.title}`;
await tp.file.move(journalPath);

tR += `tags:\n- "me/✅/✍️ "`;
if (isWeekly) {
    // Weekly template
%>
---
# ✍️ Week of <% result.monday.format("MMM D") %>

## 🗓️ Logs for the week
![<% result.monday.format("YYYY-MM-DD") %>_week](<% Dated.weeklyFile(result.monday) %>#Logs)

## 📚 Journals for the week

<%*
    // Generate journal embeds for each day of the week (Monday through Sunday)
    for (let day = 1; day <= 7; day++) {
        const date = Dated.dateOfWeek(result.monday, day);
        const dailyJournalPath = `/chronicles/journal/${year}/journal-${date}.md`;
        tR += `![${date}](${dailyJournalPath})\n\n`;
    }
%>

## 🧘‍♀️ Reflection

<%*
} else {
    // Daily template - use exact date from filename
    const title = fileDate.format("dddd, MMMM DD, YYYY");
    const dateStem = fileDate.format("YYYY/YYYY-MM-DD");
    const daily = `![invisible-embed](/chronicles/${dateStem}`;
    const am = `${daily}#^daily-am)`;
    const pm = `${daily}#^daily-pm)`;
    const log = `${daily}#Log)`;
%>
---
# ✍️ <% title %>

<% am %>
<% pm %>

> [!todo] Done today:
> <% log %>

<%*
}
%>
