---
<%* const { AreaPriority, Templates, Utils } = await window.customJS;
const title = await tp.system.prompt("Enter Name"); 
const lower = Utils.lowerKebab(title); 
const folder = await Templates.chooseFolder(tp, tp.file.folder(true));
console.log(title, lower, folder);
await tp.file.move(`${folder}/${lower}`); 

const status = await AreaPriority.chooseStatus(tp);
const urgent = await AreaPriority.chooseUrgent(tp);
const important = await AreaPriority.chooseImportant(tp);
const role = await AreaPriority.chooseRole(tp);
console.log(status, urgent, important ,role);

tR += `aliases: ["${title}"]`;
%>
type: area
important: <% important %>
urgent: <% urgent %>
status: <% status %>
role: <%role %>
---
# <% title %>

%% What? Description %%

%% How does this align with my passion and interest? %%

```js-engine
const { AreaPriority } = await window.cJS();
return AreaPriority.relatedAreas(engine);
```

```js-engine
const { AreaPriority } = await window.cJS();
return AreaPriority.relatedProjects(engine);
```

## Tasks
- [ ] Define tasks #gtd/next

## ❧ Percolator
%% ideas in flight %%

## ❧ Resources 
%% links, contacts %%

## Log



