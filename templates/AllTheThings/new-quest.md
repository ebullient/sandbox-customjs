---
<%* const { Templates, AreaPriority, Utils } = await window.cJS();
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
type: quest
important: <% important %>
urgent: <% urgent %>
status: <% status %>
role: <%role %>
---
# <% title %>

* **What**: %% synopsis %%
* **Who**:  %% collaboration %%
* **When**: %% timeline%%
* **Why**: %% internal or external motivation %%

%% How does this align with my passion and interest? %%

## Summary
%% how far along is this? where are we? %%

## Tasks
- [ ] Define tasks

## ❧ Percolator
%% ideas in flight %%

## ❧ Resources 
%% links, contacts %%

## Log



