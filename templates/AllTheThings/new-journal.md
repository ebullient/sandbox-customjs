---
<%* 
const { Dated } = await window.cJS();
const result = Dated.daily(tp.file.title);

const today = window.moment();
const title = today.format("dddd, MMMM DD, YYYY");
const dateStem = today.format("YYYY/YYYY-MM-DD");
const daily = `![invisible-embed](chronicles/${dateStem}`;
const am = `${daily}#^daily-am)`;
const pm = `${daily}#^daily-pm)`;
const log = `${daily}#Log)`;
const path  = `/demesne/self/journal/${dateStem}`;
await tp.file.move(path);
tR += `tags: ["me/✅/✍️ "]`;
%>
---
# <% title %>

<% am %>
<% pm %>

> [!todo] Done today: 
> <% log %>
