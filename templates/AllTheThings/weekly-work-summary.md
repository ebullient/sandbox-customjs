---
<%* const { Dated } = await window.cJS();
const dateString = tp.file.title.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || tp.file.title;

const friday = window.moment(dateString);
const year = friday.format("YYYY");
const monday = window.moment(friday).add(3, "d");
const thursday = window.moment(friday).add(6, "d");
console.log(dateString, dateString, thursday.format("YYYY-MM-DD"));

const summaryPath = `chronicles/work/ibm-${year}/${tp.file.title}`;
if (`${summaryPath}.md` !== tp.file.path(true)) {
    console.log(summaryPath, tp.file.title, tp.file.path(true));
    await tp.file.move(summaryPath);
}

// Get the finalized weekly file
const weeklyFile = Dated.weeklyFile(monday);
const file = tp.file.find_tfile(weeklyFile);

const jsEngine = "js-engine";

tR += `week-begin: ${dateString}\n`;
tR += `week-end: ${thursday.format("YYYY-MM-DD")}\n`;
tR += 'tags:\n- "me/✅/📓"';
%>
---
# 👩‍💻 Week of <% friday.format("MMM D") %> - <% thursday.format("MMM D") %>

```<% jsEngine %>
const { Tasks } = await window.cJS();
return await Tasks.fixedWeekTasks(engine, "<% dateString %>",  "#me/🎯/ibm");
```
