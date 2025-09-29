---
<%* 
const today = window.moment();
const title = today.format("dddd, MMMM DD, YYYY");
const path = today.format("[/demesne/self/journal]/YYYY/YYYY-MM-DD");
await tp.file.move(path);
tR += `tags: ["me/✅/✍️ "]`;
%>
---
# <%title %>
