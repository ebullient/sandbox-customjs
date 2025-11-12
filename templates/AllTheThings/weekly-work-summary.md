---
<%* const { Dated } = await window.cJS();
const friday = Dated.weeklyWorkReportDay(tp.file.title);
const summaryPath = Dated.weeklyWorkReportFile(friday);
console.log(summaryPath, tp.file.title, tp.file.path(true));
if (summaryPath !== tp.file.path(true)) {
    await tp.file.move(summaryPath.replace('.md', ''));
}
// Get the finalized weekly file
const dateString = friday.format("YYYY-MM-DD");
const thursday = friday.clone().add(6, "d");

const jsEngine = "js-engine-debug";

tR += `week-begin: ${dateString}\n`;
tR += `week-end: ${thursday.format("YYYY-MM-DD")}\n`;
tR += 'tags:\n- "me/✅/📓"';
%>
---
# 👩‍💻 Week of <% friday.format("MMM D") %> - <% thursday.format("MMM D") %>

```<% jsEngine %>
return engine.markdown.create(
    await window.taskIndex.api.generateFixedWeekTasksForEngine(engine, "<% dateString %>",  "#me/🎯/ibm"));
```
