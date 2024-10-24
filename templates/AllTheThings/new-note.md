---
<%* const { Templates, Utils } = await window.cJS();
const title = await tp.system.prompt("Enter Name"); 
const lower = Utils.lowerKebab(title); 
const current = tp.file.folder(true);
const folder = await Templates.chooseFolder(tp, current);
console.log("pre-move", title, lower, folder);
await tp.file.move(`/${folder}/${lower}`);

tR += `aliases: ["${title}"]`;
%>
---
# <% title %>