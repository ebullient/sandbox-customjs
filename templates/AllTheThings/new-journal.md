---
<%*
const { Dated } = await window.cJS();
const isWeekly = tp.file.title.endsWith("_week");
const result = Dated.parseDate(tp.file.title);

const fileMoment = isWeekly ? result.monday : result.day;
const journalPath = isWeekly
        ? Dated.weeklyJournalFile(fileMoment)
        : Dated.dailyJournalFile(fileMoment);

if (journalPath !== tp.file.path(true)) {
    console.log(journalPath, tp.file.title, tp.file.path(true));
    await tp.file.move(journalPath.replace('.md', ''));
}

tR += `tags:\n- "me/✅/✍️"`;
if (isWeekly) {
    // Weekly template
%>
---
# ✍️ Week of <% result.monday.format("MMM D") %>

<%*
    // Generate journal embeds for each day of the week (Monday through Sunday)
    for (let day = 1; day <= 7; day++) {
        const date = Dated.dateOfWeek(result.monday, day);
        const dailyJournalPath = Dated.dailyJournalFile(date);
        tR += `- [${date}](${dailyJournalPath})\n`;
    }
    const weeklyFile = Dated.weeklyFile(result.monday);
    const monthlyWeek = Dated.monthlyFile(result.monday);
-%>

- [Project items completed this week](<% weeklyFile %>#Project%20items%20completed%20this%20week)
- [Summary](<% monthlyWeek %>)

## 🧘‍♀️ Reflection

<%*
} else {
    // Daily template - use exact date from filename
    const title = fileMoment.format("dddd, MMMM DD, YYYY");
    const dailyFile = Dated.dailyFile(fileMoment);
    const day = `[daily](${dailyFile})`;
    const daily = `![invisible-embed](${dailyFile}`;
    const am = `${daily}#^daily-am)`;
    const pm = `${daily}#^daily-pm)`;
    const log = `${daily}#Log)`;
%>
---
# ✍️ <% title %>
%% <% day %> %%
> [!todo]- Today:
> <% am %>
> <% pm %>
> Log:  
> <% log %>

<%*
}
%>
